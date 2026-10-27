import { isNil } from '@activepieces/core-utils'
import { AiStepFile, OpencodeChannelMode, OpencodeStepSettings } from '@activepieces/shared'
import { Part } from '@opencode-ai/sdk/v2/client'
import { z } from 'zod'
import { opencodeErrors } from './opencode-errors'
import { opencodeFilesIn, OpencodeInputFile } from './opencode-files-in'
import { opencodeLinks } from './opencode-links'
import { BuiltPrompt, opencodePrompts, OpencodeStepAnswer } from './opencode-prompts'
import { OpencodeReplyMessage, ReplySummary } from './opencode-reply'
import { OpencodeStepFiles, OpencodeStepModel, OpencodeStepRow } from './opencode-step.entity'

function isPieceRequest<T extends { action: string }>(request: T): request is Extract<T, OpencodePieceRequest> {
    return PIECE_ACTIONS.includes(request.action)
}

function settingsOf({ request }: { request: OpencodePieceRequest }): OpencodeStepSettings {
    switch (request.action) {
        case OPENCODE_PIECE_ACTION.RUN_AGENT:
        case OPENCODE_PIECE_ACTION.RUN_COMMAND:
            return {
                sessionMode: request.session.kind === 'RUN' ? 'ONE_PER_RUN' : 'NEW_PER_STEP',
                ...(isNil(request.namespace) || isNil(request.project) ? {} : { namespace: request.namespace, project: request.project }),
                ...(isNil(request.agent) ? {} : { agent: request.agent }),
            }
        case OPENCODE_PIECE_ACTION.CONTINUE_SESSION:
            return { sessionMode: 'NEW_PER_STEP' }
        case OPENCODE_PIECE_ACTION.SEND_TO_INBOX:
            return { sessionMode: 'NEW_PER_STEP', namespace: request.namespace, project: request.project }
        case OPENCODE_PIECE_ACTION.AGENT_CHANNEL:
            return { sessionMode: 'NEW_PER_STEP' }
    }
}

function channelOf({ request }: { request: OpencodePieceRequest }): string | null {
    switch (request.action) {
        case OPENCODE_PIECE_ACTION.RUN_AGENT:
        case OPENCODE_PIECE_ACTION.RUN_COMMAND:
        case OPENCODE_PIECE_ACTION.CONTINUE_SESSION:
            return request.channel ?? null
        case OPENCODE_PIECE_ACTION.SEND_TO_INBOX:
        case OPENCODE_PIECE_ACTION.AGENT_CHANNEL:
            return null
    }
}

function pinnedSessionOf({ request }: { request: OpencodePieceRequest }): PinnedSession | null {
    switch (request.action) {
        case OPENCODE_PIECE_ACTION.RUN_AGENT:
        case OPENCODE_PIECE_ACTION.RUN_COMMAND:
            return request.session.kind === 'EXISTING' ? { sessionId: request.session.sessionId, agent: request.agent ?? null } : null
        case OPENCODE_PIECE_ACTION.CONTINUE_SESSION:
            return { sessionId: request.sessionId, agent: null }
        case OPENCODE_PIECE_ACTION.SEND_TO_INBOX:
        case OPENCODE_PIECE_ACTION.AGENT_CHANNEL:
            return null
    }
}

function modelOf({ request }: { request: OpencodePieceRequest }): OpencodeStepModel | null {
    return request.action === OPENCODE_PIECE_ACTION.RUN_AGENT ? request.model ?? null : null
}

function build({ request, outputFolder, files }: BuildParams): BuiltPrompt {
    const fileParts = files.map((file) => opencodeFilesIn.partOf({ file }))
    switch (request.action) {
        case OPENCODE_PIECE_ACTION.RUN_AGENT:
            return {
                parts: [{ type: 'text', text: `${request.prompt}\n\nSave the files you create for this step in ${outputFolder}/ in the project folder.` }, ...fileParts],
                ...formatOf({ outputSchema: request.outputSchema }),
            }
        case OPENCODE_PIECE_ACTION.CONTINUE_SESSION:
            return {
                parts: [{ type: 'text', text: request.prompt }, ...fileParts],
                ...formatOf({ outputSchema: request.outputSchema }),
            }
        case OPENCODE_PIECE_ACTION.RUN_COMMAND:
            return { parts: fileParts }
        case OPENCODE_PIECE_ACTION.SEND_TO_INBOX:
        case OPENCODE_PIECE_ACTION.AGENT_CHANNEL:
            throw new Error(`${request.action} is not a session prompt`)
    }
}

