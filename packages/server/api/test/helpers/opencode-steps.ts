import { apId } from '@activepieces/core-utils'
import {
    AiRouterMatchMode,
    BranchExecutionType,
    FlowActionType,
    FlowRunStatus,
    FlowStatus,
    FlowTriggerType,
    FlowVersionState,
    OpencodeDefaults,
    OpencodeStepSettings,
    PrincipalType,
    RunEnvironment,
} from '@activepieces/shared'
import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { generateMockToken } from './auth'
import { db } from './db'
import { createMockFlow, createMockFlowRun, createMockFlowVersion } from './mocks'
import { OpencodeStub } from './opencode-stub'
import { createTestContext, TestContext } from './test-context'

export function opencodeStepFixtures({ app, stub }: { app: () => FastifyInstance, stub: () => OpencodeStub }) {
    return {
        async routedFlow({ steps, defaults = {}, stepNameToTest }: RoutedFlowParams): Promise<RoutedSetup> {
            const ctx = await createTestContext(app())
            await ctx.get('/v1/opencode/connection')
            const flow = createMockFlow({ projectId: ctx.project.id, status: FlowStatus.DISABLED })
            await db.save('flow', flow)
            const version = createMockFlowVersion({
                flowId: flow.id,
                displayName: 'Routed flow',
                state: FlowVersionState.DRAFT,
                opencodeDefaults: defaults,
                trigger: {
                    name: 'trigger',
                    type: FlowTriggerType.EMPTY,
                    valid: true,
                    displayName: 'Trigger',
                    lastUpdatedDate: new Date().toISOString(),
                    settings: {},
                    nextAction: chain({ steps }),
                },
            })
            await db.save('flow_version', version)
            const run = {
                ...createMockFlowRun({
                    projectId: ctx.project.id,
                    flowId: flow.id,
                    flowVersionId: version.id,
                    status: FlowRunStatus.RUNNING,
                    environment: RunEnvironment.TESTING,
                }),
                ...(stepNameToTest === undefined ? {} : { stepNameToTest }),
            }
            await db.save('flow_run', run)
            return { ctx, flow, run }
        },

        async waitpointFor({ setup, stepName }: { setup: RoutedSetup, stepName: string }): Promise<string> {
            const id = apId()
            await db.save('waitpoint', {
                id,
                flowRunId: setup.run.id,
                projectId: setup.ctx.project.id,
                stepName,
                type: 'WEBHOOK',
                status: 'PENDING',
                resumeDateTime: new Date(Date.now() + 3_600_000).toISOString(),
                httpRequestId: null,
                workerHandlerId: null,
            })
            return id
        },

        async engineToken({ setup }: { setup: RoutedSetup }): Promise<string> {
            return generateMockToken({
                type: PrincipalType.ENGINE,
                id: apId(),
                projectId: setup.ctx.project.id,
                platform: { id: setup.ctx.platform.id },
            })
        },

        async stepRow({ waitpointId }: { waitpointId: string }): Promise<StepRowView> {
            return StepRowView.parse(await db.findOneBy('opencode_step', { waitpointId }))
        },

        async resumedBody({ waitpointId }: { waitpointId: string }): Promise<unknown> {
            await waitFor(async () => ResumedWaitpoint.safeParse(await db.findOneBy('waitpoint', { id: waitpointId })).success)
            return ResumedWaitpoint.parse(await db.findOneBy('waitpoint', { id: waitpointId })).resumePayload.body
        },

        sessionOf({ id }: { id: string | null }): OpencodeStub['state']['sessions'][number] {
            const session = stub().state.sessions.find((candidate) => candidate.id === id)
            if (session === undefined) {
                throw new Error(`the stub has no session ${id}`)
            }
            return session
        },

        seedNamespace({ id, projects }: { id: string, projects: string[] }): void {
            const state = stub().state
            const folder = `/root/opencode-home/${id}`
            if (!state.namespaces.some((namespace) => namespace.id === id)) {
                state.namespaces.push({ id, name: id, folder })
            }
            for (const project of projects) {
                if (!state.projects.some((candidate) => candidate.id === project)) {
                    state.projects.push({ key: `${folder}/${project}`, id: project, name: project, namespace: id, git: true })
                }
            }
        },

        idleEvent({ sessionId }: { sessionId: string | null }): Record<string, unknown> {
            return { directory: '/x', payload: { id: 'evt_1', type: 'session.idle', properties: { sessionID: sessionId } } }
        },

        statusIdleEvent({ sessionId }: { sessionId: string | null }): Record<string, unknown> {
            return { directory: '/x', payload: { id: 'evt_2', type: 'session.status', properties: { sessionID: sessionId, status: { type: 'idle' } } } }
        },

        captureEmits(): EmittedEvent[] {
            const emitted: EmittedEvent[] = []
            const io = app().io
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
        },

        waitFor,
    }
}

function chain({ steps }: { steps: OpencodeStepSpec[] }): Record<string, unknown> | undefined {
    const [head, ...rest] = steps
    if (head === undefined) {
        return undefined
    }
    const common = {
        name: head.name,
        valid: true,
        displayName: head.name,
        lastUpdatedDate: new Date().toISOString(),
        nextAction: chain({ steps: rest }),
    }
    if (head.router === true) {
        return {
            ...common,
            type: FlowActionType.AI_ROUTER,
            settings: {
                matchMode: AiRouterMatchMode.BEST_MATCH,
                branches: [{ branchType: BranchExecutionType.FALLBACK, branchName: 'Otherwise' }],
                ...(head.opencode === undefined ? {} : { opencode: head.opencode }),
            },
            children: [null],
        }
    }
    return {
        ...common,
        type: FlowActionType.PIECE,
        settings: {
            pieceName: '@activepieces/piece-ai',
            pieceVersion: '0.11.0',
            actionName: head.actionName ?? 'askAi',
            input: {},
            propertySettings: {},
            ...(head.opencode === undefined ? {} : { opencode: head.opencode }),
        },
    }
}

async function waitFor(check: () => Promise<boolean>): Promise<void> {
    for (let attempt = 0; attempt < 100; attempt++) {
        if (await check()) {
            return
        }
        await new Promise((resolve) => setTimeout(resolve, 50))
    }
    throw new Error('condition was not met in time')
}

const StepRowView = z.object({
    id: z.string(),
    status: z.string(),
    sessionId: z.string().nullable(),
    messageId: z.string(),
    sessionMode: z.string(),
}).passthrough()

const ResumedWaitpoint = z.object({
    status: z.enum(['COMPLETED', 'CONSUMED']),
    resumePayload: z.object({ body: z.unknown() }),
})

export type OpencodeStepSpec = {
    name: string
    actionName?: string
    router?: boolean
    opencode?: OpencodeStepSettings
}

export type RoutedSetup = {
    ctx: TestContext
    flow: { id: string }
    run: { id: string }
}

export type StepRowView = z.infer<typeof StepRowView>

export type EmittedEvent = {
    room: string
    event: string
    payload: unknown
}

type RoutedFlowParams = {
    steps: OpencodeStepSpec[]
    defaults?: OpencodeDefaults
    stepNameToTest?: string
}
