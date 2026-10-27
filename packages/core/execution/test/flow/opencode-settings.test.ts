import {
    AI_PIECE_NAME,
    AiRouterActionSettingsWithValidation,
    FlowActionType,
    flowOperations,
    FlowOperationRequest,
    FlowOperationType,
    flowStructureUtil,
    FlowVersion,
    OPENCODE_PIECE_NAME,
    OpencodeStepSettings,
    OpencodeStepSettingsWithValidation,
    opencodeStepUtil,
    PieceAction,
} from '../../src'
import { canvasFixtures } from './canvas-fixtures'

const { code, aiRouter, flowVersion } = canvasFixtures

function aiPiece({ name, actionName, opencode, next }: AiPieceParams): PieceAction {
    return {
        name,
        type: FlowActionType.PIECE,
        valid: true,
        displayName: name,
        lastUpdatedDate: '2026-10-10T00:00:00.000Z',
        settings: {
            pieceName: AI_PIECE_NAME,
            pieceVersion: '0.4.0',
            actionName,
            input: {},
            propertySettings: {},
            ...(opencode ? { opencode } : {}),
        },
        nextAction: next,
    }
}

function apply(version: FlowVersion, operation: FlowOperationRequest): FlowVersion {
    return flowOperations.apply(version, operation)
}

function withoutOpencodeDefaults(version: FlowVersion): FlowVersion {
    const { opencodeDefaults: _opencodeDefaults, ...rest } = version
    return JSON.parse(JSON.stringify(rest))
}

describe('opencodeStepUtil.isOpencodeStep', () => {
    it.each(['askAi', 'summarizeText', 'classifyText', 'extractStructuredData', 'run_agent'])('routes the AI piece action %s', (actionName) => {
        expect(opencodeStepUtil.isOpencodeStep({ step: aiPiece({ name: 'step_1', actionName }) })).toBe(true)
    })

    it('routes the AI router step', () => {
        expect(opencodeStepUtil.isOpencodeStep({ step: aiRouter({ name: 'step_1', branches: [{ name: 'A' }, { name: 'Otherwise' }] }) })).toBe(true)
    })

    it('leaves image generation, other pieces, code steps and the trigger on Activepieces', () => {
        const otherPiece = aiPiece({ name: 'step_2', actionName: 'askAi' })
        otherPiece.settings.pieceName = '@activepieces/piece-openai'

        expect(opencodeStepUtil.isOpencodeStep({ step: aiPiece({ name: 'step_1', actionName: 'generateImage' }) })).toBe(false)
        expect(opencodeStepUtil.isOpencodeStep({ step: otherPiece })).toBe(false)
        expect(opencodeStepUtil.isOpencodeStep({ step: code({ name: 'step_3' }) })).toBe(false)
        expect(opencodeStepUtil.isOpencodeStep({ step: flowVersion({}).trigger })).toBe(false)
    })
})

describe('opencodeStepUtil.runsOnOpencode', () => {
    it('counts the routed AI steps and every OpenCode piece step, and nothing else', () => {
        const opencodePiece = aiPiece({ name: 'step_1', actionName: 'send_to_inbox' })
        opencodePiece.settings.pieceName = OPENCODE_PIECE_NAME
        const otherPiece = aiPiece({ name: 'step_2', actionName: 'askAi' })
        otherPiece.settings.pieceName = '@activepieces/piece-openai'

        expect(opencodeStepUtil.runsOnOpencode({ step: opencodePiece })).toBe(true)
        expect(opencodeStepUtil.isOpencodeStep({ step: opencodePiece })).toBe(false)
        expect(opencodeStepUtil.runsOnOpencode({ step: aiPiece({ name: 'step_3', actionName: 'run_agent' }) })).toBe(true)
        expect(opencodeStepUtil.runsOnOpencode({ step: aiPiece({ name: 'step_4', actionName: 'generateImage' }) })).toBe(false)
        expect(opencodeStepUtil.runsOnOpencode({ step: otherPiece })).toBe(false)
        expect(opencodeStepUtil.runsOnOpencode({ step: code({ name: 'step_5' }) })).toBe(false)
    })
})

