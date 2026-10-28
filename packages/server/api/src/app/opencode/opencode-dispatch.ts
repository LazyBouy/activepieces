import { AiStepAction, apId, isNil, tryCatch } from '@activepieces/core-utils'
import { OpencodeStepSettings, opencodeStepUtil } from '@activepieces/shared'
import { OpencodeClient } from '@opencode-ai/sdk/v2/client'
import { isAxiosError } from 'axios'
import { FastifyBaseLogger } from 'fastify'
import { repoFactory } from '../core/db/repo-factory'
import { distributedLock } from '../database/redis-connections'
import { rejectedPromiseHandler } from '../helper/promise-handler'
import { OPENCODE_RUN_AGENT, opencodeAgentPrompt } from './opencode-agent-prompt'
import { ChannelReference, opencodeChannels } from './opencode-channels'
import { opencodeCompletion } from './opencode-completion'
import { opencodeConnectionService } from './opencode-connection.service'
import { opencodeErrors, OpencodeRequestError, OpencodeToolsError } from './opencode-errors'
import { opencodeFilesIn } from './opencode-files-in'
import { opencodeOutputFolder } from './opencode-files-out'
import { opencodeIds } from './opencode-ids'
import { opencodeInbox } from './opencode-inbox'
import { opencodeMcpBridge } from './opencode-mcp-bridge'
import { opencodeModelKeys } from './opencode-models'
import { OPENCODE_PIECE_ACTION, OpencodePieceRequest, opencodePieceSteps, PinnedSession } from './opencode-piece-steps'
import { BuiltPrompt, opencodePrompts } from './opencode-prompts'
import { opencodeProvisioning } from './opencode-provisioning'
import { opencodeSessions, SessionOutcome } from './opencode-sessions'
import { opencodeStepContext } from './opencode-step-context'
import { OpencodeStepEntity, OpencodeStepModel, OpencodeStepRow, OpencodeStepStatus } from './opencode-step.entity'
import { OpencodeStepRequest, OpencodeStoredRequest } from './opencode-stored-request'
import { opencodeVendorPrompts } from './opencode-vendor-prompts'

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
    const settings = call.settings ?? settingsFromStep({ request: call.request, stepSettings: context.settings })
    const stored: OpencodeStoredRequest = { request: call.request, flowName: context.flowName, settings: settings ?? null }
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
        sessionMode: settings?.sessionMode ?? opencodeStepUtil.resolveFlowSessionMode({ defaults: context.defaults }),
        namespace: null,
        opencodeProjectId: null,
        directory: null,
        agent: null,
        model: modelOf({ request: call.request }),
        runSessionId: null,
        sessionId: null,
        messageId: opencodeIds.message(),
        status: 'PENDING',
        failure: null,
        files: null,
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
    if (stored.request.action === OPENCODE_PIECE_ACTION.SEND_TO_INBOX) {
        await opencodeInbox(log).dispatch({ step, request: stored.request, client })
        return
    }
    if (stored.request.action === OPENCODE_PIECE_ACTION.AGENT_CHANNEL) {
        await opencodeChannels(log).dispatch({ step, request: stored.request, flowName: stored.flowName })
        return
    }
    const kept = await usablePinned({ step, pinned: opencodePieceSteps.isPieceRequest(stored.request) ? opencodePieceSteps.pinnedSessionOf({ request: stored.request }) : null, log })
    const pinned = kept.pinned
    const located = await locateOnce({ step: kept.step, stored, pinned, log })
    await opencodeProvisioning(log).waitForReload({ directory: located.directory ?? '' })
    if (stored.request.action === OPENCODE_PIECE_ACTION.VENDOR_PROMPT) {
        await opencodeVendorPrompts.checkProvider({ client, step: located, request: stored.request })
    }
    const outcome = await openWithRetry({ step: located, stored, client, pinnedSessionId: pinned?.sessionId, log })
    if (outcome.kind === 'queued') {
        await stepRepo().update({ id: step.id }, { status: 'QUEUED' })
        return
    }
    const ready = { ...located, sessionId: outcome.sessionId }
    if (await alreadySent({ step: ready, client })) {
        await markDispatched({ step: ready })
        return
    }
    const channel = channelReferenceOf({ stored })
    if (!isNil(channel)) {
        await opencodeChannels(log).join({ step: ready, reference: channel, client })
    }
    if (stored.request.action === OPENCODE_RUN_AGENT) {
        await opencodeMcpBridge(log).attach({ step: ready, client, tools: stored.request.tools ?? [] })
    }
    if (stored.request.action === OPENCODE_PIECE_ACTION.RUN_COMMAND) {
        await sendCommand({ step: ready, request: stored.request, client, log })
        await markDispatched({ step: ready })
        return
    }
    const prompt = await promptOf({ step: ready, request: stored.request, log })
    const sent = await client.session.promptAsync({
        sessionID: outcome.sessionId,
        directory: ready.directory ?? undefined,
        messageID: ready.messageId,
        agent: ready.agent ?? undefined,
        ...(isNil(ready.model) ? {} : { model: ready.model }),
        ...(isNil(prompt.format) ? {} : { format: prompt.format }),
        ...(isNil(prompt.system) ? {} : { system: prompt.system }),
        ...(isNil(prompt.options) ? {} : { options: prompt.options }),
        ...(isNil(prompt.variant) ? {} : { variant: prompt.variant }),
        parts: prompt.parts,
    })
    if (!isNil(sent.error)) {
        throw new OpencodeRequestError({ status: sent.response?.status, message: opencodeErrors.describe({ error: sent.error }) })
    }
    await markDispatched({ step: ready })
}

