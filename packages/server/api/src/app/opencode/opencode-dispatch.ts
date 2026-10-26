import { AiStepAction, apId, isNil, tryCatch } from '@activepieces/core-utils'
import { FileType, opencodeStepUtil } from '@activepieces/shared'
import { OpencodeClient } from '@opencode-ai/sdk/v2/client'
import { isAxiosError } from 'axios'
import { FastifyBaseLogger } from 'fastify'
import { repoFactory } from '../core/db/repo-factory'
import { distributedLock } from '../database/redis-connections'
import { fileService } from '../file/file.service'
import { rejectedPromiseHandler } from '../helper/promise-handler'
import { OPENCODE_RUN_AGENT, opencodeAgentPrompt } from './opencode-agent-prompt'
import { opencodeCompletion } from './opencode-completion'
import { opencodeConnectionService } from './opencode-connection.service'
import { opencodeErrors, OpencodeRequestError, OpencodeToolsError } from './opencode-errors'
import { opencodeIds } from './opencode-ids'
import { opencodeMcpBridge } from './opencode-mcp-bridge'
import { opencodeModelKeys } from './opencode-models'
import { BuiltPrompt, OpencodeAiRequest, OpencodeInputFile, opencodePrompts } from './opencode-prompts'
import { opencodeProvisioning } from './opencode-provisioning'
import { opencodeSessions, SessionOutcome } from './opencode-sessions'
import { opencodeStepContext } from './opencode-step-context'
import { OpencodeStepEntity, OpencodeStepRow, OpencodeStepStatus } from './opencode-step.entity'
import { OpencodeStepRequest, OpencodeStoredRequest } from './opencode-stored-request'

const stepRepo = repoFactory(OpencodeStepEntity)

export const opencodeDispatch = (log: FastifyBaseLogger) => ({
    async start({ platformId, projectId, requestId, webserverId, call }: StartParams): Promise<OpencodeStepRow> {
        const existing = isNil(call.waitpointId) ? null : await stepRepo().findOneBy({ waitpointId: call.waitpointId, projectId })
        const step = existing ?? await createStep({ platformId, projectId, requestId, webserverId, call, log })
        await this.dispatch({ stepId: step.id })
        return stepRepo().findOneByOrFail({ id: step.id })
    },

    async dispatch({ stepId }: { stepId: string }): Promise<void> {
        await distributedLock(log).runExclusive({
            key: `opencode_step_${stepId}`,
            timeoutInSeconds: DISPATCH_LOCK_TIMEOUT_SECONDS,
            fn: async () => {
                const step = await stepRepo().findOneBy({ id: stepId })
                if (isNil(step) || !DISPATCHABLE.includes(step.status)) {
                    return
                }
                const { error } = await tryCatch(() => dispatchStep({ step, log }))
                if (!isNil(error)) {
                    log.warn({ opencodeStep: { id: step.id }, flowRun: { id: step.flowRunId }, error }, '[opencodeDispatch] Could not send the step to OpenCode')
                    const { nextStepId } = await opencodeCompletion(log).fail({ stepId: step.id, failure: await failureOf({ error, step, log }) })
                    this.dispatchLater({ stepId: nextStepId })
                }
            },
        })
    },

    dispatchLater({ stepId }: { stepId: string | null }): void {
        if (isNil(stepId)) {
            return
        }
        rejectedPromiseHandler(this.dispatch({ stepId }), log)
    },
})