describe('opencodeStepUtil session mode resolution', () => {
    it('takes the step value, then the flow default, then a new session per step', () => {
        const shared = aiPiece({ name: 'step_1', actionName: 'askAi', opencode: { sessionMode: 'ONE_PER_RUN' } })
        const unset = aiPiece({ name: 'step_2', actionName: 'askAi' })

        expect(opencodeStepUtil.resolveSessionMode({ step: shared, defaults: { sessionMode: 'NEW_PER_STEP' } })).toBe('ONE_PER_RUN')
        expect(opencodeStepUtil.resolveSessionMode({ step: unset, defaults: { sessionMode: 'ONE_PER_RUN' } })).toBe('ONE_PER_RUN')
        expect(opencodeStepUtil.resolveSessionMode({ step: unset, defaults: {} })).toBe('NEW_PER_STEP')
        expect(opencodeStepUtil.resolveSessionMode({ step: unset, defaults: undefined })).toBe('NEW_PER_STEP')
        expect(opencodeStepUtil.resolveFlowSessionMode({ defaults: undefined })).toBe('NEW_PER_STEP')
    })
})

describe('settings.opencode on steps', () => {
    const opencode: OpencodeStepSettings = { sessionMode: 'ONE_PER_RUN', namespace: 'team', project: 'p1', agent: 'reviewer' }

    it('is kept by UPDATE_ACTION on a piece step and on an AI router', () => {
        const version = flowVersion({
            next: aiPiece({ name: 'step_1', actionName: 'askAi', next: aiRouter({ name: 'step_2', branches: [{ name: 'A' }, { name: 'Otherwise' }] }) }),
        })
        const router = flowStructureUtil.getActionOrThrow('step_2', version.trigger)
        const piece = flowStructureUtil.getActionOrThrow('step_1', version.trigger)

        const updatedPiece = apply(version, {
            type: FlowOperationType.UPDATE_ACTION,
            request: { ...piece, type: FlowActionType.PIECE, settings: { ...aiPiece({ name: 'step_1', actionName: 'askAi' }).settings, opencode } },
        })
        const updatedRouter = apply(updatedPiece, {
            type: FlowOperationType.UPDATE_ACTION,
            request: router.type === FlowActionType.AI_ROUTER ? { ...router, settings: { ...router.settings, opencode } } : router,
        })

        expect(opencodeStepUtil.settingsOf({ step: flowStructureUtil.getActionOrThrow('step_1', updatedRouter.trigger) })).toEqual(opencode)
        expect(opencodeStepUtil.settingsOf({ step: flowStructureUtil.getActionOrThrow('step_2', updatedRouter.trigger) })).toEqual(opencode)
    })

    it('survives the UPDATE_ACTION request schema', () => {
        const parsed = FlowOperationRequest.parse({
            type: FlowOperationType.UPDATE_ACTION,
            request: { ...aiPiece({ name: 'step_1', actionName: 'askAi', opencode }), lastUpdatedDate: undefined },
        })

        expect(parsed.type === FlowOperationType.UPDATE_ACTION && parsed.request.type === FlowActionType.PIECE ? parsed.request.settings.opencode : undefined).toEqual(opencode)
    })

    it('copies with DUPLICATE_ACTION', () => {
        const version = flowVersion({ next: aiPiece({ name: 'step_1', actionName: 'summarizeText', opencode }) })

        const duplicated = apply(version, {
            type: FlowOperationType.DUPLICATE_ACTION,
            request: { stepName: 'step_1' },
        })
        const copies = flowStructureUtil.getAllSteps(duplicated.trigger).filter((step) => step.name !== 'step_1' && step.type === FlowActionType.PIECE)

        expect(copies).toHaveLength(1)
        expect(opencodeStepUtil.settingsOf({ step: copies[0] })).toEqual(opencode)
    })

    it('accepts a namespace without a project when saved, but marks it invalid for validation', () => {
        expect(OpencodeStepSettings.safeParse({ namespace: 'team' }).success).toBe(true)

        const partial = OpencodeStepSettingsWithValidation.safeParse({ namespace: 'team' })
        expect(partial.success).toBe(false)
        expect(partial.error?.issues[0]).toMatchObject({ path: ['project'], message: 'Pick a project in this namespace' })
        expect(OpencodeStepSettingsWithValidation.safeParse({ project: 'p1' }).success).toBe(false)
        expect(OpencodeStepSettingsWithValidation.safeParse({ namespace: 'team', project: 'p1' }).success).toBe(true)
        expect(OpencodeStepSettingsWithValidation.safeParse({ sessionMode: 'NEW_PER_STEP', agent: 'reviewer' }).success).toBe(true)
        expect(OpencodeStepSettingsWithValidation.safeParse({ sessionMode: 'SOMETIMES' }).success).toBe(false)
    })

    it('makes an AI router with a namespace but no project invalid', () => {
        const settings = {
            text: 'a refund request',
            question: 'Which team?',
            branches: [
                { branchType: 'CONDITION', branchName: 'Billing', description: 'Payments' },
                { branchType: 'FALLBACK', branchName: 'Otherwise' },
            ],
        }

        expect(AiRouterActionSettingsWithValidation.safeParse({ ...settings, opencode: { namespace: 'team' } }).success).toBe(false)
        expect(AiRouterActionSettingsWithValidation.safeParse({ ...settings, opencode: { namespace: 'team', project: 'p1' } }).success).toBe(true)
    })
})

