import { z } from 'zod'
import { formErrors } from '../../form-errors'

export const OPENCODE_DEFAULT_NAMESPACE = 'iphi-flow'

export const OPENCODE_DEFAULT_ASK_CAP_MINUTES = 1440

export const OPENCODE_MAX_ASK_CAP_MINUTES = 43200

export const OpencodeAllowlistEntry = z.string().regex(/^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)?$/)
export type OpencodeAllowlistEntry = z.infer<typeof OpencodeAllowlistEntry>

export const OpencodeHealth = z.object({
    healthy: z.boolean(),
    version: z.string().optional(),
    error: z.string().optional(),
    checkedAt: z.string(),
})
export type OpencodeHealth = z.infer<typeof OpencodeHealth>

export const OpencodeConnection = z.object({
    id: z.string(),
    serverUrl: z.string(),
    username: z.string(),
    hasPassword: z.boolean(),
    adminPanelUrl: z.string(),
    callbackUrl: z.string(),
    projectsFolder: z.string().nullable(),
    enabled: z.boolean(),
    askCapMinutes: z.number(),
    allowlist: z.array(OpencodeAllowlistEntry),
    lastHealth: OpencodeHealth.nullable(),
    emailNotices: z.boolean(),
})
export type OpencodeConnection = z.infer<typeof OpencodeConnection>

export const UpdateOpencodeConnectionRequest = z.object({
    serverUrl: z.url().optional(),
    username: z.string().min(1, formErrors.required).optional(),
    password: z.string().nullable().optional(),
    adminPanelUrl: z.url().optional(),
    callbackUrl: z.url().optional(),
    projectsFolder: z.string().min(1, formErrors.required).nullable().optional(),
    enabled: z.boolean().optional(),
    askCapMinutes: z.number().int().min(1).max(OPENCODE_MAX_ASK_CAP_MINUTES).optional(),
    allowlist: z.array(OpencodeAllowlistEntry).optional(),
})
export type UpdateOpencodeConnectionRequest = z.infer<typeof UpdateOpencodeConnectionRequest>

export const OpencodeCatalogProject = z.object({
    id: z.string(),
    name: z.string(),
    folder: z.string(),
})
export type OpencodeCatalogProject = z.infer<typeof OpencodeCatalogProject>

export const OpencodeCatalogNamespace = z.object({
    id: z.string(),
    name: z.string(),
    folder: z.string(),
    projects: z.array(OpencodeCatalogProject),
})
export type OpencodeCatalogNamespace = z.infer<typeof OpencodeCatalogNamespace>

export const OpencodeCatalog = z.object({
    namespaces: z.array(OpencodeCatalogNamespace),
    error: z.string().optional(),
})
export type OpencodeCatalog = z.infer<typeof OpencodeCatalog>

export const OpencodeProjectOptions = z.object({
    enabled: z.boolean(),
    adminPanelUrl: z.string(),
    namespaces: z.array(OpencodeCatalogNamespace),
    defaultLocation: z.object({
        namespace: z.string(),
        project: z.string().nullable(),
        agent: z.string(),
    }),
    error: z.string().optional(),
})
export type OpencodeProjectOptions = z.infer<typeof OpencodeProjectOptions>

export const ListOpencodeAgentsQuery = z.object({
    namespace: z.string().min(1).optional(),
    project: z.string().min(1).optional(),
})
export type ListOpencodeAgentsQuery = z.infer<typeof ListOpencodeAgentsQuery>

export const OpencodeAgentSummary = z.object({
    name: z.string(),
    description: z.string().optional(),
    mode: z.string(),
})
export type OpencodeAgentSummary = z.infer<typeof OpencodeAgentSummary>

export const OpencodeAgentList = z.object({
    agents: z.array(OpencodeAgentSummary),
    error: z.string().optional(),
})
export type OpencodeAgentList = z.infer<typeof OpencodeAgentList>

