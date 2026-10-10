import {
    flowLayoutUtil,
    FlowTrigger,
    StepLocationRelativeToParent,
    StepPositions,
} from '../../src'
import { canvasFixtures } from './canvas-fixtures'

const { code, loop, router, aiRouter, trigger } = canvasFixtures

function branches(count: number): { name: string }[] {
    return Array.from({ length: count }, (_, index) => ({ name: index === count - 1 ? 'Otherwise' : `Branch ${index + 1}` }))
}

function complexTrigger(): FlowTrigger {
    return trigger(code({
        name: 'step_1',
        next: router({
            name: 'step_2',
            branches: [
                { name: 'Branch 1', head: loop({ name: 'step_3', body: code({ name: 'step_4', cof: true, onFailure: code({ name: 'step_5' }) }), next: code({ name: 'step_6' }) }) },
                { name: 'Branch 2' },
                { name: 'Branch 3', head: router({ name: 'step_7', branches: [{ name: 'A', head: code({ name: 'step_8' }) }, { name: 'B' }, { name: 'C' }, { name: 'D' }, { name: 'Otherwise' }] }) },
                { name: 'Otherwise', head: code({ name: 'step_9' }) },
            ],
            next: loop({ name: 'step_10', next: code({ name: 'step_11' }) }),
        }),
    }))
}

function boxesOverlap({ a, b }: { a: { x: number, y: number, h: number }, b: { x: number, y: number, h: number } }): boolean {
    const size = flowLayoutUtil.constants.NODE
    return a.x < b.x + size && b.x < a.x + size && a.y < b.y + b.h && b.y < a.y + a.h
}

describe('flowLayoutUtil.getStepOutputs', () => {
    it('gives the trigger and plain actions a single AFTER output', () => {
        expect(flowLayoutUtil.getStepOutputs(trigger())).toEqual([{ id: 'out-0', location: StepLocationRelativeToParent.AFTER }])
        expect(flowLayoutUtil.getStepOutputs(code({ name: 'step_1' }))).toEqual([{ id: 'out-0', location: StepLocationRelativeToParent.AFTER }])
    })

    it('gives loops done then loop', () => {
        expect(flowLayoutUtil.getStepOutputs(loop({ name: 'step_1' }))).toEqual([
            { id: 'out-0', label: 'done', location: StepLocationRelativeToParent.AFTER },
            { id: 'out-1', label: 'loop', location: StepLocationRelativeToParent.INSIDE_LOOP },
        ])
    })

    it('gives routers and AI routers one output per branch in settings order', () => {
        const expected = [
            { id: 'out-0', label: 'Branch 1', location: StepLocationRelativeToParent.INSIDE_BRANCH, branchIndex: 0 },
            { id: 'out-1', label: 'Branch 2', location: StepLocationRelativeToParent.INSIDE_BRANCH, branchIndex: 1 },
            { id: 'out-2', label: 'Otherwise', location: StepLocationRelativeToParent.INSIDE_BRANCH, branchIndex: 2 },
        ]
        expect(flowLayoutUtil.getStepOutputs(router({ name: 'step_1', branches: branches(3) }))).toEqual(expected)
        expect(flowLayoutUtil.getStepOutputs(aiRouter({ name: 'step_1', branches: branches(3) }))).toEqual(expected)
    })

    it('shows success and error only while continue-on-failure is on', () => {
        expect(flowLayoutUtil.getStepOutputs(code({ name: 'step_1', cof: true }))).toEqual([
            { id: 'out-0', label: 'success', location: StepLocationRelativeToParent.INSIDE_ON_SUCCESS_BRANCH },
            { id: 'out-1', label: 'error', location: StepLocationRelativeToParent.INSIDE_ON_FAILURE_BRANCH },
        ])
        expect(flowLayoutUtil.getStepOutputs(code({ name: 'step_1', cof: false, onSuccess: code({ name: 'step_2' }) }))).toEqual([
            { id: 'out-0', location: StepLocationRelativeToParent.AFTER },
        ])
    })
})

