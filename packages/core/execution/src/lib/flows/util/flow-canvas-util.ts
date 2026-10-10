import { CodeAction, FlowAction, PieceAction } from '../actions/action'
import { FlowTrigger } from '../triggers/trigger'
import { flowStructureUtil } from './flow-structure-util'

export const FLOW_CANVAS_STEP_HEIGHT = 60
export const FLOW_CANVAS_STEP_WIDTH = 232
export const FLOW_CANVAS_VSPACE = 60
export const FLOW_CANVAS_ARC = 15
export const FLOW_CANVAS_LOOP_VOFFSET = FLOW_CANVAS_VSPACE * 1.5 + 2 * FLOW_CANVAS_ARC // 120
export const FLOW_CANVAS_ROUTER_VOFFSET = FLOW_CANVAS_LOOP_VOFFSET + 30 // 150
export const FLOW_CANVAS_HSPACE = 80

type Step = FlowAction | FlowTrigger

function computeRouterChildOffsets(
    boundingBoxes: ReadonlyArray<{ width: number, left: number, right: number }>,
    branchGap: number = FLOW_CANVAS_HSPACE,
): number[] {
    if (boundingBoxes.length === 0) return []
    const totalWidth = boundingBoxes.reduce((sum, b) => sum + b.width, 0)
        + branchGap * (boundingBoxes.length - 1)
    let deltaLeftX = -(totalWidth - boundingBoxes[0].left - boundingBoxes[boundingBoxes.length - 1].right) / 2
        - boundingBoxes[0].left
    return boundingBoxes.map(b => {
        const x = deltaLeftX + b.left
        deltaLeftX += b.width + branchGap
        return x
    })
}

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
    computeRouterChildOffsets,
}
