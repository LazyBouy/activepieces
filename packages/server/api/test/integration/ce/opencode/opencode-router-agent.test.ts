import { AIProviderName, apId } from '@activepieces/core-utils'
import { AgentTaskStatus, AiRouterMatchMode, ContentBlockType, ExecutionToolStatus, ToolCallStatus, ToolCallType, WebsocketClientEvent } from '@activepieces/shared'
import { FastifyInstance } from 'fastify'
import { StatusCodes } from 'http-status-codes'
import { opencodeBridge } from '../../../../src/app/opencode/opencode-bridge'
import { opencodeProgress } from '../../../../src/app/opencode/opencode-progress'
import { db } from '../../../helpers/db'
import { opencodeStepFixtures, RoutedSetup } from '../../../helpers/opencode-steps'
import { OpencodeStub, startOpencodeStub } from '../../../helpers/opencode-stub'
import { setupTestEnvironment, teardownTestEnvironment } from '../../../helpers/test-setup'

let app: FastifyInstance | null = null
let stub: OpencodeStub
const { routedFlow, waitpointFor, engineToken, stepRow, resumedBody, sessionOf, seedNamespace, idleEvent, waitFor } = opencodeStepFixtures({ app: () => app!, stub: () => stub })

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

afterEach(() => {
    vi.restoreAllMocks()
})

