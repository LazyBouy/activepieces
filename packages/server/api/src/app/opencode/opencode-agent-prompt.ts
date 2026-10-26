import { isNil } from '@activepieces/core-utils'
import { AgentOutputField, AgentOutputFieldType, AgentResult, AgentStepBlock, AgentTaskStatus, AgentTool, AgentToolType, ContentBlockType, ExecutionToolStatus, ToolCallBase, ToolCallContentBlock, ToolCallStatus, ToolCallType } from '@activepieces/shared'
import { Part, ToolPart, ToolState } from '@opencode-ai/sdk/v2/client'
import { z } from 'zod'
import { opencodeErrors } from './opencode-errors'
import { opencodeLinks } from './opencode-links'
import { opencodeMcpNames } from './opencode-mcp-names'
import { BuiltPrompt, opencodePrompts, OpencodeStepAnswer } from './opencode-prompts'
import { OpencodeReplyMessage, ReplySummary } from './opencode-reply'
import { OpencodeStepFiles, OpencodeStepRow } from './opencode-step.entity'

function build({ request, outputFolder }: { request: OpencodeAgentRequest, outputFolder: string }): BuiltPrompt {
    const fields = request.structuredOutput ?? []
    return {
        parts: [{ type: 'text', text: `${request.instruction}\n\nSave the files you create for this step in ${outputFolder}/ in the project folder.` }],
        ...(fields.length === 0 ? {} : { format: { type: 'json_schema', schema: outputSchema({ fields }).jsonSchema } }),
    }
}

function answer({ request, step, replies, reply, summary, adminPanelUrl, files }: AnswerParams): OpencodeStepAnswer {
    if (!isNil(reply.error)) {
        return { failure: opencodeErrors.sessionError({ message: reply.error }) }
    }
    const fields = request.structuredOutput ?? []
    if (fields.length > 0 && isNil(reply.structured)) {
        return { failure: opencodePrompts.NO_STRUCTURED_OUTPUT }
    }
    const result: OpencodeAgentResult = {
        prompt: request.instruction,
        steps: stepsOf({ replies, stepId: step.id, tools: request.tools ?? [] }),
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
            files: files.files,
            skippedFiles: files.skippedFiles,
        },
    }
    return { output: result }
}

function progress({ request, replies, stepId }: { request: OpencodeAgentRequest, replies: OpencodeReplyMessage[], stepId: string }): AgentResult {
    return {
        prompt: request.instruction,
        steps: stepsOf({ replies, stepId, tools: request.tools ?? [] }),
        status: AgentTaskStatus.IN_PROGRESS,
    }
}

function sessionLink({ adminPanelUrl, directory, sessionId }: { adminPanelUrl: string, directory: string | null, sessionId: string | null }): string | null {
    if (isNil(directory) || isNil(sessionId)) {
        return null
    }
    return opencodeLinks.session({ adminPanelUrl, directory, sessionId })
}

function stepsOf({ replies, stepId, tools }: { replies: OpencodeReplyMessage[], stepId: string, tools: AgentTool[] }): AgentStepBlock[] {
    return replies.flatMap(({ info, parts }) => parts.flatMap((part) => blocksOf({ part, startedAt: info.time.created, stepId, tools })))
}

function blocksOf({ part, startedAt, stepId, tools }: { part: Part, startedAt: number, stepId: string, tools: AgentTool[] }): AgentStepBlock[] {
    if (part.type === 'text') {
        const text = part.synthetic === true || part.ignored === true ? '' : part.text.trim()
        return text.length === 0 ? [] : [{ type: ContentBlockType.MARKDOWN, markdown: text }]
    }
    if (part.type === 'tool' && part.tool !== STRUCTURED_OUTPUT_TOOL) {
        return [toolBlock({ part, startedAt, stepId, tools })]
    }
    return []
}

function toolBlock({ part, startedAt, stepId, tools }: { part: ToolPart, startedAt: number, stepId: string, tools: AgentTool[] }): ToolCallContentBlock {
    const common: ToolCallBase = {
        type: ContentBlockType.TOOL_CALL,
        toolName: part.tool,
        toolCallId: part.callID,
        input: part.state.input,
        ...progressOf({ state: part.state, startedAt }),
    }
    const tool = opencodeMcpNames.toolOfCall({ stepId, callName: part.tool, tools })
    switch (tool?.type) {
        case AgentToolType.PIECE:
            return { ...common, toolCallType: ToolCallType.PIECE, pieceName: tool.pieceMetadata.pieceName, pieceVersion: tool.pieceMetadata.pieceVersion, actionName: tool.pieceMetadata.actionName }
        case AgentToolType.FLOW:
            return { ...common, toolCallType: ToolCallType.FLOW, displayName: tool.flowDisplayName ?? tool.toolName, externalFlowId: tool.externalFlowId }
        case AgentToolType.MCP:
            return { ...common, toolCallType: ToolCallType.MCP, displayName: tool.toolName, serverUrl: tool.serverUrl }
        default:
            return { ...common, toolCallType: ToolCallType.UNKNOWN, displayName: part.tool }
    }
}

function progressOf({ state, startedAt }: { state: ToolState, startedAt: number }): Pick<ToolCallBase, 'status' | 'output' | 'startTime' | 'endTime'> {
    switch (state.status) {
        case 'pending':
            return { status: ToolCallStatus.IN_PROGRESS, startTime: isoOf({ ms: startedAt }) }
        case 'running':
            return { status: ToolCallStatus.IN_PROGRESS, startTime: isoOf({ ms: state.time.start }) }
        case 'completed':
            return {
                status: ToolCallStatus.COMPLETED,
                output: { status: ExecutionToolStatus.SUCCESS, output: state.output, resolvedInput: {} },
                startTime: isoOf({ ms: state.time.start }),
                endTime: isoOf({ ms: state.time.end }),
            }
        case 'error':
            return {
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
    tools: z.array(AgentTool).optional(),
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
        files: OpencodeStepFiles['files']
        skippedFiles: OpencodeStepFiles['skippedFiles']
    }
}

type AnswerParams = {
    request: OpencodeAgentRequest
    step: OpencodeStepRow
    replies: OpencodeReplyMessage[]
    reply: { structured: unknown, error?: string }
    summary: ReplySummary
    adminPanelUrl: string
    files: OpencodeStepFiles
}

type OutputSchema = {
    jsonSchema: Record<string, unknown>
    names: Record<string, string>
}
