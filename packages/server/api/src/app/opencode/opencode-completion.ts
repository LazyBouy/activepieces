import { ActivepiecesError, ErrorCode, isNil, sanitizeObjectForPostgresql, tryCatch } from '@activepieces/core-utils'
import { EngineResponseStatus } from '@activepieces/shared'
import { FastifyBaseLogger } from 'fastify'
import { repoFactory } from '../core/db/repo-factory'
import { resumeService } from '../waitpoints/resume-service'
import { engineResponseWatcher } from '../workers/engine-response-watcher'
import { OPENCODE_RUN_AGENT, opencodeAgentPrompt } from './opencode-agent-prompt'
import { opencodeAsks } from './opencode-asks'
import { opencodeConnectionService } from './opencode-connection.service'
import { opencodeErrors } from './opencode-errors'
import { opencodeFilesOut } from './opencode-files-out'
import { opencodeInbox } from './opencode-inbox'
import { opencodeMcpBridge } from './opencode-mcp-bridge'
import { OPENCODE_PIECE_ACTION, OpencodeInboxRequest, opencodePieceSteps } from './opencode-piece-steps'
import { opencodePrompts, OpencodeStepAnswer } from './opencode-prompts'
import { opencodeReply, ReplyState } from './opencode-reply'
import { opencodeSessions } from './opencode-sessions'
import { OpencodeStepEntity, OpencodeStepFiles, OpencodeStepRow, OpencodeStepStatus } from './opencode-step.entity'
import { opencodeStoredRequest } from './opencode-stored-request'

const stepRepo = repoFactory(OpencodeStepEntity)

export const opencodeCompletion = (log: FastifyBaseLogger) => ({
    async complete({ stepId }: { stepId: string }): Promise<CompletionResult> {
        const step = await stepRepo().findOneBy({ id: stepId })
        if (isNil(step) || step.status !== 'DISPATCHED') {
            return { finished: false, nextStepId: null }
        }
        const stored = opencodeStoredRequest.parse(step.request)
        if (stored?.request.action === OPENCODE_PIECE_ACTION.SEND_TO_INBOX) {
            return this.completeInbox({ step, request: stored.request })
        }
        if (isNil(step.sessionId)) {
            return { finished: false, nextStepId: null }
        }
        const client = await opencodeConnectionService(log).client({ platformId: step.platformId })
        const state = await opencodeReply.read({ client, sessionId: step.sessionId, messageId: step.messageId, directory: step.directory ?? undefined })
        switch (state.kind) {
            case 'pending':
                return { finished: false, nextStepId: null }
            case 'not-sent':
                if (sentLongAgo({ dispatchedAt: step.dispatchedAt })) {
                    await stepRepo().update({ id: step.id, status: 'DISPATCHED' }, { status: 'PENDING' })
                }
                return { finished: false, nextStepId: null }
            case 'gone':
                return this.finish({ step, answer: { failure: opencodeErrors.sessionGone({ sessionId: step.sessionId }) } })
            case 'done':
                return this.finish({ step, answer: await answerOf({ step, state, log }) })
        }
    },

    async completeInbox({ step, request }: { step: OpencodeStepRow, request: OpencodeInboxRequest }): Promise<CompletionResult> {
        const check = await opencodeInbox(log).check({ step, request })
        switch (check.kind) {
            case 'pending':
                return { finished: false, nextStepId: null }
            case 'failed':
                return this.finish({ step, answer: { failure: check.failure } })
            case 'done': {
                const delivered = { sessionId: check.delivered.sessionId, directory: check.delivered.directory, messageId: check.delivered.messageId, agent: check.delivered.agent }
                await stepRepo().update({ id: step.id, status: 'DISPATCHED' }, delivered)
                const connection = await opencodeConnectionService(log).getOrCreate({ platformId: step.platformId })
                return this.finish({ step: { ...step, ...delivered }, answer: opencodeInbox(log).answerOf({ check, request, adminPanelUrl: connection.adminPanelUrl }) })
            }
        }
    },

    async fail({ stepId, failure }: { stepId: string, failure: string }): Promise<CompletionResult> {
        const step = await stepRepo().findOneBy({ id: stepId })
        if (isNil(step)) {
            return { finished: false, nextStepId: null }
        }
        return this.finish({ step, answer: { failure } })
    },

    async finish({ step, answer }: { step: OpencodeStepRow, answer: OpencodeStepAnswer }): Promise<CompletionResult> {
        const claimed = await stepRepo().createQueryBuilder()
            .update()
            .set({ status: 'COMPLETING', failure: answer.failure ?? null })
            .where('id = :id AND status IN (:...statuses)', { id: step.id, statuses: OPEN_STATUSES })
            .returning(['id'])
            .execute()
        if (!hasRows({ raw: claimed.raw })) {
            return { finished: false, nextStepId: null }
        }
        await deliver({ step, answer, log })
        return this.settle({ step, failed: !isNil(answer.failure) })
    },

    async redeliver({ stepId }: { stepId: string }): Promise<CompletionResult> {
        const step = await stepRepo().findOneBy({ id: stepId, status: 'COMPLETING' })
        if (isNil(step)) {
            return { finished: false, nextStepId: null }
        }
        if (!isNil(step.failure)) {
            await deliver({ step, answer: { failure: step.failure }, log })
            return this.settle({ step, failed: true })
        }
        const answer = await answerFromReply({ step, log })
        await deliver({ step, answer, log })
        return this.settle({ step, failed: !isNil(answer.failure) })
    },

    async settle({ step, failed }: { step: OpencodeStepRow, failed: boolean }): Promise<CompletionResult> {
        await detachTools({ step, log })
        await opencodeAsks(log).closeForStep({ stepId: step.id })
        await stepRepo().update({ id: step.id }, {
            status: failed ? 'FAILED' : 'COMPLETED',
            request: null,
            completedAt: new Date().toISOString(),
        })
        const nextStepId = await opencodeSessions(log).release({ step })
        return { finished: true, nextStepId }
    },
})

