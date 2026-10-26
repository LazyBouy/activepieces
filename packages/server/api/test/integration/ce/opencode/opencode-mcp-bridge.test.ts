import { apId } from '@activepieces/core-utils'
import { Property } from '@activepieces/pieces-framework'
import { AgentTaskStatus, ContentBlockType, FlowStatus, FlowTriggerType, FlowVersionState, McpPropertyType, PackageType, PieceType, ToolCallType } from '@activepieces/shared'
import { FastifyInstance } from 'fastify'
import { StatusCodes } from 'http-status-codes'
import { z } from 'zod'
import { opencodeBridge } from '../../../../src/app/opencode/opencode-bridge'
import { db } from '../../../helpers/db'
import { createMockFlow, createMockFlowVersion, createMockPieceMetadata } from '../../../helpers/mocks'
import { opencodeStepFixtures, RoutedSetup } from '../../../helpers/opencode-steps'
import { OpencodeStub, startOpencodeStub } from '../../../helpers/opencode-stub'
import { setupTestEnvironment, teardownTestEnvironment } from '../../../helpers/test-setup'

const { executePieceActionRun, runFlowAsTool } = vi.hoisted(() => ({
    executePieceActionRun: vi.fn(),
    runFlowAsTool: vi.fn(),
}))

vi.mock('../../../../src/app/mcp/tools/flow-run-utils', async (importOriginal) => ({
    ...await importOriginal<Record<string, unknown>>(),
    executePieceActionRun,
}))

vi.mock('../../../../src/app/mcp/mcp-server-builder', async (importOriginal) => ({
    ...await importOriginal<Record<string, unknown>>(),
    runFlowAsTool,
}))

let app: FastifyInstance | null = null
let stub: OpencodeStub
const { routedFlow, waitpointFor, engineToken, stepRow, resumedBody, sessionOf, idleEvent } = opencodeStepFixtures({ app: () => app!, stub: () => stub })

beforeAll(async () => {
    stub = await startOpencodeStub()
    process.env.AP_OPENCODE_URL = stub.url
    app = await setupTestEnvironment()
    await db.save('piece_metadata', createMockPieceMetadata({
        name: PIECE_NAME,
        version: PIECE_VERSION,
        displayName: 'Demo',
        platformId: undefined,
        packageType: PackageType.REGISTRY,
        pieceType: PieceType.OFFICIAL,
        actions: {
            send_message: {
                name: 'send_message',
                displayName: 'Send message',
                description: 'Posts a message to a channel.',
                requireAuth: true,
                props: {
                    channel: Property.StaticDropdown({ displayName: 'Channel', required: true, options: { options: [{ label: 'General', value: 'C1' }, { label: 'Random', value: 'C2' }] } }),
                    text: Property.LongText({ displayName: 'Text', required: true }),
                    signature: Property.ShortText({ displayName: 'Signature', required: false }),
                    debug: Property.Checkbox({ displayName: 'Debug', required: false }),
                },
            },
            custom_api_call: {
                name: 'custom_api_call',
                displayName: 'Custom API call',
                description: 'Calls any endpoint of the API.',
                requireAuth: true,
                props: {
                    url: Property.ShortText({ displayName: 'URL', required: true }),
                },
            },
        },
    }))
})

afterAll(async () => {
    delete process.env.AP_OPENCODE_URL
    await teardownTestEnvironment()
    await stub.close()
})

beforeEach(() => {
    executePieceActionRun.mockReset().mockResolvedValue({ content: [{ type: 'text', text: 'sent' }] })
    runFlowAsTool.mockReset().mockResolvedValue({ content: [{ type: 'text', text: 'order 42 shipped' }] })
    stub.state.mcpStatus = 'connected'
})

