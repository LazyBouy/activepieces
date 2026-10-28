import { isNil } from '@activepieces/core-utils'
import { FlowActionType } from '../actions/action'
import { OpencodeDefaults, OpencodeSessionMode, OpencodeStepSettings } from '../opencode-settings'
import { FlowTrigger } from '../triggers/trigger'
import { AI_PIECE_NAME, flowStructureUtil, Step } from './flow-structure-util'

function isOpencodeStep({ step }: { step: Step }): boolean {
    if (step.type === FlowActionType.AI_ROUTER) {
        return true
    }
    if (step.type !== FlowActionType.PIECE) {
        return false
    }
    if (step.settings.pieceName === AI_PIECE_NAME) {
        return ROUTED_AI_ACTIONS.includes(step.settings.actionName ?? '')
    }
    return !isNil(vendorOfForkAction({ pieceName: step.settings.pieceName, actionName: step.settings.actionName }))
}

function vendorOfForkAction({ pieceName, actionName }: { pieceName: string, actionName: string | undefined }): OpencodeVendorPiece | undefined {
    return OPENCODE_VENDOR_PIECES.find((vendor) => vendor.forkPiece === pieceName && vendor.actions.includes(actionName ?? ''))
}

function vendorOfOfficialAction({ pieceName, actionName }: { pieceName: string, actionName: string | undefined }): OpencodeVendorPiece | undefined {
    return OPENCODE_VENDOR_PIECES.find((vendor) => vendor.officialPiece === pieceName && vendor.actions.includes(actionName ?? ''))
}

function hiddenOfficialActions({ pieceName }: { pieceName: string }): string[] {
    return OPENCODE_VENDOR_PIECES.find((vendor) => vendor.officialPiece === pieceName)?.actions ?? []
}

function runsOnOpencode({ step }: { step: Step }): boolean {
    return isOpencodeStep({ step }) || (step.type === FlowActionType.PIECE && step.settings.pieceName === OPENCODE_PIECE_NAME)
}

function isChannelStep({ step }: { step: Step }): boolean {
    return step.type === FlowActionType.PIECE && step.settings.pieceName === OPENCODE_PIECE_NAME && step.settings.actionName === OPENCODE_CHANNEL_ACTION
}

function leavesChannelOpen({ step }: { step: Step }): boolean {
    return isChannelStep({ step }) && step.type === FlowActionType.PIECE && step.settings.input[CHANNEL_WAIT_FOR_INPUT] === CHANNEL_OPEN_MODE
}

function openChannelStepsBefore({ trigger, stepName }: { trigger: FlowTrigger, stepName: string }): Step[] {
    return flowStructureUtil.findPathToStep(trigger, stepName).filter((step) => leavesChannelOpen({ step }))
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

const CHANNEL_WAIT_FOR_INPUT = 'waitFor'

const CHANNEL_OPEN_MODE = 'OPEN'

export const OPENCODE_PIECE_NAME = '@iphi-flow/piece-opencode'

export const OPENCODE_CHANNEL_ACTION = 'agent_channel'

export const OPENCODE_VENDOR_PIECES: OpencodeVendorPiece[] = [
    { vendor: 'OpenAI', officialPiece: '@activepieces/piece-openai', forkPiece: '@iphi-flow/piece-opencode-openai', provider: 'openai', actions: ['ask_chatgpt', 'vision_prompt', 'extract-structured-data', 'analyze_sentiment'] },
    { vendor: 'Claude', officialPiece: '@activepieces/piece-claude', forkPiece: '@iphi-flow/piece-opencode-claude', provider: 'anthropic', actions: ['ask_claude', 'extract-structured-data'] },
    { vendor: 'Google Gemini', officialPiece: '@activepieces/piece-google-gemini', forkPiece: '@iphi-flow/piece-opencode-google-gemini', provider: 'google', actions: ['generate_content', 'generate_content_from_image', 'chat_gemini'] },
    { vendor: 'Azure OpenAI', officialPiece: '@activepieces/piece-azure-openai', forkPiece: '@iphi-flow/piece-opencode-azure-openai', provider: 'azure', actions: ['ask_gpt'] },
    { vendor: 'Mistral AI', officialPiece: '@activepieces/piece-mistral-ai', forkPiece: '@iphi-flow/piece-opencode-mistral-ai', provider: 'mistral', actions: ['create_chat_completion', 'generate_chat_completion'] },
    { vendor: 'DeepSeek', officialPiece: '@activepieces/piece-deepseek', forkPiece: '@iphi-flow/piece-opencode-deepseek', provider: 'deepseek', actions: ['ask_deepseek'] },
    { vendor: 'Groq', officialPiece: '@activepieces/piece-groq', forkPiece: '@iphi-flow/piece-opencode-groq', provider: 'groq', actions: ['ask-ai'] },
    { vendor: 'Perplexity AI', officialPiece: '@activepieces/piece-perplexity-ai', forkPiece: '@iphi-flow/piece-opencode-perplexity-ai', provider: 'perplexity', actions: ['ask-ai'] },
    { vendor: 'Google Vertex AI', officialPiece: '@activepieces/piece-google-vertexai', forkPiece: '@iphi-flow/piece-opencode-google-vertexai', provider: 'google-vertex', actions: ['generate_content'] },
    { vendor: 'LocalAI', officialPiece: '@activepieces/piece-localai', forkPiece: '@iphi-flow/piece-opencode-localai', provider: 'localai', actions: ['ask_localai'] },
]

export const opencodeStepUtil = {
    isOpencodeStep,
    vendorOfForkAction,
    vendorOfOfficialAction,
    hiddenOfficialActions,
    runsOnOpencode,
    isChannelStep,
    leavesChannelOpen,
    openChannelStepsBefore,
    settingsOf,
    resolveSessionMode,
    resolveFlowSessionMode,
}

export type OpencodeVendorPiece = {
    vendor: string
    officialPiece: string
    forkPiece: string
    provider: string
    actions: string[]
}
