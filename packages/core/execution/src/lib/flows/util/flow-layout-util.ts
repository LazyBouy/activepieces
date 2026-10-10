import { isNil } from '@activepieces/core-utils'
import { FlowAction, FlowActionType } from '../actions/action'
import { StepCanvasPosition, StepPositions } from '../flow-version'
import { StepLocationRelativeToParent } from '../operations'
import { FlowTrigger } from '../triggers/trigger'
import { flowCanvasUtils } from './flow-canvas-util'
import { flowStructureUtil, Step } from './flow-structure-util'

const GRID = 16
const NODE = 96
const COL_GAP = 128
const PITCH = NODE + COL_GAP
const ROW_GAP = 96
const OUTPUT_GROWTH = 32
const JOIN = 16
const JOIN_GAP = 64
const EMPTY_BRANCH = 32
const STUB = 40
const BACK_EDGE_DROP = 130
const BACK_EDGE_THRESHOLD = 20
const CLEARANCE = 40
const RADIUS = 16
const ORIGIN_X = 176
const ORIGIN_Y = 240

function snap(value: number): number {
    return Math.round(value / GRID) * GRID + 0
}

function outputId(index: number): string {
    return `out-${index}`
}

function getStepOutputs(step: Step): StepCanvasOutput[] {
    if (flowStructureUtil.isBranchedAction(step)) {
        return step.settings.branches.map((branch, index) => ({
            id: outputId(index),
            label: branch.branchName,
            location: StepLocationRelativeToParent.INSIDE_BRANCH,
            branchIndex: index,
        }))
    }
    if (step.type === FlowActionType.LOOP_ON_ITEMS) {
        return [
            { id: outputId(0), label: 'done', location: StepLocationRelativeToParent.AFTER },
            { id: outputId(1), label: 'loop', location: StepLocationRelativeToParent.INSIDE_LOOP },
        ]
    }
    if (flowStructureUtil.hasContinueOnFailureBranches(step)) {
        return [
            { id: outputId(0), label: 'success', location: StepLocationRelativeToParent.INSIDE_ON_SUCCESS_BRANCH },
            { id: outputId(1), label: 'error', location: StepLocationRelativeToParent.INSIDE_ON_FAILURE_BRANCH },
        ]
    }
    return [{ id: outputId(0), location: StepLocationRelativeToParent.AFTER }]
}

function getNodeHeight({ outputCount }: { outputCount: number }): number {
    return NODE + OUTPUT_GROWTH * Math.max(0, outputCount - 2)
}

function getStepHeight(step: Step): number {
    return getNodeHeight({ outputCount: getStepOutputs(step).length })
}

function getOutputOffset({ outputCount, index }: { outputCount: number, index: number }): number {
    return getNodeHeight({ outputCount }) * (index + 1) / (outputCount + 1)
}

function hasJoin(step: Step): boolean {
    return flowStructureUtil.isBranchedAction(step) || flowStructureUtil.hasContinueOnFailureBranches(step)
}

function getJoinedBranchHeads(step: Step): (FlowAction | null)[] {
    if (flowStructureUtil.isBranchedAction(step)) {
        return step.settings.branches.map((_, index) => step.children[index] ?? null)
    }
    if (flowStructureUtil.hasContinueOnFailureBranches(step)) {
        return flowCanvasUtils.getContinueOnFailureBranchPair(step).map((branch) => branch ?? null)
    }
    return []
}

function getVisibleChildHeads(step: Step): FlowAction[] {
    if (step.type === FlowActionType.LOOP_ON_ITEMS) {
        return isNil(step.firstLoopAction) ? [] : [step.firstLoopAction]
    }
    return getJoinedBranchHeads(step).filter((head): head is FlowAction => !isNil(head))
}

function collectVisibleSteps(head: Step | undefined): Step[] {
    return getChain(head).flatMap((step) => [step, ...getVisibleChildHeads(step).flatMap((childHead) => collectVisibleSteps(childHead))])
}

