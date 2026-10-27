import { isNil, tryCatch } from '@activepieces/core-utils'
import { OpencodeAccess, OpencodeAgentCardResult, OpencodeMcpServerView, OpencodeMemoryLevelView, OpencodeProjectSessionView, OpencodeProjectViewResult, OpencodeProviderView, OpencodeServerOverview, OpencodeStepSessionView, OpencodeTranscriptEntry } from '@activepieces/shared'
import { ConfigProvidersResponse, McpStatus, OpencodeClient, OperatorCapability, OperatorMemoryLevel, OperatorPermissionRow, Part, Session } from '@opencode-ai/sdk/v2/client'
import { FastifyBaseLogger } from 'fastify'
import { z } from 'zod'
import { repoFactory } from '../core/db/repo-factory'
import { opencodeAllowlist } from './opencode-allowlist'
import { opencodeConnectionService } from './opencode-connection.service'
import { opencodeErrors } from './opencode-errors'
import { opencodeLinks } from './opencode-links'
import { opencodeOptionsService } from './opencode-options.service'
import { OpencodeReplyMessage } from './opencode-reply'
import { OpencodeStepEntity, OpencodeStepRow } from './opencode-step.entity'

const stepRepo = repoFactory(OpencodeStepEntity)

export const opencodeViews = (log: FastifyBaseLogger) => ({
    async agentCard({ platformId, projectId, name, namespace, project }: AgentCardParams): Promise<OpencodeAgentCardResult> {
        const located = await opencodeOptionsService(log).locate({ platformId, projectId, namespace, project })
        if (located.kind !== 'found') {
            return { card: null, ...(located.kind === 'error' ? { error: located.error } : {}) }
        }
        const { directory, adminPanelUrl } = located
        const client = await opencodeConnectionService(log).client({ platformId })
        const { data: agents, error: listError } = await tryCatch(() => client.operator.agent.list({ directory }, { throwOnError: true }))
        if (isNil(agents)) {
            return { card: null, error: opencodeErrors.describe({ error: listError }) }
        }
        const agent = agents.data.find((candidate) => candidate.name === name)
        if (isNil(agent)) {
            return { card: null, error: `OpenCode has no agent ${name} in ${located.namespace}/${located.project}.` }
        }
        const { data, error } = await tryCatch(() => Promise.all([
            client.operator.toolPrompt.get({ name, directory }, { throwOnError: true }),
            client.operator.capability.list({ directory }, { throwOnError: true }),
            client.operator.memory.levels({ directory, agent: name }, { throwOnError: true }),
            client.operator.hook.list({ directory, agent: name }, { throwOnError: true }),
            client.mcp.status({ directory }, { throwOnError: true }),
        ]))
        if (isNil(data)) {
            return { card: null, error: opencodeErrors.describe({ error }) }
        }
        const [toolPrompt, capabilities, memory, hooks, mcp] = data
        const rows = toolPrompt.data.rows
        return {
            card: {
                name,
                ...(isNil(agent.description) ? {} : { description: agent.description }),
                mode: agent.mode,
                model: nonEmpty({ value: agent.modelSource?.model }),
                modelFrom: agent.modelSource?.how ?? agent.modelSource?.source ?? null,
                steps: agent.steps ?? null,
                tools: toolPrompt.data.sent.map((tool) => ({ name: tool.name, source: tool.source.kind === 'mcp' && !isNil(tool.source.server) ? `mcp:${tool.source.server}` : tool.source.kind })),
                hiddenTools: toolPrompt.data.notSent.map((tool) => ({ name: tool.name, reason: tool.reason })),
                skills: capabilities.data.items.filter((item) => item.kind === 'skill').map((item) => ({
                    ...namedItem({ item }),
                    access: accessOf({ rows, permission: SKILL_PERMISSION, pattern: item.name }),
                })),
                subagents: agents.data
                    .filter((candidate) => candidate.name !== name && SUBAGENT_MODES.includes(candidate.mode) && !candidate.disabled && candidate.hidden !== true)
                    .map((candidate) => ({
                        name: candidate.name,
                        ...(isNil(candidate.description) ? {} : { description: candidate.description }),
                        access: accessOf({ rows, permission: TASK_PERMISSION, pattern: candidate.name }),
                    })),
                mcpServers: mcpServersOf({ items: capabilities.data.items, status: mcp.data }),
                memory: memoryOf({ levels: memory.data.levels }),
                permissions: rows.map((row) => ({ permission: row.permission, pattern: row.pattern, action: row.action, level: row.level ?? row.part })),
                hooks: hooks.data.hooks.map((hook) => ({
                    name: hook.name,
                    event: hook.event,
                    level: hook.level,
                    state: hook.state,
                    ...(isNil(hook.description) ? {} : { description: hook.description }),
                })),
                links: {
                    agent: opencodeLinks.agent({ adminPanelUrl, directory, name }),
                    tools: opencodeLinks.agent({ adminPanelUrl, directory, name, tab: 'tools' }),
                    permissions: opencodeLinks.agent({ adminPanelUrl, directory, name, tab: 'permissions' }),
                    hooks: opencodeLinks.agent({ adminPanelUrl, directory, name, tab: 'hooks' }),
                    memory: opencodeLinks.memory({ adminPanelUrl, directory, name }),
                },
            },
        }
    },

    async projectView({ platformId, projectId, namespace, project }: ProjectViewParams): Promise<OpencodeProjectViewResult> {
        const located = await opencodeOptionsService(log).locate({ platformId, projectId, namespace, project })
        if (located.kind !== 'found') {
            return { view: null, ...(located.kind === 'error' ? { error: located.error } : {}) }
        }
        const { directory, adminPanelUrl } = located
        const client = await opencodeConnectionService(log).client({ platformId })
        const { data, error } = await tryCatch(() => Promise.all([
            client.operator.agent.list({ directory }, { throwOnError: true }),
            client.operator.capability.list({ directory }, { throwOnError: true }),
            client.mcp.status({ directory }, { throwOnError: true }),
            client.operator.memory.levels({ directory }, { throwOnError: true }),
            client.operator.model.defaults({ directory }, { throwOnError: true }),
            client.config.providers({ directory }, { throwOnError: true }),
            client.session.list({ directory, roots: true, limit: SESSION_SCAN_LIMIT }, { throwOnError: true }),
        ]))
        if (isNil(data)) {
            return { view: null, error: opencodeErrors.describe({ error }) }
        }
        const [agents, capabilities, mcp, memory, defaults, providers, sessions] = data
        const items = capabilities.data.items
        return {
            view: {
                namespace: located.namespace,
                project: located.project,
                name: located.name,
                folder: directory,
                agents: agents.data.filter((agent) => agent.hidden !== true).map((agent) => ({
                    name: agent.name,
                    mode: agent.mode,
                    origin: agent.level.kind,
                    ...(isNil(agent.description) ? {} : { description: agent.description }),
                })),
                tools: itemsOf({ items, kind: 'tool' }),
                skills: itemsOf({ items, kind: 'skill' }),
                commands: itemsOf({ items, kind: 'command' }),
                mcpServers: mcpServersOf({ items, status: mcp.data }),
                memory: memoryOf({ levels: memory.data.levels.filter((level) => level.level !== AGENT_LEVEL) }),
                defaultModel: nonEmpty({ value: defaults.data.model.model }),
                defaultModelFrom: defaults.data.model.how ?? defaults.data.model.source,
                providers: providersOf({ listed: providers.data }),
                sessions: sessionsOf({ sessions: sessions.data, projectId, adminPanelUrl }),
                links: {
                    agents: opencodeLinks.page({ adminPanelUrl, path: `/operator/agents?${new URLSearchParams({ dir: directory }).toString()}` }),
                    capabilities: opencodeLinks.page({ adminPanelUrl, path: '/operator/capabilities' }),
                    memory: opencodeLinks.memory({ adminPanelUrl, directory }),
                    models: opencodeLinks.page({ adminPanelUrl, path: '/operator/models' }),
                    sessions: opencodeLinks.page({ adminPanelUrl, path: '/operator/sessions' }),
                },
            },
        }
    },

    async stepSessions({ platformId, projectId, flowRunId, flowVersionId, stepName }: StepSessionsParams): Promise<OpencodeStepSessionView[]> {
        if (isNil(flowRunId) && isNil(flowVersionId)) {
            return []
        }
        const rows = await stepRepo().find({
            where: { projectId, ...(isNil(flowRunId) ? { flowVersionId } : { flowRunId }) },
            order: { created: 'DESC' },
            take: STEP_SCAN_LIMIT,
        })
        const matching = rows.filter((row) => !isNil(row.stepName) && (row.stepName === stepName || row.stepName.endsWith(`/${stepName}`))).slice(0, MAX_STEP_SESSIONS)
        if (matching.length === 0) {
            return []
        }
        const connection = await opencodeConnectionService(log).getOrCreate({ platformId })
        const client = await opencodeConnectionService(log).client({ platformId })
        return Promise.all(matching.map((step) => stepView({ step, stepName, client, adminPanelUrl: connection.adminPanelUrl, log })))
    },

    async providers({ platformId, projectId, namespace, project }: ProjectViewParams): Promise<OpencodeProviderList> {
        const located = await opencodeOptionsService(log).locate({ platformId, projectId, namespace, project })
        if (located.kind !== 'found') {
            return { providers: [], ...(located.kind === 'error' ? { error: located.error } : {}) }
        }
        const client = await opencodeConnectionService(log).client({ platformId })
        const { data: listed, error } = await tryCatch(() => client.config.providers({ directory: located.directory }, { throwOnError: true }))
        if (isNil(listed)) {
            return { providers: [], error: opencodeErrors.describe({ error }) }
        }
        return { providers: providersOf({ listed: listed.data }) }
    },

    async serverOverview({ platformId }: { platformId: string }): Promise<OpencodeServerOverview> {
        const connection = await opencodeConnectionService(log).getOrCreate({ platformId })
        const catalog = await opencodeConnectionService(log).catalog({ platformId })
        const allowed = opencodeAllowlist.filterCatalog({ allowlist: connection.allowlist, catalog }).namespaces
        const client = await opencodeConnectionService(log).client({ platformId })
        const { data: listed, error } = await tryCatch(() => client.config.providers({}, { throwOnError: true }))
        const failure = catalog.error ?? (isNil(listed) ? opencodeErrors.describe({ error }) : undefined)
        return {
            allowed,
            providers: isNil(listed) ? [] : providersOf({ listed: listed.data }),
            ...(isNil(failure) ? {} : { error: failure }),
        }
    },
})

