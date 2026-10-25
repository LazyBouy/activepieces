import { ActionBase } from '@activepieces/pieces-framework'
import {
    DefaultProjectRole,
    FlowActionType,
    FlowOperationType,
    FlowStatus,
    FlowVersionState,
    PackageType,
    PieceType,
    PopulatedFlow,
} from '@activepieces/shared'
import { FastifyInstance } from 'fastify'
import { StatusCodes } from 'http-status-codes'
import { opencodeProvisioning } from '../../../../src/app/opencode/opencode-provisioning'
import { db } from '../../../helpers/db'
import { createMockFlow, createMockFlowVersion, createMockPieceMetadata } from '../../../helpers/mocks'
import { OpencodeStub, startOpencodeStub } from '../../../helpers/opencode-stub'
import { createMemberContext, createTestContext, TestContext } from '../../../helpers/test-context'
import { setupTestEnvironment, teardownTestEnvironment } from '../../../helpers/test-setup'

let app: FastifyInstance | null = null
let stub: OpencodeStub

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

describe('OpenCode settings on flows', () => {
    it('starts a new flow with empty AI settings', async () => {
        const ctx = await createTestContext(app!)

        const flow = await createFlow({ ctx })

        expect(flow.version.opencodeDefaults).toEqual({})
    })

    it('saves the flow default on the draft and rejects an unknown session mode', async () => {
        const ctx = await createTestContext(app!)
        const flow = await createFlow({ ctx })

        const saved = await ctx.post(`/v1/flows/${flow.id}`, {
            type: FlowOperationType.UPDATE_OPENCODE_DEFAULTS,
            request: { sessionMode: 'ONE_PER_RUN' },
        })
        const invalid = await ctx.post(`/v1/flows/${flow.id}`, {
            type: FlowOperationType.UPDATE_OPENCODE_DEFAULTS,
            request: { sessionMode: 'SOMETIMES' },
        })
        const read = await ctx.get(`/v1/flows/${flow.id}`)

        expect(saved.statusCode).toBe(StatusCodes.OK)
        expect(saved.json().version).toMatchObject({ id: flow.version.id, state: FlowVersionState.DRAFT, opencodeDefaults: { sessionMode: 'ONE_PER_RUN' } })
        expect(invalid.statusCode).toBe(StatusCodes.BAD_REQUEST)
        expect(read.json().version.opencodeDefaults).toEqual({ sessionMode: 'ONE_PER_RUN' })
    })

    it('keeps settings.opencode on an AI step and marks a namespace without a project invalid', async () => {
        const ctx = await createTestContext(app!)
        await saveAiPiece()
        const flow = await createFlow({ ctx })

        const partial = await ctx.post(`/v1/flows/${flow.id}`, {
            type: FlowOperationType.ADD_ACTION,
            request: { parentStep: 'trigger', action: askAiStep({ opencode: { namespace: 'team' } }) },
        })
        const complete = await ctx.post(`/v1/flows/${flow.id}`, {
            type: FlowOperationType.UPDATE_ACTION,
            request: askAiStep({ opencode: { sessionMode: 'ONE_PER_RUN', namespace: 'team', project: 'w0001', agent: 'reviewer' } }),
        })
        const read = await ctx.get(`/v1/flows/${flow.id}`)

        expect(partial.statusCode).toBe(StatusCodes.OK)
        expect(partial.json().version.trigger.nextAction).toMatchObject({ valid: false, settings: { opencode: { namespace: 'team' } } })
        expect(complete.json().version.trigger.nextAction.valid).toBe(true)
        expect(read.json().version.trigger.nextAction.settings.opencode).toEqual({ sessionMode: 'ONE_PER_RUN', namespace: 'team', project: 'w0001', agent: 'reviewer' })
    })

    it('carries the flow default into the draft made from a published version', async () => {
        const ctx = await createTestContext(app!)
        const mockFlow = createMockFlow({ projectId: ctx.project.id, status: FlowStatus.DISABLED })
        await db.save('flow', mockFlow)
        const locked = createMockFlowVersion({
            flowId: mockFlow.id,
            state: FlowVersionState.LOCKED,
            opencodeDefaults: { sessionMode: 'ONE_PER_RUN' },
        })
        await db.save('flow_version', locked)
        await db.update('flow', mockFlow.id, { publishedVersionId: locked.id })

        const response = await ctx.post(`/v1/flows/${mockFlow.id}`, {
            type: FlowOperationType.CHANGE_NAME,
            request: { displayName: 'Renamed' },
        })

        expect(response.statusCode).toBe(StatusCodes.OK)
        expect(response.json().version).toMatchObject({ state: FlowVersionState.DRAFT, displayName: 'Renamed', opencodeDefaults: { sessionMode: 'ONE_PER_RUN' } })
        expect(response.json().version.id).not.toBe(locked.id)
        const lockedRow = await db.findOneBy('flow_version', { id: locked.id })
        expect(lockedRow).toMatchObject({ opencodeDefaults: { sessionMode: 'ONE_PER_RUN' } })
    })

    it('carries the flow default on use as draft and on import', async () => {
        const ctx = await createTestContext(app!)
        const mockFlow = createMockFlow({ projectId: ctx.project.id, status: FlowStatus.DISABLED })
        await db.save('flow', mockFlow)
        const older = createMockFlowVersion({
            flowId: mockFlow.id,
            state: FlowVersionState.LOCKED,
            created: '2026-01-01T00:00:00.000Z',
            updated: '2026-01-01T00:00:00.000Z',
            opencodeDefaults: { sessionMode: 'ONE_PER_RUN' },
        })
        const draft = createMockFlowVersion({
            flowId: mockFlow.id,
            state: FlowVersionState.DRAFT,
            created: '2026-02-01T00:00:00.000Z',
            updated: '2026-02-01T00:00:00.000Z',
            opencodeDefaults: {},
        })
        await db.save('flow_version', [older, draft])

        const restored = await ctx.post(`/v1/flows/${mockFlow.id}`, {
            type: FlowOperationType.USE_AS_DRAFT,
            request: { versionId: older.id },
        })
        const imported = await ctx.post(`/v1/flows/${mockFlow.id}`, {
            type: FlowOperationType.IMPORT_FLOW,
            request: { displayName: 'Imported', trigger: draft.trigger, schemaVersion: null, opencodeDefaults: { sessionMode: 'NEW_PER_STEP' } },
        })

        expect(restored.statusCode).toBe(StatusCodes.OK)
        expect(restored.json().version).toMatchObject({ id: draft.id, opencodeDefaults: { sessionMode: 'ONE_PER_RUN' } })
        expect(imported.json().version.opencodeDefaults).toEqual({ sessionMode: 'NEW_PER_STEP' })
    })
})