describe('AI Router on OpenCode', () => {
    it('asks for the best route as structured output and resumes the paused step with the routes and probabilities', async () => {
        const setup = await routedFlow({ steps: [{ name: 'router_1', router: true }] })
        const waitpointId = await waitpointFor({ setup, stepName: 'router_1' })

        const response = await route({ setup, waitpointId, matchMode: AiRouterMatchMode.BEST_MATCH })

        expect(response.statusCode).toBe(StatusCodes.ACCEPTED)
        expect(response.json()).toEqual({ requestId: expect.any(String) })
        const step = await stepRow({ waitpointId })
        expect(step).toMatchObject({ status: 'DISPATCHED', action: 'ROUTE', stepName: 'router_1', model: null, agent: 'flow' })
        expect(sessionOf({ id: step.sessionId }).prompts[0]).toMatchObject({
            parts: [{
                type: 'text',
                text: 'Which team should handle this?\n\nRoutes:\nr0: Billing — Payments and invoices\nr1: Technical — Bugs and outages\n\nPick the one route that fits the input best, and give each route the probability (0 to 1) that it is the right one.\n\nInput:\nMy card was charged twice',
            }],
            format: {
                type: 'json_schema',
                schema: {
                    type: 'object',
                    properties: {
                        route: { type: 'string', enum: ['r0', 'r1'] },
                        probabilities: {
                            type: 'object',
                            properties: {
                                r0: { type: 'number', description: 'Probability from 0 to 1 for Billing' },
                                r1: { type: 'number', description: 'Probability from 0 to 1 for Technical' },
                            },
                            required: ['r0', 'r1'],
                            additionalProperties: false,
                        },
                    },
                    required: ['route', 'probabilities'],
                    additionalProperties: false,
                },
            },
        })

        stub.answer({ sessionId: step.sessionId, structured: { route: 'r0', probabilities: { r0: 0.9, r1: 1.4 } }, finish: 'tool-calls' })
        await opencodeBridge(app!.log).handleEvent({ platformId: setup.ctx.platform.id, event: idleEvent({ sessionId: step.sessionId }) })

        expect(await resumedBody({ waitpointId })).toEqual({ output: { matched: ['Billing'], probabilities: { Billing: 0.9, Technical: 1 } } })
    })

    it('answers a test-step router in the same request, matching every route at 0.5 or above, in the step\'s own OpenCode location', async () => {
        const setup = await routedFlow({
            steps: [{ name: 'router_1', router: true, opencode: { namespace: 'crew', project: 'c0001', agent: 'triage' } }],
            stepNameToTest: 'router_1',
        })
        seedNamespace({ id: 'crew', projects: ['c0001'] })
        await setup.ctx.post('/v1/opencode/connection', { allowlist: ['iphi-flow', 'crew'] })
        const before = stub.state.sessions.length

        const pending = route({ setup, waitpointId: undefined, matchMode: AiRouterMatchMode.ALL_MATCHES })
        await waitFor(async () => stub.state.sessions.length > before && stub.state.sessions[stub.state.sessions.length - 1].prompts.length === 1)
        const session = stub.state.sessions[stub.state.sessions.length - 1]
        stub.answer({ sessionId: session.id, structured: { probabilities: { r0: 0.5, r1: 0.2 } }, finish: 'tool-calls' })
        await opencodeBridge(app!.log).handleEvent({ platformId: setup.ctx.platform.id, event: idleEvent({ sessionId: session.id }) })
        const response = await pending

        expect(response.statusCode).toBe(StatusCodes.OK)
        expect(response.json()).toEqual({ matched: ['Billing'], probabilities: { Billing: 0.5, Technical: 0.2 } })
        expect(session).toMatchObject({ directory: '/root/opencode-home/crew/c0001', agent: 'triage' })
        expect(session.prompts[0]['format']).toMatchObject({ schema: { required: ['probabilities'] } })
        expect(await db.findOneBy('opencode_step', { sessionId: session.id })).toMatchObject({ stepName: 'router_1', status: 'COMPLETED' })
    })

    it('fails the step when the model names a route that does not exist', async () => {
        const setup = await routedFlow({ steps: [{ name: 'router_1', router: true }] })
        const waitpointId = await waitpointFor({ setup, stepName: 'router_1' })
        await route({ setup, waitpointId, matchMode: AiRouterMatchMode.BEST_MATCH })
        const step = await stepRow({ waitpointId })

        stub.answer({ sessionId: step.sessionId, structured: { route: 'r7', probabilities: { r0: 0.1, r1: 0.1 } }, finish: 'tool-calls' })
        await opencodeBridge(app!.log).handleEvent({ platformId: setup.ctx.platform.id, event: idleEvent({ sessionId: step.sessionId }) })

        expect(await resumedBody({ waitpointId })).toEqual({ failure: 'The routing model did not answer the routing question' })
    })

    it('keeps the upstream router when the switch is off', async () => {
        const setup = await routedFlow({ steps: [{ name: 'router_1', router: true }] })
        await setup.ctx.post('/v1/opencode/connection', { enabled: false })
        const before = stub.state.sessions.length

        const response = await route({ setup, waitpointId: undefined, matchMode: AiRouterMatchMode.BEST_MATCH })

        expect(response.json()).toMatchObject({ params: { message: expect.stringContaining('The AI Router needs an OpenRouter key') } })
        expect(stub.state.sessions).toHaveLength(before)
        await setup.ctx.post('/v1/opencode/connection', { enabled: true })
    })
})

