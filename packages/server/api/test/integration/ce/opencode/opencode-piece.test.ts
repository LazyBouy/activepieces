import { apId } from '@activepieces/core-utils'
import { FileCompression, FileType } from '@activepieces/shared'
import { FastifyInstance } from 'fastify'
import { StatusCodes } from 'http-status-codes'
import { fileService } from '../../../../src/app/file/file.service'
import { opencodeBridge } from '../../../../src/app/opencode/opencode-bridge'
import { opencodeCompletion } from '../../../../src/app/opencode/opencode-completion'
import { opencodeSweep } from '../../../../src/app/opencode/opencode-sweep'
import { db } from '../../../helpers/db'
import { opencodeStepFixtures, RoutedSetup } from '../../../helpers/opencode-steps'
import { OpencodeStub, startOpencodeStub } from '../../../helpers/opencode-stub'
import { setupTestEnvironment, teardownTestEnvironment } from '../../../helpers/test-setup'

let app: FastifyInstance | null = null
let stub: OpencodeStub
const { routedFlow, waitpointFor, engineToken, stepRow, resumedBody, sessionOf, seedNamespace, idleEvent, waitFor } = opencodeStepFixtures({ app: () => app!, stub: () => stub })

const PIECE = '@iphi-flow/piece-opencode'
const CREW_FOLDER = '/root/opencode-home/crew/c0001'

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

describe('OpenCode piece: Run an Agent', () => {
    it('runs in the named project with the files, schema, model and this run\'s session, and resumes with the full output', async () => {
        const setup = await crewFlow({ actionName: 'run_agent' })
        const file = await fileService(app!.log).save({
            projectId: setup.ctx.project.id,
            platformId: setup.ctx.platform.id,
            type: FileType.FLOW_STEP_FILE,
            fileName: 'notes.txt',
            data: Buffer.from('ticket 42'),
            size: 9,
            compression: FileCompression.NONE,
            metadata: {},
        })
        const waitpointId = await waitpointFor({ setup, stepName: 'step_1' })
        const schema = { type: 'object', properties: { ticket: { type: 'number' } }, required: ['ticket'] }

        const response = await pieceStep({
            setup,
            waitpointId,
            request: {
                action: 'OPENCODE_RUN_AGENT',
                namespace: 'crew',
                project: 'c0001',
                agent: 'triage',
                prompt: 'Find the ticket',
                files: [{ fileId: file.id, filename: 'notes.txt' }],
                outputSchema: schema,
                model: { providerID: 'openrouter', modelID: 'qwen/qwen3-coder' },
                session: { kind: 'RUN' },
            },
        })

        expect(response.statusCode).toBe(StatusCodes.OK)
        expect(response.json()).toEqual({ requestId: expect.any(String) })
        const step = await stepRow({ waitpointId })
        expect(step).toMatchObject({
            status: 'DISPATCHED',
            action: 'OPENCODE_RUN_AGENT',
            sessionMode: 'ONE_PER_RUN',
            namespace: 'crew',
            opencodeProjectId: 'c0001',
            agent: 'triage',
            model: { providerID: 'openrouter', modelID: 'qwen/qwen3-coder' },
            runSessionId: expect.any(String),
        })
        const session = sessionOf({ id: step.sessionId })
        expect(session.directory).toBe(CREW_FOLDER)
        expect(session.prompts[0]).toMatchObject({
            agent: 'triage',
            model: { providerID: 'openrouter', modelID: 'qwen/qwen3-coder' },
            format: { type: 'json_schema', schema },
            parts: [
                { type: 'text', text: `Find the ticket\n\nSave the files you create for this step in out/${step.id}/ in the project folder.` },
                { type: 'file', mime: 'text/plain', filename: 'notes.txt', url: `data:text/plain;base64,${Buffer.from('ticket 42').toString('base64')}` },
            ],
        })

        stub.answer({ sessionId: step.sessionId, text: 'Ticket 42 it is', structured: { ticket: 42 }, finish: 'tool-calls' })
        await opencodeBridge(app!.log).handleEvent({ platformId: setup.ctx.platform.id, event: idleEvent({ sessionId: step.sessionId }) })

        expect(await resumedBody({ waitpointId })).toEqual({
            output: {
                answer: 'Ticket 42 it is',
                structured: { ticket: 42 },
                sessionId: step.sessionId,
                adminPanelUrl: `${stub.url}/${Buffer.from(CREW_FOLDER).toString('base64url')}/session/${step.sessionId}`,
                namespace: 'crew',
                project: 'c0001',
                agent: 'triage',
                model: { providerID: 'stub', modelID: 'stub-model' },
                usage: { input: 12, output: 5, reasoning: 1, cost: 0.002 },
                files: [],
                skippedFiles: [],
            },
        })
    })

    it('fails when a schema was asked for and no structured answer came back', async () => {
        const setup = await crewFlow({ actionName: 'run_agent' })
        const waitpointId = await waitpointFor({ setup, stepName: 'step_1' })
        await pieceStep({ setup, waitpointId, request: { action: 'OPENCODE_RUN_AGENT', prompt: 'Count', outputSchema: { type: 'object' }, session: { kind: 'NEW' } } })
        const step = await stepRow({ waitpointId })

        stub.answer({ sessionId: step.sessionId, text: 'About three' })
        await opencodeBridge(app!.log).handleEvent({ platformId: setup.ctx.platform.id, event: idleEvent({ sessionId: step.sessionId }) })

        expect(step).toMatchObject({ namespace: 'iphi-flow', agent: 'flow', sessionMode: 'NEW_PER_STEP' })
        expect(await resumedBody({ waitpointId })).toEqual({ failure: 'The model did not return the requested structured output.' })
    })

    it('refuses a named session outside the allowlist or one that no longer exists', async () => {
        const setup = await crewFlow({ actionName: 'run_agent', steps: 2 })
        seedNamespace({ id: 'secret', projects: ['s0001'] })
        const hidden = await stub.createSession({ directory: '/root/opencode-home/secret/s0001' })
        const outside = await waitpointFor({ setup, stepName: 'step_1' })
        const gone = await waitpointFor({ setup, stepName: 'step_2' })

        await pieceStep({ setup, waitpointId: outside, request: { action: 'OPENCODE_RUN_AGENT', prompt: 'Peek', session: { kind: 'EXISTING', sessionId: hidden } } })
        await pieceStep({ setup, waitpointId: gone, request: { action: 'OPENCODE_RUN_AGENT', prompt: 'Peek', session: { kind: 'EXISTING', sessionId: 'ses_missing' } } })

        expect(await resumedBody({ waitpointId: outside })).toEqual({ failure: 'secret/s0001 is not allowlisted. A platform admin can add it in Platform → AI → OpenCode.' })
        expect(await resumedBody({ waitpointId: gone })).toEqual({ failure: 'The OpenCode session ses_missing no longer exists.' })
        expect(sessionOf({ id: hidden }).prompts).toEqual([])
    })
})