async function answerFromReply({ step, log }: { step: OpencodeStepRow, log: FastifyBaseLogger }): Promise<OpencodeStepAnswer> {
    const stored = opencodeStoredRequest.parse(step.request)
    if (stored?.request.action === OPENCODE_PIECE_ACTION.SEND_TO_INBOX) {
        return inboxAnswer({ step, request: stored.request, log })
    }
    if (isNil(step.sessionId)) {
        return { failure: UNREADABLE_REQUEST }
    }
    const client = await opencodeConnectionService(log).client({ platformId: step.platformId })
    const state = await opencodeReply.read({ client, sessionId: step.sessionId, messageId: step.messageId, directory: step.directory ?? undefined })
    if (state.kind === 'done') {
        return answerOf({ step, state, log })
    }
    if (state.kind === 'gone') {
        return { failure: opencodeErrors.sessionGone({ sessionId: step.sessionId }) }
    }
    return { failure: 'OpenCode has no answer for this step.' }
}

async function inboxAnswer({ step, request, log }: { step: OpencodeStepRow, request: OpencodeInboxRequest, log: FastifyBaseLogger }): Promise<OpencodeStepAnswer> {
    const check = await opencodeInbox(log).check({ step, request })
    if (check.kind === 'failed') {
        return { failure: check.failure }
    }
    if (check.kind === 'pending') {
        return { failure: 'OpenCode has no answer for this step.' }
    }
    const connection = await opencodeConnectionService(log).getOrCreate({ platformId: step.platformId })
    return opencodeInbox(log).answerOf({ check, request, adminPanelUrl: connection.adminPanelUrl })
}

