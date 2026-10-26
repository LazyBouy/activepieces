import { AIProviderName, AiStepAction } from '@activepieces/core-utils'
import { DefaultProjectRole } from '@activepieces/shared'
import { FastifyInstance } from 'fastify'
import { StatusCodes } from 'http-status-codes'
import { opencodeBridge } from '../../../../src/app/opencode/opencode-bridge'
import { opencodeStepFixtures, RoutedSetup } from '../../../helpers/opencode-steps'
import { OpencodeStub, startOpencodeStub } from '../../../helpers/opencode-stub'
import { createMemberContext, createTestContext } from '../../../helpers/test-context'
import { setupTestEnvironment, teardownTestEnvironment } from '../../../helpers/test-setup'

let app: FastifyInstance | null = null
let stub: OpencodeStub
const { routedFlow, waitpointFor, engineToken, stepRow, resumedBody, sessionOf, seedNamespace, idleEvent } = opencodeStepFixtures({ app: () => app!, stub: () => stub })

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

describe('OpenCode views', () => {
    it('shows an agent\'s card read live: tools as the model gets them, skills and subagents by its own rules, MCP servers, memory, permission lines, hooks and admin panel links', async () => {
        const ctx = await createTestContext(app!)
        seedNamespace({ id: 'crew', projects: ['c0001'] })
        const directory = '/root/opencode-home/crew/c0001'
        stub.state.agents.push(
            { directory, name: 'writer', mode: 'primary', scope: 'project', description: 'Writes release notes' },
            { directory, name: 'explore', mode: 'subagent', scope: 'opencode', description: 'Reads the code' },
            { directory, name: 'reviewer', mode: 'subagent', scope: 'project' },
            { directory, name: 'retired', mode: 'subagent', scope: 'project', disabled: true },
        )
        seedViews()
        await ctx.post('/v1/opencode/connection', { allowlist: ['iphi-flow', 'crew'] })

        const response = await ctx.get(`/v1/projects/${ctx.project.id}/opencode/agents/writer`, { namespace: 'crew', project: 'c0001' })

        expect(response.statusCode).toBe(StatusCodes.OK)
        const encodedDir = encodeURIComponent(directory)
        expect(response.json()).toEqual({
            card: {
                name: 'writer',
                description: 'Writes release notes',
                mode: 'primary',
                model: 'openrouter/qwen/qwen3-235b-a22b-2507',
                modelFrom: 'namespace',
                steps: null,
                tools: [{ name: 'bash', source: 'builtin' }, { name: 'task', source: 'builtin' }, { name: 'github_issue', source: 'mcp:github' }],
                hiddenTools: [{ name: 'question', reason: 'permission' }],
                skills: [
                    { name: 'pdf', description: 'Read PDFs', origin: 'global', access: 'allow' },
                    { name: 'secrets', origin: 'project', access: 'deny' },
                ],
                subagents: [
                    { name: 'explore', description: 'Reads the code', access: 'allow' },
                    { name: 'reviewer', access: 'deny' },
                ],
                mcpServers: [
                    { name: 'docs', status: 'not loaded' },
                    { name: 'github', status: 'failed', error: 'token expired' },
                ],
                memory: [
                    { level: 'project', folder: '/x/.memory', entries: [{ title: 'Stack', description: 'TypeScript monorepo' }] },
                    { level: 'agent', folder: `${directory}/.memory/agents/writer`, entries: [{ title: 'Tone', description: 'Short and friendly' }] },
                ],
                permissions: [
                    { permission: '*', pattern: '*', action: 'allow', level: 'opencode' },
                    { permission: 'task', pattern: 'reviewer', action: 'deny', level: 'agent' },
                    { permission: 'skill', pattern: 'sec*', action: 'deny', level: 'project' },
                ],
                hooks: [{ name: 'audit', event: 'tool.before', level: 'project', state: 'on', description: 'Logs every tool call' }],
                links: {
                    agent: `${stub.url}/operator/agents/writer?dir=${encodedDir}`,
                    tools: `${stub.url}/operator/agents/writer?dir=${encodedDir}&tab=tools`,
                    permissions: `${stub.url}/operator/agents/writer?dir=${encodedDir}&tab=permissions`,
                    hooks: `${stub.url}/operator/agents/writer?dir=${encodedDir}&tab=hooks`,
                    memory: `${stub.url}/operator/memory?tab=memory&mproject=${encodedDir}&magent=writer`,
                },
            },
        })
        expect(stub.callsTo({ method: 'GET', path: '/operator/hook' }).map((call) => call.query)).toContainEqual({ directory, agent: 'writer' })
    })

    it('refuses a card or a project view for a project that is not allowlisted, and says when OpenCode has no such agent', async () => {
        const ctx = await createTestContext(app!)
        seedNamespace({ id: 'vault', projects: ['v0001'] })
        seedNamespace({ id: 'open', projects: ['o0001'] })
        await ctx.post('/v1/opencode/connection', { allowlist: ['iphi-flow', 'open'] })
        const toolPromptCalls = stub.callsTo({ method: 'GET', path: '/operator/agent/flow/tool-prompt' }).length

        const card = await ctx.get(`/v1/projects/${ctx.project.id}/opencode/agents/flow`, { namespace: 'vault', project: 'v0001' })
        const view = await ctx.get(`/v1/projects/${ctx.project.id}/opencode/view`, { namespace: 'vault', project: 'v0001' })
        const missing = await ctx.get(`/v1/projects/${ctx.project.id}/opencode/agents/ghost`, { namespace: 'open', project: 'o0001' })

        const refusal = 'vault/v0001 is not allowlisted. A platform admin can add it in Platform → AI → OpenCode.'
        expect(card.json()).toEqual({ card: null, error: refusal })
        expect(view.json()).toEqual({ view: null, error: refusal })
        expect(missing.json()).toEqual({ card: null, error: 'OpenCode has no agent ghost in open/o0001.' })
        expect(stub.callsTo({ method: 'GET', path: '/operator/agent/flow/tool-prompt' })).toHaveLength(toolPromptCalls)
    })

    it('shows a project\'s OpenCode page: agents, capabilities, MCP servers, memory, models, and only this project\'s Activepieces sessions', async () => {
        const ctx = await createTestContext(app!)
        const other = await createTestContext(app!)
        seedNamespace({ id: 'team', projects: ['t0001'] })
        const directory = '/root/opencode-home/team/t0001'
        stub.state.agents.push(
            { directory, name: 'flow', mode: 'primary', scope: 'project', description: 'Runs the AI steps' },
            { directory, name: 'title', mode: 'primary', scope: 'opencode', hidden: true },
        )
        stub.state.providers.splice(0, stub.state.providers.length, { id: 'openrouter', name: 'OpenRouter', models: [{ id: 'qwen/qwen3', name: 'Qwen3' }, { id: 'deepseek/v3', name: 'DeepSeek V3' }] })
        seedViews()
        const mine = await stub.createSession({ directory })
        const theirs = await stub.createSession({ directory })
        const manual = await stub.createSession({ directory })
        sessionOf({ id: mine }).title = 'Routed flow · run r1 · step_1'
        sessionOf({ id: mine }).metadata = { source: 'iphi-flow', projectId: ctx.project.id, flowId: 'f1', flowRunId: 'r1', stepName: 'step_1' }
        sessionOf({ id: theirs }).metadata = { source: 'iphi-flow', projectId: other.project.id, flowRunId: 'r2' }
        sessionOf({ id: manual }).metadata = {}
        await ctx.post('/v1/opencode/connection', { allowlist: ['iphi-flow', 'team'] })

        const response = await ctx.get(`/v1/projects/${ctx.project.id}/opencode/view`, { namespace: 'team', project: 't0001' })

        const view = response.json().view
        expect(view).toMatchObject({
            namespace: 'team',
            project: 't0001',
            name: 't0001',
            folder: directory,
            agents: [{ name: 'flow', mode: 'primary', origin: 'project', description: 'Runs the AI steps' }],
            tools: [{ name: 'bash', origin: 'opencode' }],
            skills: [{ name: 'pdf', origin: 'global', description: 'Read PDFs' }, { name: 'secrets', origin: 'project' }],
            commands: [{ name: 'review', origin: 'opencode', description: 'Review the changes' }],
            mcpServers: [{ name: 'docs', status: 'not loaded' }, { name: 'github', status: 'failed', error: 'token expired' }],
            memory: [{ level: 'project', entries: [{ title: 'Stack', description: 'TypeScript monorepo' }] }],
            defaultModel: 'openrouter/qwen/qwen3-235b-a22b-2507',
            defaultModelFrom: 'namespace',
            providers: [{ id: 'openrouter', name: 'OpenRouter', defaultModel: null, models: [{ id: 'deepseek/v3', name: 'DeepSeek V3' }, { id: 'qwen/qwen3', name: 'Qwen3' }] }],
            sessions: [{ id: mine, title: 'Routed flow · run r1 · step_1', flowId: 'f1', flowRunId: 'r1', stepName: 'step_1', adminPanelUrl: `${stub.url}/${Buffer.from(directory).toString('base64url')}/session/${mine}` }],
        })
        expect(view.sessions).toHaveLength(1)
        expect(JSON.stringify(view)).not.toContain('disabled-tool')
    })

    it('shows a routed step\'s session on the run page: its transcript, model, usage, duration, files and admin panel link, and says when the session was removed', async () => {
        const setup = await routedFlow({ steps: [{ name: 'step_1' }] })
        const waitpointId = await waitpointFor({ setup, stepName: 'step_1' })
        await execute({ setup, waitpointId, body: { action: AiStepAction.ASK_AI, prompt: 'Say hi' } })
        const step = await stepRow({ waitpointId })
        const directory = sessionOf({ id: step.sessionId }).directory
        stub.answer({ sessionId: step.sessionId, parts: [
            { id: 'prt_1', type: 'text', text: 'Looking around' },
            { id: 'prt_2', type: 'tool', callID: 'call_1', tool: 'task', state: { status: 'completed', input: { description: 'explore' }, output: 'x'.repeat(5000), title: 'task', metadata: { sessionId: 'ses_child' }, time: { start: 1_000, end: 2_000 } } },
            { id: 'prt_3', type: 'text', text: 'Hi there' },
        ] })
        await opencodeBridge(app!.log).handleEvent({ platformId: setup.ctx.platform.id, event: idleEvent({ sessionId: step.sessionId }) })
        await resumedBody({ waitpointId })

        const response = await setup.ctx.get('/v1/opencode/step-sessions', { projectId: setup.ctx.project.id, flowRunId: setup.run.id, stepName: 'step_1' })

        expect(response.statusCode).toBe(StatusCodes.OK)
        const [view] = response.json()
        expect(view).toMatchObject({
            stepName: 'step_1',
            action: 'ASK_AI',
            status: 'COMPLETED',
            sessionId: step.sessionId,
            adminPanelUrl: `${stub.url}/${Buffer.from(directory).toString('base64url')}/session/${step.sessionId}`,
            agent: 'flow',
            model: 'stub/stub-model',
            usage: { input: 12, output: 5, reasoning: 1, cost: 0.002 },
            files: [],
            skippedFiles: [],
            sessionGone: false,
        })
        expect(view.durationMs).toBeGreaterThanOrEqual(0)
        expect(view.transcript).toEqual([
            { type: 'text', text: 'Looking around' },
            { type: 'tool', tool: 'task', status: 'completed', input: { description: 'explore' }, output: `${'x'.repeat(4000)}…`, subagentUrl: `${stub.url}/${Buffer.from(directory).toString('base64url')}/session/ses_child` },
            { type: 'text', text: 'Hi there' },
        ])

        stub.state.sessions = stub.state.sessions.filter((session) => session.id !== step.sessionId)
        const removed = await setup.ctx.get('/v1/opencode/step-sessions', { projectId: setup.ctx.project.id, flowRunId: setup.run.id, stepName: 'step_1' })
        expect(removed.json()).toEqual([expect.objectContaining({ sessionGone: true, transcript: [] })])
    })

    it('lists the allowlisted namespaces and projects and OpenCode\'s providers for platform admins only', async () => {
        const ctx = await createTestContext(app!)
        const member = await createMemberContext(app!, ctx, { projectRole: DefaultProjectRole.EDITOR })
        seedNamespace({ id: 'labs', projects: ['l0001', 'l0002'] })
        seedNamespace({ id: 'hidden', projects: ['h0001'] })
        stub.state.providers.splice(0, stub.state.providers.length, { id: 'openrouter', name: 'OpenRouter', models: [{ id: 'qwen/qwen3', name: 'Qwen3' }] })
        await ctx.post('/v1/opencode/connection', { allowlist: ['labs/l0002'] })

        const response = await ctx.get('/v1/opencode/connection/overview')
        const refused = await member.get('/v1/opencode/connection/overview')

        expect(response.json()).toEqual({
            allowed: [{ id: 'labs', name: 'labs', folder: '/root/opencode-home/labs', projects: [{ id: 'l0002', name: 'l0002', folder: '/root/opencode-home/labs/l0002' }] }],
            providers: [{ id: 'openrouter', name: 'OpenRouter', defaultModel: null, models: [{ id: 'qwen/qwen3', name: 'Qwen3' }] }],
        })
        expect(refused.statusCode).toBe(StatusCodes.FORBIDDEN)
    })
})