export enum OpencodeAskKind {
    PERMISSION = 'PERMISSION',
    QUESTION = 'QUESTION',
}

export enum OpencodeAskStatus {
    OPEN = 'OPEN',
    ANSWERED = 'ANSWERED',
    CLOSED = 'CLOSED',
    EXPIRED = 'EXPIRED',
}

export enum OpencodePermissionDecision {
    ALLOW_ONCE = 'allow',
    ALLOW_RUN = 'allow-session',
    ALLOW_AGENT = 'allow-agent',
    DENY = 'deny',
}

export const OPENCODE_ASK_NOTE_MAX_LENGTH = 1000

export const OpencodeQuestion = z.object({
    question: z.string(),
    header: z.string(),
    options: z.array(z.object({ label: z.string(), description: z.string() })),
    multiple: z.boolean().optional(),
    custom: z.boolean().optional(),
})
export type OpencodeQuestion = z.infer<typeof OpencodeQuestion>

export const OpencodeAskPermission = z.object({
    permission: z.string(),
    patterns: z.array(z.string()),
    metadata: z.record(z.string(), z.unknown()),
})
export type OpencodeAskPermission = z.infer<typeof OpencodeAskPermission>

export const OpencodeAskAnswer = z.object({
    decision: z.enum(OpencodePermissionDecision).optional(),
    note: z.string().optional(),
    answers: z.array(z.array(z.string())).optional(),
    dismissed: z.boolean().optional(),
})
export type OpencodeAskAnswer = z.infer<typeof OpencodeAskAnswer>

export const OpencodeAsk = z.object({
    id: z.string(),
    created: z.string(),
    flowId: z.string(),
    flowRunId: z.string(),
    flowVersionId: z.string().nullable(),
    stepName: z.string(),
    kind: z.enum(OpencodeAskKind),
    status: z.enum(OpencodeAskStatus),
    agent: z.string().nullable(),
    permission: OpencodeAskPermission.nullable(),
    questions: z.array(OpencodeQuestion).nullable(),
    deadline: z.string(),
    answer: OpencodeAskAnswer.nullable(),
    answeredVia: z.string().nullable(),
    answeredAt: z.string().nullable(),
    adminPanelUrl: z.string().nullable(),
})
export type OpencodeAsk = z.infer<typeof OpencodeAsk>

export const ListOpencodeAsksQuery = z.object({
    flowRunId: z.string().optional(),
    flowVersionId: z.string().optional(),
    stepName: z.string().optional(),
})
export type ListOpencodeAsksQuery = z.infer<typeof ListOpencodeAsksQuery>

export const AnswerOpencodeAskRequest = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('permission'),
        decision: z.enum(OpencodePermissionDecision),
        note: z.string().max(OPENCODE_ASK_NOTE_MAX_LENGTH).optional(),
    }),
    z.object({
        type: z.literal('question'),
        answers: z.array(z.array(z.string())),
    }),
    z.object({
        type: z.literal('dismiss'),
    }),
])
export type AnswerOpencodeAskRequest = z.infer<typeof AnswerOpencodeAskRequest>

export const OpencodeAskLink = z.object({
    url: z.string(),
})
export type OpencodeAskLink = z.infer<typeof OpencodeAskLink>

export const OpencodeAccess = z.enum(['allow', 'ask', 'deny'])
export type OpencodeAccess = z.infer<typeof OpencodeAccess>

export const OpencodeNamedItem = z.object({
    name: z.string(),
    description: z.string().optional(),
    origin: z.string().optional(),
    access: OpencodeAccess.optional(),
})
export type OpencodeNamedItem = z.infer<typeof OpencodeNamedItem>

export const OpencodeMcpServerView = z.object({
    name: z.string(),
    status: z.string(),
    error: z.string().optional(),
})
export type OpencodeMcpServerView = z.infer<typeof OpencodeMcpServerView>