describe('OpenCode piece: Continue a Session', () => {
    it('continues the session with its own agent and the prompt as typed, and steps naming the same session take turns', async () => {
        const setup = await crewFlow({ actionName: 'continue_session', steps: 2 })
        const sessionId = await stub.createSession({ directory: CREW_FOLDER })
        const session = sessionOf({ id: sessionId })
        session.agent = 'writer'
        const first = await waitpointFor({ setup, stepName: 'step_1' })
        const second = await waitpointFor({ setup, stepName: 'step_2' })

        await pieceStep({ setup, waitpointId: first, request: { action: 'OPENCODE_CONTINUE_SESSION', sessionId, prompt: 'Now summarise it' } })
        await pieceStep({ setup, waitpointId: second, request: { action: 'OPENCODE_CONTINUE_SESSION', sessionId, prompt: 'And translate it' } })

        expect(await stepRow({ waitpointId: first })).toMatchObject({ status: 'DISPATCHED', sessionId, agent: 'writer', namespace: 'crew', opencodeProjectId: 'c0001' })
        expect(await stepRow({ waitpointId: second })).toMatchObject({ status: 'QUEUED' })
        expect(session.prompts).toHaveLength(1)
        expect(session.prompts[0]).toMatchObject({ agent: 'writer', parts: [{ type: 'text', text: 'Now summarise it' }] })
        expect(session.prompts[0]['format']).toBeUndefined()

        stub.answer({ sessionId, text: 'A short summary' })
        await opencodeBridge(app!.log).handleEvent({ platformId: setup.ctx.platform.id, event: idleEvent({ sessionId }) })

        expect(await resumedBody({ waitpointId: first })).toMatchObject({ output: { answer: 'A short summary', sessionId, agent: 'writer' } })
        await waitFor(async () => session.prompts.length === 2)
        expect(session.prompts[1]).toMatchObject({ parts: [{ type: 'text', text: 'And translate it' }] })
        expect(await stepRow({ waitpointId: second })).toMatchObject({ status: 'DISPATCHED', sessionId })
    })
})