describe('opencodeDefaults on the flow version', () => {
    it('UPDATE_OPENCODE_DEFAULTS replaces the default and leaves the steps alone', () => {
        const version = flowVersion({ next: aiPiece({ name: 'step_1', actionName: 'askAi' }), opencodeDefaults: { sessionMode: 'ONE_PER_RUN' } })

        const result = apply(version, {
            type: FlowOperationType.UPDATE_OPENCODE_DEFAULTS,
            request: { sessionMode: 'NEW_PER_STEP' },
        })
        const cleared = apply(version, {
            type: FlowOperationType.UPDATE_OPENCODE_DEFAULTS,
            request: {},
        })

        expect(result.opencodeDefaults).toEqual({ sessionMode: 'NEW_PER_STEP' })
        expect(cleared.opencodeDefaults).toEqual({})
        expect(result.trigger).toEqual(version.trigger)
        expect(version.opencodeDefaults).toEqual({ sessionMode: 'ONE_PER_RUN' })
    })

    it('works on a version loaded without the field', () => {
        const legacy = withoutOpencodeDefaults(flowVersion({ next: code({ name: 'step_1' }) }))

        const result = apply(legacy, {
            type: FlowOperationType.UPDATE_OPENCODE_DEFAULTS,
            request: { sessionMode: 'ONE_PER_RUN' },
        })

        expect(result.opencodeDefaults).toEqual({ sessionMode: 'ONE_PER_RUN' })
    })

    it('is carried by IMPORT_FLOW and reset when the import has none', () => {
        const version = flowVersion({ next: code({ name: 'step_1' }), opencodeDefaults: { sessionMode: 'NEW_PER_STEP' } })

        const imported = apply(version, {
            type: FlowOperationType.IMPORT_FLOW,
            request: { displayName: 'Imported', trigger: version.trigger, schemaVersion: null, opencodeDefaults: { sessionMode: 'ONE_PER_RUN' } },
        })
        const importedWithout = apply(version, {
            type: FlowOperationType.IMPORT_FLOW,
            request: { displayName: 'Imported', trigger: version.trigger, schemaVersion: null },
        })

        expect(imported.opencodeDefaults).toEqual({ sessionMode: 'ONE_PER_RUN' })
        expect(importedWithout.opencodeDefaults).toEqual({})
    })

    it('rejects an unknown session mode in the operation request', () => {
        const parsed = FlowOperationRequest.safeParse({
            type: FlowOperationType.UPDATE_OPENCODE_DEFAULTS,
            request: { sessionMode: 'SOMETIMES' },
        })
        const valid = FlowOperationRequest.safeParse({
            type: FlowOperationType.UPDATE_OPENCODE_DEFAULTS,
            request: { sessionMode: 'ONE_PER_RUN' },
        })

        expect(parsed.success).toBe(false)
        expect(valid.success).toBe(true)
    })
})

type AiPieceParams = {
    name: string
    actionName: string
    opencode?: OpencodeStepSettings
    next?: PieceAction['nextAction']
}
