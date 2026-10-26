import { apId, isNil, tryCatch } from '@activepieces/core-utils'
import { OpencodeStepSettings } from '@activepieces/shared'
import { OpencodeClient } from '@opencode-ai/sdk/v2/client'
import { FastifyBaseLogger } from 'fastify'
import { IsNull } from 'typeorm'
import { repoFactory } from '../core/db/repo-factory'
import { projectService } from '../project/project-service'
import { opencodeAllowlist } from './opencode-allowlist'
import { opencodeConnectionService } from './opencode-connection.service'
import { opencodeErrors, OpencodeRequestError } from './opencode-errors'
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

    async provision({ platformId, projectId }: { platformId: string, projectId: string }): Promise<{ namespace: string, opencodeProjectId: string, directory: string, agent: string }> {
        const project = await projectService(log).getOneOrThrow(projectId)
        return opencodeProvisioning(log).ensureProject({ platformId, projectId, projectName: project.displayName })
    },

    async open({ step, client, flowName }: OpenParams): Promise<SessionOutcome> {
        if (!isNil(step.sessionId)) {
            return { kind: 'ready', sessionId: step.sessionId }
        }
        if (step.sessionMode === 'NEW_PER_STEP') {
            const sessionId = await this.createSession({ step, client, title: stepTitle({ step, flowName }), metadata: stepMetadata({ step }) })
            await stepRepo().update({ id: step.id }, { sessionId })
            return { kind: 'ready', sessionId }
        }
        const runSession = await findOrCreateRunSession({ step })
        await stepRepo().update({ id: step.id }, { runSessionId: runSession.id })
        const claimed = await runSessionRepo().createQueryBuilder()
            .update()
            .set({ activeStepId: step.id })
            .where('id = :id AND ("activeStepId" IS NULL OR "activeStepId" = :stepId)', { id: runSession.id, stepId: step.id })
            .returning(['id'])
            .execute()
        const ownsSlot = Array.isArray(claimed.raw) && claimed.raw.length > 0
        if (!ownsSlot) {
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

export type OpencodeLocation = {
    namespace: string
    opencodeProjectId: string
    directory: string
    agent: string
}

export type SessionOutcome =
    | { kind: 'ready', sessionId: string }
    | { kind: 'queued' }

type LocateParams = {
    platformId: string
    projectId: string
    settings: OpencodeStepSettings | undefined
}

type OpenParams = {
    step: OpencodeStepRow
    client: OpencodeClient
    flowName: string | null
}

type CreateSessionParams = {
    step: OpencodeStepRow
    client: OpencodeClient
    title: string
    metadata: Record<string, string>
}
