import { ActivepiecesError, apId, ErrorCode, isNil, tryCatch } from '@activepieces/core-utils'
import { AnswerOpencodeAskRequest, OpencodeAsk, OpencodeAskAnswer, OpencodeAskKind, OpencodeAskStatus, OpencodePermissionDecision, OpencodeQuestion } from '@activepieces/shared'
import { OpencodeClient } from '@opencode-ai/sdk/v2/client'
import dayjs from 'dayjs'
import { FastifyBaseLogger } from 'fastify'
import { In, LessThan } from 'typeorm'
import { z } from 'zod'
import { repoFactory } from '../core/db/repo-factory'
import { rejectedPromiseHandler } from '../helper/promise-handler'
import { system } from '../helper/system/system'
import { AppSystemProp } from '../helper/system/system-props'
import { waitpointService } from '../waitpoints/waitpoint-service'
import { opencodeAskNotices } from './opencode-ask-notices'
import { OpencodeAskEntity, OpencodeAskRow } from './opencode-ask.entity'
import { opencodeConnectionService } from './opencode-connection.service'
import { opencodeErrors } from './opencode-errors'
import { OpencodeStepEntity, OpencodeStepRow } from './opencode-step.entity'

const askRepo = repoFactory(OpencodeAskEntity)
const stepRepo = repoFactory(OpencodeStepEntity)

