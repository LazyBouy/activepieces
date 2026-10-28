import { AIProviderName, AiStepAction, apId } from '@activepieces/core-utils'
import { FlowRunStatus } from '@activepieces/shared'
import { FastifyInstance } from 'fastify'
import { StatusCodes } from 'http-status-codes'
import { opencodeBridge } from '../../../../src/app/opencode/opencode-bridge'
import { opencodeSweep } from '../../../../src/app/opencode/opencode-sweep'
import { db } from '../../../helpers/db'
import { opencodeStepFixtures, RoutedSetup } from '../../../helpers/opencode-steps'
import { OpencodeStub, startOpencodeStub } from '../../../helpers/opencode-stub'
import { setupTestEnvironment, teardownTestEnvironment } from '../../../helpers/test-setup'

let app: FastifyInstance | null = null
let stub: OpencodeStub
const { routedFlow, waitpointFor, engineToken, stepRow, resumedBody, sessionOf, seedNamespace, idleEvent, statusIdleEvent, waitFor } = opencodeStepFixtures({ app: () => app!, stub: () => stub })

beforeAll(async () => {
    stub = await startOpencodeStub()
    stub.state.providers.push({ id: 'openrouter', name: 'OpenRouter', models: [{ id: 'qwen/qwen3-coder', name: 'Qwen3 Coder' }] })
    process.env.AP_OPENCODE_URL = stub.url
    app = await setupTestEnvironment()
})

afterAll(async () => {
    delete process.env.AP_OPENCODE_URL
    await teardownTestEnvironment()
    await stub.close()
})