async function createStep({ platformId, projectId, requestId, webserverId, call, log }: CreateStepParams): Promise<OpencodeStepRow> {
    const context = await opencodeStepContext.resolve({ projectId, flowRunId: call.flowRunId, waitpointId: call.waitpointId, log })
    const stored: OpencodeStoredRequest = { request: call.request, flowName: context.flowName, settings: context.settings ?? null }
    const draft: OpencodeStepRow = {
        id: apId(),
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        platformId,
        projectId,
        flowId: call.flowId,
        flowRunId: call.flowRunId,
        flowVersionId: context.flowVersionId,
        stepName: context.stepName,
        waitpointId: call.waitpointId ?? null,
        requestId,
        webserverId: webserverId ?? null,
        action: call.request.action,
        request: stored,
        sessionMode: context.settings?.sessionMode ?? opencodeStepUtil.resolveFlowSessionMode({ defaults: context.defaults }),
        namespace: null,
        opencodeProjectId: null,
        directory: null,
        agent: null,
        model: opencodeModelKeys.resolveModel({ providerConfigId: call.request.providerConfigId, modelId: call.request.modelId }),
        runSessionId: null,
        sessionId: null,
        messageId: opencodeIds.message(),
        status: 'PENDING',
        failure: null,
        dispatchedAt: null,
        completedAt: null,
    }
    const { data: saved } = await tryCatch(() => stepRepo().save(draft))
    if (!isNil(saved) || isNil(draft.waitpointId)) {
        return stepRepo().findOneByOrFail({ id: draft.id })
    }
    return stepRepo().findOneByOrFail({ waitpointId: draft.waitpointId, projectId })
}

async function dispatchStep({ step, log }: { step: OpencodeStepRow, log: FastifyBaseLogger }): Promise<void> {
    const stored = OpencodeStoredRequest.parse(step.request)
    const client = await opencodeConnectionService(log).client({ platformId: step.platformId })
    const located = await locateOnce({ step, stored, log })
    await opencodeProvisioning(log).waitForReload({ directory: located.directory ?? '' })
    const outcome = await openWithRetry({ step: located, stored, client, log })
    if (outcome.kind === 'queued') {
        await stepRepo().update({ id: step.id }, { status: 'QUEUED' })
        return
    }
    const ready = { ...located, sessionId: outcome.sessionId }
    if (await alreadySent({ step: ready, client })) {
        await markDispatched({ step: ready })
        return
    }
    if (stored.request.action === OPENCODE_RUN_AGENT) {
        await opencodeMcpBridge(log).attach({ step: ready, client, tools: stored.request.tools ?? [] })
    }
    const prompt = await promptOf({ step: ready, request: stored.request, log })
    const sent = await client.session.promptAsync({
        sessionID: outcome.sessionId,
        directory: ready.directory ?? undefined,
        messageID: ready.messageId,
        agent: ready.agent ?? undefined,
        ...(isNil(ready.model) ? {} : { model: ready.model }),
        ...(isNil(prompt.format) ? {} : { format: prompt.format }),
        parts: prompt.parts,
    })
    if (!isNil(sent.error)) {
        throw new OpencodeRequestError({ status: sent.response?.status, message: opencodeErrors.describe({ error: sent.error }) })
    }
    await markDispatched({ step: ready })
}

async function locateOnce({ step, stored, log }: { step: OpencodeStepRow, stored: OpencodeStoredRequest, log: FastifyBaseLogger }): Promise<OpencodeStepRow> {
    if (!isNil(step.directory)) {
        return step
    }
    const location = await opencodeSessions(log).locate({ platformId: step.platformId, projectId: step.projectId, settings: stored.settings ?? undefined })
    const located = {
        namespace: location.namespace,
        opencodeProjectId: location.opencodeProjectId,
        directory: location.directory,
        agent: location.agent,
    }
    await stepRepo().update({ id: step.id }, located)
    return { ...step, ...located }
}

async function openWithRetry({ step, stored, client, log }: OpenWithRetryParams): Promise<SessionOutcome> {
    const first = await tryCatch(() => opencodeSessions(log).open({ step, client, flowName: stored.flowName }))
    if (!isNil(first.data)) {
        return first.data
    }
    if (!isGuardRefusal({ error: first.error }) || !isNil(stored.settings?.project)) {
        throw first.error
    }
    opencodeProvisioning(log).invalidate({ platformId: step.platformId, projectId: step.projectId })
    await opencodeSessions(log).provision({ platformId: step.platformId, projectId: step.projectId })
    const retried = await tryCatch(() => opencodeSessions(log).open({ step, client, flowName: stored.flowName }))
    if (isNil(retried.data)) {
        throw new Error(`Could not prepare the OpenCode project for this step: ${opencodeErrors.describe({ error: retried.error })}`)
    }
    return retried.data
}