export const opencodeAsks = (log: FastifyBaseLogger) => ({
    async open({ platformId, directory, request }: OpenParams): Promise<OpencodeAskRow | null> {
        const client = await opencodeConnectionService(log).client({ platformId })
        const step = await stepOfSession({ platformId, directory, sessionId: request.sessionId, client, depth: 0 })
        if (isNil(step) || isNil(step.stepName)) {
            return null
        }
        const recorded = await askRepo().existsBy({ platformId, requestId: request.requestId })
        if (recorded) {
            return null
        }
        const connection = await opencodeConnectionService(log).getOrCreate({ platformId })
        const deadline = await deadlineOf({ step, wanted: dayjs().add(connection.askCapMinutes, 'minute').toISOString(), log })
        const draft: OpencodeAskRow = {
            id: apId(),
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            platformId,
            projectId: step.projectId,
            flowId: step.flowId,
            flowRunId: step.flowRunId,
            flowVersionId: step.flowVersionId,
            stepName: plainStepName({ stepKey: step.stepName }),
            opencodeStepId: step.id,
            sessionId: request.sessionId,
            requestId: request.requestId,
            kind: request.kind,
            status: OpencodeAskStatus.OPEN,
            agent: step.agent,
            permission: request.permission ?? null,
            questions: request.questions ?? null,
            deadline,
            answer: null,
            answeredVia: null,
            answeredAt: null,
        }
        const { error } = await tryCatch(() => askRepo().save(draft))
        if (!isNil(error)) {
            return null
        }
        opencodeAskNotices(log).opened({ ask: draft })
        rejectedPromiseHandler(opencodeAskNotices(log).email({ ask: draft }), log)
        log.info({ opencodeAsk: { id: draft.id, kind: draft.kind }, opencodeStep: { id: step.id }, flowRun: { id: step.flowRunId } }, '[opencodeAsks] OpenCode is waiting for an answer')
        return draft
    },

    async closeAnsweredElsewhere({ platformId, requestId }: { platformId: string, requestId: string }): Promise<void> {
        const closed = await askRepo().createQueryBuilder()
            .update()
            .set({ status: OpencodeAskStatus.CLOSED, answeredVia: VIA_OPENCODE, answeredAt: new Date().toISOString() })
            .where('"platformId" = :platformId AND "requestId" = :requestId AND status = :open', { platformId, requestId, open: OpencodeAskStatus.OPEN })
            .returning(['id'])
            .execute()
        await notifyClosed({ raw: closed.raw, log })
    },

    async answer({ askId, projectId, request, via }: AnswerParams): Promise<OpencodeAskRow> {
        const claimed = await claim({ askId, projectId })
        if (isNil(claimed)) {
            throw alreadyAnswered()
        }
        const answer = answerOf({ ask: claimed, request })
        if (isNil(answer)) {
            await askRepo().update({ id: claimed.id, status: ANSWERING }, { status: OpencodeAskStatus.OPEN })
            throw new ActivepiecesError({ code: ErrorCode.VALIDATION, params: { message: 'That answer does not fit this request.' } })
        }
        const client = await opencodeConnectionService(log).client({ platformId: claimed.platformId })
        const step = await stepRepo().findOneBy({ id: claimed.opencodeStepId })
        const outcome = await sendAnswer({ ask: claimed, answer, client, directory: step?.directory ?? undefined })
        if (outcome === 'gone') {
            await askRepo().update({ id: claimed.id, status: ANSWERING }, { status: OpencodeAskStatus.CLOSED, answeredVia: VIA_OPENCODE, answeredAt: new Date().toISOString() })
            opencodeAskNotices(log).closed({ ask: claimed })
            throw alreadyAnswered()
        }
        if (outcome !== 'sent') {
            await askRepo().update({ id: claimed.id, status: ANSWERING }, { status: OpencodeAskStatus.OPEN })
            throw new ActivepiecesError({ code: ErrorCode.VALIDATION, params: { message: opencodeErrors.answerRefused({ reason: outcome.message }) } })
        }
        const answered: OpencodeAskRow = { ...claimed, status: OpencodeAskStatus.ANSWERED, answer, answeredVia: via, answeredAt: new Date().toISOString() }
        await askRepo().update({ id: claimed.id }, { status: answered.status, answer, answeredVia: via, answeredAt: answered.answeredAt })
        opencodeAskNotices(log).closed({ ask: answered })
        log.info({ opencodeAsk: { id: claimed.id, via }, flowRun: { id: claimed.flowRunId } }, '[opencodeAsks] Answered OpenCode')
        return answered
    },

    async expire(): Promise<ExpiredAsk[]> {
        await askRepo().update({ status: ANSWERING, updated: LessThan(dayjs().subtract(STUCK_ANSWER_SECONDS, 'second').toISOString()) }, { status: OpencodeAskStatus.OPEN })
        const due = await askRepo().find({ where: { status: OpencodeAskStatus.OPEN, deadline: LessThan(new Date().toISOString()) }, take: BATCH_SIZE })
        const expired: ExpiredAsk[] = []
        for (const ask of due) {
            const claimed = await claim({ askId: ask.id, projectId: ask.projectId })
            if (isNil(claimed)) {
                continue
            }
            const connection = await opencodeConnectionService(log).getOrCreate({ platformId: ask.platformId })
            const client = await opencodeConnectionService(log).client({ platformId: ask.platformId })
            const step = await stepRepo().findOneBy({ id: ask.opencodeStepId })
            const failure = opencodeErrors.askCapPassed({ summary: summaryOf({ ask }), capMinutes: connection.askCapMinutes })
            await sendAnswer({ ask, answer: expiredAnswer({ ask, note: failure }), client, directory: step?.directory ?? undefined })
            await askRepo().update({ id: ask.id }, { status: OpencodeAskStatus.EXPIRED, answeredVia: VIA_DEADLINE, answeredAt: new Date().toISOString() })
            opencodeAskNotices(log).closed({ ask })
            log.info({ opencodeAsk: { id: ask.id }, flowRun: { id: ask.flowRunId } }, '[opencodeAsks] Nobody answered in time')
            expired.push({ stepId: ask.opencodeStepId, failure })
        }
        return expired
    },

    async closeForStep({ stepId }: { stepId: string }): Promise<void> {
        const closed = await askRepo().createQueryBuilder()
            .update()
            .set({ status: OpencodeAskStatus.CLOSED, answeredAt: new Date().toISOString() })
            .where('"opencodeStepId" = :stepId AND status = :open', { stepId, open: OpencodeAskStatus.OPEN })
            .returning(['id'])
            .execute()
        await notifyClosed({ raw: closed.raw, log })
    },

    async reconcile({ platformId }: { platformId: string }): Promise<void> {
        const steps = await stepRepo().findBy({ platformId, status: 'DISPATCHED' })
        const directories = [...new Set(steps.flatMap((step) => isNil(step.directory) ? [] : [step.directory]))]
        if (directories.length === 0) {
            return
        }
        const client = await opencodeConnectionService(log).client({ platformId })
        for (const directory of directories) {
            const listedAt = new Date().toISOString()
            const [permissions, questions] = await Promise.all([client.permission.list({ directory }), client.question.list({ directory })])
            if (isNil(permissions.data) || isNil(questions.data)) {
                continue
            }
            const waiting = [
                ...permissions.data.map((request) => permissionAsk({ request })),
                ...questions.data.map((request) => questionAsk({ request })),
            ]
            for (const request of waiting) {
                await this.open({ platformId, directory, request })
            }
            const waitingIds = new Set(waiting.map((request) => request.requestId))
            const open = await askRepo().findBy({ platformId, status: OpencodeAskStatus.OPEN, created: LessThan(listedAt), opencodeStepId: In(steps.filter((step) => step.directory === directory).map((step) => step.id)) })
            for (const ask of open.filter((candidate) => !waitingIds.has(candidate.requestId))) {
                await this.closeAnsweredElsewhere({ platformId, requestId: ask.requestId })
            }
        }
    },

    async list({ projectId, flowRunId, flowVersionId, stepName }: ListParams): Promise<OpencodeAsk[]> {
        const asks = await askRepo().find({
            where: {
                projectId,
                ...(isNil(flowRunId) ? {} : { flowRunId }),
                ...(isNil(flowVersionId) ? {} : { flowVersionId }),
                ...(isNil(stepName) ? {} : { stepName }),
            },
            order: { created: 'DESC' },
            take: LIST_LIMIT,
        })
        if (asks.length === 0) {
            return []
        }
        const connection = await opencodeConnectionService(log).getOrCreate({ platformId: asks[0].platformId })
        const steps = await stepRepo().findBy({ id: In([...new Set(asks.map((ask) => ask.opencodeStepId))]), projectId })
        return asks.map((ask) => viewOf({ ask, step: steps.find((step) => step.id === ask.opencodeStepId), adminPanelUrl: connection.adminPanelUrl }))
    },

    async linked({ askId, platformId }: { askId: string, platformId: string }): Promise<{ view: OpencodeAsk, projectId: string } | null> {
        const ask = await askRepo().findOneBy({ id: askId, platformId })
        const view = await this.view({ askId, platformId })
        return isNil(ask) || isNil(view) ? null : { view, projectId: ask.projectId }
    },

    async view({ askId, platformId }: { askId: string, platformId: string }): Promise<OpencodeAsk | null> {
        const ask = await askRepo().findOneBy({ id: askId, platformId })
        if (isNil(ask)) {
            return null
        }
        const connection = await opencodeConnectionService(log).getOrCreate({ platformId })
        const step = await stepRepo().findOneBy({ id: ask.opencodeStepId, platformId })
        return viewOf({ ask, step: step ?? undefined, adminPanelUrl: connection.adminPanelUrl })
    },
})