describe('OpenCode options for a project', () => {
    it('shows only the default location when Run AI on OpenCode is off', async () => {
        const ctx = await createTestContext(app!)
        await ctx.post('/v1/opencode/connection', { enabled: false })

        const response = await ctx.get(`/v1/projects/${ctx.project.id}/opencode`)

        expect(response.statusCode).toBe(StatusCodes.OK)
        expect(response.json()).toEqual({
            enabled: false,
            adminPanelUrl: stub.url,
            namespaces: [],
            defaultLocation: { namespace: 'iphi-flow', project: null, agent: 'flow' },
        })
    })

    it('lists only allowlisted namespaces and projects, with the default project once it exists', async () => {
        const ctx = await createTestContext(app!)
        seedNamespace({ id: 'work', projects: ['w0001', 'w0002'] })
        seedNamespace({ id: 'secret', projects: ['s0001'] })
        await ctx.post('/v1/opencode/connection', { allowlist: ['iphi-flow', 'work/w0001'] })
        const provisioned = await opencodeProvisioning(app!.log).ensureProject({ platformId: ctx.platform.id, projectId: ctx.project.id, projectName: ctx.project.displayName })

        const response = await ctx.get(`/v1/projects/${ctx.project.id}/opencode`)

        expect(response.statusCode).toBe(StatusCodes.OK)
        const body = response.json()
        expect(body.enabled).toBe(true)
        expect(body.defaultLocation).toEqual({ namespace: 'iphi-flow', project: provisioned.opencodeProjectId, agent: 'flow' })
        expect(body.namespaces.map((namespace: { id: string }) => namespace.id).sort()).toEqual(['iphi-flow', 'work'])
        expect(body.namespaces.find((namespace: { id: string }) => namespace.id === 'work').projects).toEqual([
            { id: 'w0001', name: 'w0001', folder: '/root/opencode-home/work/w0001' },
        ])
        expect(JSON.stringify(body)).not.toContain('secret')
    })

    it('lists the primary agents of an allowlisted project and hides subagents, hidden and disabled agents', async () => {
        const ctx = await createTestContext(app!)
        seedNamespace({ id: 'crew', projects: ['c0001'] })
        const directory = '/root/opencode-home/crew/c0001'
        stub.state.agents.push(
            { directory, name: 'reviewer', mode: 'primary', scope: 'project', description: 'Reviews pull requests' },
            { directory, name: 'helper', mode: 'subagent', scope: 'project' },
            { directory, name: 'internal', mode: 'primary', scope: 'project', hidden: true },
            { directory, name: 'retired', mode: 'primary', scope: 'project', disabled: true },
            { directory, name: 'any', mode: 'all', scope: 'project' },
        )
        await ctx.post('/v1/opencode/connection', { allowlist: ['iphi-flow', 'crew'] })

        const response = await ctx.get(`/v1/projects/${ctx.project.id}/opencode/agents`, { namespace: 'crew', project: 'c0001' })

        expect(response.statusCode).toBe(StatusCodes.OK)
        expect(response.json()).toEqual({
            agents: [
                { name: 'reviewer', mode: 'primary', description: 'Reviews pull requests' },
                { name: 'any', mode: 'all' },
            ],
        })
    })

    it('refuses agents of a project that is not allowlisted without asking OpenCode', async () => {
        const ctx = await createTestContext(app!)
        seedNamespace({ id: 'vault', projects: ['v0001'] })
        await ctx.post('/v1/opencode/connection', { allowlist: ['iphi-flow'] })
        const callsBefore = stub.callsTo({ method: 'GET', path: '/operator/agent' }).length

        const response = await ctx.get(`/v1/projects/${ctx.project.id}/opencode/agents`, { namespace: 'vault', project: 'v0001' })

        expect(response.json()).toEqual({
            agents: [],
            error: 'vault/v0001 is not allowlisted. A platform admin can add it in Platform → AI → OpenCode.',
        })
        expect(stub.callsTo({ method: 'GET', path: '/operator/agent' })).toHaveLength(callsBefore)
    })

    it('returns no agents for the default project before it is created', async () => {
        const ctx = await createTestContext(app!)

        const response = await ctx.get(`/v1/projects/${ctx.project.id}/opencode/agents`)

        expect(response.json()).toEqual({ agents: [] })
    })

    it('lets project members read the options and keeps other platforms out', async () => {
        const ctx = await createTestContext(app!)
        const viewer = await createMemberContext(app!, ctx, { projectRole: DefaultProjectRole.VIEWER })
        const outsider = await createTestContext(app!)

        expect((await viewer.get(`/v1/projects/${ctx.project.id}/opencode`)).statusCode).toBe(StatusCodes.OK)
        expect((await viewer.get(`/v1/projects/${ctx.project.id}/opencode/agents`)).statusCode).toBe(StatusCodes.OK)
        expect((await outsider.get(`/v1/projects/${ctx.project.id}/opencode`)).statusCode).toBe(StatusCodes.FORBIDDEN)
        expect((await outsider.get(`/v1/projects/${ctx.project.id}/opencode/agents`)).statusCode).toBe(StatusCodes.FORBIDDEN)
    })
})