describe('flowLayoutUtil node sizes', () => {
    it('grows the box by 32px per output beyond two', () => {
        expect(flowLayoutUtil.getNodeHeight({ outputCount: 0 })).toBe(96)
        expect(flowLayoutUtil.getNodeHeight({ outputCount: 1 })).toBe(96)
        expect(flowLayoutUtil.getNodeHeight({ outputCount: 2 })).toBe(96)
        expect(flowLayoutUtil.getNodeHeight({ outputCount: 5 })).toBe(192)
        expect(flowLayoutUtil.getStepHeight(router({ name: 'step_1', branches: branches(2) }))).toBe(96)
        expect(flowLayoutUtil.getStepHeight(router({ name: 'step_1', branches: branches(5) }))).toBe(192)
    })

    it('spaces outputs at (i + 1) / (n + 1) of the height, 32px apart for two or more', () => {
        const offsets = (outputCount: number) => Array.from({ length: outputCount }, (_, index) => flowLayoutUtil.getOutputOffset({ outputCount, index }))
        expect(offsets(1)).toEqual([48])
        expect(offsets(2)).toEqual([32, 64])
        expect(offsets(5)).toEqual([32, 64, 96, 128, 160])
    })
})

describe('flowLayoutUtil.computeAutoLayout', () => {
    it('places the trigger at the origin and the chain at pitch 224 on one centre line', () => {
        const layout = flowLayoutUtil.computeAutoLayout({
            trigger: trigger(code({ name: 'step_1', next: code({ name: 'step_2' }) })),
        })

        expect(layout).toEqual({
            steps: {
                trigger: { x: 176, y: 240 },
                step_1: { x: 400, y: 240 },
                step_2: { x: 624, y: 240 },
            },
            joins: {},
        })
    })

    it('stacks router branches one column right, centred on the router, and joins them before the next step', () => {
        const layout = flowLayoutUtil.computeAutoLayout({
            trigger: trigger(router({
                name: 'step_1',
                branches: [{ name: 'Branch 1', head: code({ name: 'step_2' }) }, { name: 'Otherwise', head: code({ name: 'step_3' }) }],
                next: code({ name: 'step_4' }),
            })),
        })

        expect(layout.steps).toEqual({
            trigger: { x: 176, y: 240 },
            step_1: { x: 400, y: 240 },
            step_2: { x: 624, y: 144 },
            step_3: { x: 624, y: 336 },
            step_4: { x: 864, y: 240 },
        })
        expect(layout.joins).toEqual({ step_1: { x: 784, y: 280 } })
    })

    it('gives an empty branch a 32px slot and keeps the group centred on a taller router', () => {
        const layout = flowLayoutUtil.computeAutoLayout({
            trigger: trigger(router({
                name: 'step_1',
                branches: [
                    { name: 'Branch 1', head: code({ name: 'step_2' }) },
                    { name: 'Branch 2' },
                    { name: 'Otherwise', head: code({ name: 'step_3' }) },
                ],
            })),
        })

        expect(layout.steps).toEqual({
            trigger: { x: 176, y: 240 },
            step_1: { x: 400, y: 224 },
            step_2: { x: 624, y: 80 },
            step_3: { x: 624, y: 400 },
        })
        expect(layout.joins).toEqual({ step_1: { x: 784, y: 280 } })
    })

    it('places the join 64px right of the widest branch', () => {
        const layout = flowLayoutUtil.computeAutoLayout({
            trigger: trigger(router({
                name: 'step_1',
                branches: [
                    { name: 'Branch 1', head: code({ name: 'step_2', next: code({ name: 'step_3' }) }) },
                    { name: 'Otherwise' },
                ],
                next: code({ name: 'step_4' }),
            })),
        })

        expect(layout.joins).toEqual({ step_1: { x: 1008, y: 280 } })
        expect(layout.steps['step_4']).toEqual({ x: 1088, y: 240 })
    })

    it('puts the join of a router with only empty branches right after the branch column', () => {
        const layout = flowLayoutUtil.computeAutoLayout({
            trigger: trigger(router({ name: 'step_1', branches: branches(2) })),
        })

        expect(layout.joins).toEqual({ step_1: { x: 688, y: 280 } })
    })

    it('puts the loop body one row below the loop and its done chain', () => {
        const layout = flowLayoutUtil.computeAutoLayout({
            trigger: trigger(loop({
                name: 'step_1',
                body: code({ name: 'step_2', next: code({ name: 'step_3' }) }),
                next: code({ name: 'step_4' }),
            })),
        })

        expect(layout.steps).toEqual({
            trigger: { x: 176, y: 240 },
            step_1: { x: 400, y: 240 },
            step_4: { x: 624, y: 240 },
            step_2: { x: 624, y: 432 },
            step_3: { x: 848, y: 432 },
        })
    })

    it('puts the loop body below a done chain that reaches further down', () => {
        const layout = flowLayoutUtil.computeAutoLayout({
            trigger: trigger(loop({
                name: 'step_1',
                body: code({ name: 'step_5' }),
                next: router({
                    name: 'step_2',
                    branches: [{ name: 'Branch 1', head: code({ name: 'step_3' }) }, { name: 'Otherwise', head: code({ name: 'step_4' }) }],
                }),
            })),
        })

        expect(layout.steps['step_4']).toEqual({ x: 848, y: 336 })
        expect(layout.steps['step_5']).toEqual({ x: 624, y: 528 })
    })

    it('lays out continue-on-failure branches only while the option is on', () => {
        const on = flowLayoutUtil.computeAutoLayout({
            trigger: trigger(code({ name: 'step_1', cof: true, onSuccess: code({ name: 'step_2' }), next: code({ name: 'step_3' }) })),
        })
        const off = flowLayoutUtil.computeAutoLayout({
            trigger: trigger(code({ name: 'step_1', cof: false, onSuccess: code({ name: 'step_2' }), next: code({ name: 'step_3' }) })),
        })

        expect(on.steps).toEqual({
            trigger: { x: 176, y: 240 },
            step_1: { x: 400, y: 240 },
            step_2: { x: 624, y: 176 },
            step_3: { x: 864, y: 240 },
        })
        expect(on.joins).toEqual({ step_1: { x: 784, y: 280 } })
        expect(off.steps).toEqual({
            trigger: { x: 176, y: 240 },
            step_1: { x: 400, y: 240 },
            step_3: { x: 624, y: 240 },
        })
        expect(off.joins).toEqual({})
    })

    it('snaps every step to the 16px grid, centres joins on their router and never overlaps boxes', () => {
        const flowTrigger = complexTrigger()
        const layout = flowLayoutUtil.computeAutoLayout({ trigger: flowTrigger })
        const steps = flowLayoutUtil.getVisibleSteps({ trigger: flowTrigger })
        const boxes = steps.map((step) => ({ name: step.name, ...layout.steps[step.name], h: flowLayoutUtil.getStepHeight(step) }))

        expect(Object.keys(layout.steps).sort()).toEqual(steps.map((step) => step.name).sort())
        Object.values(layout.steps).forEach((position) => {
            expect(Number.isInteger(position.x / 16)).toBe(true)
            expect(Number.isInteger(position.y / 16)).toBe(true)
        })
        Object.entries(layout.joins).forEach(([name, join]) => {
            const owner = boxes.find((box) => box.name === name)
            expect(Number.isInteger(join.x / 16)).toBe(true)
            expect(join.y + 8).toBe((owner?.y ?? 0) + (owner?.h ?? 0) / 2)
        })
        boxes.forEach((a, i) => boxes.slice(i + 1).forEach((b) => {
            expect(boxesOverlap({ a, b })).toBe(false)
        }))
    })
})