describe('Run Agent on OpenCode', () => {
    it('runs the instruction as an OpenCode session and resumes the step with the agent result, its transcript and the OpenCode details', async () => {
        const setup = await routedFlow({ steps: [{ name: 'step_1', actionName: 'run_agent' }] })
        const waitpointId = await waitpointFor({ setup, stepName: 'step_1' })

        const response = await runAgent({
            setup,
            body: {
                waitpointId,
                instruction: 'Find the ticket id',
                structuredOutput: [{ displayName: 'Ticket id', description: 'The ticket number', type: 'number' }],
                provider: AIProviderName.CUSTOM,
                providerConfigId: 'opencode:openrouter',
                modelName: 'qwen/qwen3-coder',
                maxSteps: 5,
            },
        })

        expect(response.statusCode).toBe(StatusCodes.OK)
        const step = await stepRow({ waitpointId })
        expect(step).toMatchObject({ status: 'DISPATCHED', action: 'RUN_AGENT', model: { providerID: 'openrouter', modelID: 'qwen/qwen3-coder' } })
        const session = sessionOf({ id: step.sessionId })
        expect(session.prompts[0]).toMatchObject({
            agent: 'flow',
            model: { providerID: 'openrouter', modelID: 'qwen/qwen3-coder' },
            parts: [{ type: 'text', text: 'Find the ticket id' }],
            format: {
                type: 'json_schema',
                schema: {
                    type: 'object',
                    properties: { Ticket_id: { type: 'number', description: 'The ticket number' } },
                    required: ['Ticket_id'],
                    additionalProperties: false,
                },
            },
        })

        stub.answer({ sessionId: step.sessionId, finish: 'tool-calls', parts: [
            { id: 'prt_1', type: 'text', text: 'Looking it up' },
            { id: 'prt_2', type: 'tool', callID: 'call_1', tool: 'bash', state: { status: 'completed', input: { command: 'grep -r ticket .' }, output: 'ticket 42', title: 'grep', metadata: {}, time: { start: 1_000, end: 2_000 } } },
        ] })
        stub.answer({ sessionId: step.sessionId, finish: 'tool-calls', structured: { Ticket_id: 42 }, parts: [
            { id: 'prt_3', type: 'tool', callID: 'call_2', tool: 'StructuredOutput', state: { status: 'completed', input: { Ticket_id: 42 }, output: 'ok', title: 'StructuredOutput', metadata: {}, time: { start: 3_000, end: 3_100 } } },
        ] })
        await opencodeBridge(app!.log).handleEvent({ platformId: setup.ctx.platform.id, event: idleEvent({ sessionId: step.sessionId }) })

        expect(await resumedBody({ waitpointId })).toEqual({
            prompt: 'Find the ticket id',
            status: AgentTaskStatus.COMPLETED,
            steps: [
                { type: ContentBlockType.MARKDOWN, markdown: 'Looking it up' },
                {
                    type: ContentBlockType.TOOL_CALL,
                    toolCallType: ToolCallType.UNKNOWN,
                    toolName: 'bash',
                    displayName: 'bash',
                    toolCallId: 'call_1',
                    input: { command: 'grep -r ticket .' },
                    output: { status: ExecutionToolStatus.SUCCESS, output: 'ticket 42', resolvedInput: {} },
                    status: ToolCallStatus.COMPLETED,
                    startTime: new Date(1_000).toISOString(),
                    endTime: new Date(2_000).toISOString(),
                },
            ],
            structuredOutput: { 'Ticket id': 42 },
            opencode: {
                sessionId: step.sessionId,
                adminPanelUrl: `${stub.url}/${Buffer.from(session.directory).toString('base64url')}/session/${step.sessionId}`,
                namespace: 'iphi-flow',
                project: expect.any(String),
                agent: 'flow',
                model: { providerID: 'stub', modelID: 'stub-model' },
                usage: { input: 24, output: 10, reasoning: 2, cost: 0.004 },
                files: [],
            },
        })
    })

    it('fails the step when a schema was asked for and no structured output came back', async () => {
        const setup = await routedFlow({ steps: [{ name: 'step_1', actionName: 'run_agent' }] })
        const waitpointId = await waitpointFor({ setup, stepName: 'step_1' })
        await runAgent({ setup, body: { waitpointId, instruction: 'Answer', structuredOutput: [{ displayName: 'Yes', type: 'boolean' }] } })
        const step = await stepRow({ waitpointId })

        stub.answer({ sessionId: step.sessionId, text: 'I am not sure' })
        await opencodeBridge(app!.log).handleEvent({ platformId: setup.ctx.platform.id, event: idleEvent({ sessionId: step.sessionId }) })

        expect(await resumedBody({ waitpointId })).toEqual({ failure: 'The model did not return the requested structured output.' })
    })

    it('refuses saved agents, knowledge-base tools and, for now, Activepieces tools', async () => {
        const setup = await routedFlow({ steps: [{ name: 'step_1', actionName: 'run_agent' }] })
        const waitpointId = await waitpointFor({ setup, stepName: 'step_1' })

        const saved = await runAgent({ setup, body: { waitpointId, instruction: 'Go', agentId: apId() } })
        const knowledge = await runAgent({ setup, body: { waitpointId, instruction: 'Go', tools: [{ type: 'KNOWLEDGE_BASE', toolName: 'docs', sourceType: 'FILE', sourceId: apId(), sourceName: 'Docs' }] } })
        const piece = await runAgent({ setup, body: { waitpointId, instruction: 'Go', tools: [{ type: 'PIECE', toolName: 'send', pieceMetadata: { pieceName: '@activepieces/piece-slack', pieceVersion: '0.1.0', actionName: 'send_message' } }] } })

        expect(saved.statusCode).toBe(StatusCodes.CONFLICT)
        expect(saved.json()).toMatchObject({ params: { message: 'Saved agents are not supported when AI runs on OpenCode. Pick an OpenCode agent in the step\'s OpenCode section.' } })
        expect(knowledge.json()).toMatchObject({ params: { message: 'Knowledge-base tools are not supported when AI runs on OpenCode.' } })
        expect(piece.json()).toMatchObject({ params: { message: 'Activepieces tools on an OpenCode agent step are not available yet. Remove the tools from this step to run it on OpenCode.' } })
        expect(await db.findBy('opencode_step', { waitpointId })).toEqual([])
    })

    it('leaves the upstream agent route in place when the switch is off', async () => {
        const setup = await routedFlow({ steps: [{ name: 'step_1', actionName: 'run_agent' }] })
        const waitpointId = await waitpointFor({ setup, stepName: 'step_1' })
        await setup.ctx.post('/v1/opencode/connection', { enabled: false })

        const response = await runAgent({ setup, body: { waitpointId, instruction: 'Go', agentId: apId(), tools: [{ type: 'PIECE', toolName: 'send', pieceMetadata: { pieceName: '@activepieces/piece-slack', pieceVersion: '0.1.0', actionName: 'send_message' } }] } })

        expect(response.json()).toMatchObject({ params: { message: 'This step both links an agent and carries its own tools, so which one to run is ambiguous' } })
        expect(await db.findBy('opencode_step', { waitpointId })).toEqual([])
        await setup.ctx.post('/v1/opencode/connection', { enabled: true })
    })

    it('pushes the live transcript to the test panel while the agent works', async () => {
        const setup = await routedFlow({ steps: [{ name: 'step_1', actionName: 'run_agent' }] })
        const waitpointId = await waitpointFor({ setup, stepName: 'step_1' })
        await runAgent({ setup, body: { waitpointId, instruction: 'Check the logs' } })
        const step = await stepRow({ waitpointId })
        const emitted = captureEmits()
        stub.answer({ sessionId: step.sessionId, completed: false, finish: 'unknown', parts: [
            { id: 'prt_1', type: 'text', text: 'Reading the logs' },
            { id: 'prt_2', type: 'tool', callID: 'call_1', tool: 'read', state: { status: 'running', input: { filePath: 'app.log' }, time: { start: 5_000 } } },
        ] })

        await opencodeBridge(app!.log).handleEvent({ platformId: setup.ctx.platform.id, event: { directory: '/x', payload: { type: 'message.part.updated', properties: { sessionID: step.sessionId, part: {}, time: 1 } } } })
        await waitFor(async () => emitted.length > 0)

        expect(emitted[0]).toEqual({
            room: setup.ctx.project.id,
            event: WebsocketClientEvent.TEST_STEP_PROGRESS,
            payload: {
                projectId: setup.ctx.project.id,
                runId: setup.run.id,
                sequence: expect.any(Number),
                output: {
                    prompt: 'Check the logs',
                    status: AgentTaskStatus.IN_PROGRESS,
                    steps: [
                        { type: ContentBlockType.MARKDOWN, markdown: 'Reading the logs' },
                        {
                            type: ContentBlockType.TOOL_CALL,
                            toolCallType: ToolCallType.UNKNOWN,
                            toolName: 'read',
                            displayName: 'read',
                            toolCallId: 'call_1',
                            input: { filePath: 'app.log' },
                            status: ToolCallStatus.IN_PROGRESS,
                            startTime: new Date(5_000).toISOString(),
                        },
                    ],
                },
            },
        })
        expect(await opencodeProgress(app!.log).push({ platformId: setup.ctx.platform.id, sessionId: 'ses_unknown' })).toBe(0)
    })
})