async function stepView({ step, stepName, client, adminPanelUrl, log }: StepViewParams): Promise<OpencodeStepSessionView> {
    const base: OpencodeStepSessionView = {
        stepId: step.id,
        stepName,
        action: step.action,
        status: step.status,
        created: step.created,
        sessionId: step.sessionId,
        adminPanelUrl: isNil(step.sessionId) || isNil(step.directory) ? null : opencodeLinks.session({ adminPanelUrl, directory: step.directory, sessionId: step.sessionId }),
        namespace: step.namespace,
        project: step.opencodeProjectId,
        agent: step.agent,
        model: isNil(step.model) ? null : `${step.model.providerID}/${step.model.modelID}`,
        usage: null,
        durationMs: durationOf({ step }),
        failure: step.failure,
        files: step.files?.files ?? [],
        skippedFiles: step.files?.skippedFiles ?? [],
        transcript: [],
        sessionGone: false,
    }
    if (isNil(step.sessionId) || isNil(step.directory)) {
        return base
    }
    const result = await client.session.messages({ sessionID: step.sessionId, directory: step.directory })
    if (isNil(result.data)) {
        if (result.response?.status === NOT_FOUND) {
            return { ...base, sessionGone: true }
        }
        log.warn({ opencodeStep: { id: step.id }, error: opencodeErrors.describe({ error: result.error }) }, '[opencodeViews] Could not read the step\'s session')
        return base
    }
    const replies = result.data
        .filter((message): message is OpencodeReplyMessage => message.info.role === 'assistant' && message.info.parentID === step.messageId)
        .sort((left, right) => left.info.id.localeCompare(right.info.id))
    const last = replies[replies.length - 1]
    return {
        ...base,
        model: isNil(last) ? base.model : `${last.info.providerID}/${last.info.modelID}`,
        usage: replies.length === 0 ? null : replies.reduce((total, { info }) => ({
            input: total.input + info.tokens.input,
            output: total.output + info.tokens.output,
            reasoning: total.reasoning + info.tokens.reasoning,
            cost: total.cost + info.cost,
        }), { input: 0, output: 0, reasoning: 0, cost: 0 }),
        transcript: replies.flatMap(({ parts }) => parts.flatMap((part) => entriesOf({ part, adminPanelUrl, directory: step.directory ?? '' }))),
    }
}

