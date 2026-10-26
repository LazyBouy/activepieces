import { isNil, tryCatch } from '@activepieces/core-utils'
import { OPENCODE_DEFAULT_NAMESPACE, OpencodeAgentList, OpencodeProjectOptions } from '@activepieces/shared'
import { FastifyBaseLogger } from 'fastify'
import { repoFactory } from '../core/db/repo-factory'
import { opencodeAllowlist } from './opencode-allowlist'
import { opencodeConnectionService } from './opencode-connection.service'
import { opencodeErrors } from './opencode-errors'
import { OpencodeProjectLinkEntity } from './opencode-project-link.entity'
import { FLOW_AGENT_NAME } from './opencode-provisioning'

const linkRepo = repoFactory(OpencodeProjectLinkEntity)

export const opencodeOptionsService = (log: FastifyBaseLogger) => ({
    async options({ platformId, projectId }: ProjectParams): Promise<OpencodeProjectOptions> {
        const connection = await opencodeConnectionService(log).getOrCreate({ platformId })
        const link = await linkRepo().findOneBy({ projectId })
        const defaultLocation = {
            namespace: link?.namespace ?? OPENCODE_DEFAULT_NAMESPACE,
            project: link?.opencodeProjectId ?? null,
            agent: FLOW_AGENT_NAME,
        }
        if (!connection.enabled) {
            return { enabled: false, adminPanelUrl: connection.adminPanelUrl, namespaces: [], defaultLocation }
        }
        const catalog = await opencodeConnectionService(log).catalog({ platformId })
        const allowed = opencodeAllowlist.filterCatalog({ allowlist: connection.allowlist, catalog })
        return {
            enabled: true,
            adminPanelUrl: connection.adminPanelUrl,
            namespaces: allowed.namespaces,
            defaultLocation,
            ...(isNil(catalog.error) ? {} : { error: catalog.error }),
        }
    },

    async locate({ platformId, projectId, namespace, project }: ListAgentsParams): Promise<OpencodeLocated> {
        const connection = await opencodeConnectionService(log).getOrCreate({ platformId })
        const target = await resolveTarget({ projectId, namespace, project })
        if (isNil(target)) {
            return { kind: 'none' }
        }
        if (!opencodeAllowlist.isProjectAllowed({ allowlist: connection.allowlist, namespace: target.namespace, projectId: target.project })) {
            return { kind: 'error', error: opencodeErrors.notAllowlisted({ namespace: target.namespace, project: target.project }) }
        }
        const catalog = await opencodeConnectionService(log).catalog({ platformId })
        const found = catalog.namespaces.find((candidate) => candidate.id === target.namespace)?.projects.find((candidate) => candidate.id === target.project)
        if (isNil(found)) {
            return { kind: 'error', error: catalog.error ?? `OpenCode has no project ${target.namespace}/${target.project}.` }
        }
        return { kind: 'found', namespace: target.namespace, project: target.project, name: found.name, directory: found.folder, adminPanelUrl: connection.adminPanelUrl }
    },

    async agents({ platformId, projectId, namespace, project }: ListAgentsParams): Promise<OpencodeAgentList> {
        const located = await this.locate({ platformId, projectId, namespace, project })
        if (located.kind === 'none') {
            return { agents: [] }
        }
        if (located.kind === 'error') {
            return { agents: [], error: located.error }
        }
        const directory = located.directory
        const client = await opencodeConnectionService(log).client({ platformId })
        const { data: result, error } = await tryCatch(() => client.operator.agent.list({ directory }, { throwOnError: true }))
        if (isNil(result)) {
            return { agents: [], error: opencodeErrors.describe({ error }) }
        }
        return {
            agents: result.data
                .filter((agent) => agent.mode !== 'subagent' && agent.hidden !== true && !agent.disabled)
                .map((agent) => ({ name: agent.name, mode: agent.mode, ...(isNil(agent.description) ? {} : { description: agent.description }) })),
        }
    },
})

async function resolveTarget({ projectId, namespace, project }: { projectId: string, namespace?: string, project?: string }): Promise<{ namespace: string, project: string } | null> {
    if (!isNil(namespace) && !isNil(project)) {
        return { namespace, project }
    }
    const link = await linkRepo().findOneBy({ projectId })
    if (isNil(link)) {
        return null
    }
    return { namespace: link.namespace, project: link.opencodeProjectId }
}

export type OpencodeLocated =
    | { kind: 'none' }
    | { kind: 'error', error: string }
    | { kind: 'found', namespace: string, project: string, name: string, directory: string, adminPanelUrl: string }

type ProjectParams = {
    platformId: string
    projectId: string
}

type ListAgentsParams = ProjectParams & {
    namespace?: string
    project?: string
}