describe('OpenCode models for the Run Agent step picker', () => {
    it('lists only OpenCode for a flow-step picker while routing is on, and the upstream list otherwise', async () => {
        const setup = await routedFlow({ steps: [{ name: 'step_1', actionName: 'run_agent' }] })
        const projectId = setup.ctx.project.id

        const providers = await setup.ctx.get('/v1/ai-providers', { projectId, forFlowStep: 'true' })
        const models = await setup.ctx.get('/v1/ai-providers/custom/models', { projectId, configId: 'opencode:openrouter', forFlowStep: 'true' })
        const otherProvider = await setup.ctx.get('/v1/ai-providers/openai/models', { projectId, forFlowStep: 'true' })
        const plain = await setup.ctx.get('/v1/ai-providers', { projectId })
        await setup.ctx.post('/v1/opencode/connection', { enabled: false })
        const switchedOff = await setup.ctx.get('/v1/ai-providers', { projectId, forFlowStep: 'true' })
        await setup.ctx.post('/v1/opencode/connection', { enabled: true })

        expect(providers.json()).toEqual([{
            provider: AIProviderName.CUSTOM,
            name: 'OpenCode',
            enabledForChat: false,
            keys: [{ id: 'opencode:default', name: 'Default model' }, { id: 'opencode:openrouter', name: 'OpenRouter' }],
        }])
        expect(models.json()).toEqual([{ id: 'qwen/qwen3-coder', name: 'Qwen3 Coder', type: 'text' }])
        expect(otherProvider.json()).toEqual([])
        expect(JSON.stringify(plain.json())).not.toContain('OpenCode')
        expect(JSON.stringify(switchedOff.json())).not.toContain('OpenCode')
    })
})