function getVisibleSteps({ trigger }: { trigger: FlowTrigger }): Step[] {
    return collectVisibleSteps(trigger)
}

function getChain(head: Step | undefined): Step[] {
    const chain: Step[] = []
    let current: Step | undefined = head
    while (!isNil(current)) {
        chain.push(current)
        current = current.nextAction
    }
    return chain
}

function emptyBlock(): LayoutBlock {
    return { steps: {}, joins: {}, bounds: null }
}

function emptyBranchBlock(): LayoutBlock {
    return { steps: {}, joins: {}, bounds: { left: 0, right: 0, top: -EMPTY_BRANCH / 2, bottom: EMPTY_BRANCH / 2 } }
}

function unionBounds({ a, b }: { a: Bounds | null, b: Bounds | null }): Bounds | null {
    if (isNil(a)) {
        return b
    }
    if (isNil(b)) {
        return a
    }
    return {
        left: Math.min(a.left, b.left),
        right: Math.max(a.right, b.right),
        top: Math.min(a.top, b.top),
        bottom: Math.max(a.bottom, b.bottom),
    }
}

function translatePositions({ positions, dx, dy }: { positions: StepPositions, dx: number, dy: number }): StepPositions {
    return Object.fromEntries(Object.entries(positions).map(([name, position]) => [name, { x: position.x + dx, y: position.y + dy }]))
}

function translateBlock({ block, dx, dy }: { block: LayoutBlock, dx: number, dy: number }): LayoutBlock {
    return {
        steps: translatePositions({ positions: block.steps, dx, dy }),
        joins: translatePositions({ positions: block.joins, dx, dy }),
        bounds: isNil(block.bounds) ? null : {
            left: block.bounds.left + dx,
            right: block.bounds.right + dx,
            top: block.bounds.top + dy,
            bottom: block.bounds.bottom + dy,
        },
    }
}

function mergeBlocks({ a, b }: { a: LayoutBlock, b: LayoutBlock }): LayoutBlock {
    return {
        steps: { ...a.steps, ...b.steps },
        joins: { ...a.joins, ...b.joins },
        bounds: unionBounds({ a: a.bounds, b: b.bounds }),
    }
}

function placeBox({ block, name, position, width, height, kind }: PlaceBoxParams): LayoutBlock {
    const box: Bounds = { left: position.x, right: position.x + width, top: position.y, bottom: position.y + height }
    return {
        steps: kind === 'step' ? { ...block.steps, [name]: position } : block.steps,
        joins: kind === 'join' ? { ...block.joins, [name]: position } : block.joins,
        bounds: unionBounds({ a: block.bounds, b: box }),
    }
}

function blockHeight(block: LayoutBlock): number {
    return isNil(block.bounds) ? 0 : block.bounds.bottom - block.bounds.top
}

function layoutBranches({ block, step, x }: { block: LayoutBlock, step: Step, x: number }): { block: LayoutBlock, nextX: number } {
    const branchBlocks = getJoinedBranchHeads(step).map((head) => isNil(head) ? emptyBranchBlock() : layoutChain(head))
    const heights = branchBlocks.map(blockHeight)
    const totalHeight = heights.reduce((sum, height) => sum + height, 0) + ROW_GAP * Math.max(0, branchBlocks.length - 1)
    const branchX = x + PITCH
    const groupTop = snap(-totalHeight / 2)
    const tops = heights.map((_, index) => groupTop + heights.slice(0, index).reduce((sum, height) => sum + height + ROW_GAP, 0))
    const placed = branchBlocks.map((branchBlock, index) => translateBlock({
        block: branchBlock,
        dx: branchX,
        dy: tops[index] - (branchBlock.bounds?.top ?? 0),
    }))
    const branchRight = Math.max(branchX, ...placed.map((placedBlock) => placedBlock.bounds?.right ?? branchX))
    const joinX = snap(branchRight + JOIN_GAP)
    const withBranches = placed.reduce((acc, placedBlock) => mergeBlocks({ a: acc, b: placedBlock }), block)
    const withJoin = placeBox({ block: withBranches, name: step.name, position: { x: joinX, y: -JOIN / 2 }, width: JOIN, height: JOIN, kind: 'join' })
    return { block: withJoin, nextX: joinX + JOIN + JOIN_GAP }
}

