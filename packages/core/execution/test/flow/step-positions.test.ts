import {
    FlowActionType,
    flowOperations,
    FlowOperationRequest,
    FlowOperationType,
    flowStructureUtil,
    FlowTriggerType,
    FlowVersion,
    ImportFlowRequest,
    StepLocationRelativeToParent,
    UpdateActionRequest,
} from '../../src'
import { canvasFixtures } from './canvas-fixtures'

const { code, loop, router, flowVersion } = canvasFixtures

function withoutStepPositions(version: FlowVersion): FlowVersion {
    const { stepPositions: _stepPositions, ...rest } = version
    return JSON.parse(JSON.stringify(rest))
}

function apply(version: FlowVersion, operation: FlowOperationRequest): FlowVersion {
    return flowOperations.apply(version, operation)
}

describe('UPDATE_STEP_POSITIONS', () => {
    it('merges the batch into the stored map', () => {
        const version = flowVersion({
            next: code({ name: 'step_1', next: code({ name: 'step_2' }) }),
            stepPositions: { trigger: { x: 176, y: 240 }, step_1: { x: 400, y: 240 } },
        })

        const result = apply(version, {
            type: FlowOperationType.UPDATE_STEP_POSITIONS,
            request: { positions: { step_1: { x: 416, y: 272 }, step_2: { x: 640, y: 240 } } },
        })

        expect(result.stepPositions).toEqual({
            trigger: { x: 176, y: 240 },
            step_1: { x: 416, y: 272 },
            step_2: { x: 640, y: 240 },
        })
        expect(version.stepPositions).toEqual({ trigger: { x: 176, y: 240 }, step_1: { x: 400, y: 240 } })
    })

    it('drops positions of names that are not steps of the flow', () => {
        const version = flowVersion({
            next: code({ name: 'step_1' }),
            stepPositions: { trigger: { x: 176, y: 240 }, ghost: { x: 0, y: 0 } },
        })

        const merged = apply(version, {
            type: FlowOperationType.UPDATE_STEP_POSITIONS,
            request: { positions: { step_1: { x: 400, y: 240 }, step_9: { x: 1, y: 2 } } },
        })
        const renamed = apply(version, {
            type: FlowOperationType.CHANGE_NAME,
            request: { displayName: 'Renamed' },
        })

        expect(merged.stepPositions).toEqual({ trigger: { x: 176, y: 240 }, step_1: { x: 400, y: 240 } })
        expect(renamed.stepPositions).toEqual({ trigger: { x: 176, y: 240 } })
    })

    it('works on a version loaded without the field', () => {
        const legacy = withoutStepPositions(flowVersion({ next: code({ name: 'step_1' }) }))

        const result = apply(legacy, {
            type: FlowOperationType.UPDATE_STEP_POSITIONS,
            request: { positions: { step_1: { x: 400, y: 240 } } },
        })
        const untouched = apply(legacy, {
            type: FlowOperationType.CHANGE_NAME,
            request: { displayName: 'Renamed' },
        })

        expect(result.stepPositions).toEqual({ step_1: { x: 400, y: 240 } })
        expect(untouched.stepPositions).toEqual({})
    })

    it('rejects coordinates that are not finite numbers', () => {
        const parsed = FlowOperationRequest.safeParse({
            type: FlowOperationType.UPDATE_STEP_POSITIONS,
            request: { positions: { step_1: { x: '10', y: 0 } } },
        })
        const infinite = FlowOperationRequest.safeParse({
            type: FlowOperationType.UPDATE_STEP_POSITIONS,
            request: { positions: { step_1: { x: Number.POSITIVE_INFINITY, y: 0 } } },
        })

        expect(parsed.success).toBe(false)
        expect(infinite.success).toBe(false)
    })
})

