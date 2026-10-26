import { OpencodeStepSettings } from '@activepieces/shared'
import { z } from 'zod'
import { OpencodeAiRequest } from './opencode-prompts'

function parse(value: unknown): OpencodeStoredRequest | null {
    const parsed = OpencodeStoredRequest.safeParse(value)
    return parsed.success ? parsed.data : null
}

export const OpencodeStoredRequest = z.object({
    request: OpencodeAiRequest,
    flowName: z.string().nullable(),
    settings: OpencodeStepSettings.nullable(),
})
export type OpencodeStoredRequest = z.infer<typeof OpencodeStoredRequest>

export const opencodeStoredRequest = {
    parse,
}
