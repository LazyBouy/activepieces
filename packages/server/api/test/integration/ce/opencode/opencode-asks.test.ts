import { OpencodeAskKind, OpencodeAskStatus, WebsocketClientEvent } from '@activepieces/shared'
import dayjs from 'dayjs'
import { FastifyInstance } from 'fastify'
import { StatusCodes } from 'http-status-codes'
import { z } from 'zod'
import { opencodeBridge } from '../../../../src/app/opencode/opencode-bridge'
import { opencodeSweep } from '../../../../src/app/opencode/opencode-sweep'
import { db } from '../../../helpers/db'
import { opencodeStepFixtures, RoutedSetup } from '../../../helpers/opencode-steps'
import { OpencodeStub, startOpencodeStub } from '../../../helpers/opencode-stub'
import { setupTestEnvironment, teardownTestEnvironment } from '../../../helpers/test-setup'

let app: FastifyInstance | null = null
let stub: OpencodeStub
const { routedFlow, waitpointFor, engineToken, stepRow, resumedBody, sessionOf, idleEvent, captureEmits } = opencodeStepFixtures({ app: () => app!, stub: () => stub })

beforeAll(async () => {
    stub = await startOpencodeStub()
    process.env.AP_OPENCODE_URL = stub.url
    app = await setupTestEnvironment()
})

