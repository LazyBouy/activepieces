import { apId, isNil, tryCatch } from '@activepieces/core-utils'
import { OpencodeStepSettings } from '@activepieces/shared'
import { OpencodeClient } from '@opencode-ai/sdk/v2/client'
import { FastifyBaseLogger } from 'fastify'
import { IsNull, Not } from 'typeorm'
import { repoFactory } from '../core/db/repo-factory'
import { projectService } from '../project/project-service'
import { opencodeAllowlist } from './opencode-allowlist'
import { opencodeConnectionService } from './opencode-connection.service'
import { opencodeErrors, OpencodeRequestError } from './opencode-errors'
import { opencodeMcpNames } from './opencode-mcp-names'
import { FLOW_AGENT_NAME, opencodeProvisioning } from './opencode-provisioning'
import { OpencodeRunSessionEntity, OpencodeRunSessionRow } from './opencode-run-session.entity'
import { OpencodeStepEntity, OpencodeStepRow } from './opencode-step.entity'

const runSessionRepo = repoFactory(OpencodeRunSessionEntity)
const stepRepo = repoFactory(OpencodeStepEntity)

export const opencodeSessions = (log: FastifyBaseLogger) => ({
    async locate({ platformId, projectId, settings }: LocateParams): Promise<OpencodeLocation> {
        const connection = await opencodeConnectionService(log).getOrCreate({ platformId })
        if (!isNil(settings?.namespace) && !isNil(settings.project)) {
            if (!opencodeAllowlist.isProjectAllowed({ allowlist: connection.allowlist, namespace: settings.namespace, projectId: settings.project })) {
                throw new Error(opencodeErrors.notAllowlisted({ namespace: settings.namespace, project: settings.project }))
            }
            const directory = await folderOf({ platformId, namespace: settings.namespace, project: settings.project, log })
            return { namespace: settings.namespace, opencodeProjectId: settings.project, directory, agent: settings.agent ?? FLOW_AGENT_NAME }
        }
        const provisioned = await this.provision({ platformId, projectId })
        if (!opencodeAllowlist.isProjectAllowed({ allowlist: connection.allowlist, namespace: provisioned.namespace, projectId: provisioned.opencodeProjectId })) {
            throw new Error(opencodeErrors.notAllowlisted({ namespace: provisioned.namespace, project: provisioned.opencodeProjectId }))
        }
        return {
            namespace: provisioned.namespace,
            opencodeProjectId: provisioned.opencodeProjectId,
            directory: provisioned.directory,
            agent: settings?.agent ?? provisioned.agent,
        }
    },

    async locateSession({ platformId, sessionId, agent }: LocateSessionParams): Promise<OpencodeLocation> {
        const client = await opencodeConnectionService(log).client({ platformId })
        const found = await client.session.get({ sessionID: sessionId })
        if (isNil(found.data)) {
            if (found.response?.status === NOT_FOUND) {
                throw new Error(opencodeErrors.sessionGone({ sessionId }))
            }
            throw new OpencodeRequestError({ status: found.response?.status, message: opencodeErrors.describe({ error: found.error }) })
        }
        const session = found.data
        const connection = await opencodeConnectionService(log).getOrCreate({ platformId })
        const catalog = await opencodeConnectionService(log).catalog({ platformId })
        const owner = catalog.namespaces
            .flatMap((namespace) => namespace.projects.map((project) => ({ namespace: namespace.id, project: project.id, folder: project.folder })))
            .find(({ folder }) => session.directory === folder || session.directory.startsWith(`${folder}/`))
        if (isNil(owner)) {
            throw new Error(catalog.error ?? `The OpenCode session ${sessionId} is not in an OpenCode project Activepieces knows.`)
        }
        if (!opencodeAllowlist.isProjectAllowed({ allowlist: connection.allowlist, namespace: owner.namespace, projectId: owner.project })) {
            throw new Error(opencodeErrors.notAllowlisted({ namespace: owner.namespace, project: owner.project }))
        }
        return { namespace: owner.namespace, opencodeProjectId: owner.project, directory: session.directory, agent: agent ?? session.agent ?? null }
    },

    async provision({ platformId, projectId }: { platformId: string, projectId: string }): Promise<{ namespace: string, opencodeProjectId: string, directory: string, agent: string }> {
        const project = await projectService(log).getOneOrThrow(projectId)
        return opencodeProvisioning(log).ensureProject({ platformId, projectId, projectName: project.displayName })
    },

    async open({ step, client, flowName, pinnedSessionId }: OpenParams): Promise<SessionOutcome> {
        if (!isNil(step.sessionId)) {
            return { kind: 'ready', sessionId: step.sessionId }
        }
        if (!isNil(pinnedSessionId)) {
            const slot = await findOrCreatePinnedSlot({ step, sessionId: pinnedSessionId })
            if (!await claimSlot({ step, slot })) {
                return { kind: 'queued' }
            }
            await stepRepo().update({ id: step.id }, { sessionId: pinnedSessionId })
            return { kind: 'ready', sessionId: pinnedSessionId }
        }
        if (step.sessionMode === 'NEW_PER_STEP') {
            const sessionId = await this.createSession({ step, client, title: stepTitle({ step, flowName }), metadata: stepMetadata({ step }) })
            await stepRepo().update({ id: step.id }, { sessionId })
            return { kind: 'ready', sessionId }
        }
        const runSession = await findOrCreateRunSession({ step })
        if (!await claimSlot({ step, slot: runSession })) {
            return { kind: 'queued' }
        }
        const sessionId = runSession.sessionId ?? await this.startRunSession({ step, client, runSession, flowName })
        await stepRepo().update({ id: step.id }, { sessionId })
        return { kind: 'ready', sessionId }
    },

    async startRunSession({ step, client, runSession, flowName }: OpenParams & { runSession: OpencodeRunSessionRow }): Promise<string> {
        const created = await this.createSession({ step, client, title: runTitle({ step, flowName }), metadata: runMetadata({ step }) })
        await runSessionRepo().update({ id: runSession.id, sessionId: IsNull() }, { sessionId: created })
        const stored = await runSessionRepo().findOneByOrFail({ id: runSession.id })
        if (!isNil(stored.sessionId) && stored.sessionId !== created) {
            await tryCatch(() => client.session.delete({ sessionID: created, directory: step.directory ?? undefined }))
            return stored.sessionId
        }
        return created
    },

    async createSession({ step, client, title, metadata }: CreateSessionParams): Promise<string> {
        const result = await client.session.create({
            directory: step.directory ?? undefined,
            title,
            agent: step.agent ?? undefined,
            metadata,
            permission: [opencodeMcpNames.denyAllLine()],
        })
        if (isNil(result.data)) {
            throw new OpencodeRequestError({ status: result.response?.status, message: opencodeErrors.describe({ error: result.error }) })
        }
        return result.data.id
    },

    async release({ step }: { step: OpencodeStepRow }): Promise<string | null> {
        if (isNil(step.runSessionId)) {
            return null
        }
        await runSessionRepo().update({ id: step.runSessionId, activeStepId: step.id }, { activeStepId: null })
        const next = await stepRepo().findOne({
            where: { runSessionId: step.runSessionId, status: 'QUEUED' },
            order: { created: 'ASC' },
        })
        return next?.id ?? null
    },

    async releaseStale({ limit }: { limit: number }): Promise<string[]> {
        const held = await runSessionRepo().createQueryBuilder('runSession')
            .innerJoin('opencode_step', 'step', '"step"."id" = "runSession"."activeStepId"')
            .where('"step"."status" IN (:...terminal)', { terminal: TERMINAL_STATUSES })
            .limit(limit)
            .getMany()
        const nextSteps = await Promise.all(held.flatMap(({ id, activeStepId }) => isNil(activeStepId) ? [] : [{ id, activeStepId }]).map(async ({ id, activeStepId }) => {
            await runSessionRepo().update({ id, activeStepId }, { activeStepId: null })
            const next = await stepRepo().findOne({ where: { runSessionId: id, status: 'QUEUED' }, order: { created: 'ASC' } })
            return next?.id ?? null
        }))
        return nextSteps.filter((id): id is string => !isNil(id))
    },

    async abort({ step, client }: { step: OpencodeStepRow, client: OpencodeClient }): Promise<void> {
        const sessionId = step.sessionId
        if (isNil(sessionId)) {
            return
        }
        if (!isNil(step.runSessionId)) {
            const runSession = await runSessionRepo().findOneBy({ id: step.runSessionId })
            if (runSession?.activeStepId !== step.id) {
                return
            }
        }
        const { error } = await tryCatch(() => client.session.abort({ sessionID: sessionId, directory: step.directory ?? undefined }))
        if (!isNil(error)) {
            log.warn({ opencodeStep: { id: step.id }, error }, '[opencodeSessions#abort] Could not abort the OpenCode session')
        }
    },

})