function entriesOf({ part, adminPanelUrl, directory }: { part: Part, adminPanelUrl: string, directory: string }): OpencodeTranscriptEntry[] {
    if (part.type === 'text') {
        const text = part.synthetic === true || part.ignored === true ? '' : part.text.trim()
        return text.length === 0 ? [] : [{ type: 'text', text }]
    }
    if (part.type !== 'tool' || part.tool === STRUCTURED_OUTPUT_TOOL) {
        return []
    }
    const subagent = SubagentMetadata.safeParse('metadata' in part.state ? part.state.metadata : undefined)
    return [{
        type: 'tool',
        tool: part.tool,
        status: part.state.status,
        input: part.state.input,
        ...(part.state.status === 'completed' ? { output: clip({ text: part.state.output }) } : {}),
        ...(part.state.status === 'error' ? { error: clip({ text: part.state.error }) } : {}),
        ...(subagent.success ? { subagentUrl: opencodeLinks.session({ adminPanelUrl, directory, sessionId: subagent.data.sessionId }) } : {}),
    }]
}

function accessOf({ rows, permission, pattern }: { rows: OperatorPermissionRow[], permission: string, pattern: string }): OpencodeAccess {
    const matching = rows.filter((row) => wildcardMatch({ input: permission, pattern: row.permission }) && wildcardMatch({ input: pattern, pattern: row.pattern }))
    return matching[matching.length - 1]?.action ?? 'ask'
}

