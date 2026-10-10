import { CodeAction, FlowAction, PieceAction } from '../actions/action'
import { FlowTrigger } from '../triggers/trigger'
import { flowStructureUtil } from './flow-structure-util'

type Step = FlowAction | FlowTrigger

function getContinueOnFailureBranchPair(step: CodeAction | PieceAction): (FlowAction | undefined)[] {
    const branches = step.continueOnFailureBranches
    return [branches?.onSuccess, branches?.onFailure]
}

function getStepBranchRelativeTo(ancestor: Step | FlowAction, targetStepName: string): 'on-success' | 'on-failure' | null {
    if (!flowStructureUtil.hasContinueOnFailureBranches(ancestor)) {
        return null
    }
    const [onSuccess, onFailure] = getContinueOnFailureBranchPair(ancestor)
    if (onSuccess && flowStructureUtil.getAllSteps(onSuccess).some((s) => s.name === targetStepName)) {
        return 'on-success'
    }
    if (onFailure && flowStructureUtil.getAllSteps(onFailure).some((s) => s.name === targetStepName)) {
        return 'on-failure'
    }
    return null
}

export const flowCanvasUtils = {
    getContinueOnFailureBranchPair,
    getStepBranchRelativeTo,
}
