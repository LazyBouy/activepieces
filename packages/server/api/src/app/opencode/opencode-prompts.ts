import { AiStepAction, isNil } from '@activepieces/core-utils'
import { AiRouterMatchMode, AiStepFile, AiStepSchema } from '@activepieces/shared'
import { z } from 'zod'
import { opencodeErrors } from './opencode-errors'

function build({ request, files }: BuildParams): BuiltPrompt {
    switch (request.action) {
        case AiStepAction.ASK_AI:
            return { parts: [textPart({ text: askText({ request }) })] }
        case AiStepAction.SUMMARIZE_TEXT:
            return { parts: [textPart({ text: `${request.prompt ?? ''} Summarize the following text : ${request.text ?? ''}` })] }
        case AiStepAction.CLASSIFY_TEXT:
            return {
                parts: [textPart({ text: classifyText({ request }) })],
                format: jsonSchemaFormat({ schema: classifySchema({ categories: request.categories ?? [] }) }),
            }
        case AiStepAction.EXTRACT_STRUCTURED_DATA:
            return {
                parts: [textPart({ text: extractText({ request }) }), ...files.filter(isExtractable).map(filePart)],
                format: jsonSchemaFormat({ schema: extractSchema({ schema: request.schema }).jsonSchema }),
            }
        case AiStepAction.ROUTE:
            return {
                parts: [textPart({ text: routeText({ request }) })],
                format: jsonSchemaFormat({ schema: routeSchema({ request }) }),
            }
        case AiStepAction.GENERATE_IMAGE:
            throw new Error(`${request.action} does not run on OpenCode`)
    }
}

function mapReply({ request, reply }: MapReplyParams): OpencodeStepAnswer {
    if (!isNil(reply.error)) {
        return { failure: opencodeErrors.sessionError({ message: reply.error }) }
    }
    switch (request.action) {
        case AiStepAction.ASK_AI:
            return { output: askOutput({ request, text: reply.text }) }
        case AiStepAction.SUMMARIZE_TEXT:
            return { output: { answer: reply.text } }
        case AiStepAction.CLASSIFY_TEXT: {
            const parsed = ClassifyAnswer.safeParse(reply.structured)
            if (!parsed.success) {
                return { failure: NO_STRUCTURED_OUTPUT }
            }
            if (!(request.categories ?? []).includes(parsed.data.category)) {
                return { failure: 'Unable to classify the text into the provided categories.' }
            }
            return { output: { answer: parsed.data.category } }
        }
        case AiStepAction.EXTRACT_STRUCTURED_DATA: {
            if (isNil(reply.structured)) {
                return { failure: NO_STRUCTURED_OUTPUT }
            }
            const { sanitizedNameMap } = extractSchema({ schema: request.schema })
            return { output: { answer: restoreFieldNames({ extracted: reply.structured, sanitizedNameMap }) } }
        }
        case AiStepAction.ROUTE:
            return routeAnswer({ request, structured: reply.structured })
        case AiStepAction.GENERATE_IMAGE:
            return { failure: `${request.action} does not run on OpenCode` }
    }
}

function askText({ request }: { request: OpencodeAiRequest }): string {
    const prompt = request.prompt ?? ''
    const earlier = (request.conversation ?? []).map(conversationLine).filter((line) => line.length > 0)
    if (earlier.length === 0) {
        return prompt
    }
    return ['Earlier in this conversation:', ...earlier, '', prompt].join('\n')
}

function askOutput({ request, text }: { request: OpencodeAiRequest, text: string }): Record<string, unknown> {
    if (isNil(request.conversation)) {
        return { answer: text }
    }
    return {
        answer: text,
        conversation: [
            ...request.conversation,
            { role: 'user', content: request.prompt ?? '' },
            { role: 'assistant', content: text },
        ],
    }
}

function conversationLine(message: Record<string, unknown>): string {
    const content = contentText({ content: message['content'] })
    if (content.length === 0) {
        return ''
    }
    return `${message['role'] === 'assistant' ? 'Assistant' : 'User'}: ${content}`
}

function contentText({ content }: { content: unknown }): string {
    if (typeof content === 'string') {
        return content
    }
    if (!Array.isArray(content)) {
        return ''
    }
    return content
        .map((part) => TextContentPart.safeParse(part))
        .filter((parsed) => parsed.success)
        .map((parsed) => parsed.data.text)
        .join('\n')
}