describe('OpenCode piece: one session used by two runs', () => {
    it('a step continuing another run\'s session waits until that run\'s step there has finished', async () => {
        const owner = await crewFlow({ actionName: 'run_agent' })
        const other = await anotherRun({ setup: owner })
        const ownerWaitpoint = await waitpointFor({ setup: owner, stepName: 'step_1' })
        await pieceStep({ setup: owner, waitpointId: ownerWaitpoint, request: { action: 'OPENCODE_RUN_AGENT', prompt: 'Start the report', session: { kind: 'RUN' } } })
        const ownerStep = await stepRow({ waitpointId: ownerWaitpoint })
        const otherWaitpoint = await waitpointFor({ setup: other, stepName: 'step_1' })

        await pieceStep({ setup: other, waitpointId: otherWaitpoint, request: { action: 'OPENCODE_CONTINUE_SESSION', sessionId: ownerStep.sessionId, prompt: 'Add a summary' } })

        expect(await stepRow({ waitpointId: otherWaitpoint })).toMatchObject({ status: 'QUEUED' })
        expect(sessionOf({ id: ownerStep.sessionId }).prompts).toHaveLength(1)

        stub.answer({ sessionId: ownerStep.sessionId, text: 'Report started' })
        await opencodeBridge(app!.log).handleEvent({ platformId: owner.ctx.platform.id, event: idleEvent({ sessionId: ownerStep.sessionId }) })
        expect(await resumedBody({ waitpointId: ownerWaitpoint })).toMatchObject({ output: { answer: 'Report started' } })
        await opencodeSweep(app!.log).retryQueued()

        expect(await stepRow({ waitpointId: otherWaitpoint })).toMatchObject({ status: 'DISPATCHED', sessionId: ownerStep.sessionId })
        expect(sessionOf({ id: ownerStep.sessionId }).prompts[1]).toMatchObject({ parts: [{ type: 'text', text: 'Add a summary' }] })
    })
})

describe('OpenCode piece: Run a Command', () => {
    it('runs a command from the project\'s list and answers with its reply; an unknown command fails with its name', async () => {
        stub.state.commands = [{ name: 'review', source: 'command' }, { name: 'pdf', source: 'skill' }]
        const setup = await crewFlow({ actionName: 'run_command', steps: 2 })
        const waitpointId = await waitpointFor({ setup, stepName: 'step_1' })
        const unknown = await waitpointFor({ setup, stepName: 'step_2' })

        await pieceStep({ setup, waitpointId, request: { action: 'OPENCODE_RUN_COMMAND', namespace: 'crew', project: 'c0001', command: 'review', arguments: 'src/', session: { kind: 'NEW' } } })
        await pieceStep({ setup, waitpointId: unknown, request: { action: 'OPENCODE_RUN_COMMAND', namespace: 'crew', project: 'c0001', command: 'deploy', session: { kind: 'NEW' } } })

        const step = await stepRow({ waitpointId })
        expect(step).toMatchObject({ status: 'DISPATCHED', action: 'OPENCODE_RUN_COMMAND' })
        expect(sessionOf({ id: step.sessionId }).prompts[0]).toMatchObject({ messageID: step.messageId, command: 'review', arguments: 'src/', agent: 'flow', parts: [] })
        expect(await resumedBody({ waitpointId: unknown })).toEqual({ failure: 'OpenCode has no command or skill deploy in crew/c0001.' })

        stub.answer({ sessionId: step.sessionId, text: 'Looks good to me' })
        await opencodeBridge(app!.log).handleEvent({ platformId: setup.ctx.platform.id, event: idleEvent({ sessionId: step.sessionId }) })

        const body = await resumedBody({ waitpointId })
        expect(body).toMatchObject({ output: { answer: 'Looks good to me', sessionId: step.sessionId, namespace: 'crew', project: 'c0001' } })
        expect(body).not.toHaveProperty('output.structured')
    })
})