async function findOrCreateRunSession({ step }: { step: OpencodeStepRow }): Promise<OpencodeRunSessionRow> {
    const location = {
        flowRunId: step.flowRunId,
        namespace: step.namespace ?? '',
        opencodeProjectId: step.opencodeProjectId ?? '',
        agent: step.agent ?? FLOW_AGENT_NAME,
    }
    await runSessionRepo().createQueryBuilder()
        .insert()
        .values({ id: apId(), platformId: step.platformId, projectId: step.projectId, ...location, sessionId: null, activeStepId: null })
        .orIgnore()
        .execute()
    return runSessionRepo().findOneByOrFail({ projectId: step.projectId, ...location })
}

async function findOrCreatePinnedSlot({ step, sessionId }: { step: OpencodeStepRow, sessionId: string }): Promise<OpencodeRunSessionRow> {
    await runSessionRepo().createQueryBuilder()
        .insert()
        .values({
            id: apId(),
            platformId: step.platformId,
            projectId: step.projectId,
            flowRunId: null,
            namespace: step.namespace ?? '',
            opencodeProjectId: step.opencodeProjectId ?? '',
            agent: step.agent ?? '',
            sessionId,
            activeStepId: null,
        })
        .orIgnore()
        .execute()
    return runSessionRepo().findOneByOrFail({ platformId: step.platformId, sessionId, flowRunId: IsNull() })
}