async function usablePinned({ step, pinned, log }: { step: OpencodeStepRow, pinned: PinnedSession | null, log: FastifyBaseLogger }): Promise<KeptPinned> {
    if (isNil(pinned) || pinned.orNew !== true || !isNil(step.sessionId)) {
        return { step, pinned }
    }
    const { error } = await tryCatch(() => opencodeSessions(log).locateSession({ platformId: step.platformId, sessionId: pinned.sessionId, agent: pinned.agent }))
    if (isNil(error)) {
        return { step, pinned }
    }
    log.info({ opencodeStep: { id: step.id }, error: opencodeErrors.describe({ error }) }, '[opencodeDispatch] The step\'s remembered OpenCode session cannot be used, so it starts a new one')
    const unlocated = { namespace: null, opencodeProjectId: null, directory: null, agent: null }
    await stepRepo().update({ id: step.id }, unlocated)
    return { step: { ...step, ...unlocated }, pinned: null }
}

function settingsFromStep({ request, stepSettings }: { request: OpencodeStepRequest, stepSettings: OpencodeStepSettings | undefined }): OpencodeStepSettings | undefined {
    return opencodePieceSteps.isPieceRequest(request) && request.action === OPENCODE_PIECE_ACTION.VENDOR_PROMPT
        ? opencodeVendorPrompts.settingsOf({ request, stepSettings })
        : stepSettings
}

async function locateOnce({ step, stored, pinned, log }: LocateOnceParams): Promise<OpencodeStepRow> {
    if (!isNil(step.directory)) {
        return step
    }
    const location = isNil(pinned)
        ? await opencodeSessions(log).locate({ platformId: step.platformId, projectId: step.projectId, settings: stored.settings ?? undefined })
        : await opencodeSessions(log).locateSession({ platformId: step.platformId, sessionId: pinned.sessionId, agent: pinned.agent })
    const located = {
        namespace: location.namespace,
        opencodeProjectId: location.opencodeProjectId,
        directory: location.directory,
        agent: location.agent,
    }
    await stepRepo().update({ id: step.id }, located)
    return { ...step, ...located }
}