export const OpencodeMemoryLevelView = z.object({
    level: z.string(),
    folder: z.string(),
    entries: z.array(z.object({ title: z.string(), description: z.string() })),
})
export type OpencodeMemoryLevelView = z.infer<typeof OpencodeMemoryLevelView>

export const OpencodeProviderView = z.object({
    id: z.string(),
    name: z.string(),
    defaultModel: z.string().nullable(),
    models: z.array(z.object({ id: z.string(), name: z.string() })),
})
export type OpencodeProviderView = z.infer<typeof OpencodeProviderView>

export const OpencodeAgentCard = z.object({
    name: z.string(),
    description: z.string().optional(),
    mode: z.string(),
    model: z.string().nullable(),
    modelFrom: z.string().nullable(),
    steps: z.number().nullable(),
    tools: z.array(z.object({ name: z.string(), source: z.string() })),
    hiddenTools: z.array(z.object({ name: z.string(), reason: z.string() })),
    skills: z.array(OpencodeNamedItem),
    subagents: z.array(OpencodeNamedItem),
    mcpServers: z.array(OpencodeMcpServerView),
    memory: z.array(OpencodeMemoryLevelView),
    permissions: z.array(z.object({ permission: z.string(), pattern: z.string(), action: OpencodeAccess, level: z.string() })),
    hooks: z.array(z.object({ name: z.string(), event: z.string(), level: z.string(), state: z.string(), description: z.string().optional() })),
    links: z.object({ agent: z.string(), tools: z.string(), permissions: z.string(), hooks: z.string(), memory: z.string() }),
})
export type OpencodeAgentCard = z.infer<typeof OpencodeAgentCard>

export const OpencodeAgentCardResult = z.object({
    card: OpencodeAgentCard.nullable(),
    error: z.string().optional(),
})
export type OpencodeAgentCardResult = z.infer<typeof OpencodeAgentCardResult>

export const OpencodeProjectSessionView = z.object({
    id: z.string(),
    title: z.string(),
    agent: z.string().nullable(),
    model: z.string().nullable(),
    cost: z.number(),
    created: z.string(),
    updated: z.string(),
    flowId: z.string().nullable(),
    flowRunId: z.string().nullable(),
    stepName: z.string().nullable(),
    adminPanelUrl: z.string(),
})
export type OpencodeProjectSessionView = z.infer<typeof OpencodeProjectSessionView>

export const OpencodeProjectView = z.object({
    namespace: z.string(),
    project: z.string(),
    name: z.string(),
    folder: z.string(),
    agents: z.array(OpencodeNamedItem.extend({ mode: z.string() })),
    tools: z.array(OpencodeNamedItem),
    skills: z.array(OpencodeNamedItem),
    commands: z.array(OpencodeNamedItem),
    mcpServers: z.array(OpencodeMcpServerView),
    memory: z.array(OpencodeMemoryLevelView),
    defaultModel: z.string().nullable(),
    defaultModelFrom: z.string().nullable(),
    providers: z.array(OpencodeProviderView),
    sessions: z.array(OpencodeProjectSessionView),
    links: z.object({ agents: z.string(), capabilities: z.string(), memory: z.string(), models: z.string(), sessions: z.string() }),
})
export type OpencodeProjectView = z.infer<typeof OpencodeProjectView>

export const OpencodeProjectViewResult = z.object({
    view: OpencodeProjectView.nullable(),
    error: z.string().optional(),
})
export type OpencodeProjectViewResult = z.infer<typeof OpencodeProjectViewResult>

export const OpencodeTranscriptEntry = z.discriminatedUnion('type', [
    z.object({ type: z.literal('text'), text: z.string() }),
    z.object({
        type: z.literal('tool'),
        tool: z.string(),
        status: z.string(),
        input: z.unknown(),
        output: z.string().optional(),
        error: z.string().optional(),
        subagentUrl: z.string().optional(),
    }),
])
export type OpencodeTranscriptEntry = z.infer<typeof OpencodeTranscriptEntry>