async function deadlineOf({ step, wanted, log }: { step: OpencodeStepRow, wanted: string, log: FastifyBaseLogger }): Promise<string> {
    const stepDeadline = isNil(step.waitpointId)
        ? dayjs(step.dispatchedAt ?? new Date()).add(system.getNumberOrThrow(AppSystemProp.FLOW_TIMEOUT_SECONDS), 'second').toISOString()
        : await waitpointService(log).extendDeadline({ waitpointId: step.waitpointId, flowRunId: step.flowRunId, projectId: step.projectId, notBefore: wanted })
    return isNil(stepDeadline) || dayjs(wanted).isBefore(dayjs(stepDeadline)) ? wanted : stepDeadline
}

async function stepOfSession({ platformId, directory, sessionId, client, depth }: StepOfSessionParams): Promise<OpencodeStepRow | null> {
    const step = await stepRepo().findOneBy({ platformId, sessionId, status: 'DISPATCHED' })
    if (!isNil(step)) {
        return step
    }
    if (depth >= MAX_SESSION_DEPTH || isNil(directory)) {
        return null
    }
    const hasStepsHere = await stepRepo().existsBy({ platformId, directory, status: 'DISPATCHED' })
    if (!hasStepsHere) {
        return null
    }
    const session = await client.session.get({ sessionID: sessionId, directory })
    const parentId = session.data?.parentID
    if (isNil(parentId)) {
        return null
    }
    return stepOfSession({ platformId, directory, sessionId: parentId, client, depth: depth + 1 })
}