async function alreadySent({ step, client }: { step: OpencodeStepRow, client: OpencodeClient }): Promise<boolean> {
    if (isNil(step.sessionId)) {
        return false
    }
    const found = await client.session.message({ sessionID: step.sessionId, messageID: step.messageId, directory: step.directory ?? undefined })
    return !isNil(found.data)
}

async function markDispatched({ step }: { step: OpencodeStepRow }): Promise<void> {
    await stepRepo().update({ id: step.id }, { status: 'DISPATCHED', sessionId: step.sessionId, dispatchedAt: new Date().toISOString() })
}

async function promptOf({ step, request, log }: { step: OpencodeStepRow, request: OpencodeStepRequest, log: FastifyBaseLogger }): Promise<BuiltPrompt> {
    if (request.action === OPENCODE_RUN_AGENT) {
        return opencodeAgentPrompt.build({ request })
    }
    const files = await readInputFiles({ step, request, log })
    return opencodePrompts.build({ request, files })
}

async function readInputFiles({ step, request, log }: { step: OpencodeStepRow, request: OpencodeAiRequest, log: FastifyBaseLogger }): Promise<OpencodeInputFile[]> {
    if (request.action !== AiStepAction.EXTRACT_STRUCTURED_DATA) {
        return []
    }
    return Promise.all((request.files ?? []).map(async (file) => {
        const stored = await fileService(log).getDataOrThrow({ projectId: step.projectId, platformId: step.platformId, fileId: file.fileId, type: FileType.FLOW_STEP_FILE })
        const filename = file.filename ?? stored.fileName
        return {
            mime: file.mimeType ?? mimeTypeOf({ metadata: stored.metadata }) ?? DEFAULT_MIME,
            base64: stored.data.toString('base64'),
            ...(isNil(filename) ? {} : { filename }),
        }
    }))
}

function mimeTypeOf({ metadata }: { metadata: Record<string, unknown> | null | undefined }): string | undefined {
    const value = metadata?.['mimeType']
    return typeof value === 'string' ? value : undefined
}

async function failureOf({ error, step, log }: { error: unknown, step: OpencodeStepRow, log: FastifyBaseLogger }): Promise<string> {
    if (isAxiosError(error)) {
        const connection = await opencodeConnectionService(log).getOrCreate({ platformId: step.platformId })
        return opencodeErrors.unreachable({ serverUrl: connection.serverUrl, error })
    }
    if (error instanceof OpencodeToolsError) {
        return error.message
    }
    if (error instanceof OpencodeRequestError) {
        return opencodeErrors.sessionError({ message: error.message })
    }
    return opencodeErrors.describe({ error })
}

function isGuardRefusal({ error }: { error: unknown }): boolean {
    return error instanceof OpencodeRequestError && (error.status === 409 || error.status === 403)
}

const DISPATCHABLE: OpencodeStepStatus[] = ['PENDING', 'QUEUED']

const DISPATCH_LOCK_TIMEOUT_SECONDS = 120

const DEFAULT_MIME = 'application/octet-stream'

export type OpencodeAiCall = {
    flowId: string
    flowRunId: string
    waitpointId?: string
    request: OpencodeStepRequest
}

type StartParams = {
    platformId: string
    projectId: string
    requestId: string
    webserverId?: string
    call: OpencodeAiCall
}

type CreateStepParams = StartParams & {
    log: FastifyBaseLogger
}

type OpenWithRetryParams = {
    step: OpencodeStepRow
    stored: OpencodeStoredRequest
    client: OpencodeClient
    log: FastifyBaseLogger
}