async function createFlow({ ctx }: { ctx: TestContext }): Promise<PopulatedFlow> {
    const response = await ctx.post('/v1/flows', {
        displayName: 'AI flow',
        projectId: ctx.project.id,
    }, { query: { projectId: ctx.project.id } })
    return response.json()
}

async function saveAiPiece(): Promise<void> {
    const askAi: ActionBase = { name: 'askAi', displayName: 'Ask AI', description: 'Ask a question', props: {}, requireAuth: false }
    await db.save('piece_metadata', createMockPieceMetadata({
        name: AI_PIECE,
        version: AI_PIECE_VERSION,
        pieceType: PieceType.OFFICIAL,
        packageType: PackageType.REGISTRY,
        actions: { askAi },
        triggers: {},
    }))
}

function askAiStep({ opencode }: { opencode: Record<string, string> }): Record<string, unknown> {
    return {
        type: FlowActionType.PIECE,
        displayName: 'Ask AI',
        name: 'step_1',
        valid: true,
        skip: false,
        settings: {
            pieceName: AI_PIECE,
            pieceVersion: AI_PIECE_VERSION,
            actionName: 'askAi',
            input: {},
            propertySettings: {},
            opencode,
        },
    }
}

function seedNamespace({ id, projects }: { id: string, projects: string[] }): void {
    const folder = `/root/opencode-home/${id}`
    if (!stub.state.namespaces.some((namespace) => namespace.id === id)) {
        stub.state.namespaces.push({ id, name: id, folder })
    }
    for (const project of projects) {
        if (!stub.state.projects.some((candidate) => candidate.id === project)) {
            stub.state.projects.push({ key: `${folder}/${project}`, id: project, name: project, namespace: id, git: true })
        }
    }
}

const AI_PIECE = '@activepieces/piece-ai'

const AI_PIECE_VERSION = '0.99.0'
