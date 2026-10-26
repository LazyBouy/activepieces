import path from 'node:path'
import { apId, isNil, tryCatch } from '@activepieces/core-utils'
import { OPENCODE_DEFAULT_NAMESPACE } from '@activepieces/shared'
import { OpencodeClient, OperatorNamespaceSummary, PermissionRuleset } from '@opencode-ai/sdk/v2/client'
import { FastifyBaseLogger } from 'fastify'
import { repoFactory } from '../core/db/repo-factory'
import { distributedLock } from '../database/redis-connections'
import { opencodeConnectionService } from './opencode-connection.service'
import { opencodeErrors } from './opencode-errors'
import { OpencodeProjectLinkEntity } from './opencode-project-link.entity'

const linkRepo = repoFactory(OpencodeProjectLinkEntity)

export const opencodeProvisioning = (log: FastifyBaseLogger) => ({
    async ensureProject({ platformId, projectId, projectName }: EnsureProjectParams): Promise<ProvisionedProject> {
        const connection = await opencodeConnectionService(log).getOrCreate({ platformId })
        const cacheKey = `${platformId}:${projectId}`
        const version = `${connection.updated}|${connection.projectsFolder ?? ''}`
        const cached = provisionedCache.get(cacheKey)
        if (!isNil(cached) && cached.version === version && cached.expiresAt > Date.now()) {
            return cached.project
        }
        const client = await opencodeConnectionService(log).client({ platformId })
        const { data: project, error } = await tryCatch(() => distributedLock(log).runExclusive({
            key: `opencode_provisioning_${platformId}`,
            timeoutInSeconds: PROVISIONING_LOCK_TIMEOUT_SECONDS,
            fn: () => provision({ client, platformId, projectId, projectName, projectsFolder: connection.projectsFolder, log }),
        }))
        if (isNil(project)) {
            throw new Error(`Could not prepare the OpenCode project for this step: ${opencodeErrors.describe({ error })}`)
        }
        provisionedCache.set(cacheKey, { version, project, expiresAt: Date.now() + PROVISIONED_CACHE_TTL_MS })
        return project
    },

    invalidate({ platformId, projectId }: { platformId: string, projectId: string }): void {
        provisionedCache.delete(`${platformId}:${projectId}`)
    },

    async waitForReload({ directory }: { directory: string }): Promise<void> {
        const wait = (reloadUntil.get(directory) ?? 0) - Date.now()
        if (wait <= 0) {
            reloadUntil.delete(directory)
            return
        }
        await new Promise((resolve) => setTimeout(resolve, wait))
    },
})

async function provision({ client, platformId, projectId, projectName, projectsFolder, log }: ProvisionParams): Promise<ProvisionedProject> {
    const { summary: namespace, created: namespaceCreated } = await ensureNamespace({ client })
    const folder = projectsFolder ?? namespace.namespace.folder ?? namespace.target
    const directory = path.posix.join(folder, projectId)
    const { opencodeProjectId, registered } = await ensureRegistered({ client, directory, namespace: namespace.namespace.id, projectName, log })
    const agentCreated = await ensureFlowAgent({ client, directory })
    if (namespaceCreated || registered || agentCreated) {
        reloadUntil.set(directory, Date.now() + RELOAD_SETTLE_MS)
    }
    await linkRepo().upsert({
        id: apId(),
        platformId,
        projectId,
        namespace: namespace.namespace.id,
        directory,
        opencodeProjectId,
    }, ['projectId'])
    return { namespace: namespace.namespace.id, directory, opencodeProjectId, agent: FLOW_AGENT_NAME }
}

async function ensureNamespace({ client }: { client: OpencodeClient }): Promise<{ summary: OperatorNamespaceSummary, created: boolean }> {
    const existing = await findNamespace({ client })
    if (!isNil(existing)) {
        return { summary: existing, created: false }
    }
    const { error } = await tryCatch(() => client.operator.namespace.create({ name: OPENCODE_DEFAULT_NAMESPACE, purpose: NAMESPACE_PURPOSE }, { throwOnError: true }))
    if (!isNil(error)) {
        if (!opencodeErrors.describe({ error }).includes('already exists')) {
            throw error
        }
        await client.operator.namespace.create({ name: OPENCODE_DEFAULT_NAMESPACE, purpose: NAMESPACE_PURPOSE, adopt: true }, { throwOnError: true })
    }
    const created = await findNamespace({ client })
    if (isNil(created)) {
        throw new Error(`OpenCode did not list the namespace ${OPENCODE_DEFAULT_NAMESPACE} after creating it`)
    }
    return { summary: created, created: true }
}

async function findNamespace({ client }: { client: OpencodeClient }): Promise<OperatorNamespaceSummary | undefined> {
    const { data } = await client.operator.namespace.list({ throwOnError: true })
    return data.find((summary) => summary.namespace.id === OPENCODE_DEFAULT_NAMESPACE)
}