export const OpencodeStepSessionView = z.object({
    stepId: z.string(),
    stepName: z.string(),
    action: z.string(),
    status: z.string(),
    created: z.string(),
    sessionId: z.string().nullable(),
    adminPanelUrl: z.string().nullable(),
    namespace: z.string().nullable(),
    project: z.string().nullable(),
    agent: z.string().nullable(),
    model: z.string().nullable(),
    usage: z.object({ input: z.number(), output: z.number(), reasoning: z.number(), cost: z.number() }).nullable(),
    durationMs: z.number().nullable(),
    failure: z.string().nullable(),
    files: z.array(z.object({ name: z.string(), url: z.string(), size: z.number() })),
    skippedFiles: z.array(z.object({ name: z.string(), reason: z.string() })),
    transcript: z.array(OpencodeTranscriptEntry),
    sessionGone: z.boolean(),
})
export type OpencodeStepSessionView = z.infer<typeof OpencodeStepSessionView>

export const ListOpencodeStepSessionsQuery = z.object({
    flowRunId: z.string().optional(),
    flowVersionId: z.string().optional(),
    stepName: z.string(),
})
export type ListOpencodeStepSessionsQuery = z.infer<typeof ListOpencodeStepSessionsQuery>

export const OpencodeChannelMode = z.enum(['FINISH_RULE', 'OPEN'])
export type OpencodeChannelMode = z.infer<typeof OpencodeChannelMode>

export const OpencodeChannelStatus = z.enum(['OPEN', 'CLOSED'])
export type OpencodeChannelStatus = z.infer<typeof OpencodeChannelStatus>

export const OpencodeChannelParticipantView = z.object({
    key: z.string(),
    namespace: z.string(),
    project: z.string(),
    projectName: z.string(),
    agent: z.string(),
    sessionId: z.string().nullable(),
    adminPanelUrl: z.string().nullable(),
})
export type OpencodeChannelParticipantView = z.infer<typeof OpencodeChannelParticipantView>

export const OpencodeChannelMessageView = z.object({
    id: z.string(),
    from: z.string(),
    to: z.string(),
    text: z.string(),
    at: z.string(),
    status: z.string(),
})
export type OpencodeChannelMessageView = z.infer<typeof OpencodeChannelMessageView>

export const OpencodeChannelView = z.object({
    id: z.string(),
    stepName: z.string().nullable(),
    correlationId: z.string(),
    mode: OpencodeChannelMode,
    status: OpencodeChannelStatus,
    finishedBy: z.string().nullable(),
    created: z.string(),
    closedAt: z.string().nullable(),
    participants: z.array(OpencodeChannelParticipantView),
    messages: z.array(OpencodeChannelMessageView),
    error: z.string().optional(),
})
export type OpencodeChannelView = z.infer<typeof OpencodeChannelView>

export const ListOpencodeChannelsQuery = z.object({
    flowRunId: z.string().optional(),
    flowVersionId: z.string().optional(),
    stepName: z.string(),
})
export type ListOpencodeChannelsQuery = z.infer<typeof ListOpencodeChannelsQuery>

export const OpencodeServerOverview = z.object({
    allowed: z.array(OpencodeCatalogNamespace),
    providers: z.array(OpencodeProviderView),
    error: z.string().optional(),
})
export type OpencodeServerOverview = z.infer<typeof OpencodeServerOverview>

export const OpencodeAskEvent = z.object({
    askId: z.string(),
    flowId: z.string(),
    flowRunId: z.string(),
    flowVersionId: z.string().nullable(),
    stepName: z.string(),
    kind: z.enum(OpencodeAskKind),
    state: z.enum(['opened', 'closed']),
    title: z.string(),
})
export type OpencodeAskEvent = z.infer<typeof OpencodeAskEvent>