describe('flowLayoutUtil.resolveStepPositions', () => {
    const chain = trigger(code({ name: 'step_1', next: code({ name: 'step_2', next: code({ name: 'step_3' }) }) }))
    const branched = trigger(router({
        name: 'step_1',
        branches: [{ name: 'Branch 1', head: code({ name: 'step_2' }) }, { name: 'Otherwise', head: code({ name: 'step_3' }) }],
        next: code({ name: 'step_4' }),
    }))

    it('equals the auto-layout when nothing is stored', () => {
        const flowTrigger = complexTrigger()

        expect(flowLayoutUtil.resolveStepPositions({ trigger: flowTrigger, stepPositions: {} })).toEqual(flowLayoutUtil.computeAutoLayout({ trigger: flowTrigger }))
        expect(flowLayoutUtil.resolveStepPositions({ trigger: flowTrigger, stepPositions: undefined })).toEqual(flowLayoutUtil.computeAutoLayout({ trigger: flowTrigger }))
    })

    it('keeps stored positions and anchors the rest to the previous step', () => {
        const resolved = flowLayoutUtil.resolveStepPositions({ trigger: chain, stepPositions: { step_1: { x: 480, y: 320 } } })

        expect(resolved.steps).toEqual({
            trigger: { x: 176, y: 240 },
            step_1: { x: 480, y: 320 },
            step_2: { x: 704, y: 320 },
            step_3: { x: 928, y: 320 },
        })
    })

    it('anchors the first step of a branch to its parent and recomputes the join from the resolved steps', () => {
        const stepPositions: StepPositions = { step_1: { x: 400, y: 400 }, step_3: { x: 1008, y: 0 } }

        const resolved = flowLayoutUtil.resolveStepPositions({ trigger: branched, stepPositions })

        expect(resolved.steps).toEqual({
            trigger: { x: 176, y: 240 },
            step_1: { x: 400, y: 400 },
            step_2: { x: 624, y: 304 },
            step_3: { x: 1008, y: 0 },
            step_4: { x: 864, y: 400 },
        })
        expect(resolved.joins).toEqual({ step_1: { x: 1168, y: 440 } })
    })

    it('ignores stored positions of steps that are hidden or gone', () => {
        const hidden = trigger(code({ name: 'step_1', cof: false, onSuccess: code({ name: 'step_2' }) }))

        const resolved = flowLayoutUtil.resolveStepPositions({ trigger: hidden, stepPositions: { step_2: { x: 0, y: 0 }, ghost: { x: 16, y: 16 } } })

        expect(resolved.steps).toEqual({ trigger: { x: 176, y: 240 }, step_1: { x: 400, y: 240 } })
    })
})

