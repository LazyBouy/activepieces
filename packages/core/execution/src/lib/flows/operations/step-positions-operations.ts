import { FlowVersion, StepPositions } from '../flow-version'
import { Step } from '../util/flow-structure-util'
import { UpdateStepPositionsRequest } from './index'

function updateStepPositions({ flowVersion, request }: UpdateStepPositionsParams): FlowVersion {
    return {
        ...flowVersion,
        stepPositions: {
            ...(flowVersion.stepPositions ?? {}),
            ...request.positions,
        },
    }
}

function replaceStepPositions({ flowVersion, stepPositions }: ReplaceStepPositionsParams): FlowVersion {
    return {
        ...flowVersion,
        stepPositions: { ...(stepPositions ?? {}) },
    }
}

function pickStepPositions({ flowVersion, stepNames }: PickStepPositionsParams): StepPositions {
    const current = flowVersion.stepPositions ?? {}
    return Object.fromEntries(stepNames.filter((name) => name in current).map((name) => [name, current[name]]))
}

function pruneStepPositions({ flowVersion, steps }: PruneStepPositionsParams): FlowVersion {
    const existingNames = new Set(steps.map((step) => step.name))
    const current = flowVersion.stepPositions ?? {}
    return {
        ...flowVersion,
        stepPositions: Object.fromEntries(Object.entries(current).filter(([name]) => existingNames.has(name))),
    }
}

export const stepPositionsOperations = {
    update: updateStepPositions,
    replace: replaceStepPositions,
    pick: pickStepPositions,
    prune: pruneStepPositions,
}

type UpdateStepPositionsParams = {
    flowVersion: FlowVersion
    request: UpdateStepPositionsRequest
}

type ReplaceStepPositionsParams = {
    flowVersion: FlowVersion
    stepPositions: StepPositions | null | undefined
}

type PickStepPositionsParams = {
    flowVersion: FlowVersion
    stepNames: string[]
}

type PruneStepPositionsParams = {
    flowVersion: FlowVersion
    steps: Step[]
}