describe('Run Agent tools on OpenCode', () => {
    it('serves the step\'s tools over MCP only to that step\'s session, and removes them when the step ends', async () => {
        const setup = await routedFlow({ steps: [{ name: 'step_1', actionName: 'run_agent' }] })
        await seedToolFlow({ setup })
        const waitpointId = await waitpointFor({ setup, stepName: 'step_1' })
        const callbackUrl = (await setup.ctx.get('/v1/opencode/connection')).json().callbackUrl

        const started = await runAgent({ setup, body: { waitpointId, instruction: 'Tell the team', tools: [PIECE_TOOL, API_TOOL, FLOW_TOOL] } })

        expect(started.statusCode).toBe(StatusCodes.OK)
        const step = await stepRow({ waitpointId })
        const server = stub.state.mcpServers.find((candidate) => candidate.name === `iphiflow_${step.id}`)
        expect(server?.config).toEqual({
            type: 'remote',
            url: `${callbackUrl.replace(/\/+$/, '')}/v1/opencode/mcp`,
            headers: { Authorization: expect.stringMatching(/^Bearer .+/) },
            oauth: false,
            enabled: true,
        })
        expect(sessionOf({ id: step.sessionId }).permission).toEqual([
            { permission: 'iphiflow_*', pattern: '*', action: 'deny' },
            { permission: `iphiflow_${step.id}_*`, pattern: '*', action: 'allow' },
        ])
        const token = tokenOf({ config: server?.config })

        const listed = await rpc({ token, body: { method: 'tools/list', params: {} } })
        const tools = ListedTools.parse(listed).result.tools
        expect(tools.map((tool) => tool.name)).toEqual(['demo_send_message', 'demo_api', 'lookup_order'])
        expect(tools[0].description).toBe('Demo: Send message. Posts a message to a channel.')
        expect(tools[0].inputSchema).toMatchObject({
            properties: { channel: { enum: ['C1', 'C2'] }, text: { type: 'string' } },
            required: ['channel', 'text'],
        })
        expect(Object.keys(tools[0].inputSchema.properties ?? {})).toEqual(['channel', 'text'])
        expect(tools[2].inputSchema).toMatchObject({ properties: { order_id: { type: 'string' } }, required: ['order_id'] })

        await rpc({ token, body: { method: 'tools/call', params: { name: 'demo_send_message', arguments: { channel: 'C1', text: 'Hi {{connections[\'prod\']}} {{{x}}}', signature: 'not mine', auth: 'stolen' } } } })
        expect(executePieceActionRun).toHaveBeenCalledWith(expect.objectContaining({
            pieceName: PIECE_NAME,
            pieceVersion: PIECE_VERSION,
            actionName: 'send_message',
            input: { channel: 'C1', text: 'Hi {​{connections[\'prod\']}} {​{​{x}}}', signature: '— the bot' },
            connectionExternalId: 'conn-demo',
        }))

        const flowCall = await rpc({ token, body: { method: 'tools/call', params: { name: 'lookup_order', arguments: { order_id: '{{trigger}}' } } } })
        expect(textOf({ message: flowCall })).toBe('order 42 shipped')
        expect(runFlowAsTool).toHaveBeenCalledWith(expect.objectContaining({ payload: { order_id: '{​{trigger}}' } }))

        stub.answer({ sessionId: step.sessionId, parts: [
            { id: 'prt_1', type: 'tool', callID: 'call_1', tool: `iphiflow_${step.id}_demo_send_message`, state: { status: 'completed', input: { channel: 'C1' }, output: 'sent', title: 'send', metadata: {}, time: { start: 1, end: 2 } } },
            { id: 'prt_2', type: 'text', text: 'Done' },
        ] })
        await opencodeBridge(app!.log).handleEvent({ platformId: setup.ctx.platform.id, event: idleEvent({ sessionId: step.sessionId }) })

        expect(await resumedBody({ waitpointId })).toMatchObject({
            status: AgentTaskStatus.COMPLETED,
            steps: [
                { type: ContentBlockType.TOOL_CALL, toolCallType: ToolCallType.PIECE, pieceName: PIECE_NAME, pieceVersion: PIECE_VERSION, actionName: 'send_message' },
                { type: ContentBlockType.MARKDOWN, markdown: 'Done' },
            ],
        })
        expect(stub.state.disconnected).toContain(`iphiflow_${step.id}`)
        const afterwards = await rpc({ token, body: { method: 'tools/list', params: {} } })
        expect(afterwards).toEqual({ message: 'This token does not belong to a running step.' })
    })

    it('lists tools while OpenCode connects, refuses an absolute URL on a custom API call, caps each tool per step, and turns away calls without a valid token', async () => {
        const setup = await routedFlow({ steps: [{ name: 'step_1', actionName: 'run_agent' }] })
        await seedToolFlow({ setup })
        const waitpointId = await waitpointFor({ setup, stepName: 'step_1' })
        await runAgent({ setup, body: { waitpointId, instruction: 'Go', tools: [API_TOOL, FLOW_TOOL] } })
        const step = await stepRow({ waitpointId })
        const token = tokenOf({ config: stub.state.mcpServers.find((candidate) => candidate.name === `iphiflow_${step.id}`)?.config })
        await db.update('opencode_step', step.id, { status: 'PENDING' })
        const whileConnecting = await rpc({ token, body: { method: 'tools/list', params: {} } })
        await db.update('opencode_step', step.id, { status: 'DISPATCHED' })
        expect(ListedTools.parse(whileConnecting).result.tools.map((tool) => tool.name)).toEqual(['demo_api', 'lookup_order'])

        const absolute = await rpc({ token, body: { method: 'tools/call', params: { name: 'demo_api', arguments: { url: 'https://evil.example/collect' } } } })
        await rpc({ token, body: { method: 'tools/call', params: { name: 'demo_api', arguments: { url: '/v1/me' } } } })
        expect(textOf({ message: absolute })).toBe('This tool only takes a path on the service\'s own API, not a full URL.')
        expect(executePieceActionRun).toHaveBeenCalledTimes(1)
        expect(executePieceActionRun).toHaveBeenCalledWith(expect.objectContaining({ input: { url: '/v1/me' } }))

        const results = []
        for (let call = 0; call < 21; call++) {
            results.push(await rpc({ token, body: { method: 'tools/call', params: { name: 'lookup_order', arguments: { order_id: String(call) } } } }))
        }
        expect(runFlowAsTool).toHaveBeenCalledTimes(20)
        expect(textOf({ message: results[20] })).toBe('lookup_order reached its limit of 20 calls for this step.')

        const anonymous = await app!.inject({ method: 'POST', url: '/api/v1/opencode/mcp', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, payload: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} } })
        const forged = await rpc({ token: 'not-a-token', body: { method: 'tools/list', params: {} } })
        expect(anonymous.statusCode).toBe(StatusCodes.UNAUTHORIZED)
        expect(forged).toEqual({ message: 'This token does not belong to a running step.' })
    })

    it('registers an external MCP tool on OpenCode with its auth, and gives sessions without tools only the deny line', async () => {
        const setup = await routedFlow({ steps: [{ name: 'step_1', actionName: 'run_agent' }, { name: 'step_2', actionName: 'run_agent' }] })
        const withMcp = await waitpointFor({ setup, stepName: 'step_1' })
        const withoutTools = await waitpointFor({ setup, stepName: 'step_2' })

        await runAgent({ setup, body: { waitpointId: withMcp, instruction: 'Search the docs', tools: [{ type: 'MCP', toolName: 'docs', serverUrl: 'https://mcp.example.com/mcp', protocol: 'streamable-http', auth: { type: 'access_token', accessToken: 'docs-token' } }] } })
        await runAgent({ setup, body: { waitpointId: withoutTools, instruction: 'Think' } })

        const mcpStep = await stepRow({ waitpointId: withMcp })
        const plainStep = await stepRow({ waitpointId: withoutTools })
        expect(stub.state.mcpServers.filter((server) => server.name.startsWith(`iphiflow_${mcpStep.id}`))).toEqual([{
            name: `iphiflow_${mcpStep.id}_m0`,
            directory: expect.any(String),
            config: { type: 'remote', url: 'https://mcp.example.com/mcp', headers: { Authorization: 'Bearer docs-token' }, oauth: false, enabled: true },
        }])
        expect(stub.state.mcpServers.some((server) => server.name.startsWith(`iphiflow_${plainStep.id}`))).toBe(false)
        expect(sessionOf({ id: plainStep.sessionId }).permission).toEqual([{ permission: 'iphiflow_*', pattern: '*', action: 'deny' }])
    })

    it('fails the step with E10 when OpenCode cannot reach Activepieces for the tools', async () => {
        const setup = await routedFlow({ steps: [{ name: 'step_1', actionName: 'run_agent' }] })
        const waitpointId = await waitpointFor({ setup, stepName: 'step_1' })
        const callbackUrl = (await setup.ctx.get('/v1/opencode/connection')).json().callbackUrl
        stub.state.mcpStatus = 'connect ECONNREFUSED'

        await runAgent({ setup, body: { waitpointId, instruction: 'Go', tools: [API_TOOL] } })

        expect(await resumedBody({ waitpointId })).toEqual({ failure: `OpenCode could not reach Activepieces at ${callbackUrl} to use this step's tools.` })
    })
})