describe('flowLayoutUtil.tidyUp', () => {
    it('returns the auto-layout translated so the trigger keeps its current position', () => {
        const flowTrigger = trigger(code({ name: 'step_1', next: code({ name: 'step_2' }) }))

        const tidied = flowLayoutUtil.tidyUp({ trigger: flowTrigger, stepPositions: { trigger: { x: 32, y: 48 }, step_1: { x: 900, y: 900 } } })

        expect(tidied).toEqual({
            trigger: { x: 32, y: 48 },
            step_1: { x: 256, y: 48 },
            step_2: { x: 480, y: 48 },
        })
    })

    it('keeps the auto-layout as is when the trigger was never moved', () => {
        const flowTrigger = complexTrigger()

        expect(flowLayoutUtil.tidyUp({ trigger: flowTrigger, stepPositions: { step_9: { x: 2000, y: 2000 } } })).toEqual(flowLayoutUtil.computeAutoLayout({ trigger: flowTrigger }).steps)
    })
})

describe('flowLayoutUtil.getStubs', () => {
    it('puts a stub on the trigger of a flow without actions', () => {
        expect(flowLayoutUtil.getStubs({ trigger: trigger() })).toEqual([
            { stepName: 'trigger', outputId: 'out-0', onJoin: false, location: StepLocationRelativeToParent.AFTER },
        ])
    })

    it('sends empty router outputs to the join and puts the stub on the join', () => {
        expect(flowLayoutUtil.getStubs({ trigger: trigger(router({ name: 'step_1', branches: branches(3) })) })).toEqual([
            { stepName: 'step_1', outputId: 'out-0', onJoin: true, location: StepLocationRelativeToParent.AFTER },
        ])
    })

    it('puts stubs on empty loop bodies and on the done output of a final loop', () => {
        const flowTrigger = trigger(router({
            name: 'step_1',
            branches: [{ name: 'Branch 1', head: loop({ name: 'step_2' }) }, { name: 'Otherwise' }],
            next: loop({ name: 'step_3', body: code({ name: 'step_4' }) }),
        }))

        expect(flowLayoutUtil.getStubs({ trigger: flowTrigger })).toEqual([
            { stepName: 'step_3', outputId: 'out-0', onJoin: false, location: StepLocationRelativeToParent.AFTER },
            { stepName: 'step_2', outputId: 'out-1', onJoin: false, location: StepLocationRelativeToParent.INSIDE_LOOP },
        ])
    })

    it('ignores empty loops inside a hidden continue-on-failure branch', () => {
        const flowTrigger = trigger(code({ name: 'step_1', cof: false, onSuccess: loop({ name: 'step_2' }) }))

        expect(flowLayoutUtil.getStubs({ trigger: flowTrigger })).toEqual([
            { stepName: 'step_1', outputId: 'out-0', onJoin: false, location: StepLocationRelativeToParent.AFTER },
        ])
    })
})