function wildcardMatch({ input, pattern }: { input: string, pattern: string }): boolean {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')
    const tail = escaped.endsWith(' .*') ? `${escaped.slice(0, -3)}( .*)?` : escaped
    return new RegExp(`^${tail}$`, 's').test(input)
}

function namedItem({ item }: { item: OperatorCapability }): { name: string, description?: string, origin: string } {
    return { name: item.name, origin: item.origin, ...(isNil(item.description) ? {} : { description: item.description }) }
}

function itemsOf({ items, kind }: { items: OperatorCapability[], kind: OperatorCapability['kind'] }): { name: string, description?: string, origin: string }[] {
    return items.filter((item) => item.kind === kind && item.state !== DISABLED).map((item) => namedItem({ item }))
}

function mcpServersOf({ items, status }: { items: OperatorCapability[], status: Record<string, McpStatus> }): OpencodeMcpServerView[] {
    const names = [...new Set([...items.filter((item) => item.kind === 'mcp').map((item) => item.name), ...Object.keys(status)])]
        .filter((name) => !name.startsWith(STEP_SERVER_PREFIX))
        .sort()
    return names.map((name) => {
        const current = status[name]
        if (isNil(current)) {
            return { name, status: NOT_LOADED }
        }
        return { name, status: current.status, ...('error' in current ? { error: current.error } : {}) }
    })
}

function memoryOf({ levels }: { levels: OperatorMemoryLevel[] }): OpencodeMemoryLevelView[] {
    return levels.map((level) => ({
        level: level.level,
        folder: level.folder,
        entries: level.entries.map((entry) => ({ title: entry.title, description: entry.description })),
    }))
}