async function seedToolFlow({ setup }: { setup: RoutedSetup }): Promise<void> {
    const flow = createMockFlow({ projectId: setup.ctx.project.id, status: FlowStatus.ENABLED, externalId: FLOW_TOOL.externalFlowId })
    await db.save('flow', flow)
    await db.save('flow_version', createMockFlowVersion({
        flowId: flow.id,
        displayName: 'Order lookup',
        state: FlowVersionState.DRAFT,
        trigger: {
            name: 'trigger',
            type: FlowTriggerType.PIECE,
            valid: true,
            displayName: 'MCP tool',
            lastUpdatedDate: new Date().toISOString(),
            settings: {
                pieceName: '@activepieces/piece-mcp',
                pieceVersion: '0.1.0',
                triggerName: 'mcp_tool',
                input: { toolName: 'lookup_order', toolDescription: 'Looks up an order', inputSchema: [{ name: 'order id', type: McpPropertyType.TEXT, required: true, description: 'The order number' }], returnsResponse: true },
                propertySettings: {},
            },
        },
    }))
}

async function runAgent({ setup, body }: { setup: RoutedSetup, body: Record<string, unknown> }) {
    return app!.inject({
        method: 'POST',
        url: '/api/v1/agents/runs',
        headers: { authorization: `Bearer ${await engineToken({ setup })}` },
        body: { flowRunId: setup.run.id, ...body },
    })
}