function filesOf({ request }: { request: OpencodePieceRequest }): AiStepFile[] {
    return request.action === OPENCODE_PIECE_ACTION.SEND_TO_INBOX || request.action === OPENCODE_PIECE_ACTION.AGENT_CHANNEL ? [] : request.files ?? []
}

function participantKey({ namespace, project, agent }: { namespace: string, project: string, agent: string }): string {
    return `${namespace}/${project}/${agent}`
}

function answer({ request, step, replies, reply, summary, adminPanelUrl, files }: AnswerParams): OpencodeStepAnswer {
    if (!isNil(reply.error)) {
        return { failure: opencodeErrors.sessionError({ message: reply.error }) }
    }
    const wantsStructured = hasOutputSchema({ request })
    if (wantsStructured && isNil(reply.structured)) {
        return { failure: opencodePrompts.NO_STRUCTURED_OUTPUT }
    }
    const output: OpencodePieceOutput = {
        answer: request.action === OPENCODE_PIECE_ACTION.RUN_COMMAND ? commandAnswer({ text: reply.text, replies }) : reply.text,
        ...(wantsStructured ? { structured: reply.structured } : {}),
        sessionId: step.sessionId ?? '',
        adminPanelUrl: isNil(step.directory) || isNil(step.sessionId) ? null : opencodeLinks.session({ adminPanelUrl, directory: step.directory, sessionId: step.sessionId }),
        namespace: step.namespace,
        project: step.opencodeProjectId,
        agent: step.agent,
        model: summary.model,
        usage: summary.usage,
        files: files.files,
        skippedFiles: files.skippedFiles,
    }
    return { output }
}

function hasOutputSchema({ request }: { request: OpencodePieceRequest }): boolean {
    return (request.action === OPENCODE_PIECE_ACTION.RUN_AGENT || request.action === OPENCODE_PIECE_ACTION.CONTINUE_SESSION) && !isNil(request.outputSchema)
}

function commandAnswer({ text, replies }: { text: string, replies: OpencodeReplyMessage[] }): string {
    if (text.length > 0) {
        return text
    }
    const outputs = replies.flatMap(({ parts }) => parts.flatMap((part) => taskOutputOf({ part })))
    return outputs[outputs.length - 1] ?? ''
}

function taskOutputOf({ part }: { part: Part }): string[] {
    return part.type === 'tool' && part.tool === TASK_TOOL && part.state.status === 'completed' ? [part.state.output.trim()] : []
}

function formatOf({ outputSchema }: { outputSchema: Record<string, unknown> | undefined }): Pick<BuiltPrompt, 'format'> {
    return isNil(outputSchema) ? {} : { format: { type: 'json_schema', schema: outputSchema } }
}

const TASK_TOOL = 'task'

export const OPENCODE_PIECE_ACTION = {
    RUN_AGENT: 'OPENCODE_RUN_AGENT',
    RUN_COMMAND: 'OPENCODE_RUN_COMMAND',
    CONTINUE_SESSION: 'OPENCODE_CONTINUE_SESSION',
    SEND_TO_INBOX: 'OPENCODE_SEND_TO_INBOX',
    AGENT_CHANNEL: 'OPENCODE_AGENT_CHANNEL',
} as const

const PIECE_ACTIONS: string[] = Object.values(OPENCODE_PIECE_ACTION)

export const OPENCODE_INBOX_MAX_TIMEOUT_MINUTES = 30

export const OPENCODE_INBOX_DEFAULT_TIMEOUT_MINUTES = 10

export const OPENCODE_CHANNEL_LIMITS = {
    MIN_PARTICIPANTS: 2,
    MAX_PARTICIPANTS: 10,
    DEFAULT_MAX_MESSAGES: 50,
    MAX_MESSAGES: 1000,
    DEFAULT_TIMEOUT_MINUTES: 30,
    MAX_TIMEOUT_MINUTES: 1440,
} as const

export const OPENCODE_CHANNEL_START_ALL = 'ALL'

const ChannelParticipantRequest = z.object({
    namespace: z.string().min(1),
    project: z.string().min(1),
    agent: z.string().min(1),
})

