import {
    AiRouterAction,
    BranchExecutionType,
    CodeAction,
    FlowAction,
    FlowActionType,
    FlowTrigger,
    FlowTriggerType,
    FlowVersion,
    FlowVersionState,
    LoopOnItemsAction,
    RouterAction,
    RouterExecutionType,
    StepPositions,
} from '../../src'

const LAST_UPDATED = '2026-10-10T00:00:00.000Z'

function code({ name, next, cof = false, onSuccess, onFailure }: CodeParams): CodeAction {
    return {
        name,
        type: FlowActionType.CODE,
        valid: true,
        displayName: name,
        lastUpdatedDate: LAST_UPDATED,
        settings: {
            sourceCode: { code: '', packageJson: '{}' },
            input: {},
            errorHandlingOptions: {
                continueOnFailure: { value: cof },
                retryOnFailure: { value: false },
            },
        },
        ...(onSuccess || onFailure ? { continueOnFailureBranches: { onSuccess, onFailure } } : {}),
        nextAction: next,
    }
}

function loop({ name, body, next }: LoopParams): LoopOnItemsAction {
    return {
        name,
        type: FlowActionType.LOOP_ON_ITEMS,
        valid: true,
        displayName: name,
        lastUpdatedDate: LAST_UPDATED,
        settings: { items: '{{trigger}}' },
        firstLoopAction: body,
        nextAction: next,
    }
}

function router({ name, branches, next }: RouterParams): RouterAction {
    return {
        name,
        type: FlowActionType.ROUTER,
        valid: true,
        displayName: name,
        lastUpdatedDate: LAST_UPDATED,
        settings: {
            executionType: RouterExecutionType.EXECUTE_FIRST_MATCH,
            branches: branches.map((branch, index) => index === branches.length - 1
                ? { branchType: BranchExecutionType.FALLBACK, branchName: branch.name }
                : { branchType: BranchExecutionType.CONDITION, branchName: branch.name, conditions: [[]] }),
        },
        children: branches.map((branch) => branch.head ?? null),
        nextAction: next,
    }
}

function aiRouter({ name, branches, next }: RouterParams): AiRouterAction {
    return {
        name,
        type: FlowActionType.AI_ROUTER,
        valid: true,
        displayName: name,
        lastUpdatedDate: LAST_UPDATED,
        settings: {
            text: '',
            question: '',
            branches: branches.map((branch, index) => index === branches.length - 1
                ? { branchType: BranchExecutionType.FALLBACK, branchName: branch.name }
                : { branchType: BranchExecutionType.CONDITION, branchName: branch.name }),
        },
        children: branches.map((branch) => branch.head ?? null),
        nextAction: next,
    }
}

function trigger(next?: FlowAction): FlowTrigger {
    return {
        name: 'trigger',
        type: FlowTriggerType.EMPTY,
        valid: true,
        displayName: 'Trigger',
        lastUpdatedDate: LAST_UPDATED,
        settings: {},
        nextAction: next,
    }
}

function flowVersion({ next, stepPositions = {} }: { next?: FlowAction, stepPositions?: StepPositions }): FlowVersion {
    return {
        id: 'version-id',
        created: LAST_UPDATED,
        updated: LAST_UPDATED,
        flowId: 'flow-id',
        displayName: 'Canvas flow',
        updatedBy: null,
        valid: true,
        schemaVersion: null,
        agentIds: [],
        state: FlowVersionState.DRAFT,
        connectionIds: [],
        backupFiles: null,
        notes: [],
        stepPositions,
        trigger: trigger(next),
    }
}

export const canvasFixtures = {
    code,
    loop,
    router,
    aiRouter,
    trigger,
    flowVersion,
}

type CodeParams = {
    name: string
    next?: FlowAction
    cof?: boolean
    onSuccess?: FlowAction
    onFailure?: FlowAction
}

type LoopParams = {
    name: string
    body?: FlowAction
    next?: FlowAction
}

type RouterParams = {
    name: string
    branches: { name: string, head?: FlowAction }[]
    next?: FlowAction
}
