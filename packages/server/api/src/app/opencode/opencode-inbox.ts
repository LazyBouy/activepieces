import { apId, isNil } from '@activepieces/core-utils'
import { OpencodeClient, OperatorMessage } from '@opencode-ai/sdk/v2/client'
import { FastifyBaseLogger } from 'fastify'
import { z } from 'zod'
import { repoFactory } from '../core/db/repo-factory'
import { opencodeConnectionService } from './opencode-connection.service'
import { opencodeErrors, OpencodeRequestError } from './opencode-errors'
import { opencodeLinks } from './opencode-links'
import { opencodeOptionsService } from './opencode-options.service'
import { OPENCODE_INBOX_DEFAULT_TIMEOUT_MINUTES, OpencodeInboxRequest } from './opencode-piece-steps'
import { OpencodeStepAnswer } from './opencode-prompts'
import { opencodeReply, ReplyState, SessionMessage } from './opencode-reply'
import { OpencodeStepEntity, OpencodeStepRow } from './opencode-step.entity'

const stepRepo = repoFactory(OpencodeStepEntity)

export const opencodeInbox = (log: FastifyBaseLogger) => ({
    async sendNow({ platformId, projectId, request }: SendNowParams): Promise<OpencodeStepAnswer> {
        const target = await locate({ platformId, projectId, request, log })
        const client = await opencodeConnectionService(log).client({ platformId })
        const correlationId = `${CORRELATION_PREFIX}${apId()}`
        const entered = await enter({ client, target, request, correlationId })
        const settled = await settle({ client, message: entered })
        return { output: outputOf({ message: settled, correlationId }) }
    },

    async dispatch({ step, request, client }: DispatchParams): Promise<void> {
        const target = await locate({ platformId: step.platformId, projectId: step.projectId, request, log })
        await stepRepo().update({ id: step.id }, { namespace: target.namespace, opencodeProjectId: target.project, directory: target.directory })
        const correlationId = request.correlationId ?? `${CORRELATION_PREFIX}${step.id}`
        const message = await enteredBefore({ client, correlationId, project: target.project }) ?? await enter({ client, target, request, correlationId })
        await stepRepo().update({ id: step.id }, {
            request: { ...(step.request ?? {}), request: { ...request, correlationId, inboxMessageId: message.id } },
            status: 'DISPATCHED',
            dispatchedAt: new Date().toISOString(),
        })
        if (UNDELIVERED.includes(message.status)) {
            throw new Error(opencodeErrors.inboxNotDelivered({ reason: reasonOf({ message }) }))
        }
    },

    async check({ step, request }: CheckParams): Promise<InboxCheck> {
        if (isNil(request.inboxMessageId) || isNil(request.correlationId)) {
            return { kind: 'pending' }
        }
        const client = await opencodeConnectionService(log).client({ platformId: step.platformId })
        const record = await client.operator.message.get({ id: request.inboxMessageId, directory: step.directory ?? undefined })
        if (isNil(record.data)) {
            throw new OpencodeRequestError({ status: record.response?.status, message: opencodeErrors.describe({ error: record.error }) })
        }
        const message = record.data
        if (UNDELIVERED.includes(message.status)) {
            return { kind: 'failed', failure: opencodeErrors.inboxNotDelivered({ reason: reasonOf({ message }) }) }
        }
        const answered = await firstAnswer({ client, message, correlationId: request.correlationId })
        if (!isNil(answered)) {
            return answered
        }
        const timeoutMinutes = request.timeoutMinutes ?? OPENCODE_INBOX_DEFAULT_TIMEOUT_MINUTES
        if (!isNil(step.dispatchedAt) && Date.now() - new Date(step.dispatchedAt).getTime() > timeoutMinutes * MS_PER_MINUTE) {
            return { kind: 'failed', failure: opencodeErrors.inboxTimeout({ minutes: timeoutMinutes }) }
        }
        return { kind: 'pending' }
    },

    answerOf({ check, request, adminPanelUrl }: AnswerOfParams): OpencodeStepAnswer {
        if (!isNil(check.reply.error)) {
            return { failure: opencodeErrors.sessionError({ message: check.reply.error }) }
        }
        return {
            output: {
                ...outputOf({ message: check.message, correlationId: request.correlationId ?? check.message.correlationID }),
                reply: check.reply.text,
                replyFrom: {
                    agent: check.delivered.agent,
                    sessionId: check.delivered.sessionId,
                    adminPanelUrl: opencodeLinks.session({ adminPanelUrl, directory: check.delivered.directory, sessionId: check.delivered.sessionId }),
                },
            },
        }
    },
})

async function locate({ platformId, projectId, request, log }: LocateParams): Promise<InboxTarget> {
    const located = await opencodeOptionsService(log).locate({ platformId, projectId, namespace: request.namespace, project: request.project })
    if (located.kind === 'error') {
        throw new Error(located.error)
    }
    if (located.kind === 'none') {
        throw new Error(`OpenCode has no project ${request.namespace}/${request.project}.`)
    }
    return { namespace: located.namespace, project: located.project, directory: located.directory }
}

async function enter({ client, target, request, correlationId }: EnterParams): Promise<OperatorMessage> {
    const result = await client.operator.projectInbox.enter({
        project: target.project,
        directory: target.directory,
        text: request.message,
        ...(isNil(request.to) ? {} : { to: request.to }),
        correlationID: correlationId,
        from: 'external',
    })
    if (isNil(result.data)) {
        throw new OpencodeRequestError({ status: result.response?.status, message: opencodeErrors.describe({ error: result.error }) })
    }
    return result.data
}