describe('AI steps on OpenCode', () => {
    it('sends Ask AI to the project\'s own OpenCode project as a traceable session and resumes the step with the answer', async () => {
        const setup = await routedFlow({ steps: [{ name: 'step_1' }] })
        const waitpointId = await waitpointFor({ setup, stepName: 'step_1' })

        const response = await execute({ setup, waitpointId, body: { action: AiStepAction.ASK_AI, prompt: 'Say hi' } })

        expect(response.statusCode).toBe(StatusCodes.OK)
        expect(response.json()).toEqual({ requestId: expect.any(String) })
        const step = await stepRow({ waitpointId })
        expect(step).toMatchObject({ status: 'DISPATCHED', sessionMode: 'NEW_PER_STEP', namespace: 'iphi-flow', agent: 'flow', stepName: 'step_1' })
        const session = sessionOf({ id: step.sessionId })
        expect(session.title).toBe(`Routed flow · run ${setup.run.id} · step_1`)
        expect(session.directory).toBe(`/root/opencode-home/iphi-flow/${setup.ctx.project.id}`)
        expect(session.metadata).toMatchObject({ source: 'iphi-flow', projectId: setup.ctx.project.id, flowRunId: setup.run.id, stepName: 'step_1' })
        expect(session.prompts).toEqual([{
            messageID: step.messageId,
            agent: 'flow',
            parts: [{ type: 'text', text: 'Say hi' }],
        }])
        expect(step.messageId).toMatch(/^msg_[0-9a-f]{12}[0-9A-Za-z]{14}$/)

        stub.answer({ sessionId: step.sessionId, text: 'Hi there' })
        await opencodeBridge(app!.log).handleEvent({ platformId: setup.ctx.platform.id, event: idleEvent({ sessionId: step.sessionId }) })

        expect(await resumedBody({ waitpointId })).toEqual({ output: { answer: 'Hi there' } })
        expect(await stepRow({ waitpointId })).toMatchObject({ status: 'COMPLETED', request: null })
    })

    it('sends the earlier conversation as visible text and returns it with the new turn', async () => {
        const setup = await routedFlow({ steps: [{ name: 'step_1' }] })
        const waitpointId = await waitpointFor({ setup, stepName: 'step_1' })
        const conversation = [{ role: 'user', content: 'My name is Ada' }, { role: 'assistant', content: 'Hello Ada' }]

        await execute({ setup, waitpointId, body: { action: AiStepAction.ASK_AI, prompt: 'What is my name?', conversation } })
        const step = await stepRow({ waitpointId })
        stub.answer({ sessionId: step.sessionId, text: 'Ada' })
        await opencodeBridge(app!.log).handleEvent({ platformId: setup.ctx.platform.id, event: statusIdleEvent({ sessionId: step.sessionId }) })

        expect(sessionOf({ id: step.sessionId }).prompts[0]['parts']).toEqual([{
            type: 'text',
            text: 'Earlier in this conversation:\nUser: My name is Ada\nAssistant: Hello Ada\n\nWhat is my name?',
        }])
        expect(await resumedBody({ waitpointId })).toEqual({
            output: {
                answer: 'Ada',
                conversation: [...conversation, { role: 'user', content: 'What is my name?' }, { role: 'assistant', content: 'Ada' }],
            },
        })
    })

    it('asks Classify for a structured category and fails when the model picks something else', async () => {
        const setup = await routedFlow({ steps: [{ name: 'step_1', actionName: 'classifyText' }, { name: 'step_2', actionName: 'classifyText' }] })
        const first = await waitpointFor({ setup, stepName: 'step_1' })
        const second = await waitpointFor({ setup, stepName: 'step_2' })
        const body = { action: AiStepAction.CLASSIFY_TEXT, text: 'My card was charged twice', categories: ['billing', 'shipping'] }

        await execute({ setup, waitpointId: first, body })
        await execute({ setup, waitpointId: second, body })
        const firstStep = await stepRow({ waitpointId: first })
        const secondStep = await stepRow({ waitpointId: second })
        stub.answer({ sessionId: firstStep.sessionId, structured: { category: 'billing' }, finish: 'tool-calls' })
        stub.answer({ sessionId: secondStep.sessionId, structured: { category: 'refunds' }, finish: 'tool-calls' })
        await opencodeBridge(app!.log).handleEvent({ platformId: setup.ctx.platform.id, event: idleEvent({ sessionId: firstStep.sessionId }) })
        await opencodeBridge(app!.log).handleEvent({ platformId: setup.ctx.platform.id, event: idleEvent({ sessionId: secondStep.sessionId }) })

        expect(sessionOf({ id: firstStep.sessionId }).prompts[0]['format']).toEqual({
            type: 'json_schema',
            schema: {
                type: 'object',
                properties: { category: { type: 'string', enum: ['billing', 'shipping'] } },
                required: ['category'],
                additionalProperties: false,
            },
        })
        expect(await resumedBody({ waitpointId: first })).toEqual({ output: { answer: 'billing' } })
        expect(await resumedBody({ waitpointId: second })).toEqual({ failure: 'Unable to classify the text into the provided categories.' })
        expect(await stepRow({ waitpointId: second })).toMatchObject({ status: 'FAILED' })
    })

    it('restores Extract field names and fails when no structured output comes back', async () => {
        const setup = await routedFlow({ steps: [{ name: 'step_1', actionName: 'extractStructuredData' }, { name: 'step_2', actionName: 'extractStructuredData' }] })
        const first = await waitpointFor({ setup, stepName: 'step_1' })
        const second = await waitpointFor({ setup, stepName: 'step_2' })
        const body = {
            action: AiStepAction.EXTRACT_STRUCTURED_DATA,
            text: 'Invoice 42 from ACME',
            schema: { mode: 'simple', fields: [{ name: 'invoice number', type: 'string', isRequired: true }] },
        }

        await execute({ setup, waitpointId: first, body })
        await execute({ setup, waitpointId: second, body })
        const firstStep = await stepRow({ waitpointId: first })
        const secondStep = await stepRow({ waitpointId: second })
        stub.answer({ sessionId: firstStep.sessionId, structured: { invoice_number: '42' } })
        stub.answer({ sessionId: secondStep.sessionId, text: 'I could not find it' })
        await opencodeBridge(app!.log).handleEvent({ platformId: setup.ctx.platform.id, event: idleEvent({ sessionId: firstStep.sessionId }) })
        await opencodeBridge(app!.log).handleEvent({ platformId: setup.ctx.platform.id, event: idleEvent({ sessionId: secondStep.sessionId }) })

        expect(sessionOf({ id: firstStep.sessionId }).prompts[0]).toMatchObject({
            parts: [{ type: 'text', text: 'Extract the following data from the provided data.\n\nText to analyze:\nInvoice 42 from ACME' }],
            format: { type: 'json_schema', schema: { type: 'object', properties: { invoice_number: { type: 'string' } }, required: ['invoice_number'] } },
        })
        expect(await resumedBody({ waitpointId: first })).toEqual({ output: { answer: { 'invoice number': '42' } } })
        expect(await resumedBody({ waitpointId: second })).toEqual({ failure: 'The model did not return the requested structured output.' })
    })

    it('uses the step\'s OpenCode model choice, location and agent, and refuses a project that is not allowlisted', async () => {
        const setup = await routedFlow({
            steps: [
                { name: 'step_1', opencode: { namespace: 'crew', project: 'c0001', agent: 'reviewer' } },
                { name: 'step_2', opencode: { namespace: 'vault', project: 'v0001' } },
            ],
        })
        seedNamespace({ id: 'crew', projects: ['c0001'] })
        seedNamespace({ id: 'vault', projects: ['v0001'] })
        await setup.ctx.post('/v1/opencode/connection', { allowlist: ['iphi-flow', 'crew'] })
        const first = await waitpointFor({ setup, stepName: 'step_1' })
        const second = await waitpointFor({ setup, stepName: 'step_2' })

        await execute({ setup, waitpointId: first, body: { action: AiStepAction.SUMMARIZE_TEXT, prompt: 'Be brief.', text: 'Long text', provider: AIProviderName.CUSTOM, providerConfigId: 'opencode:openrouter', modelId: 'qwen/qwen3-coder' } })
        await execute({ setup, waitpointId: second, body: { action: AiStepAction.SUMMARIZE_TEXT, text: 'Long text' } })

        const firstStep = await stepRow({ waitpointId: first })
        expect(firstStep).toMatchObject({ namespace: 'crew', opencodeProjectId: 'c0001', directory: '/root/opencode-home/crew/c0001', agent: 'reviewer', model: { providerID: 'openrouter', modelID: 'qwen/qwen3-coder' } })
        expect(sessionOf({ id: firstStep.sessionId }).prompts[0]).toMatchObject({
            agent: 'reviewer',
            model: { providerID: 'openrouter', modelID: 'qwen/qwen3-coder' },
            parts: [{ type: 'text', text: 'Be brief. Summarize the following text : Long text' }],
        })
        expect(await resumedBody({ waitpointId: second })).toEqual({ failure: 'vault/v0001 is not allowlisted. A platform admin can add it in Platform → AI → OpenCode.' })
    })

    it('waits while a turn that stopped for tool calls is still running, and finishes once the session is idle', async () => {
        const setup = await routedFlow({ steps: [{ name: 'step_1' }] })
        const waitpointId = await waitpointFor({ setup, stepName: 'step_1' })
        await execute({ setup, waitpointId, body: { action: AiStepAction.ASK_AI, prompt: 'Use a tool' } })
        const step = await stepRow({ waitpointId })
        stub.answer({ sessionId: step.sessionId, text: 'Let me check', finish: 'tool-calls' })
        stub.state.busy.push(step.sessionId ?? '')

        await opencodeBridge(app!.log).handleEvent({ platformId: setup.ctx.platform.id, event: idleEvent({ sessionId: step.sessionId }) })
        expect(await stepRow({ waitpointId })).toMatchObject({ status: 'DISPATCHED' })

        stub.state.busy = []
        await opencodeBridge(app!.log).handleEvent({ platformId: setup.ctx.platform.id, event: idleEvent({ sessionId: step.sessionId }) })
        expect(await resumedBody({ waitpointId })).toEqual({ output: { answer: 'Let me check' } })
    })

    it('never sends a step twice when its request comes in again', async () => {
        const setup = await routedFlow({ steps: [{ name: 'step_1' }] })
        const waitpointId = await waitpointFor({ setup, stepName: 'step_1' })

        await execute({ setup, waitpointId, body: { action: AiStepAction.ASK_AI, prompt: 'Once' } })
        await execute({ setup, waitpointId, body: { action: AiStepAction.ASK_AI, prompt: 'Once' } })
        const step = await stepRow({ waitpointId })
        await db.update('opencode_step', step.id, { status: 'PENDING', updated: new Date(Date.now() - 120_000).toISOString() })
        await opencodeSweep(app!.log).resendPending()

        expect(await db.findBy('opencode_step', { waitpointId })).toHaveLength(1)
        expect(sessionOf({ id: step.sessionId }).prompts).toHaveLength(1)
        expect(await stepRow({ waitpointId })).toMatchObject({ status: 'DISPATCHED' })
    })

    it('shares one session per run, project and agent, one step at a time, when the flow default is one per run', async () => {
        const setup = await routedFlow({ steps: [{ name: 'step_1' }, { name: 'step_2' }], defaults: { sessionMode: 'ONE_PER_RUN' } })
        const first = await waitpointFor({ setup, stepName: 'step_1' })
        const second = await waitpointFor({ setup, stepName: 'step_2' })

        await execute({ setup, waitpointId: first, body: { action: AiStepAction.ASK_AI, prompt: 'First' } })
        await execute({ setup, waitpointId: second, body: { action: AiStepAction.ASK_AI, prompt: 'Second' } })
        const firstStep = await stepRow({ waitpointId: first })

        expect(firstStep).toMatchObject({ status: 'DISPATCHED', sessionMode: 'ONE_PER_RUN' })
        expect(await stepRow({ waitpointId: second })).toMatchObject({ status: 'QUEUED', sessionId: null })
        expect(sessionOf({ id: firstStep.sessionId }).title).toBe(`Routed flow · run ${setup.run.id}`)

        stub.answer({ sessionId: firstStep.sessionId, text: 'one' })
        await opencodeBridge(app!.log).handleEvent({ platformId: setup.ctx.platform.id, event: idleEvent({ sessionId: firstStep.sessionId }) })
        await waitFor(async () => (await stepRow({ waitpointId: second })).status === 'DISPATCHED')
        const secondStep = await stepRow({ waitpointId: second })

        expect(secondStep.sessionId).toBe(firstStep.sessionId)
        expect(sessionOf({ id: firstStep.sessionId }).prompts.map((prompt) => prompt['parts'])).toEqual([
            [{ type: 'text', text: 'First' }],
            [{ type: 'text', text: 'Second' }],
        ])
        stub.answer({ sessionId: secondStep.sessionId, text: 'two' })
        await opencodeBridge(app!.log).handleEvent({ platformId: setup.ctx.platform.id, event: idleEvent({ sessionId: secondStep.sessionId }) })

        expect(await resumedBody({ waitpointId: first })).toEqual({ output: { answer: 'one' } })
        expect(await resumedBody({ waitpointId: second })).toEqual({ output: { answer: 'two' } })
        expect(await db.findBy('opencode_run_session', { flowRunId: setup.run.id })).toEqual([expect.objectContaining({ sessionId: firstStep.sessionId, activeStepId: null })])
    })

    it('fails the step with the OpenCode error, and with a clear message when the session was deleted', async () => {
        const setup = await routedFlow({ steps: [{ name: 'step_1' }, { name: 'step_2' }, { name: 'step_3' }] })
        const errored = await waitpointFor({ setup, stepName: 'step_1' })
        const deleted = await waitpointFor({ setup, stepName: 'step_2' })
        const failedReply = await waitpointFor({ setup, stepName: 'step_3' })

        for (const waitpointId of [errored, deleted, failedReply]) {
            await execute({ setup, waitpointId, body: { action: AiStepAction.ASK_AI, prompt: 'Go' } })
        }
        const erroredStep = await stepRow({ waitpointId: errored })
        const deletedStep = await stepRow({ waitpointId: deleted })
        const failedStep = await stepRow({ waitpointId: failedReply })
        stub.answer({ sessionId: failedStep.sessionId, error: { name: 'ProviderAuthError', data: { message: 'No API key for openrouter' } } })
        await opencodeBridge(app!.log).handleEvent({ platformId: setup.ctx.platform.id, event: { directory: '/x', payload: { type: 'session.error', properties: { sessionID: erroredStep.sessionId, error: { name: 'UnknownError', data: { message: 'model crashed' } } } } } })
        await opencodeBridge(app!.log).handleEvent({ platformId: setup.ctx.platform.id, event: { directory: '/x', payload: { type: 'session.deleted', properties: { sessionID: deletedStep.sessionId, info: {} } } } })
        await opencodeBridge(app!.log).handleEvent({ platformId: setup.ctx.platform.id, event: idleEvent({ sessionId: failedStep.sessionId }) })

        expect(await resumedBody({ waitpointId: errored })).toEqual({ failure: 'OpenCode stopped with an error: model crashed.' })
        expect(await resumedBody({ waitpointId: deleted })).toEqual({ failure: `The OpenCode session ${deletedStep.sessionId} no longer exists.` })
        expect(await resumedBody({ waitpointId: failedReply })).toEqual({ failure: 'OpenCode stopped with an error: No API key for openrouter.' })
    })

    it('fails clearly when OpenCode cannot be reached', async () => {
        const setup = await routedFlow({ steps: [{ name: 'step_1' }] })
        await setup.ctx.post('/v1/opencode/connection', { serverUrl: 'http://127.0.0.1:9' })
        const waitpointId = await waitpointFor({ setup, stepName: 'step_1' })

        await execute({ setup, waitpointId, body: { action: AiStepAction.ASK_AI, prompt: 'Anyone?' } })

        const body = await resumedBody({ waitpointId })
        expect(body).toEqual({ failure: expect.stringMatching(/^OpenCode did not answer at http:\/\/127\.0\.0\.1:9: .+\.$/) })
    })

    it('answers a step that cannot pause in the same request', async () => {
        const setup = await routedFlow({ steps: [{ name: 'step_1' }] })
        const before = stub.state.sessions.length

        const pending = execute({ setup, waitpointId: undefined, body: { action: AiStepAction.ASK_AI, prompt: 'Quick' } })
        await waitFor(async () => stub.state.sessions.length > before && stub.state.sessions[stub.state.sessions.length - 1].prompts.length === 1)
        const session = stub.state.sessions[stub.state.sessions.length - 1]
        stub.answer({ sessionId: session.id, text: 'Done' })
        await opencodeBridge(app!.log).handleEvent({ platformId: setup.ctx.platform.id, event: idleEvent({ sessionId: session.id }) })
        const response = await pending

        expect(response.json()).toEqual({ requestId: expect.any(String), output: { answer: 'Done' } })
    })

    it('completes a step whose idle event was missed, and aborts one whose flow run ended', async () => {
        const setup = await routedFlow({ steps: [{ name: 'step_1' }] })
        const other = await routedFlow({ steps: [{ name: 'step_1' }] })
        const missed = await waitpointFor({ setup, stepName: 'step_1' })
        const ended = await waitpointFor({ setup: other, stepName: 'step_1' })
        await execute({ setup, waitpointId: missed, body: { action: AiStepAction.ASK_AI, prompt: 'Late' } })
        await execute({ setup: other, waitpointId: ended, body: { action: AiStepAction.ASK_AI, prompt: 'Too late' } })
        const missedStep = await stepRow({ waitpointId: missed })
        const endedStep = await stepRow({ waitpointId: ended })
        stub.answer({ sessionId: missedStep.sessionId, text: 'Here' })
        await db.update('flow_run', other.run.id, { status: FlowRunStatus.CANCELED })
        await db.update('opencode_step', missedStep.id, { updated: new Date(Date.now() - 120_000).toISOString() })
        await db.update('opencode_step', endedStep.id, { updated: new Date(Date.now() - 120_000).toISOString() })

        await opencodeSweep(app!.log).checkDispatched({ platformId: undefined })

        expect(await resumedBody({ waitpointId: missed })).toEqual({ output: { answer: 'Here' } })
        expect(await stepRow({ waitpointId: ended })).toMatchObject({ status: 'FAILED', failure: 'The flow run ended before OpenCode answered.' })
        expect(sessionOf({ id: endedStep.sessionId }).aborted).toBe(1)
    })

    it('waits on an unfinished answer while the session is busy, and fails it as cut off once the session is idle', async () => {
        const setup = await routedFlow({ steps: [{ name: 'step_1' }] })
        const waitpointId = await waitpointFor({ setup, stepName: 'step_1' })
        await execute({ setup, waitpointId, body: { action: AiStepAction.ASK_AI, prompt: 'Write a long essay' } })
        const step = await stepRow({ waitpointId })
        stub.answer({ sessionId: step.sessionId, completed: false, finish: 'unknown' })
        stub.state.busy.push(step.sessionId ?? '')
        await db.update('opencode_step', step.id, { updated: new Date(Date.now() - 120_000).toISOString() })

        await opencodeSweep(app!.log).checkDispatched({ platformId: setup.ctx.platform.id })
        expect(await stepRow({ waitpointId })).toMatchObject({ status: 'DISPATCHED' })

        stub.state.busy = []
        await opencodeSweep(app!.log).checkDispatched({ platformId: setup.ctx.platform.id })
        expect(await resumedBody({ waitpointId })).toEqual({ failure: 'OpenCode stopped with an error: the answer was interrupted before it finished.' })
    })

    it('aborts a step whose waitpoint deadline passed', async () => {
        const setup = await routedFlow({ steps: [{ name: 'step_1' }] })
        const waitpointId = await waitpointFor({ setup, stepName: 'step_1' })
        await execute({ setup, waitpointId, body: { action: AiStepAction.ASK_AI, prompt: 'Slow' } })
        const step = await stepRow({ waitpointId })
        await db.update('waitpoint', waitpointId, { resumeDateTime: new Date(Date.now() - 1_000).toISOString() })
        await db.update('opencode_step', step.id, { updated: new Date(Date.now() - 120_000).toISOString() })

        await opencodeSweep(app!.log).checkDispatched({ platformId: setup.ctx.platform.id })

        expect(await stepRow({ waitpointId })).toMatchObject({ status: 'FAILED', failure: 'The AI step timed out before OpenCode answered.' })
        expect(sessionOf({ id: step.sessionId }).aborted).toBe(1)
    })

    it('provisions again and retries once when the OpenCode session guard refuses the default project', async () => {
        const setup = await routedFlow({ steps: [{ name: 'step_1' }, { name: 'step_2' }] })
        const retried = await waitpointFor({ setup, stepName: 'step_1' })
        const refused = await waitpointFor({ setup, stepName: 'step_2' })

        stub.state.refusals.push(409)
        await execute({ setup, waitpointId: retried, body: { action: AiStepAction.ASK_AI, prompt: 'Retry me' } })
        stub.state.refusals.push(403, 403)
        await execute({ setup, waitpointId: refused, body: { action: AiStepAction.ASK_AI, prompt: 'Refuse me' } })

        expect(await stepRow({ waitpointId: retried })).toMatchObject({ status: 'DISPATCHED' })
        expect(await resumedBody({ waitpointId: refused })).toEqual({ failure: 'Could not prepare the OpenCode project for this step: refused with 403.' })
    })

    it('completes a dispatched step from the live event stream', async () => {
        const setup = await routedFlow({ steps: [{ name: 'step_1' }] })
        const waitpointId = await waitpointFor({ setup, stepName: 'step_1' })
        await execute({ setup, waitpointId, body: { action: AiStepAction.ASK_AI, prompt: 'Stream' } })
        const step = await stepRow({ waitpointId })
        const controller = new AbortController()

        const listening = opencodeBridge(app!.log).listen({ platformId: setup.ctx.platform.id, signal: controller.signal })
        await waitFor(async () => stub.state.eventClients.size > 0)
        stub.answer({ sessionId: step.sessionId, text: 'Streamed' })
        stub.emit({ type: 'session.idle', properties: { sessionID: step.sessionId } })
        await waitFor(async () => (await stepRow({ waitpointId })).status === 'COMPLETED')
        controller.abort()
        await listening.catch(() => undefined)

        expect(await resumedBody({ waitpointId })).toEqual({ output: { answer: 'Streamed' } })
    })

    it('leaves Generate Image and switched-off platforms on Activepieces', async () => {
        const setup = await routedFlow({ steps: [{ name: 'step_1' }] })
        const waitpointId = await waitpointFor({ setup, stepName: 'step_1' })
        await setup.ctx.post('/v1/opencode/connection', { enabled: false })
        const before = stub.state.sessions.length

        await execute({ setup, waitpointId, body: { action: AiStepAction.ASK_AI, prompt: 'Not routed' } })
        await setup.ctx.post('/v1/opencode/connection', { enabled: true })
        await execute({ setup, waitpointId: apId(), body: { action: AiStepAction.GENERATE_IMAGE, prompt: 'A cat' } })

        expect(stub.state.sessions).toHaveLength(before)
        expect(await db.findBy('opencode_step', { flowRunId: setup.run.id })).toEqual([])
    })
})