describe('OpenCode piece: Send to Project Inbox', () => {
    it('without waiting, sends from outside and returns where the message went; with no recipient the inbox dead-letters it', async () => {
        const setup = await crewFlow({ actionName: 'send_to_inbox' })

        const routed = await pieceStep({ setup, request: { action: 'OPENCODE_SEND_TO_INBOX', namespace: 'crew', project: 'c0001', message: 'New order 7', to: { type: 'agent', id: 'writer' }, wait: false } })
        const dead = await pieceStep({ setup, request: { action: 'OPENCODE_SEND_TO_INBOX', namespace: 'crew', project: 'c0001', message: 'Anyone?', wait: false } })

        expect(routed.json()).toEqual({
            requestId: expect.any(String),
            output: { messageId: expect.stringMatching(/^msg_/), correlationId: expect.stringMatching(/^iphiflow_/), status: 'routed', routedTo: ['writer'] },
        })
        const sent = stub.state.inboxMessages.find((message) => message.id === routed.json().output.messageId)
        expect(sent).toMatchObject({ from: { kind: 'external' }, correlationID: routed.json().output.correlationId, body: { text: 'New order 7' } })
        expect(dead.json().output).toMatchObject({ status: 'dead letter', routedTo: [] })
        expect(await db.findBy('opencode_step', { flowRunId: setup.run.id })).toEqual([])
    })

    it('waits for the receiving agent\'s answer, resumes with it and shows that session on the run page', async () => {
        const setup = await crewFlow({ actionName: 'send_to_inbox' })
        const waitpointId = await waitpointFor({ setup, stepName: 'step_1' })

        await pieceStep({ setup, waitpointId, request: { action: 'OPENCODE_SEND_TO_INBOX', namespace: 'crew', project: 'c0001', message: 'Has order 7 shipped?', to: { type: 'agent', id: 'writer' }, wait: true, timeoutMinutes: 5 } })
        const step = await stepRow({ waitpointId })
        const delivered = stub.state.sessions[stub.state.sessions.length - 1]
        expect(step).toMatchObject({ status: 'DISPATCHED', sessionId: null, namespace: 'crew', opencodeProjectId: 'c0001' })
        expect(delivered).toMatchObject({ agent: 'writer', directory: CREW_FOLDER })

        await opencodeBridge(app!.log).handleEvent({ platformId: setup.ctx.platform.id, event: idleEvent({ sessionId: 'ses_unrelated' }) })
        expect(await stepRow({ waitpointId })).toMatchObject({ status: 'DISPATCHED' })
        stub.answer({ sessionId: delivered.id, text: 'Yes, it shipped this morning' })
        await opencodeBridge(app!.log).handleEvent({ platformId: setup.ctx.platform.id, event: idleEvent({ sessionId: delivered.id }) })

        expect(await resumedBody({ waitpointId })).toEqual({
            output: {
                messageId: expect.stringMatching(/^msg_/),
                correlationId: `iphiflow_${step.id}`,
                status: 'routed',
                routedTo: ['writer'],
                reply: 'Yes, it shipped this morning',
                replyFrom: { agent: 'writer', sessionId: delivered.id, adminPanelUrl: `${stub.url}/${Buffer.from(CREW_FOLDER).toString('base64url')}/session/${delivered.id}` },
            },
        })
        expect(await stepRow({ waitpointId })).toMatchObject({ status: 'COMPLETED', sessionId: delivered.id, agent: 'writer' })
        const views = await setup.ctx.get('/v1/opencode/step-sessions', { projectId: setup.ctx.project.id, flowRunId: setup.run.id, stepName: 'step_1' })
        expect(views.json()).toEqual([expect.objectContaining({ action: 'OPENCODE_SEND_TO_INBOX', sessionId: delivered.id, transcript: [{ type: 'text', text: 'Yes, it shipped this morning' }] })])
    })

    it('fails a waiting step at once when the message is dead-lettered, and after the timeout when nobody answers', async () => {
        const setup = await crewFlow({ actionName: 'send_to_inbox', steps: 2 })
        const dead = await waitpointFor({ setup, stepName: 'step_1' })
        const silent = await waitpointFor({ setup, stepName: 'step_2' })

        await pieceStep({ setup, waitpointId: dead, request: { action: 'OPENCODE_SEND_TO_INBOX', namespace: 'crew', project: 'c0001', message: 'Anyone?', wait: true } })
        await pieceStep({ setup, waitpointId: silent, request: { action: 'OPENCODE_SEND_TO_INBOX', namespace: 'crew', project: 'c0001', message: 'Ping', to: { type: 'agent', id: 'writer' }, wait: true, timeoutMinutes: 1 } })

        expect(await resumedBody({ waitpointId: dead })).toEqual({ failure: 'The project inbox did not deliver the message: no rule matched, the project has no manager, and it names no recipient.' })
        const step = await stepRow({ waitpointId: silent })
        expect(await opencodeCompletion(app!.log).complete({ stepId: step.id })).toEqual({ finished: false, nextStepId: null })
        await db.update('opencode_step', step.id, { dispatchedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString() })
        await opencodeCompletion(app!.log).complete({ stepId: step.id })
        expect(await resumedBody({ waitpointId: silent })).toEqual({ failure: 'No reply arrived within 1 min.' })
    })
})