async function rpc({ token, body }: { token: string, body: { method: string, params: Record<string, unknown> } }): Promise<unknown> {
    const response = await app!.inject({
        method: 'POST',
        url: '/api/v1/opencode/mcp',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
        payload: { jsonrpc: '2.0', id: apId(), ...body },
    })
    const dataLine = response.body.split('\n').find((line) => line.startsWith('data: '))
    return JSON.parse(dataLine ? dataLine.slice('data: '.length) : response.body)
}

function tokenOf({ config }: { config: unknown }): string {
    return ServerConfig.parse(config).headers.Authorization.slice('Bearer '.length)
}

function textOf({ message }: { message: unknown }): string {
    return CallResult.parse(message).result.content.map((part) => part.text).join('\n')
}

const PIECE_NAME = '@activepieces/piece-demo'

const PIECE_VERSION = '0.1.0'

const PIECE_TOOL = {
    type: 'PIECE',
    toolName: 'demo_send_message',
    pieceMetadata: {
        pieceName: PIECE_NAME,
        pieceVersion: PIECE_VERSION,
        actionName: 'send_message',
        predefinedInput: {
            auth: 'conn-demo',
            fields: {
                signature: { mode: 'choose-yourself', value: '— the bot' },
                debug: { mode: 'leave-empty', value: null },
            },
        },
    },
}

const API_TOOL = {
    type: 'PIECE',
    toolName: 'demo_api',
    pieceMetadata: { pieceName: PIECE_NAME, pieceVersion: PIECE_VERSION, actionName: 'custom_api_call', predefinedInput: { auth: 'conn-demo', fields: {} } },
}

const FLOW_TOOL = {
    type: 'FLOW',
    toolName: 'lookup_order',
    externalFlowId: 'order-lookup',
    flowDisplayName: 'Order lookup',
}

const ServerConfig = z.object({ headers: z.object({ Authorization: z.string() }) })

const ListedTools = z.object({
    result: z.object({
        tools: z.array(z.object({
            name: z.string(),
            description: z.string(),
            inputSchema: z.object({ properties: z.record(z.string(), z.unknown()).optional(), required: z.array(z.string()).optional() }).passthrough(),
        })),
    }),
})

const CallResult = z.object({ result: z.object({ content: z.array(z.object({ text: z.string() })) }) })