async function answerOf({ step, state, log }: { step: OpencodeStepRow, state: Extract<ReplyState, { kind: 'done' }>, log: FastifyBaseLogger }): Promise<OpencodeStepAnswer> {
    const stored = opencodeStoredRequest.parse(step.request)
    if (isNil(stored)) {
        return { failure: UNREADABLE_REQUEST }
    }
    const files = isNil(state.reply.error)
        ? await opencodeFilesOut(log).ensure({ step, client: await opencodeConnectionService(log).client({ platformId: step.platformId }), replies: state.replies })
        : NO_FILES
    if (opencodePieceSteps.isPieceRequest(stored.request)) {
        const connection = await opencodeConnectionService(log).getOrCreate({ platformId: step.platformId })
        return opencodePieceSteps.answer({ request: stored.request, step, replies: state.replies, reply: state.reply, summary: state.summary, adminPanelUrl: connection.adminPanelUrl, files })
    }
    if (stored.request.action !== OPENCODE_RUN_AGENT) {
        return opencodePrompts.mapReply({ request: stored.request, reply: state.reply })
    }
    const connection = await opencodeConnectionService(log).getOrCreate({ platformId: step.platformId })
    return opencodeAgentPrompt.answer({
        request: stored.request,
        step,
        replies: state.replies,
        reply: state.reply,
        summary: state.summary,
        adminPanelUrl: connection.adminPanelUrl,
        files,
    })
}

async function detachTools({ step, log }: { step: OpencodeStepRow, log: FastifyBaseLogger }): Promise<void> {
    const stored = opencodeStoredRequest.parse(step.request)
    if (isNil(stored) || stored.request.action !== OPENCODE_RUN_AGENT || (stored.request.tools ?? []).length === 0) {
        return
    }
    const tools = stored.request.tools ?? []
    const { error } = await tryCatch(async () => opencodeMcpBridge(log).detach({ step, client: await opencodeConnectionService(log).client({ platformId: step.platformId }), tools }))
    if (!isNil(error)) {
        log.warn({ opencodeStep: { id: step.id }, error }, '[opencodeCompletion] Could not remove the step\'s tools from OpenCode')
    }
}

function resumeBodyOf({ step, answer }: { step: OpencodeStepRow, answer: OpencodeStepAnswer }): unknown {
    return step.action === OPENCODE_RUN_AGENT && isNil(answer.failure) ? answer.output : answer
}

async function deliver({ step, answer, log }: { step: OpencodeStepRow, answer: OpencodeStepAnswer, log: FastifyBaseLogger }): Promise<void> {
    if (!isNil(step.waitpointId)) {
        const { error } = await tryCatch(() => resumeService(log).resumeFromWaitpoint({
            flowRunId: step.flowRunId,
            waitpointId: step.waitpointId ?? '',
            resumePayload: { body: sanitizeObjectForPostgresql(resumeBodyOf({ step, answer })), headers: {}, queryParams: {} },
        }))
        if (!isNil(error) && !isFlowRunGone({ error })) {
            throw error
        }
        return
    }
    if (!isNil(step.webserverId)) {
        await engineResponseWatcher(log).publish(step.webserverId, step.requestId, { status: EngineResponseStatus.OK, response: answer })
    }
}

function hasRows({ raw }: { raw: unknown }): boolean {
    return Array.isArray(raw) && raw.length > 0
}

function sentLongAgo({ dispatchedAt }: { dispatchedAt: string | null }): boolean {
    return isNil(dispatchedAt) || Date.now() - new Date(dispatchedAt).getTime() > RESEND_AFTER_MS
}

function isFlowRunGone({ error }: { error: unknown }): boolean {
    return error instanceof ActivepiecesError
        && error.error.code === ErrorCode.ENTITY_NOT_FOUND
        && error.error.params.entityType === FLOW_RUN_ENTITY_TYPE
}

const UNREADABLE_REQUEST = 'The step request could not be read back.'

const NO_FILES: OpencodeStepFiles = { files: [], skippedFiles: [] }

const OPEN_STATUSES: OpencodeStepStatus[] = ['PENDING', 'QUEUED', 'DISPATCHED']

const FLOW_RUN_ENTITY_TYPE = 'flow_run'

const RESEND_AFTER_MS = 2 * 60 * 1000

export type CompletionResult = {
    finished: boolean
    nextStepId: string | null
}