async function openWithRetry({ step, stored, client, pinnedSessionId, log }: OpenWithRetryParams): Promise<SessionOutcome> {
    const first = await tryCatch(() => opencodeSessions(log).open({ step, client, flowName: stored.flowName, pinnedSessionId }))
    if (!isNil(first.data)) {
        return first.data
    }
    if (!isGuardRefusal({ error: first.error }) || !isNil(stored.settings?.project) || !isNil(pinnedSessionId)) {
        throw first.error
    }
    opencodeProvisioning(log).invalidate({ platformId: step.platformId, projectId: step.projectId })
    await opencodeSessions(log).provision({ platformId: step.platformId, projectId: step.projectId })
    const retried = await tryCatch(() => opencodeSessions(log).open({ step, client, flowName: stored.flowName }))
    if (isNil(retried.data)) {
        throw opencodeErrors.provisioningFailed({ error: retried.error })
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

async function sendCommand({ step, request, client, log }: SendCommandParams): Promise<void> {
    const listed = await client.command.list({ directory: step.directory ?? undefined })
    if (!isNil(listed.data) && !listed.data.some((command) => command.name === request.command)) {
        throw new Error(opencodeErrors.noCommand({ command: request.command, namespace: step.namespace ?? '', project: step.opencodeProjectId ?? '' }))
    }
    const files = await opencodeFilesIn.read({ step, files: request.files ?? [], log })
    const sent: Promise<CommandOutcome> = client.session.command({
        sessionID: step.sessionId ?? '',
        directory: step.directory ?? undefined,
        messageID: step.messageId,
        command: request.command,
        arguments: request.arguments ?? '',
        ...(isNil(step.agent) ? {} : { agent: step.agent }),
        parts: files.map((file) => opencodeFilesIn.partOf({ file })),
    }).then(
        (result) => isNil(result.error) ? { kind: 'finished' } : { kind: 'refused', error: new Error(opencodeErrors.commandRefused({ command: request.command, reason: opencodeErrors.describe({ error: result.error }) })) },
        (error: unknown) => ({ kind: 'refused', error }),
    )
    const deadline = Date.now() + COMMAND_START_MS
    while (Date.now() < deadline) {
        const outcome = await Promise.race([sent, delay({ ms: COMMAND_POLL_MS }).then(() => null)])
        if (outcome?.kind === 'refused') {
            throw outcome.error
        }
        if (outcome?.kind === 'finished' || await alreadySent({ step, client })) {
            rejectedPromiseHandler(sent.then((late) => logLateRefusal({ step, outcome: late, log })), log)
            return
        }
    }
    await opencodeSessions(log).abort({ step, client })
    throw new Error(opencodeErrors.commandNotStarted({ command: request.command, seconds: COMMAND_START_MS / 1000 }))
}

function logLateRefusal({ step, outcome, log }: { step: OpencodeStepRow, outcome: CommandOutcome, log: FastifyBaseLogger }): void {
    if (outcome.kind === 'refused') {
        log.warn({ opencodeStep: { id: step.id }, error: opencodeErrors.describe({ error: outcome.error }) }, '[opencodeDispatch] The OpenCode command ended with an error after it started')
    }
}

async function delay({ ms }: { ms: number }): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function channelReferenceOf({ stored }: { stored: OpencodeStoredRequest }): ChannelReference | null {
    if (opencodePieceSteps.isPieceRequest(stored.request) && !opencodePieceSteps.usesStepSettings({ request: stored.request })) {
        const correlationId = opencodePieceSteps.channelOf({ request: stored.request })
        return isNil(correlationId) ? null : { kind: 'correlation', value: correlationId }
    }
    const stepName = stored.settings?.channel
    return isNil(stepName) ? null : { kind: 'step', value: stepName }
}

function modelOf({ request }: { request: OpencodeStepRequest }): OpencodeStepModel | null {
    if (opencodePieceSteps.isPieceRequest(request)) {
        return opencodePieceSteps.modelOf({ request })
    }
    return opencodeModelKeys.resolveModel({ providerConfigId: request.providerConfigId, modelId: request.modelId })
}

async function promptOf({ step, request, log }: { step: OpencodeStepRow, request: OpencodeStepRequest, log: FastifyBaseLogger }): Promise<BuiltPrompt> {
    if (request.action === OPENCODE_RUN_AGENT) {
        return opencodeAgentPrompt.build({ request, outputFolder: opencodeOutputFolder.of({ stepId: step.id }) })
    }
    if (opencodePieceSteps.isPieceRequest(request)) {
        const files = await opencodeFilesIn.read({ step, files: opencodePieceSteps.filesOf({ request }), log })
        return opencodePieceSteps.build({ request, outputFolder: opencodeOutputFolder.of({ stepId: step.id }), files })
    }
    const files = request.action === AiStepAction.EXTRACT_STRUCTURED_DATA
        ? await opencodeFilesIn.read({ step, files: request.files ?? [], log })
        : []
    return opencodePrompts.build({ request, files })
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

const COMMAND_START_MS = 90 * 1000

const COMMAND_POLL_MS = 500

export type OpencodeAiCall = {
    flowId: string
    flowRunId: string
    waitpointId?: string
    request: OpencodeStepRequest
    settings?: OpencodeStepSettings
}

type KeptPinned = {
    step: OpencodeStepRow
    pinned: PinnedSession | null
}

type CommandOutcome =
    | { kind: 'finished' }
    | { kind: 'refused', error: unknown }

type SendCommandParams = {
    step: OpencodeStepRow
    request: Extract<OpencodePieceRequest, { action: typeof OPENCODE_PIECE_ACTION.RUN_COMMAND }>
    client: OpencodeClient
    log: FastifyBaseLogger
}

type LocateOnceParams = {
    step: OpencodeStepRow
    stored: OpencodeStoredRequest
    pinned: PinnedSession | null
    log: FastifyBaseLogger
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
    pinnedSessionId: string | undefined
    log: FastifyBaseLogger
}