function seedViews(): void {
    stub.state.views.toolPrompts['writer'] = {
        rows: [
            { index: 1, permission: '*', pattern: '*', action: 'allow', part: 'opencode', from: { kind: 'opencode-default' }, level: 'opencode' },
            { index: 2, permission: 'task', pattern: 'reviewer', action: 'deny', part: 'agent', from: { kind: 'agent' }, level: 'agent' },
            { index: 3, permission: 'skill', pattern: 'sec*', action: 'deny', part: 'config', from: { kind: 'config-permission' }, level: 'project' },
        ],
        sent: [
            { name: 'bash', permission: 'bash', source: { kind: 'builtin' } },
            { name: 'task', permission: 'task', source: { kind: 'builtin' } },
            { name: 'github_issue', permission: 'github_issue', source: { kind: 'mcp', server: 'github' } },
        ],
        notSent: [{ name: 'question', permission: 'question', reason: 'permission', rule: 1 }],
    }
    stub.state.views.capabilities = [
        { kind: 'tool', name: 'bash', origin: 'opencode', location: '<built-in>', state: 'inherited', hides: [] },
        { kind: 'tool', name: 'disabled-tool', origin: 'project', location: 'x', state: 'disabled', hides: [] },
        { kind: 'skill', name: 'pdf', description: 'Read PDFs', origin: 'global', location: 'y', state: 'inherited', hides: [] },
        { kind: 'skill', name: 'secrets', origin: 'project', location: 'z', state: 'local', hides: [] },
        { kind: 'command', name: 'review', description: 'Review the changes', origin: 'opencode', location: '<built-in>', state: 'inherited', hides: [] },
        { kind: 'mcp', name: 'docs', origin: 'project', location: 'opencode.jsonc#mcp.docs', state: 'local', hides: [] },
    ]
    stub.state.views.mcpStatus = { github: { status: 'failed', error: 'token expired' }, iphiflow_step123: { status: 'connected' } }
    stub.state.views.memoryLevels = [
        { level: 'project', folder: '/x/.memory', exists: true, entries: [{ title: 'Stack', file: 'stack.md', description: 'TypeScript monorepo', line: 1 }], invalid: [], unindexed: [], lines: 1, chars: 10 },
        { level: 'agent', folder: '/root/opencode-home/crew/c0001/.memory/agents/writer', exists: true, entries: [{ title: 'Tone', file: 'tone.md', description: 'Short and friendly', line: 1 }], invalid: [], unindexed: [], lines: 1, chars: 10 },
    ]
    stub.state.views.hooks = [{ name: 'audit', event: 'tool.before', command: '/h/audit.sh', script: 'audit.sh', args: [], match: [], onFailure: 'allow', locked: false, enabled: true, description: 'Logs every tool call', level: 'project', file: 'opencode.jsonc', state: 'on' }]
}

async function execute({ setup, waitpointId, body }: { setup: RoutedSetup, waitpointId: string, body: Record<string, unknown> }) {
    return app!.inject({
        method: 'POST',
        url: '/api/v1/ai/execute',
        headers: { authorization: `Bearer ${await engineToken({ setup })}` },
        body: { flowId: setup.flow.id, flowRunId: setup.run.id, provider: AIProviderName.ACTIVEPIECES, modelId: 'smart', waitpointId, ...body },
    })
}
