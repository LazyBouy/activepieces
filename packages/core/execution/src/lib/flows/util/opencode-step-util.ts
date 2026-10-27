import { FlowActionType } from '../actions/action'
import { OpencodeDefaults, OpencodeSessionMode, OpencodeStepSettings } from '../opencode-settings'
import { AI_PIECE_NAME, Step } from './flow-structure-util'

function isOpencodeStep({ step }: { step: Step }): boolean {
    if (step.type === FlowActionType.AI_ROUTER) {
        return true
    }
    if (step.type !== FlowActionType.PIECE) {
        return false
    }
    return step.settings.pieceName === AI_PIECE_NAME && ROUTED_AI_ACTIONS.includes(step.settings.actionName ?? '')
}

function runsOnOpencode({ step }: { step: Step }): boolean {
    return isOpencodeStep({ step }) || (step.type === FlowActionType.PIECE && step.settings.pieceName === OPENCODE_PIECE_NAME)
}

function settingsOf({ step }: { step: Step }): OpencodeStepSettings | undefined {
    if (step.type === FlowActionType.AI_ROUTER || step.type === FlowActionType.PIECE) {
        return step.settings.opencode
    }
    return undefined
}

function resolveSessionMode({ step, defaults }: { step: Step, defaults: OpencodeDefaults | undefined }): OpencodeSessionMode {
    return settingsOf({ step })?.sessionMode ?? resolveFlowSessionMode({ defaults })
}

function resolveFlowSessionMode({ defaults }: { defaults: OpencodeDefaults | undefined }): OpencodeSessionMode {
    return defaults?.sessionMode ?? DEFAULT_SESSION_MODE
}

const ROUTED_AI_ACTIONS = ['askAi', 'summarizeText', 'classifyText', 'extractStructuredData', 'run_agent']

const DEFAULT_SESSION_MODE: OpencodeSessionMode = 'NEW_PER_STEP'

export const OPENCODE_PIECE_NAME = '@iphi-flow/piece-opencode'

export const opencodeStepUtil = {
    isOpencodeStep,
    runsOnOpencode,
    settingsOf,
    resolveSessionMode,
    resolveFlowSessionMode,
}