const PieceSession = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('NEW') }),
    z.object({ kind: z.literal('RUN') }),
    z.object({ kind: z.literal('EXISTING'), sessionId: z.string().min(1) }),
])

const OutputSchema = z.record(z.string(), z.unknown())

const InboxTarget = z.object({
    type: z.enum(['agent', 'session', 'group']),
    id: z.string().min(1),
})

export const OpencodePieceRequest = z.discriminatedUnion('action', [
    z.object({
        action: z.literal(OPENCODE_PIECE_ACTION.RUN_AGENT),
        namespace: z.string().min(1).optional(),
        project: z.string().min(1).optional(),
        agent: z.string().min(1).optional(),
        prompt: z.string().min(1),
        files: z.array(AiStepFile).optional(),
        outputSchema: OutputSchema.optional(),
        model: OpencodeStepModel.optional(),
        session: PieceSession,
        channel: z.string().min(1).optional(),
    }),
    z.object({
        action: z.literal(OPENCODE_PIECE_ACTION.RUN_COMMAND),
        namespace: z.string().min(1).optional(),
        project: z.string().min(1).optional(),
        agent: z.string().min(1).optional(),
        command: z.string().min(1),
        arguments: z.string().optional(),
        files: z.array(AiStepFile).optional(),
        session: PieceSession,
        channel: z.string().min(1).optional(),
    }),
    z.object({
        action: z.literal(OPENCODE_PIECE_ACTION.CONTINUE_SESSION),
        sessionId: z.string().min(1),
        prompt: z.string().min(1),
        files: z.array(AiStepFile).optional(),
        outputSchema: OutputSchema.optional(),
        channel: z.string().min(1).optional(),
    }),
    z.object({
        action: z.literal(OPENCODE_PIECE_ACTION.AGENT_CHANNEL),
        participants: z.array(ChannelParticipantRequest).min(OPENCODE_CHANNEL_LIMITS.MIN_PARTICIPANTS).max(OPENCODE_CHANNEL_LIMITS.MAX_PARTICIPANTS),
        waitFor: OpencodeChannelMode,
        kickoff: z.string().optional(),
        startWith: z.string().min(1).optional(),
        doneBy: z.string().min(1).optional(),
        maxMessages: z.number().int().min(1).max(OPENCODE_CHANNEL_LIMITS.MAX_MESSAGES).optional(),
        timeoutMinutes: z.number().int().min(1).max(OPENCODE_CHANNEL_LIMITS.MAX_TIMEOUT_MINUTES).optional(),
    }),
    z.object({
        action: z.literal(OPENCODE_PIECE_ACTION.SEND_TO_INBOX),
        namespace: z.string().min(1),
        project: z.string().min(1),
        message: z.string().min(1),
        to: InboxTarget.optional(),
        wait: z.boolean(),
        timeoutMinutes: z.number().int().min(1).max(OPENCODE_INBOX_MAX_TIMEOUT_MINUTES).optional(),
        correlationId: z.string().optional(),
        inboxMessageId: z.string().optional(),
    }),
])
export type OpencodePieceRequest = z.infer<typeof OpencodePieceRequest>

export type OpencodeInboxRequest = Extract<OpencodePieceRequest, { action: typeof OPENCODE_PIECE_ACTION.SEND_TO_INBOX }>

export type OpencodeChannelRequest = Extract<OpencodePieceRequest, { action: typeof OPENCODE_PIECE_ACTION.AGENT_CHANNEL }>

export const opencodePieceSteps = {
    isPieceRequest,
    settingsOf,
    channelOf,
    participantKey,
    pinnedSessionOf,
    modelOf,
    build,
    filesOf,
    answer,
}

export type PinnedSession = {
    sessionId: string
    agent: string | null
}

export type OpencodePieceOutput = {
    answer: string
    structured?: unknown
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

type BuildParams = {
    request: OpencodePieceRequest
    outputFolder: string
    files: OpencodeInputFile[]
}

type AnswerParams = {
    request: OpencodePieceRequest
    step: OpencodeStepRow
    replies: OpencodeReplyMessage[]
    reply: { text: string, structured: unknown, error?: string }
    summary: ReplySummary
    adminPanelUrl: string
    files: OpencodeStepFiles
}