async function route({ setup, waitpointId, matchMode }: { setup: RoutedSetup, waitpointId: string | undefined, matchMode: AiRouterMatchMode }) {
    return app!.inject({
        method: 'POST',
        url: '/api/v1/engine/ai-router',
        headers: { authorization: `Bearer ${await engineToken({ setup })}` },
        body: {
            flowId: setup.flow.id,
            flowRunId: setup.run.id,
            state: 'My card was charged twice',
            question: 'Which team should handle this?',
            options: { Billing: 'Payments and invoices', Technical: 'Bugs and outages' },
            matchMode,
            ...(waitpointId === undefined ? {} : { waitpointId }),
        },
    })
}

async function runAgent({ setup, body }: { setup: RoutedSetup, body: Record<string, unknown> }) {
    return app!.inject({
        method: 'POST',
        url: '/api/v1/agents/runs',
        headers: { authorization: `Bearer ${await engineToken({ setup })}` },
        body: { flowRunId: setup.run.id, ...body },
    })
}

function captureEmits(): EmittedEvent[] {
    const emitted: EmittedEvent[] = []
    const io = app!.io
    const realTo = io.to.bind(io)
    vi.spyOn(io, 'to').mockImplementation((room) => {
        const operator = realTo(room)
        vi.spyOn(operator, 'emit').mockImplementation((event, ...args) => {
            emitted.push({ room: String(room), event: String(event), payload: args[0] })
            return true
        })
        return operator
    })
    return emitted
}

type EmittedEvent = {
    room: string
    event: string
    payload: unknown
}