function providersOf({ listed }: { listed: ConfigProvidersResponse }): OpencodeProviderView[] {
    return listed.providers
        .map((provider) => ({
            id: provider.id,
            name: provider.name,
            defaultModel: listed.default[provider.id] ?? null,
            models: Object.values(provider.models).map((model) => ({ id: model.id, name: model.name })).sort((left, right) => left.name.localeCompare(right.name)),
        }))
        .sort((left, right) => left.name.localeCompare(right.name))
}

function sessionsOf({ sessions, projectId, adminPanelUrl }: { sessions: Session[], projectId: string, adminPanelUrl: string }): OpencodeProjectSessionView[] {
    return sessions
        .flatMap((session) => {
            const metadata = SessionMetadata.safeParse(session.metadata)
            if (!metadata.success || metadata.data.projectId !== projectId) {
                return []
            }
            return [{
                id: session.id,
                title: session.title,
                agent: session.agent ?? null,
                model: isNil(session.model) ? null : `${session.model.providerID}/${session.model.id}`,
                cost: session.cost ?? 0,
                created: new Date(session.time.created).toISOString(),
                updated: new Date(session.time.updated).toISOString(),
                flowId: metadata.data.flowId ?? null,
                flowRunId: metadata.data.flowRunId ?? null,
                stepName: metadata.data.stepName ?? null,
                adminPanelUrl: opencodeLinks.session({ adminPanelUrl, directory: session.directory, sessionId: session.id }),
            }]
        })
        .sort((left, right) => right.updated.localeCompare(left.updated))
        .slice(0, MAX_PROJECT_SESSIONS)
}

function durationOf({ step }: { step: OpencodeStepRow }): number | null {
    if (isNil(step.dispatchedAt) || isNil(step.completedAt)) {
        return null
    }
    return new Date(step.completedAt).getTime() - new Date(step.dispatchedAt).getTime()
}

function nonEmpty({ value }: { value: string | undefined }): string | null {
    return isNil(value) || value.length === 0 ? null : value
}

function clip({ text }: { text: string }): string {
    return text.length > MAX_TOOL_TEXT ? `${text.slice(0, MAX_TOOL_TEXT)}…` : text
}

const SKILL_PERMISSION = 'skill'

const TASK_PERMISSION = 'task'

const SUBAGENT_MODES = ['subagent', 'all']

const AGENT_LEVEL = 'agent'

const DISABLED = 'disabled'

const NOT_LOADED = 'not loaded'

const STEP_SERVER_PREFIX = 'iphiflow_'

const STRUCTURED_OUTPUT_TOOL = 'StructuredOutput'

const NOT_FOUND = 404

const SESSION_SCAN_LIMIT = 200

const MAX_PROJECT_SESSIONS = 20

const STEP_SCAN_LIMIT = 50

const MAX_STEP_SESSIONS = 5

const MAX_TOOL_TEXT = 4000

const SessionMetadata = z.object({
    source: z.literal('iphi-flow'),
    projectId: z.string(),
    flowId: z.string().optional(),
    flowRunId: z.string().optional(),
    stepName: z.string().optional(),
})

const SubagentMetadata = z.object({ sessionId: z.string() })

export const OpencodeProviderList = z.object({
    providers: z.array(OpencodeProviderView),
    error: z.string().optional(),
})
export type OpencodeProviderList = z.infer<typeof OpencodeProviderList>

type AgentCardParams = {
    platformId: string
    projectId: string
    name: string
    namespace?: string
    project?: string
}

type ProjectViewParams = {
    platformId: string
    projectId: string
    namespace?: string
    project?: string
}

type StepSessionsParams = {
    platformId: string
    projectId: string
    flowRunId?: string
    flowVersionId?: string
    stepName: string
}

type StepViewParams = {
    step: OpencodeStepRow
    stepName: string
    client: OpencodeClient
    adminPanelUrl: string
    log: FastifyBaseLogger
}