afterAll(async () => {
    delete process.env.AP_OPENCODE_URL
    await teardownTestEnvironment()
    await stub.close()
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('OpenCode asks', () => {
    it('opens an ask for a routed step, extends its deadline, notifies the project, and sends the answer to OpenCode once', async () => {
        const { setup, waitpointId, step } = await runningAgent()
        const emitted = captureEmits()

        await ask({ setup, requestId: 'per_1', sessionId: step.sessionId })

        const row = AskRow.parse(await db.findOneBy('opencode_ask', { requestId: 'per_1' }))
        expect(row).toMatchObject({ status: OpencodeAskStatus.OPEN, kind: OpencodeAskKind.PERMISSION, stepName: 'step_1', flowRunId: setup.run.id, agent: 'flow' })
        expect(dayjs(row.deadline).diff(dayjs(), 'minute')).toBeGreaterThan(1430)
        const waitpoint = WaitpointRow.parse(await db.findOneBy('waitpoint', { id: waitpointId }))
        expect(dayjs(waitpoint.resumeDateTime).isAfter(dayjs().add(23, 'hour'))).toBe(true)
        expect(emitted).toContainEqual(expect.objectContaining({
            room: setup.ctx.project.id,
            event: WebsocketClientEvent.OPENCODE_ASK,
            payload: expect.objectContaining({ state: 'opened', stepName: 'step_1', title: 'bash: rm -rf build' }),
        }))

        const listed = await setup.ctx.get('/v1/opencode/asks', { projectId: setup.ctx.project.id, flowRunId: setup.run.id })
        expect(listed.json()).toEqual([expect.objectContaining({
            id: row.id,
            status: OpencodeAskStatus.OPEN,
            permission: { permission: 'bash', patterns: ['rm -rf build'], metadata: { command: 'rm -rf build' } },
            adminPanelUrl: expect.stringMatching(new RegExp(`/session/${step.sessionId}$`)),
        })])

        const answered = await setup.ctx.post(`/v1/opencode/asks/${row.id}/answer`, { type: 'permission', decision: 'allow-session' })
        const again = await setup.ctx.post(`/v1/opencode/asks/${row.id}/answer`, { type: 'permission', decision: 'deny' })

        expect(answered.json()).toMatchObject({ status: OpencodeAskStatus.ANSWERED, answer: { decision: 'allow-session' }, answeredVia: 'run-page' })
        expect(again.statusCode).toBe(StatusCodes.CONFLICT)
        expect(again.json()).toMatchObject({ params: { message: 'This request was already answered.' } })
        expect(stub.state.decisions.filter((decision) => decision.requestId === 'per_1')).toEqual([{
            requestId: 'per_1',
            body: { decision: 'allow-session', via: 'client' },
            query: { confirmCopy: 'true' },
        }])
        expect(emitted).toContainEqual(expect.objectContaining({ payload: expect.objectContaining({ askId: row.id, state: 'closed' }) }))
    })

    it('keeps a builder test\'s wait limit, and gives the ask the step\'s own deadline', async () => {
        const { setup, waitpointId, step } = await runningAgent()
        const testLimit = dayjs().add(15, 'minute').toISOString()
        await db.update('flow_run', setup.run.id, { environment: 'TESTING' })
        await db.update('waitpoint', waitpointId, { resumeDateTime: testLimit })

        await ask({ setup, requestId: 'per_test', sessionId: step.sessionId })

        const row = AskRow.parse(await db.findOneBy('opencode_ask', { requestId: 'per_test' }))
        const waitpoint = WaitpointRow.parse(await db.findOneBy('waitpoint', { id: waitpointId }))
        expect(dayjs(waitpoint.resumeDateTime).toISOString()).toBe(testLimit)
        expect(dayjs(row.deadline).toISOString()).toBe(testLimit)
    })

    it('closes an ask answered in the admin panel, and refuses an answer OpenCode no longer waits for', async () => {
        const { setup, step } = await runningAgent()
        await ask({ setup, requestId: 'per_2', sessionId: step.sessionId })
        await ask({ setup, requestId: 'per_3', sessionId: step.sessionId })
        const gone = AskRow.parse(await db.findOneBy('opencode_ask', { requestId: 'per_3' }))
        stub.state.goneRequests.push('per_3')

        await event({ setup, payload: { type: 'permission.replied', properties: { sessionID: step.sessionId, requestID: 'per_2', reply: 'once' } } })
        const refused = await setup.ctx.post(`/v1/opencode/asks/${gone.id}/answer`, { type: 'permission', decision: 'allow' })

        expect(await db.findOneBy('opencode_ask', { requestId: 'per_2' })).toMatchObject({ status: OpencodeAskStatus.CLOSED, answeredVia: 'opencode' })
        expect(refused.statusCode).toBe(StatusCodes.CONFLICT)
        expect(await db.findOneBy('opencode_ask', { requestId: 'per_3' })).toMatchObject({ status: OpencodeAskStatus.CLOSED })
    })

    it('keeps the ask open and says why when OpenCode does not accept a decision', async () => {
        const { setup, step } = await runningAgent()
        await ask({ setup, requestId: 'per_refused', sessionId: step.sessionId })
        const row = AskRow.parse(await db.findOneBy('opencode_ask', { requestId: 'per_refused' }))
        stub.state.refusedRequests.push('per_refused')

        const refused = await setup.ctx.post(`/v1/opencode/asks/${row.id}/answer`, { type: 'permission', decision: 'allow-agent' })

        expect(refused.json()).toMatchObject({ params: { message: 'OpenCode did not accept the answer: Give the rule a pattern' } })
        expect(await db.findOneBy('opencode_ask', { id: row.id })).toMatchObject({ status: OpencodeAskStatus.OPEN })
    })

    it('attaches a subagent\'s ask to its parent step, and ignores asks from sessions Activepieces did not start', async () => {
        const { setup, step } = await runningAgent()
        const child = await stub.createSession({ directory: sessionOf({ id: step.sessionId }).directory, parentId: step.sessionId ?? '' })
        const stranger = await stub.createSession({ directory: sessionOf({ id: step.sessionId }).directory })

        await ask({ setup, requestId: 'per_child', sessionId: child })
        await ask({ setup, requestId: 'per_stranger', sessionId: stranger })

        expect(await db.findOneBy('opencode_ask', { requestId: 'per_child' })).toMatchObject({ opencodeStepId: step.id, sessionId: child })
        expect(await db.findOneBy('opencode_ask', { requestId: 'per_stranger' })).toBeNull()
    })

    it('answers a question with the chosen options, or dismisses it', async () => {
        const { setup, step } = await runningAgent()
        await question({ setup, requestId: 'que_1', sessionId: step.sessionId })
        await question({ setup, requestId: 'que_2', sessionId: step.sessionId })
        const first = AskRow.parse(await db.findOneBy('opencode_ask', { requestId: 'que_1' }))
        const second = AskRow.parse(await db.findOneBy('opencode_ask', { requestId: 'que_2' }))

        const wrongShape = await setup.ctx.post(`/v1/opencode/asks/${first.id}/answer`, { type: 'permission', decision: 'allow' })
        await setup.ctx.post(`/v1/opencode/asks/${first.id}/answer`, { type: 'question', answers: [['Staging']] })
        await setup.ctx.post(`/v1/opencode/asks/${second.id}/answer`, { type: 'dismiss' })

        expect(wrongShape.json()).toMatchObject({ params: { message: 'That answer does not fit this request.' } })
        expect(stub.state.questionReplies).toEqual(expect.arrayContaining([
            { requestId: 'que_1', kind: 'reply', body: { answers: [['Staging']] } },
            { requestId: 'que_2', kind: 'reject', body: {} },
        ]))
        expect(await db.findOneBy('opencode_ask', { id: second.id })).toMatchObject({ status: OpencodeAskStatus.ANSWERED, answer: { dismissed: true } })
    })

    it('serves a signed approval link whose GET only shows the request and whose POST decides', async () => {
        const { setup, step } = await runningAgent()
        await ask({ setup, requestId: 'per_link', sessionId: step.sessionId })
        const row = AskRow.parse(await db.findOneBy('opencode_ask', { requestId: 'per_link' }))
        const link = LinkResponse.parse((await setup.ctx.post(`/v1/opencode/asks/${row.id}/link`, {})).json())
        const url = new URL(link.url)
        const path = `${url.pathname}${url.search}`

        const page = await app!.inject({ method: 'GET', url: path })
        const decided = await app!.inject({ method: 'POST', url: `${path}&action=deny`, headers: { accept: 'text/html', 'content-type': 'application/x-www-form-urlencoded' }, payload: 'note=Not+on+production' })
        const reopened = await app!.inject({ method: 'GET', url: path })
        const forged = await app!.inject({ method: 'GET', url: '/api/v1/opencode/ask-links?token=not-a-token' })

        expect(page.headers['content-security-policy']).toContain('form-action \'self\'')
        expect(page.body).toContain('Allow once')
        expect(page.body).toContain('rm -rf build')
        expect(stub.state.decisions.filter((decision) => decision.requestId === 'per_link')).toEqual([expect.objectContaining({ body: { decision: 'deny', via: 'client', note: 'Not on production' } })])
        expect(decided.body).toContain('Answer recorded')
        expect(reopened.body).toContain('Already answered')
        expect(forged.body).toContain('Link not valid')
        expect(await db.findOneBy('opencode_ask', { id: row.id })).toMatchObject({ status: OpencodeAskStatus.ANSWERED, answeredVia: 'link' })
    })

    it('rejects an ask nobody answered in time, aborts the session and fails the step with E11', async () => {
        const { setup, waitpointId, step } = await runningAgent()
        await ask({ setup, requestId: 'per_late', sessionId: step.sessionId })
        const row = AskRow.parse(await db.findOneBy('opencode_ask', { requestId: 'per_late' }))
        await db.update('opencode_ask', row.id, { deadline: dayjs().subtract(1, 'minute').toISOString() })

        await opencodeSweep(app!.log).expireAsks()

        const failure = 'Nobody answered OpenCode\'s permission request (bash: rm -rf build) within 24 h.'
        expect(await db.findOneBy('opencode_ask', { id: row.id })).toMatchObject({ status: OpencodeAskStatus.EXPIRED, answeredVia: 'deadline' })
        expect(stub.state.decisions.filter((decision) => decision.requestId === 'per_late')).toEqual([expect.objectContaining({ body: { decision: 'deny', via: 'client', note: failure } })])
        expect(sessionOf({ id: step.sessionId }).aborted).toBe(1)
        expect(await resumedBody({ waitpointId })).toEqual({ failure })
    })

    it('lets an answer that never reached OpenCode be given again, and keeps an ask opened while the waiting list was read', async () => {
        const { setup, step } = await runningAgent()
        await ask({ setup, requestId: 'per_stuck', sessionId: step.sessionId })
        await ask({ setup, requestId: 'per_new', sessionId: step.sessionId })
        const stuck = AskRow.parse(await db.findOneBy('opencode_ask', { requestId: 'per_stuck' }))
        const fresh = AskRow.parse(await db.findOneBy('opencode_ask', { requestId: 'per_new' }))
        await db.update('opencode_ask', stuck.id, { status: 'ANSWERING', updated: dayjs().subtract(2, 'minute').toISOString() })
        await db.update('opencode_ask', fresh.id, { created: dayjs().add(1, 'minute').toISOString() })
        stub.state.pendingPermissions = [{ id: 'per_stuck', sessionID: step.sessionId, permission: 'bash', patterns: ['rm -rf build'], metadata: {}, always: [] }]

        await opencodeSweep(app!.log).expireAsks()
        await opencodeSweep(app!.log).reconcileAsks()
        const answered = await setup.ctx.post(`/v1/opencode/asks/${stuck.id}/answer`, { type: 'permission', decision: 'allow' })

        expect(answered.json()).toMatchObject({ status: OpencodeAskStatus.ANSWERED, answeredVia: 'run-page' })
        expect(await db.findOneBy('opencode_ask', { id: fresh.id })).toMatchObject({ status: OpencodeAskStatus.OPEN })
        stub.state.pendingPermissions = []
    })

    it('picks up asks it missed from OpenCode\'s waiting lists, closes them once they are gone, and closes open asks when the step ends', async () => {
        const { setup, waitpointId, step } = await runningAgent()
        stub.state.pendingPermissions.push({ id: 'per_missed', sessionID: step.sessionId, permission: 'edit', patterns: ['src/app.ts'], metadata: {}, always: [] })

        await opencodeSweep(app!.log).reconcileAsks()
        expect(await db.findOneBy('opencode_ask', { requestId: 'per_missed' })).toMatchObject({ status: OpencodeAskStatus.OPEN, permission: { permission: 'edit' } })

        stub.state.pendingPermissions = []
        await opencodeSweep(app!.log).reconcileAsks()
        expect(await db.findOneBy('opencode_ask', { requestId: 'per_missed' })).toMatchObject({ status: OpencodeAskStatus.CLOSED })

        await ask({ setup, requestId: 'per_open', sessionId: step.sessionId })
        stub.answer({ sessionId: step.sessionId, text: 'Done' })
        await opencodeBridge(app!.log).handleEvent({ platformId: setup.ctx.platform.id, event: idleEvent({ sessionId: step.sessionId }) })
        await resumedBody({ waitpointId })
        expect(await db.findOneBy('opencode_ask', { requestId: 'per_open' })).toMatchObject({ status: OpencodeAskStatus.CLOSED })
    })
})

async function runningAgent(): Promise<{ setup: RoutedSetup, waitpointId: string, step: { id: string, sessionId: string | null } }> {
    const setup = await routedFlow({ steps: [{ name: 'step_1', actionName: 'run_agent' }] })
    await db.update('flow_run', setup.run.id, { environment: 'PRODUCTION' })
    const waitpointId = await waitpointFor({ setup, stepName: 'step_1' })
    await app!.inject({
        method: 'POST',
        url: '/api/v1/agents/runs',
        headers: { authorization: `Bearer ${await engineToken({ setup })}` },
        body: { flowRunId: setup.run.id, waitpointId, instruction: 'Clean the build folder' },
    })
    return { setup, waitpointId, step: await stepRow({ waitpointId }) }
}

async function ask({ setup, requestId, sessionId }: { setup: RoutedSetup, requestId: string, sessionId: string | null }): Promise<void> {
    await event({ setup, payload: { type: 'permission.asked', properties: { id: requestId, sessionID: sessionId, permission: 'bash', patterns: ['rm -rf build'], metadata: { command: 'rm -rf build' }, always: ['rm *'] } } })
}

async function question({ setup, requestId, sessionId }: { setup: RoutedSetup, requestId: string, sessionId: string | null }): Promise<void> {
    await event({ setup, payload: { type: 'question.asked', properties: { id: requestId, sessionID: sessionId, questions: [{ question: 'Where should I deploy?', header: 'Target', options: [{ label: 'Staging', description: 'The test system' }, { label: 'Production', description: 'Live' }] }] } } })
}

async function event({ setup, payload }: { setup: RoutedSetup, payload: Record<string, unknown> }): Promise<void> {
    const sessionId = z.object({ properties: z.object({ sessionID: z.string().nullable() }) }).parse(payload).properties.sessionID
    const directory = stub.state.sessions.find((session) => session.id === sessionId)?.directory
    await opencodeBridge(app!.log).handleEvent({ platformId: setup.ctx.platform.id, event: { directory, payload } })
}

const AskRow = z.object({ id: z.string(), status: z.string(), deadline: z.union([z.string(), z.date()]) }).passthrough()

const WaitpointRow = z.object({ resumeDateTime: z.union([z.string(), z.date()]) })

const LinkResponse = z.object({ url: z.string() })