function classifyText({ request }: { request: OpencodeAiRequest }): string {
    return `Assign one of these categories to the text: ${(request.categories ?? []).join(', ')}.\n\nText to classify:\n${request.text ?? ''}`
}

function classifySchema({ categories }: { categories: string[] }): Record<string, unknown> {
    return {
        type: 'object',
        properties: { category: { type: 'string', enum: categories } },
        required: ['category'],
        additionalProperties: false,
    }
}

function extractText({ request }: { request: OpencodeAiRequest }): string {
    const prompt = request.prompt ?? ''
    const guide = prompt.length === 0 ? 'Extract the following data from the provided data.' : prompt
    const text = request.text ?? ''
    return text.length === 0 ? guide : `${guide}\n\nText to analyze:\n${text}`
}

function extractSchema({ schema }: { schema: AiStepSchema | undefined }): ExtractSchema {
    if (schema?.mode === 'advanced') {
        const advanced = JsonObject.safeParse(schema.fields)
        return { jsonSchema: advanced.success ? advanced.data : { type: 'object' }, sanitizedNameMap: {} }
    }
    const fields = z.array(SimpleField).safeParse(schema?.fields ?? [])
    const simpleFields = fields.success ? fields.data : []
    const entries = simpleFields.map((field) => ({ field, sanitized: field.name.replace(/[^a-zA-Z0-9_.-]/g, '_') }))
    return {
        jsonSchema: {
            type: 'object',
            properties: Object.fromEntries(entries.map(({ field, sanitized }) => [sanitized, {
                type: field.type,
                ...(isNil(field.description) ? {} : { description: field.description }),
            }])),
            required: entries.filter(({ field }) => field.isRequired).map(({ sanitized }) => sanitized),
        },
        sanitizedNameMap: Object.fromEntries(entries.map(({ field, sanitized }) => [sanitized, field.name])),
    }
}

function restoreFieldNames({ extracted, sanitizedNameMap }: { extracted: unknown, sanitizedNameMap: Record<string, string> }): unknown {
    if (Object.keys(sanitizedNameMap).length === 0 || typeof extracted !== 'object' || extracted === null || Array.isArray(extracted)) {
        return extracted
    }
    return Object.fromEntries(Object.entries(extracted).map(([key, value]) => [sanitizedNameMap[key] ?? key, value]))
}

function routeText({ request }: { request: OpencodeAiRequest }): string {
    const guide = isBestMatch({ request })
        ? 'Pick the one route that fits the input best, and give each route the probability (0 to 1) that it is the right one.'
        : 'Give each route the probability (0 to 1) that it applies to the input. More than one route can apply.'
    return [
        request.question ?? '',
        '',
        'Routes:',
        ...routeKeys({ request }).map(({ key, route, criterion }) => `${key}: ${route} — ${criterion}`),
        '',
        guide,
        '',
        'Input:',
        request.state ?? '',
    ].join('\n')
}

function routeSchema({ request }: { request: OpencodeAiRequest }): Record<string, unknown> {
    const routes = routeKeys({ request })
    const probabilities = {
        type: 'object',
        properties: Object.fromEntries(routes.map(({ key, route }) => [key, { type: 'number', description: `Probability from 0 to 1 for ${route}` }])),
        required: routes.map(({ key }) => key),
        additionalProperties: false,
    }
    if (!isBestMatch({ request })) {
        return { type: 'object', properties: { probabilities }, required: ['probabilities'], additionalProperties: false }
    }
    return {
        type: 'object',
        properties: { route: { type: 'string', enum: routes.map(({ key }) => key) }, probabilities },
        required: ['route', 'probabilities'],
        additionalProperties: false,
    }
}

function routeAnswer({ request, structured }: { request: OpencodeAiRequest, structured: unknown }): OpencodeStepAnswer {
    const parsed = RouteAnswer.safeParse(structured)
    if (!parsed.success) {
        return { failure: NO_STRUCTURED_OUTPUT }
    }
    const routes = routeKeys({ request })
    const probabilities = Object.fromEntries(routes.flatMap(({ key, route }) => {
        const probability = parsed.data.probabilities[key]
        return isNil(probability) ? [] : [[route, Math.min(1, Math.max(0, probability))]]
    }))
    if (isBestMatch({ request })) {
        const chosen = routes.find(({ key }) => key === parsed.data.route)
        return isNil(chosen) ? { failure: NO_ROUTE } : { output: { matched: [chosen.route], probabilities } }
    }
    if (Object.keys(probabilities).length === 0) {
        return { failure: NO_ROUTE }
    }
    return {
        output: {
            matched: Object.entries(probabilities).filter(([, probability]) => probability >= ROUTE_APPLIES_THRESHOLD).map(([route]) => route),
            probabilities,
        },
    }
}