describe('OpenCode piece: the step route and its dropdowns', () => {
    it('answers that routing is off instead of starting anything', async () => {
        const setup = await crewFlow({ actionName: 'run_agent' })
        await setup.ctx.post('/v1/opencode/connection', { enabled: false })

        const response = await pieceStep({ setup, request: { action: 'OPENCODE_RUN_AGENT', prompt: 'x', session: { kind: 'NEW' } } })

        expect(response.json()).toEqual({ requestId: expect.any(String), failure: 'Run AI on OpenCode is off. Turn it on in Platform → AI → OpenCode.' })
        expect(await db.findBy('opencode_step', { flowRunId: setup.run.id })).toEqual([])
        await setup.ctx.post('/v1/opencode/connection', { enabled: true })
    })

    it('lists only allowlisted namespaces, and the agents, commands, groups and models of the picked project, for a running flow only', async () => {
        const setup = await crewFlow({ actionName: 'run_agent' })
        seedNamespace({ id: 'secret', projects: ['s0001'] })
        stub.state.agents.push({ directory: CREW_FOLDER, name: 'writer', mode: 'primary', scope: 'project', description: 'Writes replies' })
        stub.state.commands = [{ name: 'review', source: 'command', description: 'Review the change' }, { name: 'pdf', source: 'skill' }]
        stub.state.groups[CREW_FOLDER] = [{ id: 'g1', name: 'Writers', members: ['writer'] }]
        const query = { namespace: 'crew', project: 'c0001' }

        const options = await engineGet({ setup, path: '/options' })
        const agents = await engineGet({ setup, path: '/agents', query })
        const commands = await engineGet({ setup, path: '/commands', query })
        const groups = await engineGet({ setup, path: '/groups', query })
        const models = await engineGet({ setup, path: '/models', query })
        const hidden = await engineGet({ setup, path: '/commands', query: { namespace: 'secret', project: 's0001' } })
        const asUser = await setup.ctx.get('/v1/opencode/steps/options')

        expect(options.json().namespaces.map((namespace: { id: string }) => namespace.id).sort()).toEqual(['crew', 'iphi-flow'])
        expect(agents.json()).toEqual({ agents: [{ name: 'writer', mode: 'primary', description: 'Writes replies' }] })
        expect(commands.json()).toEqual({ commands: [{ name: 'review', source: 'command', description: 'Review the change' }, { name: 'pdf', source: 'skill' }] })
        expect(groups.json()).toEqual({ groups: [{ id: 'g1', name: 'Writers' }] })
        expect(models.json()).toEqual({ providers: [{ id: 'openrouter', name: 'OpenRouter', defaultModel: null, models: [{ id: 'qwen/qwen3-coder', name: 'Qwen3 Coder' }] }] })
        expect(hidden.json()).toEqual({ commands: [], error: 'secret/s0001 is not allowlisted. A platform admin can add it in Platform → AI → OpenCode.' })
        expect(asUser.statusCode).toBe(StatusCodes.FORBIDDEN)
    })
})

async function crewFlow({ actionName, steps = 1 }: { actionName: string, steps?: number }): Promise<RoutedSetup> {
    const setup = await routedFlow({ steps: Array.from({ length: steps }, (_, index) => ({ name: `step_${index + 1}`, pieceName: PIECE, actionName })) })
    seedNamespace({ id: 'crew', projects: ['c0001'] })
    await setup.ctx.post('/v1/opencode/connection', { allowlist: ['iphi-flow', 'crew'] })
    return setup
}

async function anotherRun({ setup }: { setup: RoutedSetup }): Promise<RoutedSetup> {
    const run = await db.findOneByOrFail<Record<string, unknown>>('flow_run', { id: setup.run.id })
    const copy = { ...run, id: apId() }
    await db.save('flow_run', copy)
    return { ...setup, run: { id: copy.id } }
}

async function pieceStep({ setup, waitpointId, request }: { setup: RoutedSetup, waitpointId?: string, request: Record<string, unknown> }) {
    return app!.inject({
        method: 'POST',
        url: '/api/v1/opencode/steps',
        headers: { authorization: `Bearer ${await engineToken({ setup })}` },
        body: { flowId: setup.flow.id, flowRunId: setup.run.id, ...(waitpointId === undefined ? {} : { waitpointId }), request },
    })
}

async function engineGet({ setup, path, query = {} }: { setup: RoutedSetup, path: string, query?: Record<string, string> }) {
    return app!.inject({
        method: 'GET',
        url: `/api/v1/opencode/steps${path}`,
        query,
        headers: { authorization: `Bearer ${await engineToken({ setup })}` },
    })
}
