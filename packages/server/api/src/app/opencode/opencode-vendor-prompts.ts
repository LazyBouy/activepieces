import { isNil, tryCatch } from '@activepieces/core-utils'
import { AiStepFile, OpencodeStepSettings } from '@activepieces/shared'
import { OpencodeClient, Part } from '@opencode-ai/sdk/v2/client'
import { z } from 'zod'
import { opencodeErrors } from './opencode-errors'
import { opencodeFilesIn, OpencodeInputFile } from './opencode-files-in'
import { opencodeLinks } from './opencode-links'
import { BuiltPrompt, opencodePrompts, OpencodeStepAnswer } from './opencode-prompts'
import { OpencodeReplyMessage, ReplySummary, SessionMessage } from './opencode-reply'
import { OpencodeStepModel, OpencodeStepRow } from './opencode-step.entity'

function settingsOf({ request, stepSettings }: SettingsParams): OpencodeStepSettings | undefined {
    if (request.session.kind === 'STEP') {
        return stepSettings
    }
    return { ...stepSettings, sessionMode: 'NEW_PER_STEP' }
}

function pinnedSessionOf({ request }: { request: OpencodeVendorPromptRequest }): string | null {
    return request.session.kind === 'MEMORY' ? request.session.sessionId : null
}

function modelOf({ request }: { request: OpencodeVendorPromptRequest }): OpencodeStepModel {
    return { providerID: request.provider, modelID: request.model }
}

function build({ request, files }: { request: OpencodeVendorPromptRequest, files: OpencodeInputFile[] }): BuiltPrompt {
    return {
        parts: [{ type: 'text', text: request.prompt }, ...files.map((file) => opencodeFilesIn.partOf({ file }))],
        ...(isNil(request.outputSchema) ? {} : { format: { type: 'json_schema', schema: request.outputSchema } }),
        ...(isNil(request.system) || request.system.length === 0 ? {} : { system: request.system }),
        ...(isNil(request.options) ? {} : { options: request.options }),
        ...(isNil(request.variant) ? {} : { variant: request.variant }),
    }
}

async function checkProvider({ client, step, request }: CheckProviderParams): Promise<void> {
    const { data: listed } = await tryCatch(() => client.config.providers({ directory: step.directory ?? undefined }, { throwOnError: true }))
    if (isNil(listed)) {
        return
    }
    if (!listed.data.providers.some((provider) => provider.id === request.provider)) {
        throw new Error(opencodeErrors.providerNotConnected({ vendor: request.vendor }))
    }
}

function answer({ request, step, replies, messages, reply, summary, adminPanelUrl }: AnswerParams): OpencodeStepAnswer {
    if (!isNil(reply.error)) {
        return { failure: opencodeErrors.sessionError({ message: reply.error }) }
    }
    if (!isNil(request.outputSchema) && isNil(reply.structured)) {
        return { failure: opencodePrompts.NO_STRUCTURED_OUTPUT }
    }
    const last = replies[replies.length - 1]
    const output: OpencodeVendorOutput = {
        answer: reply.text,
        ...(isNil(request.outputSchema) ? {} : { structured: reply.structured }),
        reasoning: replies.flatMap(({ parts }) => parts.flatMap((part) => reasoningOf({ part }))).join('\n').trim(),
        sources: uniqueSources({ replies }),
        finish: last?.info.finish ?? null,
        messageId: last?.info.id ?? null,
        sessionId: step.sessionId ?? '',
        adminPanelUrl: isNil(step.directory) || isNil(step.sessionId) ? null : opencodeLinks.session({ adminPanelUrl, directory: step.directory, sessionId: step.sessionId }),
        model: summary.model,
        usage: summary.usage,
        ...(request.withHistory === true ? { history: historyOf({ messages }) } : {}),
    }
    return { output }
}

function reasoningOf({ part }: { part: Part }): string[] {
    return part.type === 'reasoning' && part.text.trim().length > 0 ? [part.text.trim()] : []
}

function uniqueSources({ replies }: { replies: OpencodeReplyMessage[] }): CitedSource[] {
    const all = replies.flatMap(({ info }) => info.sources ?? [])
    return all.filter((source, index) => all.findIndex((other) => other.url === source.url) === index)
        .map((source) => isNil(source.title) ? { url: source.url } : { url: source.url, title: source.title })
}

function historyOf({ messages }: { messages: SessionMessage[] }): HistoryTurn[] {
    return messages.flatMap(({ info, parts }) => {
        const text = parts
            .flatMap((part) => part.type === 'text' && part.synthetic !== true && part.ignored !== true ? [part.text] : [])
            .join('')
            .trim()
        return text.length === 0 ? [] : [{ role: info.role, text }]
    })
}

const ModelOptions = z.object({
    temperature: z.number().min(0).max(2).optional(),
    topP: z.number().min(0).max(1).optional(),
    maxOutputTokens: z.number().int().min(1).optional(),
    frequencyPenalty: z.number().min(-2).max(2).optional(),
    presencePenalty: z.number().min(-2).max(2).optional(),
    seed: z.number().int().optional(),
})

const VendorSession = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('STEP') }),
    z.object({ kind: z.literal('NEW') }),
    z.object({ kind: z.literal('MEMORY'), sessionId: z.string().min(1) }),
])

export const OPENCODE_VENDOR_PROMPT = 'OPENCODE_VENDOR_PROMPT'

export const OpencodeVendorPromptRequest = z.object({
    action: z.literal(OPENCODE_VENDOR_PROMPT),
    vendor: z.string().min(1),
    provider: z.string().min(1),
    model: z.string().min(1),
    prompt: z.string().min(1),
    system: z.string().optional(),
    files: z.array(AiStepFile).optional(),
    outputSchema: z.record(z.string(), z.unknown()).optional(),
    options: ModelOptions.optional(),
    variant: z.string().min(1).optional(),
    session: VendorSession,
    withHistory: z.boolean().optional(),
})
export type OpencodeVendorPromptRequest = z.infer<typeof OpencodeVendorPromptRequest>

export const opencodeVendorPrompts = {
    settingsOf,
    pinnedSessionOf,
    modelOf,
    build,
    checkProvider,
    answer,
}

export type OpencodeVendorOutput = {
    answer: string
    structured?: unknown
    reasoning: string
    sources: CitedSource[]
    finish: string | null
    messageId: string | null
    sessionId: string
    adminPanelUrl: string | null
    model: ReplySummary['model']
    usage: ReplySummary['usage']
    history?: HistoryTurn[]
}

type CitedSource = {
    url: string
    title?: string
}

type HistoryTurn = {
    role: 'user' | 'assistant'
    text: string
}

type SettingsParams = {
    request: OpencodeVendorPromptRequest
    stepSettings: OpencodeStepSettings | undefined
}

type CheckProviderParams = {
    client: OpencodeClient
    step: OpencodeStepRow
    request: OpencodeVendorPromptRequest
}

type AnswerParams = {
    request: OpencodeVendorPromptRequest
    step: OpencodeStepRow
    replies: OpencodeReplyMessage[]
    messages: SessionMessage[]
    reply: { text: string, structured: unknown, error?: string }
    summary: ReplySummary
    adminPanelUrl: string
}