describe('step position pruning', () => {
    it('DELETE_ACTION prunes the step and its descendants, and a reused name starts without a position', () => {
        const version = flowVersion({
            next: loop({
                name: 'step_1',
                body: code({ name: 'step_2', next: code({ name: 'step_3' }) }),
                next: code({ name: 'step_4' }),
            }),
            stepPositions: {
                trigger: { x: 176, y: 240 },
                step_1: { x: 400, y: 240 },
                step_2: { x: 624, y: 432 },
                step_3: { x: 848, y: 432 },
                step_4: { x: 624, y: 240 },
            },
        })

        const deleted = apply(version, {
            type: FlowOperationType.DELETE_ACTION,
            request: { names: ['step_1'] },
        })
        const reusedName = flowStructureUtil.findUnusedName(deleted.trigger)
        const readded = apply(deleted, {
            type: FlowOperationType.ADD_ACTION,
            request: {
                parentStep: 'step_4',
                stepLocationRelativeToParent: StepLocationRelativeToParent.AFTER,
                action: code({ name: reusedName }),
            },
        })

        expect(deleted.stepPositions).toEqual({ trigger: { x: 176, y: 240 }, step_4: { x: 624, y: 240 } })
        expect(reusedName).toBe('step_1')
        expect(readded.stepPositions).toEqual({ trigger: { x: 176, y: 240 }, step_4: { x: 624, y: 240 } })
    })

    it('DELETE_BRANCH prunes the steps of the removed branch', () => {
        const version = flowVersion({
            next: router({
                name: 'step_1',
                branches: [
                    { name: 'Branch 1', head: code({ name: 'step_2', next: code({ name: 'step_3' }) }) },
                    { name: 'Branch 2', head: code({ name: 'step_4' }) },
                    { name: 'Otherwise' },
                ],
            }),
            stepPositions: {
                step_1: { x: 400, y: 240 },
                step_2: { x: 624, y: 112 },
                step_3: { x: 848, y: 112 },
                step_4: { x: 624, y: 304 },
            },
        })

        const result = apply(version, {
            type: FlowOperationType.DELETE_BRANCH,
            request: { stepName: 'step_1', branchIndex: 0 },
        })

        expect(result.stepPositions).toEqual({ step_1: { x: 400, y: 240 }, step_4: { x: 624, y: 304 } })
    })

    it('changing a router into a piece step prunes its branch steps', () => {
        const version = flowVersion({
            next: router({
                name: 'step_1',
                branches: [
                    { name: 'Branch 1', head: code({ name: 'step_2' }) },
                    { name: 'Otherwise', head: code({ name: 'step_3' }) },
                ],
                next: code({ name: 'step_4' }),
            }),
            stepPositions: {
                step_1: { x: 400, y: 240 },
                step_2: { x: 624, y: 144 },
                step_3: { x: 624, y: 336 },
                step_4: { x: 960, y: 240 },
            },
        })

        const result = apply(version, {
            type: FlowOperationType.UPDATE_ACTION,
            request: {
                name: 'step_1',
                type: FlowActionType.PIECE,
                displayName: 'Get',
                valid: true,
                skip: false,
                settings: {
                    pieceName: '@activepieces/piece-store',
                    pieceVersion: '0.0.1',
                    actionName: 'get',
                    input: {},
                    propertySettings: {},
                    errorHandlingOptions: {
                        continueOnFailure: { value: false },
                        retryOnFailure: { value: false },
                    },
                },
            },
        })

        expect(result.trigger.nextAction?.type).toBe(FlowActionType.PIECE)
        expect(result.stepPositions).toEqual({ step_1: { x: 400, y: 240 }, step_4: { x: 960, y: 240 } })
    })
})

describe('MOVE_ACTION', () => {
    it('keeps the positions of the moved step and its children', () => {
        const stepPositions = {
            trigger: { x: 176, y: 240 },
            step_1: { x: 400, y: 240 },
            step_2: { x: 624, y: 240 },
            step_3: { x: 848, y: 432 },
            step_4: { x: 848, y: 240 },
        }
        const version = flowVersion({
            next: code({
                name: 'step_1',
                next: loop({ name: 'step_2', body: code({ name: 'step_3' }), next: code({ name: 'step_4' }) }),
            }),
            stepPositions,
        })

        const result = apply(version, {
            type: FlowOperationType.MOVE_ACTION,
            request: {
                name: 'step_2',
                newParentStep: 'trigger',
                stepLocationRelativeToNewParent: StepLocationRelativeToParent.AFTER,
            },
        })

        expect(result.trigger.nextAction?.name).toBe('step_2')
        expect(flowStructureUtil.getAllSteps(result.trigger).map((step) => step.name).sort()).toEqual(['step_1', 'step_2', 'step_3', 'step_4', 'trigger'])
        expect(result.stepPositions).toEqual(stepPositions)
    })

    it('keeps the positions when moving into a router branch', () => {
        const stepPositions = {
            step_1: { x: 400, y: 240 },
            step_2: { x: 624, y: 144 },
            step_3: { x: 960, y: 240 },
            step_4: { x: 1184, y: 240 },
        }
        const version = flowVersion({
            next: router({
                name: 'step_1',
                branches: [{ name: 'Branch 1', head: code({ name: 'step_2' }) }, { name: 'Otherwise' }],
                next: code({ name: 'step_3', cof: true, onFailure: code({ name: 'step_4' }) }),
            }),
            stepPositions,
        })

        const result = apply(version, {
            type: FlowOperationType.MOVE_ACTION,
            request: {
                name: 'step_3',
                newParentStep: 'step_1',
                stepLocationRelativeToNewParent: StepLocationRelativeToParent.INSIDE_BRANCH,
                branchIndex: 1,
            },
        })

        const movedRouter = result.trigger.nextAction
        expect(movedRouter?.type === FlowActionType.ROUTER ? movedRouter.children[1]?.name : null).toBe('step_3')
        expect(result.stepPositions).toEqual(stepPositions)
    })
})