async function enteredBefore({ client, correlationId, project }: { client: OpencodeClient, correlationId: string, project: string }): Promise<OperatorMessage | null> {
    const result = await client.operator.conversation.get({ correlationID: correlationId })
    const found = result.data?.messages.find((message) => message.from.kind === EXTERNAL && message.inbox === project && isNil(message.via))
    return found ?? null
}

async function settle({ client, message }: { client: OpencodeClient, message: OperatorMessage }): Promise<OperatorMessage> {
    const deadline = Date.now() + SETTLE_MS
    let current = message
    while (current.status === QUEUED && Date.now() < deadline) {
        await delay({ ms: SETTLE_POLL_MS })
        const record = await client.operator.message.get({ id: message.id })
        current = record.data ?? current
    }
    return current
}

async function firstAnswer({ client, message, correlationId }: FirstAnswerParams): Promise<Extract<InboxCheck, { kind: 'done' }> | null> {
    const conversation = await client.operator.conversation.get({ correlationID: correlationId })
    if (isNil(conversation.data)) {
        throw new OpencodeRequestError({ status: conversation.response?.status, message: opencodeErrors.describe({ error: conversation.error }) })
    }
    const copies = conversation.data.messages
        .filter((copy) => copy.via === message.id && !isNil(copy.sessionID))
        .sort((left, right) => (left.deliveredAt ?? left.createdAt) - (right.deliveredAt ?? right.createdAt))
    const answers = await Promise.all(copies.map((copy) => answerIn({ client, copy })))
    const done = answers
        .filter((answer): answer is DeliveredAnswer => !isNil(answer))
        .sort((left, right) => left.completedAt - right.completedAt)
    const first = done[0]
    if (isNil(first)) {
        return null
    }
    return { kind: 'done', message, reply: first.state.reply, delivered: first.delivered }
}

async function answerIn({ client, copy }: { client: OpencodeClient, copy: OperatorMessage }): Promise<DeliveredAnswer | null> {
    const sessionId = copy.sessionID
    if (isNil(sessionId)) {
        return null
    }
    const directory = copy.folder
    const messages = await opencodeReply.messagesOf({ client, sessionId, directory })
    if (isNil(messages)) {
        return null
    }
    const prompt = messages.find((candidate) => candidate.info.role === USER && carriesCopy({ message: candidate, copyId: copy.id }))
    if (isNil(prompt)) {
        return null
    }
    const state = await opencodeReply.stateOf({ client, sessionId, messageId: prompt.info.id, directory, messages })
    if (state.kind !== 'done') {
        return null
    }
    const last = state.replies[state.replies.length - 1]
    return {
        state,
        completedAt: last?.info.time.completed ?? last?.info.time.created ?? Date.now(),
        delivered: { sessionId, directory: directory ?? last?.info.path.root ?? '', messageId: prompt.info.id, agent: copy.agent ?? last?.info.agent ?? null },
    }
}

function carriesCopy({ message, copyId }: { message: SessionMessage, copyId: string }): boolean {
    return message.parts.some((part) => part.type === 'text' && DeliveredMark.safeParse(part.metadata).data?.message.id === copyId)
}

function outputOf({ message, correlationId }: { message: OperatorMessage, correlationId: string }): InboxOutput {
    return {
        messageId: message.id,
        correlationId,
        status: message.status,
        routedTo: message.routedTo ?? [],
    }
}

function reasonOf({ message }: { message: OperatorMessage }): string {
    const last = message.trail[message.trail.length - 1]
    return last?.detail ?? last?.kind ?? message.status
}

async function delay({ ms }: { ms: number }): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, ms))
}

const CORRELATION_PREFIX = 'iphiflow_'

const EXTERNAL = 'external'

const USER = 'user'

const QUEUED = 'queued'

const UNDELIVERED: OperatorMessage['status'][] = ['dead letter', 'dropped', 'failed', 'cancelled']

const SETTLE_MS = 3000

const SETTLE_POLL_MS = 300

const MS_PER_MINUTE = 60 * 1000

const DeliveredMark = z.object({ message: z.object({ id: z.string() }) })

export type InboxCheck =
    | { kind: 'pending' }
    | { kind: 'failed', failure: string }
    | { kind: 'done', message: OperatorMessage, reply: Extract<ReplyState, { kind: 'done' }>['reply'], delivered: DeliveredSession }

export type DeliveredSession = {
    sessionId: string
    directory: string
    messageId: string
    agent: string | null
}

type DeliveredAnswer = {
    state: Extract<ReplyState, { kind: 'done' }>
    completedAt: number
    delivered: DeliveredSession
}

type InboxTarget = {
    namespace: string
    project: string
    directory: string
}

type InboxOutput = {
    messageId: string
    correlationId: string
    status: string
    routedTo: string[]
}

type SendNowParams = {
    platformId: string
    projectId: string
    request: OpencodeInboxRequest
}

type DispatchParams = {
    step: OpencodeStepRow
    request: OpencodeInboxRequest
    client: OpencodeClient
}

type CheckParams = {
    step: OpencodeStepRow
    request: OpencodeInboxRequest
}

type AnswerOfParams = {
    check: Extract<InboxCheck, { kind: 'done' }>
    request: OpencodeInboxRequest
    adminPanelUrl: string
}

type LocateParams = {
    platformId: string
    projectId: string
    request: OpencodeInboxRequest
    log: FastifyBaseLogger
}

type EnterParams = {
    client: OpencodeClient
    target: InboxTarget
    request: OpencodeInboxRequest
    correlationId: string
}

type FirstAnswerParams = {
    client: OpencodeClient
    message: OperatorMessage
    correlationId: string
}
