import { OpencodeStepSettings } from '@activepieces/shared'
import { FastifyInstance } from 'fastify'
import { StatusCodes } from 'http-status-codes'
import { opencodeBridge } from '../../../../src/app/opencode/opencode-bridge'
import { opencodeStepFixtures, RoutedSetup } from '../../../helpers/opencode-steps'
import { OpencodeStub, startOpencodeStub } from '../../../helpers/opencode-stub'
import { setupTestEnvironment, teardownTestEnvironment } from '../../../helpers/test-setup'

let app: FastifyInstance | null = null
let stub: OpencodeStub
const { routedFlow, waitpointFor, engineToken, stepRow, resumedBody, sessionOf, seedNamespace, idleEvent } = opencodeStepFixtures({ app: () => app!, stub: () => stub })

const PIECE = '@iphi-flow/piece-opencode-openai'
const CREW_FOLDER = '/root/opencode-home/crew/c0001'

beforeAll(async () => {
    stub = await startOpencodeStub()
    stub.state.providers.push({ id: 'openai', name: 'OpenAI', models: [{ id: 'gpt-4o', name: 'GPT-4o' }] })
    process.env.AP_OPENCODE_URL = stub.url
    app = await setupTestEnvironment()
})

afterAll(async () => {
    delete process.env.AP_OPENCODE_URL
    await teardownTestEnvironment()
    await stub.close()
})

describe('OpenCode vendor pieces: a vendor prompt', () => {
    it('runs where the step\'s OpenCode section says, with the vendor model, system text, model options and variant, and resumes with the reply details', async () => {
        const setup = await vendorFlow({ opencode: { sessionMode: 'ONE_PER_RUN', namespace: 'crew', project: 'c0001', agent: 'triage' } })
        const waitpointId = await waitpointFor({ setup, stepName: 'step_1' })

        const response = await vendorStep({
            setup,
            waitpointId,
            request: vendorRequest({
                prompt: 'Earlier in this conversation:\nUser: Hi\n\nWhat is new?',
                system: 'Be brief.',
                options: { temperature: 0.2, maxOutputTokens: 300 },
                variant: 'high',
            }),
        })

        expect(response.statusCode).toBe(StatusCodes.OK)
        const step = await stepRow({ waitpointId })
        expect(step).toMatchObject({
            status: 'DISPATCHED',
            action: 'OPENCODE_VENDOR_PROMPT',
            sessionMode: 'ONE_PER_RUN',
            namespace: 'crew',
            opencodeProjectId: 'c0001',
            agent: 'triage',
            model: { providerID: 'openai', modelID: 'gpt-4o' },
        })
        const session = sessionOf({ id: step.sessionId })
        expect(session.directory).toBe(CREW_FOLDER)
        expect(session.prompts[0]).toMatchObject({
            agent: 'triage',
            model: { providerID: 'openai', modelID: 'gpt-4o' },
            system: 'Be brief.',
            options: { temperature: 0.2, maxOutputTokens: 300 },
            variant: 'high',
            parts: [{ type: 'text', text: 'Earlier in this conversation:\nUser: Hi\n\nWhat is new?' }],
        })
        expect(session.prompts[0]).not.toHaveProperty('format')

        stub.answer({
            sessionId: step.sessionId,
            parts: [
                { id: 'prt_reason', sessionID: step.sessionId, messageID: 'm', type: 'reasoning', text: 'Thinking it over' },
                { id: 'prt_text', sessionID: step.sessionId, messageID: 'm', type: 'text', text: 'Rain tomorrow.' },
            ],
            sources: [{ url: 'https://example.com/weather', title: 'Weather' }, { url: 'https://example.com/weather' }, { url: 'https://example.com/b' }],
        })
        await opencodeBridge(app!.log).handleEvent({ platformId: setup.ctx.platform.id, event: idleEvent({ sessionId: step.sessionId }) })

        expect(await resumedBody({ waitpointId })).toEqual({
            output: {
                answer: 'Rain tomorrow.',
                reasoning: 'Thinking it over',
                sources: [{ url: 'https://example.com/weather', title: 'Weather' }, { url: 'https://example.com/b' }],
                finish: 'stop',
                messageId: `${step.messageId}_r1`,
                sessionId: step.sessionId,
                adminPanelUrl: `${stub.url}/${Buffer.from(CREW_FOLDER).toString('base64url')}/session/${step.sessionId}`,
                model: { providerID: 'stub', modelID: 'stub-model' },
                usage: { input: 12, output: 5, reasoning: 1, cost: 0.002 },
            },
        })
    })

    it('returns the structured answer and the session\'s text turns when asked, and fails when a schema got no structured answer', async () => {
        const setup = await vendorFlow({ steps: 2 })
        const structuredStep = await waitpointFor({ setup, stepName: 'step_1' })
        const missingStep = await waitpointFor({ setup, stepName: 'step_2' })

        await vendorStep({ setup, waitpointId: structuredStep, request: vendorRequest({ prompt: 'Extract it', outputSchema: { type: 'object' }, withHistory: true }) })
        await vendorStep({ setup, waitpointId: missingStep, request: vendorRequest({ prompt: 'Extract more', outputSchema: { type: 'object' } }) })
        const first = await stepRow({ waitpointId: structuredStep })
        const second = await stepRow({ waitpointId: missingStep })

        expect(sessionOf({ id: first.sessionId }).prompts[0]).toMatchObject({ format: { type: 'json_schema', schema: { type: 'object' } } })
        stub.answer({ sessionId: first.sessionId, text: 'Done', structured: { total: 42 } })
        stub.answer({ sessionId: second.sessionId, text: 'No idea' })
        await opencodeBridge(app!.log).handleEvent({ platformId: setup.ctx.platform.id, event: idleEvent({ sessionId: first.sessionId }) })
        await opencodeBridge(app!.log).handleEvent({ platformId: setup.ctx.platform.id, event: idleEvent({ sessionId: second.sessionId }) })

        expect(await resumedBody({ waitpointId: structuredStep })).toMatchObject({
            output: {
                answer: 'Done',
                structured: { total: 42 },
                history: [{ role: 'user', text: 'Extract it' }, { role: 'assistant', text: 'Done' }],
            },
        })
        expect(await resumedBody({ waitpointId: missingStep })).toEqual({ failure: 'The model did not return the requested structured output.' })
    })

    it('fails without prompting when the vendor\'s provider is not connected in OpenCode', async () => {
        const setup = await vendorFlow({})
        const waitpointId = await waitpointFor({ setup, stepName: 'step_1' })

        await vendorStep({ setup, waitpointId, request: vendorRequest({ vendor: 'Mistral AI', provider: 'mistral', model: 'mistral-small-latest', prompt: 'Hi' }) })

        expect(await resumedBody({ waitpointId })).toEqual({ failure: 'Connect Mistral AI in the OpenCode admin panel to run this step.' })
        expect(await stepRow({ waitpointId })).toMatchObject({ status: 'FAILED', sessionId: null })
    })
})