describe('IMPORT_FLOW', () => {
    const importedTrigger = canvasFixtures.trigger(code({ name: 'step_1', next: code({ name: 'step_2' }) }))

    it('replaces the map with the imported positions', () => {
        const version = flowVersion({
            next: code({ name: 'step_7' }),
            stepPositions: { trigger: { x: 0, y: 0 }, step_7: { x: 224, y: 0 } },
        })

        const result = apply(version, {
            type: FlowOperationType.IMPORT_FLOW,
            request: {
                displayName: 'Imported',
                trigger: importedTrigger,
                schemaVersion: null,
                notes: null,
                stepPositions: { step_1: { x: 400, y: 240 }, step_99: { x: 1, y: 1 } },
            },
        })

        expect(result.stepPositions).toEqual({ step_1: { x: 400, y: 240 } })
    })

    it('clears the map when the import carries no positions', () => {
        const version = flowVersion({
            next: code({ name: 'step_1' }),
            stepPositions: { trigger: { x: 0, y: 0 }, step_1: { x: 224, y: 0 } },
        })

        const withNull = apply(version, {
            type: FlowOperationType.IMPORT_FLOW,
            request: { displayName: 'Imported', trigger: importedTrigger, schemaVersion: null, notes: null, stepPositions: null },
        })
        const withoutField = apply(version, {
            type: FlowOperationType.IMPORT_FLOW,
            request: { displayName: 'Imported', trigger: importedTrigger, schemaVersion: null, notes: null },
        })

        expect(withNull.stepPositions).toEqual({})
        expect(withoutField.stepPositions).toEqual({})
    })

    it('imports into a version loaded without the field', () => {
        const legacy = withoutStepPositions(flowVersion({ next: code({ name: 'step_1' }) }))

        const result = apply(legacy, {
            type: FlowOperationType.IMPORT_FLOW,
            request: {
                displayName: 'Imported',
                trigger: importedTrigger,
                schemaVersion: null,
                notes: null,
                stepPositions: { step_2: { x: 624, y: 240 } },
            },
        })

        expect(result.stepPositions).toEqual({ step_2: { x: 624, y: 240 } })
    })
})

describe('schemas without stepPositions', () => {
    it('FlowVersion defaults the field to an empty map', () => {
        const legacy = withoutStepPositions(flowVersion({ next: code({ name: 'step_1' }) }))

        const parsed = FlowVersion.parse(legacy)

        expect(parsed.stepPositions).toEqual({})
    })

    it('UpdateActionRequest parses a step without any position field', () => {
        const parsed = UpdateActionRequest.safeParse({
            name: 'step_1',
            type: FlowActionType.CODE,
            displayName: 'Code',
            valid: true,
            skip: false,
            settings: {
                sourceCode: { code: '', packageJson: '{}' },
                input: {},
                errorHandlingOptions: {
                    continueOnFailure: { value: false },
                    retryOnFailure: { value: false },
                },
            },
        })

        expect(parsed.success).toBe(true)
    })

    it('ImportFlowRequest parses without the field', () => {
        const parsed = ImportFlowRequest.parse({
            displayName: 'Old export',
            trigger: {
                name: 'trigger',
                type: FlowTriggerType.EMPTY,
                valid: false,
                displayName: 'Select Trigger',
                lastUpdatedDate: '2026-10-10T00:00:00.000Z',
                settings: {},
            },
            schemaVersion: null,
            notes: null,
        })

        expect(parsed.stepPositions).toBeUndefined()
    })
})