describe('OpenCode models for AI steps', () => {
    it('lists OpenCode first for the engine while routing is on, with its providers as keys and their models, and keeps image models from Activepieces providers', async () => {
        const setup = await routedFlow({ steps: [{ name: 'step_1' }] })
        const engine = await engineToken({ setup })

        const providers = await app!.inject({ method: 'GET', url: `/api/v1/ai-providers?projectId=${setup.ctx.project.id}`, headers: { authorization: `Bearer ${engine}` } })
        const defaultModels = await app!.inject({ method: 'GET', url: `/api/v1/ai-providers/custom/models?projectId=${setup.ctx.project.id}&configId=opencode:default`, headers: { authorization: `Bearer ${engine}` } })
        const models = await app!.inject({ method: 'GET', url: `/api/v1/ai-providers/custom/models?projectId=${setup.ctx.project.id}&configId=opencode:openrouter`, headers: { authorization: `Bearer ${engine}` } })
        const userView = await setup.ctx.get('/v1/ai-providers', { projectId: setup.ctx.project.id })

        expect(providers.json()[0]).toEqual({
            provider: AIProviderName.CUSTOM,
            name: 'OpenCode',
            enabledForChat: false,
            keys: [{ id: 'opencode:default', name: 'Default model' }, { id: 'opencode:openrouter', name: 'OpenRouter' }],
        })
        expect(JSON.stringify(providers.json())).not.toContain('secret-key-never-shown')
        expect(defaultModels.json()).toEqual([{ id: 'default', name: 'Default (the agent, project, namespace or settings model)', type: 'text' }])
        expect(models.json()).toEqual([{ id: 'qwen/qwen3-coder', name: 'Qwen3 Coder', type: 'text' }])
        expect(JSON.stringify(userView.json())).not.toContain('OpenCode')
    })
})

async function execute({ setup, waitpointId, body }: { setup: RoutedSetup, waitpointId: string | undefined, body: Record<string, unknown> }) {
    return app!.inject({
        method: 'POST',
        url: '/api/v1/ai/execute',
        headers: { authorization: `Bearer ${await engineToken({ setup })}` },
        body: {
            flowId: setup.flow.id,
            flowRunId: setup.run.id,
            provider: AIProviderName.ACTIVEPIECES,
            modelId: 'smart',
            ...(waitpointId === undefined ? {} : { waitpointId }),
            ...body,
        },
    })
}
