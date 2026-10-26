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