function routeKeys({ request }: { request: OpencodeAiRequest }): RouteKey[] {
    return Object.entries(request.options ?? {}).map(([route, criterion], index) => ({ key: `r${index}`, route, criterion }))
}

function isBestMatch({ request }: { request: OpencodeAiRequest }): boolean {
    return request.matchMode !== AiRouterMatchMode.ALL_MATCHES
}

function isExtractable(file: OpencodeInputFile): boolean {
    return file.mime.startsWith('image/') || file.mime.startsWith('application/pdf') || file.mime.startsWith('text/')
}

function filePart(file: OpencodeInputFile): OpencodeFilePart {
    return {
        type: 'file',
        mime: file.mime,
        url: `data:${file.mime};base64,${file.base64}`,
        ...(isNil(file.filename) ? {} : { filename: file.filename }),
    }
}

function textPart({ text }: { text: string }): OpencodeTextPart {
    return { type: 'text', text }
}

function jsonSchemaFormat({ schema }: { schema: Record<string, unknown> }): OpencodeOutputFormat {
    return { type: 'json_schema', schema }
}

const NO_STRUCTURED_OUTPUT = 'The model did not return the requested structured output.'

const NO_ROUTE = 'The routing model did not answer the routing question'

const ROUTE_APPLIES_THRESHOLD = 0.5

const RouteAnswer = z.object({
    route: z.string().optional(),
    probabilities: z.record(z.string(), z.number()),
})

const ClassifyAnswer = z.object({ category: z.string() })

const TextContentPart = z.object({ type: z.literal('text'), text: z.string() })

const JsonObject = z.record(z.string(), z.unknown())

const SimpleField = z.object({
    name: z.string(),
    description: z.string().optional(),
    type: z.string(),
    isRequired: z.boolean().optional(),
})

export const OpencodeAiRequest = z.object({
    action: z.enum(AiStepAction),
    provider: z.string().optional(),
    providerConfigId: z.string().optional(),
    modelId: z.string().optional(),
    modelTierId: z.string().optional(),
    prompt: z.string().optional(),
    text: z.string().optional(),
    categories: z.array(z.string()).optional(),
    files: z.array(AiStepFile).optional(),
    schema: AiStepSchema.optional(),
    conversation: z.array(z.record(z.string(), z.unknown())).optional(),
    state: z.string().optional(),
    question: z.string().optional(),
    options: z.record(z.string(), z.string()).optional(),
    matchMode: z.enum(AiRouterMatchMode).optional(),
})
export type OpencodeAiRequest = z.infer<typeof OpencodeAiRequest>

export const opencodePrompts = {
    build,
    mapReply,
    NO_STRUCTURED_OUTPUT,
}

export type OpencodeInputFile = {
    mime: string
    base64: string
    filename?: string
}

export type OpencodeTextPart = {
    type: 'text'
    text: string
}

export type OpencodeFilePart = {
    type: 'file'
    mime: string
    url: string
    filename?: string
}

export type OpencodeOutputFormat = {
    type: 'json_schema'
    schema: Record<string, unknown>
}

export type BuiltPrompt = {
    parts: (OpencodeTextPart | OpencodeFilePart)[]
    format?: OpencodeOutputFormat
}

export type OpencodeReply = {
    text: string
    structured: unknown
    error?: string
}

export type OpencodeStepAnswer = {
    output?: unknown
    failure?: string
}

type BuildParams = {
    request: OpencodeAiRequest
    files: OpencodeInputFile[]
}

type MapReplyParams = {
    request: OpencodeAiRequest
    reply: OpencodeReply
}

type ExtractSchema = {
    jsonSchema: Record<string, unknown>
    sanitizedNameMap: Record<string, string>
}

type RouteKey = {
    key: string
    route: string
    criterion: string
}
