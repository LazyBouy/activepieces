import { isNil } from '@activepieces/core-utils'
import { AgentOutputField, AgentOutputFieldType, AgentResult, AgentStepBlock, AgentTaskStatus, ContentBlockType, ExecutionToolStatus, ToolCallContentBlock, ToolCallStatus, ToolCallType } from '@activepieces/shared'
import { Part, ToolPart } from '@opencode-ai/sdk/v2/client'
import { z } from 'zod'
import { opencodeErrors } from './opencode-errors'
import { BuiltPrompt, opencodePrompts, OpencodeStepAnswer } from './opencode-prompts'
import { OpencodeReplyMessage, ReplySummary } from './opencode-reply'
import { OpencodeStepRow } from './opencode-step.entity'

function build({ request }: { request: OpencodeAgentRequest }): BuiltPrompt {
    const fields = request.structuredOutput ?? []
    return {
        parts: [{ type: 'text', text: request.instruction }],
        ...(fields.length === 0 ? {} : { format: { type: 'json_schema', schema: outputSchema({ fields }).jsonSchema } }),
    }
}

function answer({ request, step, replies, reply, summary, adminPanelUrl }: AnswerParams): OpencodeStepAnswer {
    if (!isNil(reply.error)) {
        return { failure: opencodeErrors.sessionError({ message: reply.error }) }
    }
    const fields = request.structuredOutput ?? []
    if (fields.length > 0 && isNil(reply.structured)) {
        return { failure: opencodePrompts.NO_STRUCTURED_OUTPUT }
    }
    const result: OpencodeAgentResult = {
        prompt: request.instruction,
        steps: stepsOf({ replies }),
        status: AgentTaskStatus.COMPLETED,
        ...(fields.length === 0 ? {} : { structuredOutput: restoreNames({ value: reply.structured, names: outputSchema({ fields }).names }) }),
        opencode: {
            sessionId: step.sessionId ?? '',
            adminPanelUrl: sessionLink({ adminPanelUrl, directory: step.directory, sessionId: step.sessionId }),
            namespace: step.namespace,
            project: step.opencodeProjectId,
            agent: step.agent,
            model: summary.model,
            usage: summary.usage,
            files: [],
        },
    }
    return { output: result }
}

function progress({ request, replies }: { request: OpencodeAgentRequest, replies: OpencodeReplyMessage[] }): AgentResult {
    return {
        prompt: request.instruction,
        steps: stepsOf({ replies }),
        status: AgentTaskStatus.IN_PROGRESS,
    }
}

function sessionLink({ adminPanelUrl, directory, sessionId }: { adminPanelUrl: string, directory: string | null, sessionId: string | null }): string | null {
    if (isNil(directory) || isNil(sessionId)) {
        return null
    }
    return `${adminPanelUrl.replace(/\/+$/, '')}/${Buffer.from(directory).toString('base64url')}/session/${sessionId}`
}

function stepsOf({ replies }: { replies: OpencodeReplyMessage[] }): AgentStepBlock[] {
    return replies.flatMap(({ info, parts }) => parts.flatMap((part) => blocksOf({ part, startedAt: info.time.created })))
}

function blocksOf({ part, startedAt }: { part: Part, startedAt: number }): AgentStepBlock[] {
    if (part.type === 'text') {
        const text = part.synthetic === true || part.ignored === true ? '' : part.text.trim()
        return text.length === 0 ? [] : [{ type: ContentBlockType.MARKDOWN, markdown: text }]
    }
    if (part.type === 'tool' && part.tool !== STRUCTURED_OUTPUT_TOOL) {
        return [toolBlock({ part, startedAt })]
    }
    return []
}

function toolBlock({ part, startedAt }: { part: ToolPart, startedAt: number }): ToolCallContentBlock {
    const state = part.state
    const base: Pick<UnknownToolCall, 'type' | 'toolCallType' | 'toolName' | 'displayName' | 'toolCallId' | 'input'> = {
        type: ContentBlockType.TOOL_CALL,
        toolCallType: ToolCallType.UNKNOWN,
        toolName: part.tool,
        displayName: part.tool,
        toolCallId: part.callID,
        input: state.input,
    }
    switch (state.status) {
        case 'pending':
            return { ...base, status: ToolCallStatus.IN_PROGRESS, startTime: isoOf({ ms: startedAt }) }
        case 'running':
            return { ...base, status: ToolCallStatus.IN_PROGRESS, startTime: isoOf({ ms: state.time.start }) }
        case 'completed':
            return {
                ...base,
                status: ToolCallStatus.COMPLETED,
                output: { status: ExecutionToolStatus.SUCCESS, output: state.output, resolvedInput: {} },
                startTime: isoOf({ ms: state.time.start }),
                endTime: isoOf({ ms: state.time.end }),
            }
        case 'error':
            return {
                ...base,
                status: ToolCallStatus.COMPLETED,
                output: { status: ExecutionToolStatus.FAILED, output: null, resolvedInput: {}, errorMessage: state.error },
                startTime: isoOf({ ms: state.time.start }),
                endTime: isoOf({ ms: state.time.end }),
            }
    }
}

function outputSchema({ fields }: { fields: AgentOutputField[] }): OutputSchema {
    const entries = fields.map((field) => ({ field, key: field.displayName.replace(/[^a-zA-Z0-9_.-]/g, '_') }))
    return {
        jsonSchema: {
            type: 'object',
            properties: Object.fromEntries(entries.map(({ field, key }) => [key, {
                type: JSON_TYPES[field.type],
                description: field.description ?? field.displayName,
            }])),
            required: entries.map(({ key }) => key),
            additionalProperties: false,
        },
        names: Object.fromEntries(entries.map(({ field, key }) => [key, field.displayName])),
    }
}

function restoreNames({ value, names }: { value: unknown, names: Record<string, string> }): unknown {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return value
    }
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [names[key] ?? key, entry]))
}

function isoOf({ ms }: { ms: number }): string {
    return new Date(ms).toISOString()
}

const STRUCTURED_OUTPUT_TOOL = 'StructuredOutput'

const JSON_TYPES: Record<AgentOutputFieldType, string> = {
    [AgentOutputFieldType.TEXT]: 'string',
    [AgentOutputFieldType.NUMBER]: 'number',
    [AgentOutputFieldType.BOOLEAN]: 'boolean',
}

export const OPENCODE_RUN_AGENT = 'RUN_AGENT'

export const OpencodeAgentRequest = z.object({
    action: z.literal(OPENCODE_RUN_AGENT),
    instruction: z.string(),
    structuredOutput: z.array(AgentOutputField).optional(),
    provider: z.string().optional(),
    providerConfigId: z.string().optional(),
    modelId: z.string().optional(),
})
export type OpencodeAgentRequest = z.infer<typeof OpencodeAgentRequest>

export const opencodeAgentPrompt = {
    build,
    answer,
    progress,
}

export type OpencodeAgentResult = AgentResult & {
    opencode: {
        sessionId: string
        adminPanelUrl: string | null
        namespace: string | null
        project: string | null
        agent: string | null
        model: ReplySummary['model']
        usage: ReplySummary['usage']
        files: { name: string, url: string, size: number }[]
    }
}

type AnswerParams = {
    request: OpencodeAgentRequest
    step: OpencodeStepRow
    replies: OpencodeReplyMessage[]
    reply: { structured: unknown, error?: string }
    summary: ReplySummary
    adminPanelUrl: string
}

type UnknownToolCall = Extract<ToolCallContentBlock, { toolCallType: ToolCallType.UNKNOWN }>

type OutputSchema = {
    jsonSchema: Record<string, unknown>
    names: Record<string, string>
}