function layoutChain(head: Step): LayoutBlock {
    let block = emptyBlock()
    let x = 0
    let current: Step | undefined = head
    while (!isNil(current)) {
        const height = getStepHeight(current)
        block = placeBox({ block, name: current.name, position: { x, y: -height / 2 }, width: NODE, height, kind: 'step' })
        if (current.type === FlowActionType.LOOP_ON_ITEMS) {
            const doneBlock = isNil(current.nextAction) ? emptyBlock() : translateBlock({ block: layoutChain(current.nextAction), dx: x + PITCH, dy: 0 })
            const withDone = mergeBlocks({ a: block, b: doneBlock })
            if (isNil(current.firstLoopAction)) {
                return withDone
            }
            const bodyBlock = layoutChain(current.firstLoopAction)
            const bodyTop = snap(Math.max(height / 2, doneBlock.bounds?.bottom ?? height / 2) + ROW_GAP)
            return mergeBlocks({
                a: withDone,
                b: translateBlock({ block: bodyBlock, dx: x + PITCH, dy: bodyTop - (bodyBlock.bounds?.top ?? 0) }),
            })
        }
        if (hasJoin(current)) {
            const result = layoutBranches({ block, step: current, x })
            block = result.block
            x = result.nextX
        }
        else {
            x += PITCH
        }
        current = current.nextAction
    }
    return block
}

function computeAutoLayout({ trigger }: { trigger: FlowTrigger }): FlowLayout {
    const block = layoutChain(trigger)
    const triggerPosition = block.steps[trigger.name]
    const dx = ORIGIN_X - triggerPosition.x
    const dy = ORIGIN_Y - triggerPosition.y
    return {
        steps: translatePositions({ positions: block.steps, dx, dy }),
        joins: translatePositions({ positions: block.joins, dx, dy }),
    }
}

function deriveFromAnchor({ stepName, anchor, auto }: DeriveFromAnchorParams): StepCanvasPosition {
    const autoPosition = auto.steps[stepName]
    if (isNil(anchor)) {
        return autoPosition
    }
    const autoAnchor = auto.steps[anchor.name]
    return {
        x: anchor.position.x + autoPosition.x - autoAnchor.x,
        y: anchor.position.y + autoPosition.y - autoAnchor.y,
    }
}

function resolveChain({ head, anchor, auto, stored }: ResolveChainParams): StepPositions {
    const resolved: StepPositions = {}
    let previous = anchor
    for (const step of getChain(head)) {
        const position = stored[step.name] ?? deriveFromAnchor({ stepName: step.name, anchor: previous, auto })
        resolved[step.name] = position
        for (const childHead of getVisibleChildHeads(step)) {
            Object.assign(resolved, resolveChain({ head: childHead, anchor: { name: step.name, position }, auto, stored }))
        }
        previous = { name: step.name, position }
    }
    return resolved
}

function computeChainJoins({ head, steps }: { head: Step, steps: StepPositions }): { joins: StepPositions, right: number } {
    const joins: StepPositions = {}
    let right = Number.NEGATIVE_INFINITY
    for (const step of getChain(head)) {
        const position = steps[step.name]
        const children = getVisibleChildHeads(step).map((childHead) => computeChainJoins({ head: childHead, steps }))
        const childrenRight = Math.max(Number.NEGATIVE_INFINITY, ...children.map((child) => child.right))
        children.forEach((child) => Object.assign(joins, child.joins))
        right = Math.max(right, position.x + NODE, childrenRight)
        if (hasJoin(step)) {
            const joinX = snap(Math.max(position.x + PITCH, childrenRight) + JOIN_GAP)
            joins[step.name] = { x: joinX, y: position.y + getStepHeight(step) / 2 - JOIN / 2 }
            right = Math.max(right, joinX + JOIN)
        }
    }
    return { joins, right }
}