async function claim({ askId, projectId }: { askId: string, projectId: string }): Promise<OpencodeAskRow | null> {
    const claimed = await askRepo().createQueryBuilder()
        .update()
        .set({ status: ANSWERING })
        .where('id = :askId AND "projectId" = :projectId AND status = :open', { askId, projectId, open: OpencodeAskStatus.OPEN })
        .returning(['id'])
        .execute()
    if (!hasRows({ raw: claimed.raw })) {
        return null
    }
    return askRepo().findOneBy({ id: askId, projectId })
}

function answerOf({ ask, request }: { ask: OpencodeAskRow, request: AnswerOpencodeAskRequest }): OpencodeAskAnswer | null {
    if (ask.kind === OpencodeAskKind.PERMISSION && request.type === 'permission') {
        return { decision: request.decision, ...(isNil(request.note) || request.note.length === 0 ? {} : { note: request.note }) }
    }
    if (ask.kind === OpencodeAskKind.QUESTION && request.type === 'question' && request.answers.length === (ask.questions ?? []).length) {
        return { answers: request.answers }
    }
    if (ask.kind === OpencodeAskKind.QUESTION && request.type === 'dismiss') {
        return { dismissed: true }
    }
    return null
}

function expiredAnswer({ ask, note }: { ask: OpencodeAskRow, note: string }): OpencodeAskAnswer {
    return ask.kind === OpencodeAskKind.PERMISSION ? { decision: OpencodePermissionDecision.DENY, note } : { dismissed: true }
}

async function sendAnswer({ ask, answer, client, directory }: SendAnswerParams): Promise<'sent' | 'gone' | { message: string }> {
    if (ask.kind === OpencodeAskKind.PERMISSION && !isNil(answer.decision)) {
        const decided = await client.operator.permission.decide({
            requestID: ask.requestId,
            confirmCopy: 'true',
            operatorPermissionDecideInput: {
                decision: answer.decision,
                via: DECISION_VIA,
                ...(isNil(answer.note) ? {} : { note: answer.note }),
            },
        })
        return outcomeOf({ status: decided.response?.status, ok: !isNil(decided.data), error: decided.error })
    }
    if (ask.kind === OpencodeAskKind.QUESTION && answer.dismissed === true) {
        const rejected = await client.question.reject({ requestID: ask.requestId, directory })
        return outcomeOf({ status: rejected.response?.status, ok: !isNil(rejected.data), error: rejected.error })
    }
    const replied = await client.question.reply({ requestID: ask.requestId, directory, answers: answer.answers ?? [] })
    return outcomeOf({ status: replied.response?.status, ok: !isNil(replied.data), error: replied.error })
}

function outcomeOf({ status, ok, error }: { status: number | undefined, ok: boolean, error: unknown }): 'sent' | 'gone' | { message: string } {
    if (ok) {
        return 'sent'
    }
    if (status === GONE_STATUS || status === NOT_FOUND_STATUS) {
        return 'gone'
    }
    return { message: opencodeErrors.describe({ error }) }
}