async function claimSlot({ step, slot }: { step: OpencodeStepRow, slot: OpencodeRunSessionRow }): Promise<boolean> {
    await stepRepo().update({ id: step.id }, { runSessionId: slot.id })
    const claimed = await runSessionRepo().createQueryBuilder()
        .update()
        .set({ activeStepId: step.id })
        .where('id = :id AND ("activeStepId" IS NULL OR "activeStepId" = :stepId)', { id: slot.id, stepId: step.id })
        .returning(['id'])
        .execute()
    if (!Array.isArray(claimed.raw) || claimed.raw.length === 0) {
        return false
    }
    if (isNil(slot.sessionId) || !await busyElsewhere({ slot, sessionId: slot.sessionId, stepId: step.id })) {
        return true
    }
    await runSessionRepo().update({ id: slot.id, activeStepId: step.id }, { activeStepId: null })
    return false
}

async function busyElsewhere({ slot, sessionId, stepId }: { slot: OpencodeRunSessionRow, sessionId: string, stepId: string }): Promise<boolean> {
    const holders = await runSessionRepo().findBy({ platformId: slot.platformId, sessionId, activeStepId: Not(IsNull()) })
    return holders.some((holder) => holder.id !== slot.id && holder.activeStepId !== stepId)
}

async function folderOf({ platformId, namespace, project, log }: { platformId: string, namespace: string, project: string, log: FastifyBaseLogger }): Promise<string> {
    const catalog = await opencodeConnectionService(log).catalog({ platformId })
    const folder = catalog.namespaces.find((candidate) => candidate.id === namespace)?.projects.find((candidate) => candidate.id === project)?.folder
    if (isNil(folder)) {
        throw new Error(catalog.error ?? `OpenCode has no project ${namespace}/${project}.`)
    }
    return folder
}

function stepTitle({ step, flowName }: { step: OpencodeStepRow, flowName: string | null }): string {
    return [flowName ?? step.flowId, `run ${step.flowRunId}`, ...(isNil(step.stepName) ? [] : [step.stepName])].join(' · ')
}

function runTitle({ step, flowName }: { step: OpencodeStepRow, flowName: string | null }): string {
    return [flowName ?? step.flowId, `run ${step.flowRunId}`].join(' · ')
}

function stepMetadata({ step }: { step: OpencodeStepRow }): Record<string, string> {
    return {
        ...runMetadata({ step }),
        ...(isNil(step.stepName) ? {} : { stepName: step.stepName }),
    }
}

function runMetadata({ step }: { step: OpencodeStepRow }): Record<string, string> {
    return {
        source: SESSION_SOURCE,
        platformId: step.platformId,
        projectId: step.projectId,
        flowId: step.flowId,
        flowRunId: step.flowRunId,
        ...(isNil(step.flowVersionId) ? {} : { flowVersionId: step.flowVersionId }),
    }
}

const SESSION_SOURCE = 'iphi-flow'

const TERMINAL_STATUSES = ['COMPLETED', 'FAILED']

const NOT_FOUND = 404

export type OpencodeLocation = {
    namespace: string
    opencodeProjectId: string
    directory: string
    agent: string | null
}

export type SessionOutcome =
    | { kind: 'ready', sessionId: string }
    | { kind: 'queued' }

type LocateParams = {
    platformId: string
    projectId: string
    settings: OpencodeStepSettings | undefined
}

type LocateSessionParams = {
    platformId: string
    sessionId: string
    agent: string | null
}

type OpenParams = {
    step: OpencodeStepRow
    client: OpencodeClient
    flowName: string | null
    pinnedSessionId?: string
}

type CreateSessionParams = {
    step: OpencodeStepRow
    client: OpencodeClient
    title: string
    metadata: Record<string, string>
}