function resolveStepPositions({ trigger, stepPositions }: ResolveStepPositionsParams): FlowLayout {
    const auto = computeAutoLayout({ trigger })
    const steps = resolveChain({ head: trigger, anchor: null, auto, stored: stepPositions ?? {} })
    return {
        steps,
        joins: computeChainJoins({ head: trigger, steps }).joins,
    }
}

function tidyUp({ trigger, stepPositions }: ResolveStepPositionsParams): StepPositions {
    const auto = computeAutoLayout({ trigger })
    const current = resolveStepPositions({ trigger, stepPositions }).steps[trigger.name]
    const autoTrigger = auto.steps[trigger.name]
    return translatePositions({ positions: auto.steps, dx: current.x - autoTrigger.x, dy: current.y - autoTrigger.y })
}

function getStubs({ trigger }: { trigger: FlowTrigger }): StepCanvasStub[] {
    const chain = getChain(trigger)
    const exit = chain[chain.length - 1]
    const exitStub: StepCanvasStub = {
        stepName: exit.name,
        outputId: outputId(0),
        onJoin: hasJoin(exit),
        location: StepLocationRelativeToParent.AFTER,
    }
    const emptyLoopStubs: StepCanvasStub[] = getVisibleSteps({ trigger })
        .filter((step) => step.type === FlowActionType.LOOP_ON_ITEMS && isNil(step.firstLoopAction))
        .map((step) => ({
            stepName: step.name,
            outputId: outputId(1),
            onJoin: false,
            location: StepLocationRelativeToParent.INSIDE_LOOP,
        }))
    return [exitStub, ...emptyLoopStubs]
}

export const flowLayoutUtil = {
    constants: {
        GRID,
        NODE,
        COL_GAP,
        PITCH,
        ROW_GAP,
        OUTPUT_GROWTH,
        JOIN,
        JOIN_GAP,
        EMPTY_BRANCH,
        STUB,
        BACK_EDGE_DROP,
        BACK_EDGE_THRESHOLD,
        CLEARANCE,
        RADIUS,
        ORIGIN_X,
        ORIGIN_Y,
    },
    snap,
    getStepOutputs,
    getNodeHeight,
    getStepHeight,
    getOutputOffset,
    hasJoin,
    getVisibleSteps,
    computeAutoLayout,
    resolveStepPositions,
    tidyUp,
    getStubs,
}

type Bounds = {
    left: number
    right: number
    top: number
    bottom: number
}

type LayoutBlock = {
    steps: StepPositions
    joins: StepPositions
    bounds: Bounds | null
}

type PlaceBoxParams = {
    block: LayoutBlock
    name: string
    position: StepCanvasPosition
    width: number
    height: number
    kind: 'step' | 'join'
}

type Anchor = {
    name: string
    position: StepCanvasPosition
}

type DeriveFromAnchorParams = {
    stepName: string
    anchor: Anchor | null
    auto: FlowLayout
}

type ResolveChainParams = {
    head: Step
    anchor: Anchor | null
    auto: FlowLayout
    stored: StepPositions
}

type ResolveStepPositionsParams = {
    trigger: FlowTrigger
    stepPositions: StepPositions | null | undefined
}

export type StepCanvasOutput = {
    id: string
    label?: string
    location: StepLocationRelativeToParent
    branchIndex?: number
}

export type FlowLayout = {
    steps: StepPositions
    joins: StepPositions
}

export type StepCanvasStub = {
    stepName: string
    outputId: string
    onJoin: boolean
    location: StepLocationRelativeToParent
}