describe('OpenCode vendor pieces: sessions', () => {
    it('continues a remembered session, and starts a new one when the remembered session is gone', async () => {
        const setup = await vendorFlow({ steps: 2 })
        const remembered = await stub.createSession({ directory: CREW_FOLDER })
        const kept = await waitpointFor({ setup, stepName: 'step_1' })
        const gone = await waitpointFor({ setup, stepName: 'step_2' })

        await vendorStep({ setup, waitpointId: kept, request: vendorRequest({ prompt: 'Again', session: { kind: 'MEMORY', sessionId: remembered } }) })
        await vendorStep({ setup, waitpointId: gone, request: vendorRequest({ prompt: 'Again', session: { kind: 'MEMORY', sessionId: 'ses_missing' } }) })

        const keptStep = await stepRow({ waitpointId: kept })
        const goneStep = await stepRow({ waitpointId: gone })
        expect(keptStep).toMatchObject({ status: 'DISPATCHED', sessionId: remembered, namespace: 'crew', opencodeProjectId: 'c0001' })
        expect(sessionOf({ id: remembered }).prompts).toHaveLength(1)
        expect(goneStep).toMatchObject({ status: 'DISPATCHED', sessionMode: 'NEW_PER_STEP', namespace: 'iphi-flow', agent: 'flow' })
        expect(goneStep.sessionId).not.toBe('ses_missing')
        expect(sessionOf({ id: goneStep.sessionId }).prompts[0]).toMatchObject({ parts: [{ type: 'text', text: 'Again' }] })
    })

    it('starts a session of its own for a new memory key even when the step shares this run\'s session', async () => {
        const setup = await vendorFlow({ opencode: { sessionMode: 'ONE_PER_RUN' } })
        const waitpointId = await waitpointFor({ setup, stepName: 'step_1' })

        await vendorStep({ setup, waitpointId, request: vendorRequest({ prompt: 'First turn', session: { kind: 'NEW' } }) })

        expect(await stepRow({ waitpointId })).toMatchObject({ status: 'DISPATCHED', sessionMode: 'NEW_PER_STEP', runSessionId: null })
    })
})

async function vendorFlow({ opencode, steps = 1 }: { opencode?: OpencodeStepSettings, steps?: number }): Promise<RoutedSetup> {
    const setup = await routedFlow({
        steps: Array.from({ length: steps }, (_, index) => ({ name: `step_${index + 1}`, pieceName: PIECE, actionName: 'ask_chatgpt', ...(opencode === undefined ? {} : { opencode }) })),
    })
    seedNamespace({ id: 'crew', projects: ['c0001'] })
    await setup.ctx.post('/v1/opencode/connection', { allowlist: ['iphi-flow', 'crew'] })
    return setup
}

function vendorRequest(overrides: Record<string, unknown>): Record<string, unknown> {
    return {
        action: 'OPENCODE_VENDOR_PROMPT',
        vendor: 'OpenAI',
        provider: 'openai',
        model: 'gpt-4o',
        session: { kind: 'STEP' },
        ...overrides,
    }
}

async function vendorStep({ setup, waitpointId, request }: { setup: RoutedSetup, waitpointId: string, request: Record<string, unknown> }) {
    return app!.inject({
        method: 'POST',
        url: '/api/v1/opencode/steps',
        headers: { authorization: `Bearer ${await engineToken({ setup })}` },
        body: { flowId: setup.flow.id, flowRunId: setup.run.id, waitpointId, request },
    })
}