async function ensureRegistered({ client, directory, namespace, projectName, log }: EnsureRegisteredParams): Promise<{ opencodeProjectId: string, registered: boolean }> {
    const { data: resolved } = await client.operator.projectSettings.resolve({ directory }, { throwOnError: true })
    if (!isNil(resolved.project) && resolved.project.key !== directory) {
        throw new Error(`${directory} is inside the OpenCode project ${resolved.project.key}`)
    }
    if (isNil(resolved.project)) {
        const hasGit = await isGitRepository({ client, directory })
        await waitForGitSpacing()
        const { data: registered } = await client.operator.projectSettings.register({ directory, namespace, git: !hasGit }, { throwOnError: true })
        lastRegisteredAt = Date.now()
        await describeProject({ client, directory, projectName, log })
        return { opencodeProjectId: registered.project.id, registered: true }
    }
    const { data: projects } = await client.operator.projectSettings.list({ throwOnError: true })
    const project = projects.find((candidate) => candidate.key === directory)
    if (isNil(project)) {
        throw new Error(`OpenCode resolved ${directory} as a project but did not list it`)
    }
    return { opencodeProjectId: project.id, registered: false }
}

async function isGitRepository({ client, directory }: { client: OpencodeClient, directory: string }): Promise<boolean> {
    const { data } = await tryCatch(() => client.operator.folder.list({ path: directory }, { throwOnError: true }))
    return data?.data.project ?? false
}

async function describeProject({ client, directory, projectName, log }: DescribeProjectParams): Promise<void> {
    const { error } = await tryCatch(() => client.operator.projectRecord.update({ key: directory, description: `Activepieces project "${projectName}"` }, { throwOnError: true }))
    if (!isNil(error)) {
        log.warn({ error, opencode: { directory } }, '[opencodeProvisioning] could not set the project description')
    }
}

async function ensureFlowAgent({ client, directory }: { client: OpencodeClient, directory: string }): Promise<boolean> {
    const { data: agents } = await client.operator.agent.list({ directory }, { throwOnError: true })
    if (agents.some((agent) => agent.name === FLOW_AGENT_NAME)) {
        return false
    }
    await client.operator.agent.create({ directory, scope: 'project', name: FLOW_AGENT_NAME, mode: 'primary', description: FLOW_AGENT_DESCRIPTION }, { throwOnError: true })
    await client.operator.agentPermissions.save({ name: FLOW_AGENT_NAME, directory, scope: 'project', rules: FLOW_AGENT_RULES }, { throwOnError: true })
    const { data: prompt } = await client.operator.agentPrompt.get({ name: FLOW_AGENT_NAME, directory }, { throwOnError: true })
    await client.operator.agentPrompt.update({
        name: FLOW_AGENT_NAME,
        directory,
        profile: prompt.default.id,
        override: {
            slots: { role: [`agent:${FLOW_LAYER_ID}`] },
            layers: { [FLOW_LAYER_ID]: { type: 'role', text: FLOW_LAYER_TEXT } },
        },
    }, { throwOnError: true })
    return true
}

async function waitForGitSpacing(): Promise<void> {
    const wait = lastRegisteredAt + GIT_INIT_SPACING_MS - Date.now()
    if (wait > 0) {
        await new Promise((resolve) => setTimeout(resolve, wait))
    }
}

let lastRegisteredAt = 0

const reloadUntil = new Map<string, number>()

const RELOAD_SETTLE_MS = 1500

const provisionedCache = new Map<string, { version: string, project: ProvisionedProject, expiresAt: number }>()

const PROVISIONING_LOCK_TIMEOUT_SECONDS = 120

const PROVISIONED_CACHE_TTL_MS = 5 * 60 * 1000

const GIT_INIT_SPACING_MS = 1100

const NAMESPACE_PURPOSE = 'Projects that Activepieces creates for the AI steps of its flows. Each project belongs to one Activepieces project.'

const FLOW_AGENT_DESCRIPTION = 'Runs the AI steps of Activepieces flows'

const FLOW_LAYER_ID = 'activepieces-step'

const FLOW_LAYER_TEXT = 'You are running inside an Activepieces automation step. Do the task in the user message and finish with the result only. Files you create for the flow go in the folder named in the message.'

const FLOW_AGENT_RULES: PermissionRuleset = [
    { permission: 'read', pattern: '*', action: 'allow' },
    { permission: 'edit', pattern: '*', action: 'allow' },
    { permission: 'glob', pattern: '*', action: 'allow' },
    { permission: 'grep', pattern: '*', action: 'allow' },
    { permission: 'webfetch', pattern: '*', action: 'allow' },
    { permission: 'websearch', pattern: '*', action: 'allow' },
    { permission: 'bash', pattern: '*', action: 'ask' },
    { permission: 'external_directory', pattern: '*', action: 'ask' },
    { permission: 'question', pattern: '*', action: 'deny' },
]

export const FLOW_AGENT_NAME = 'flow'

export type ProvisionedProject = {
    namespace: string
    directory: string
    opencodeProjectId: string
    agent: string
}

type EnsureProjectParams = {
    platformId: string
    projectId: string
    projectName: string
}

type ProvisionParams = EnsureProjectParams & {
    client: OpencodeClient
    projectsFolder: string | null
    log: FastifyBaseLogger
}

type EnsureRegisteredParams = {
    client: OpencodeClient
    directory: string
    namespace: string
    projectName: string
    log: FastifyBaseLogger
}

type DescribeProjectParams = {
    client: OpencodeClient
    directory: string
    projectName: string
    log: FastifyBaseLogger
}