function viewOf({ ask, step, adminPanelUrl }: { ask: OpencodeAskRow, step: OpencodeStepRow | undefined, adminPanelUrl: string }): OpencodeAsk {
    return {
        id: ask.id,
        created: ask.created,
        flowId: ask.flowId,
        flowRunId: ask.flowRunId,
        flowVersionId: ask.flowVersionId,
        stepName: ask.stepName,
        kind: ask.kind,
        status: ask.status === ANSWERING ? OpencodeAskStatus.OPEN : ask.status,
        agent: ask.agent,
        permission: ask.permission,
        questions: ask.questions,
        deadline: ask.deadline,
        answer: ask.answer,
        answeredVia: ask.answeredVia,
        answeredAt: ask.answeredAt,
        adminPanelUrl: isNil(step?.directory) ? null : `${adminPanelUrl.replace(/\/+$/, '')}/${Buffer.from(step.directory).toString('base64url')}/session/${ask.sessionId}`,
    }
}

function permissionAsk({ request }: { request: { id: string, sessionID: string, permission: string, patterns: string[], metadata: Record<string, unknown> } }): OpencodeAskRequest {
    return {
        kind: OpencodeAskKind.PERMISSION,
        requestId: request.id,
        sessionId: request.sessionID,
        permission: { permission: request.permission, patterns: request.patterns, metadata: request.metadata },
    }
}

function questionAsk({ request }: { request: { id: string, sessionID: string, questions: OpencodeQuestion[] } }): OpencodeAskRequest {
    return {
        kind: OpencodeAskKind.QUESTION,
        requestId: request.id,
        sessionId: request.sessionID,
        questions: request.questions,
    }
}

function summaryOf({ ask }: { ask: OpencodeAskRow }): string {
    if (ask.kind === OpencodeAskKind.QUESTION) {
        return 'question'
    }
    return `permission request (${ask.permission?.permission ?? 'permission'}: ${(ask.permission?.patterns ?? []).join(', ')})`
}

async function notifyClosed({ raw, log }: { raw: unknown, log: FastifyBaseLogger }): Promise<void> {
    const ids = Array.isArray(raw) ? raw.flatMap((row) => ClosedRow.safeParse(row).data?.id ?? []) : []
    if (ids.length === 0) {
        return
    }
    const closed = await askRepo().findBy({ id: In(ids) })
    closed.forEach((ask) => opencodeAskNotices(log).closed({ ask }))
}

function plainStepName({ stepKey }: { stepKey: string }): string {
    return stepKey.split('/').pop() ?? stepKey
}

function alreadyAnswered(): ActivepiecesError {
    return new ActivepiecesError({ code: ErrorCode.VALIDATION, params: { message: 'This request was already answered.' } })
}

function hasRows({ raw }: { raw: unknown }): boolean {
    return Array.isArray(raw) && raw.length > 0
}

const ANSWERING = 'ANSWERING'

const VIA_OPENCODE = 'opencode'

const VIA_DEADLINE = 'deadline'

const DECISION_VIA = 'client'

const MAX_SESSION_DEPTH = 4

const STUCK_ANSWER_SECONDS = 60

const BATCH_SIZE = 100

const LIST_LIMIT = 50

const GONE_STATUS = 409

const NOT_FOUND_STATUS = 404

const ClosedRow = z.object({ id: z.string() })

export const opencodeAskVia = {
    RUN_PAGE: 'run-page',
    LINK: 'link',
}

export type ExpiredAsk = {
    stepId: string
    failure: string
}

export type OpencodeAskRequest = {
    kind: OpencodeAskKind
    requestId: string
    sessionId: string
    permission?: OpencodeAskRow['permission']
    questions?: OpencodeQuestion[]
}

type OpenParams = {
    platformId: string
    directory: string | undefined
    request: OpencodeAskRequest
}

type AnswerParams = {
    askId: string
    projectId: string
    request: AnswerOpencodeAskRequest
    via: string
}

type ListParams = {
    projectId: string
    flowRunId?: string
    flowVersionId?: string
    stepName?: string
}

type StepOfSessionParams = {
    platformId: string
    directory: string | undefined
    sessionId: string
    client: OpencodeClient
    depth: number
}

type SendAnswerParams = {
    ask: OpencodeAskRow
    answer: OpencodeAskAnswer
    client: OpencodeClient
    directory: string | undefined
}
