import { OpencodeStepSettings } from '@activepieces/shared'
import { z } from 'zod'
import { OpencodeAgentRequest } from './opencode-agent-prompt'
import { OpencodePieceRequest } from './opencode-piece-steps'
import { OpencodeAiRequest } from './opencode-prompts'

function parse(value: unknown): OpencodeStoredRequest | null {
    const parsed = OpencodeStoredRequest.safeParse(value)
    return parsed.success ? parsed.data : null
}

export const OpencodeStepRequest = z.union([OpencodeAiRequest, OpencodeAgentRequest, OpencodePieceRequest])
export type OpencodeStepRequest = z.infer<typeof OpencodeStepRequest>

export const OpencodeStoredRequest = z.object({
    request: OpencodeStepRequest,
    flowName: z.string().nullable(),
    settings: OpencodeStepSettings.nullable(),
})
export type OpencodeStoredRequest = z.infer<typeof OpencodeStoredRequest>

export const opencodeStoredRequest = {
    parse,
}
