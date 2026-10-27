import { apId, isNil, tryCatch } from '@activepieces/core-utils'
import { isFlowRunStateTerminal, OpencodeChannelMessageView, OpencodeChannelView } from '@activepieces/shared'
import { OpencodeClient, OperatorInboxRule, OperatorMessage, Part } from '@opencode-ai/sdk/v2/client'
import { FastifyBaseLogger } from 'fastify'
import { z } from 'zod'
import { repoFactory } from '../core/db/repo-factory'
import { flowRunService } from '../flows/flow-run/flow-run-service'
import { opencodeChannelText } from './opencode-channel-text'
import { OpencodeChannelEntity, OpencodeChannelParticipant, OpencodeChannelRow, OpencodeChannelRule } from './opencode-channel.entity'
import { opencodeConnectionService } from './opencode-connection.service'
import { opencodeErrors, OpencodeRequestError } from './opencode-errors'
import { opencodeIds } from './opencode-ids'
import { opencodeInboxRules } from './opencode-inbox-rules'
import { opencodeLinks } from './opencode-links'
import { opencodeMcpBridge } from './opencode-mcp-bridge'
import { opencodeMcpNames, OpencodePermissionLine } from './opencode-mcp-names'
import { OpencodeMcpTool } from './opencode-mcp-tools'
import { opencodeOptionsService } from './opencode-options.service'
import { OPENCODE_CHANNEL_LIMITS, OPENCODE_CHANNEL_START_ALL, OpencodeChannelRequest, opencodePieceSteps } from './opencode-piece-steps'
import { opencodeReply } from './opencode-reply'
import { OpencodeStepEntity, OpencodeStepRow } from './opencode-step.entity'

const channelRepo = repoFactory(OpencodeChannelEntity)
const stepRepo = repoFactory(OpencodeStepEntity)

export const opencodeChannels = (log: FastifyBaseLogger) => ({
    async open({ origin, request, flowName, opencodeStepId }: OpenParams): Promise<OpencodeChannelRow> {
        const existing = isNil(opencodeStepId) ? null : await channelRepo().findOneBy({ opencodeStepId, projectId: origin.projectId })
        const channel = existing ?? await createChannel({ origin, request, opencodeStepId, log })
        const client = await opencodeConnectionService(log).client({ platformId: channel.platformId })
        const withSessions = await createSessions({ channel, flowName, client })
        const withRules = await installRules({ channel: withSessions, client, log })
        const doneBy = doneByOf({ channel: withRules })
        if (!isNil(doneBy) && !isNil(withRules.opencodeStepId)) {
            await opencodeMcpBridge(log).attachChannel({ step: { id: withRules.opencodeStepId, platformId: withRules.platformId, projectId: withRules.projectId }, client, directory: doneBy.directory })
        }
        await sendBriefs({ channel: withRules, flowName, client })
        log.info({ flowRun: { id: withRules.flowRunId }, opencodeChannel: { id: withRules.id, participants: withRules.participants.length, mode: withRules.mode } }, '[opencodeChannels] Opened an agent channel')
        return withRules
    },

    async dispatch({ step, request, flowName }: DispatchParams): Promise<void> {
        const channel = await this.open({ origin: originOf({ step }), request, flowName, opencodeStepId: step.id })
        await stepRepo().update({ id: step.id }, { status: 'DISPATCHED', dispatchedAt: new Date().toISOString(), namespace: channel.namespace })
    },

    async check({ step }: { step: OpencodeStepRow }): Promise<ChannelCheck> {
        const channel = await channelRepo().findOneBy({ opencodeStepId: step.id, projectId: step.projectId })
        if (isNil(channel)) {
            return { kind: 'pending' }
        }
        if (channel.status === 'CLOSED') {
            return isNil(channel.output) ? { kind: 'failed', failure: `The agent channel closed: ${channel.finishedBy ?? 'no reason'}.` } : { kind: 'done', output: channel.output }
        }
        const client = await opencodeConnectionService(log).client({ platformId: channel.platformId })
        const messages = await conversationOf({ client, correlationId: channel.correlationId })
        const finishedBy = finishedByOf({ channel, count: messages.length })
        if (isNil(finishedBy)) {
            return { kind: 'pending' }
        }
        const output = await outputOf({ channel, client, messages, finishedBy })
        await this.close({ channel, finishedBy, output })
        return { kind: 'done', output }
    },

    async close({ channel: stale, finishedBy, output }: CloseParams): Promise<void> {
        const claimed = await channelRepo().createQueryBuilder()
            .update()
            .set({ status: 'CLOSED', finishedBy, closedAt: new Date().toISOString() })
            .where('id = :id AND status = :status', { id: stale.id, status: 'OPEN' })
            .returning(['id'])
            .execute()
        if (!Array.isArray(claimed.raw) || claimed.raw.length === 0) {
            return
        }
        const channel = await channelRepo().findOneByOrFail({ id: stale.id })
        await channelRepo().save({ ...channel, output })
        const client = await opencodeConnectionService(log).client({ platformId: channel.platformId })
        for (const participant of channel.participants) {
            const sessionId = participant.sessionId
            if (isNil(sessionId)) {
                continue
            }
            const { error } = await tryCatch(async () => {
                await client.session.abort({ sessionID: sessionId, directory: participant.directory })
                await replacePingLines({ client, sessionId, directory: participant.directory, lines: opencodeChannelText.pingLines({ directory: participant.directory, others: [] }) })
            })
            if (!isNil(error)) {
                log.warn({ opencodeChannel: { id: channel.id }, error }, '[opencodeChannels] Could not stop a participant session')
            }
        }
        await removeRules({ channel, rules: channel.rules, client, log })
        const doneBy = doneByOf({ channel })
        if (!isNil(doneBy) && !isNil(channel.opencodeStepId)) {
            await opencodeMcpBridge(log).detachChannel({ step: { id: channel.opencodeStepId, platformId: channel.platformId, projectId: channel.projectId }, client, directory: doneBy.directory })
        }
        log.info({ opencodeChannel: { id: channel.id, finishedBy } }, '[opencodeChannels] Closed an agent channel')
    },

    async closeForStep({ stepId, finishedBy }: { stepId: string, finishedBy: string }): Promise<void> {
        const channel = await channelRepo().findOneBy({ opencodeStepId: stepId, status: 'OPEN' })
        if (!isNil(channel)) {
            await this.close({ channel, finishedBy, output: null })
        }
    },

    async closeEnded(): Promise<number> {
        const open = await channelRepo().find({ where: { status: 'OPEN' }, order: { created: 'ASC' }, take: SWEEP_LIMIT })
        const ended = await Promise.all(open.map(async (channel) => {
            const flowRun = await flowRunService(log).getOne({ id: channel.flowRunId, projectId: channel.projectId })
            return isNil(flowRun) || isFlowRunStateTerminal({ status: flowRun.status, ignoreInternalError: false }) ? channel : null
        }))
        const closing = ended.flatMap((channel) => isNil(channel) ? [] : [channel])
        for (const channel of closing) {
            const { error } = await tryCatch(() => this.close({ channel, finishedBy: RUN_ENDED, output: null }))
            if (!isNil(error)) {
                log.warn({ opencodeChannel: { id: channel.id }, error }, '[opencodeChannels] Could not close the channel of an ended run')
            }
        }
        return closing.length
    },

    async stepsWaitingOn({ platformId, sessionId }: { platformId: string, sessionId: string }): Promise<string[]> {
        const open = await waitingChannels({ platformId })
        return open
            .filter((channel) => channel.participants.some((participant) => participant.sessionId === sessionId))
            .flatMap((channel) => isNil(channel.opencodeStepId) ? [] : [channel.opencodeStepId])
    },

    async participantSession({ platformId, sessionId }: { platformId: string, sessionId: string }): Promise<ParticipantSession | null> {
        const open = await waitingChannels({ platformId })
        const found = open.flatMap((channel) => {
            const participant = channel.participants.find((candidate) => candidate.sessionId === sessionId)
            return isNil(participant) || isNil(channel.opencodeStepId) ? [] : [{ opencodeStepId: channel.opencodeStepId, directory: participant.directory, agent: participant.agent }]
        })
        return found[0] ?? null
    },

    async waitingDirectories({ platformId }: { platformId: string }): Promise<string[]> {
        const open = await waitingChannels({ platformId })
        return [...new Set(open.flatMap((channel) => channel.participants.map((participant) => participant.directory)))]
    },

    async join({ step, reference, client }: JoinParams): Promise<void> {
        const channel = await openChannelOf({ step, reference })
        if (isNil(channel)) {
            throw new Error(opencodeErrors.channelNotOpen({ channel: reference.value }))
        }
        if (channel.namespace !== step.namespace) {
            throw new Error(opencodeErrors.channelAcrossNamespaces())
        }
        if (channel.joins.some((joined) => joined.stepId === step.id) || isNil(step.sessionId) || isNil(step.directory)) {
            return
        }
        const sessionId = step.sessionId
        const directory = step.directory
        const correlationId = `${JOIN_PREFIX}${channel.id}_${step.id}`
        await replacePingLines({ client, sessionId, directory, lines: opencodeChannelText.pingLines({ directory, others: channel.participants }) })
        const reachable = channel.participants.filter((participant) => participant.directory !== directory)
        const rules = await addRules({
            channel,
            client,
            log,
            entries: reachable.map((participant) => ({ participant, ruleId: `iphiflow-jn-${channel.id}-${step.id}-${channel.participants.indexOf(participant)}`, correlationPrefix: correlationId, name: `iphi-flow channel ${channel.stepName ?? channel.id}: step ${step.stepName ?? step.id} to ${participant.agent}` })),
        })
        const messageId = opencodeIds.message()
        const sent = await client.session.promptAsync({
            sessionID: sessionId,
            directory,
            messageID: messageId,
            ...(isNil(step.agent) ? {} : { agent: step.agent }),
            noReply: true,
            parts: [{ type: 'text', text: opencodeChannelText.joinNote({ channel, correlationId, directory }) }],
        })
        if (!isNil(sent.error)) {
            throw new OpencodeRequestError({ status: sent.response?.status, message: opencodeErrors.describe({ error: sent.error }) })
        }
        await channelRepo().update({ id: channel.id }, {
            rules: [...channel.rules, ...rules],
            joins: [...channel.joins, { stepId: step.id, correlationId, sessionId, directory, agent: step.agent ?? '', messageId }],
        })
        log.info({ opencodeChannel: { id: channel.id }, opencodeStep: { id: step.id } }, '[opencodeChannels] A step joined an agent channel')
    },

    finishTool({ stepId }: { stepId: string }): OpencodeMcpTool {
        return {
            key: FINISH_TOOL,
            description: 'Ends this agent channel and hands its result to the flow. Call it once, when the work of the channel is finished.',
            inputSchema: z.object({ result: z.string().describe('The result of the channel\'s work: plain text, or JSON written as text') }),
            run: async (args) => {
                const parsed = FinishArgs.safeParse(args)
                if (!parsed.success) {
                    return { content: [{ type: 'text', text: 'Give the result as text in "result".' }], isError: true }
                }
                const open = await channelRepo().findOneBy({ opencodeStepId: stepId, status: 'OPEN' })
                if (isNil(open)) {
                    return { content: [{ type: 'text', text: 'This channel is already closed.' }], isError: true }
                }
                await channelRepo().save({ ...open, result: { value: resultValueOf({ text: parsed.data.result }) } })
                log.info({ opencodeStep: { id: stepId } }, '[opencodeChannels] The done agent finished its channel')
                return { content: [{ type: 'text', text: 'The channel is finished and its result went to the flow. Stop here.' }] }
            },
        }
    },

    openOutputOf({ channel, adminPanelUrl }: { channel: OpencodeChannelRow, adminPanelUrl: string }): Record<string, unknown> {
        return {
            correlationId: channel.correlationId,
            participants: channel.participants.map((participant) => ({
                key: labelOf({ participant }),
                namespace: participant.namespace,
                project: participant.project,
                agent: participant.agent,
                sessionId: participant.sessionId,
                adminPanelUrl: isNil(participant.sessionId) ? null : opencodeLinks.session({ adminPanelUrl, directory: participant.directory, sessionId: participant.sessionId }),
            })),
        }
    },

    async views({ projectId, flowRunId, flowVersionId, stepName }: ViewsParams): Promise<OpencodeChannelView[]> {
        if (isNil(flowRunId) && isNil(flowVersionId)) {
            return []
        }
        const channels = await channelRepo().find({
            where: { projectId, stepName, ...(isNil(flowRunId) ? { flowVersionId } : { flowRunId }) },
            order: { created: 'DESC' },
            take: MAX_VIEWS,
        })
        if (channels.length === 0) {
            return []
        }
        const connection = await opencodeConnectionService(log).getOrCreate({ platformId: channels[0].platformId })
        const client = await opencodeConnectionService(log).client({ platformId: channels[0].platformId })
        return Promise.all(channels.map((channel) => viewOf({ channel, client, adminPanelUrl: connection.adminPanelUrl })))
    },
})

async function waitingChannels({ platformId }: { platformId: string }): Promise<OpencodeChannelRow[]> {
    return channelRepo().find({ where: { platformId, status: 'OPEN', mode: 'FINISH_RULE' }, take: SWEEP_LIMIT })
}

async function createChannel({ origin, request, opencodeStepId, log }: CreateChannelParams): Promise<OpencodeChannelRow> {
    const keys = request.participants.map((participant) => opencodePieceSteps.participantKey(participant))
    const repeated = keys.find((key, index) => keys.indexOf(key) !== index)
    if (!isNil(repeated)) {
        throw new Error(`${repeated} is in the channel twice. Pick each agent once.`)
    }
    if (new Set(request.participants.map((participant) => participant.namespace)).size > 1) {
        throw new Error(opencodeErrors.channelAcrossNamespaces())
    }
    const startWith = request.startWith ?? OPENCODE_CHANNEL_START_ALL
    if (startWith !== OPENCODE_CHANNEL_START_ALL && !keys.includes(startWith)) {
        throw new Error(`"Start with" names ${startWith}, which is not a participant.`)
    }
    if (!isNil(request.doneBy) && !keys.includes(request.doneBy)) {
        throw new Error(`"Done when" names ${request.doneBy}, which is not a participant.`)
    }
    const kickoff = request.kickoff?.trim() ?? ''
    if (request.waitFor === 'FINISH_RULE' && kickoff.length === 0) {
        throw new Error('Write the kickoff message: with a finish rule, it is what starts the conversation.')
    }
    const located = await Promise.all(request.participants.map(async (participant) => {
        const found = await opencodeOptionsService(log).locate({ platformId: origin.platformId, projectId: origin.projectId, namespace: participant.namespace, project: participant.project })
        if (found.kind === 'error') {
            throw new Error(found.error)
        }
        if (found.kind === 'none') {
            throw new Error(`OpenCode has no project ${participant.namespace}/${participant.project}.`)
        }
        return { participant, found }
    }))
    const id = apId()
    const draft: OpencodeChannelRow = {
        id,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        ...origin,
        opencodeStepId,
        correlationId: `${CHANNEL_PREFIX}${id}`,
        namespace: request.participants[0].namespace,
        mode: request.waitFor,
        participants: located.map(({ participant, found }) => {
            const key = opencodePieceSteps.participantKey(participant)
            return {
                key,
                namespace: participant.namespace,
                project: participant.project,
                projectName: found.name,
                directory: found.directory,
                agent: participant.agent,
                sessionId: null,
                messageId: opencodeIds.message(),
                starts: request.waitFor === 'FINISH_RULE' && (startWith === OPENCODE_CHANNEL_START_ALL || startWith === key),
            }
        }),
        rules: [],
        joins: [],
        finish: request.waitFor === 'FINISH_RULE'
            ? {
                kickoff,
                doneBy: request.doneBy ?? null,
                maxMessages: request.maxMessages ?? OPENCODE_CHANNEL_LIMITS.DEFAULT_MAX_MESSAGES,
                timeoutMinutes: request.timeoutMinutes ?? OPENCODE_CHANNEL_LIMITS.DEFAULT_TIMEOUT_MINUTES,
            }
            : null,
        status: 'OPEN',
        finishedBy: null,
        result: null,
        output: null,
        closedAt: null,
    }
    const { data: saved } = await tryCatch(() => channelRepo().save(draft))
    if (!isNil(saved) || isNil(opencodeStepId)) {
        return channelRepo().findOneByOrFail({ id })
    }
    return channelRepo().findOneByOrFail({ opencodeStepId, projectId: origin.projectId })
}

async function createSessions({ channel, flowName, client }: { channel: OpencodeChannelRow, flowName: string | null, client: OpencodeClient }): Promise<OpencodeChannelRow> {
    const doneBy = doneByOf({ channel })
    const participants = await Promise.all(channel.participants.map(async (participant) => {
        if (!isNil(participant.sessionId)) {
            return participant
        }
        const others = channel.participants.filter((other) => other.key !== participant.key)
        const created = await client.session.create({
            directory: participant.directory,
            title: [flowName ?? channel.flowId, `run ${channel.flowRunId}`, channel.stepName ?? 'channel', participant.agent].join(' · '),
            agent: participant.agent,
            metadata: {
                source: SESSION_SOURCE,
                platformId: channel.platformId,
                projectId: channel.projectId,
                flowId: channel.flowId,
                flowRunId: channel.flowRunId,
                ...(isNil(channel.flowVersionId) ? {} : { flowVersionId: channel.flowVersionId }),
                ...(isNil(channel.stepName) ? {} : { stepName: channel.stepName }),
                channel: channel.correlationId,
            },
            permission: [
                opencodeMcpNames.denyAllLine(),
                ...(doneBy?.key === participant.key && !isNil(channel.opencodeStepId) ? [opencodeMcpNames.allowStepLine({ stepId: channel.opencodeStepId })] : []),
                ...opencodeChannelText.pingLines({ directory: participant.directory, others }),
            ],
        })
        if (isNil(created.data)) {
            throw new OpencodeRequestError({ status: created.response?.status, message: opencodeErrors.describe({ error: created.error }) })
        }
        return { ...participant, sessionId: created.data.id }
    }))
    await channelRepo().update({ id: channel.id }, { participants })
    return { ...channel, participants }
}

async function installRules({ channel, client, log }: { channel: OpencodeChannelRow, client: OpencodeClient, log: FastifyBaseLogger }): Promise<OpencodeChannelRow> {
    const missing = channel.participants
        .map((participant, index) => ({ participant, ruleId: `iphiflow-ch-${channel.id}-${index}` }))
        .filter(({ ruleId }) => !channel.rules.some((rule) => rule.ruleId === ruleId))
    const rules = await addRules({
        channel,
        client,
        log,
        entries: missing.map(({ participant, ruleId }) => ({ participant, ruleId, correlationPrefix: channel.correlationId, name: `iphi-flow channel ${channel.stepName ?? channel.id}: to ${participant.agent}` })),
    })
    const all = [...channel.rules, ...rules]
    await channelRepo().update({ id: channel.id }, { rules: all })
    return { ...channel, rules: all }
}

async function addRules({ channel, client, log, entries }: AddRulesParams): Promise<OpencodeChannelRule[]> {
    const projects = [...new Set(entries.map(({ participant }) => participant.project))]
    const added = await Promise.all(projects.map(async (project) => {
        const here = entries.filter(({ participant }) => participant.project === project)
        const directory = here[0].participant.directory
        await opencodeInboxRules(log).addFirst({
            platformId: channel.platformId,
            client,
            project,
            directory,
            rules: here.map(({ participant, ruleId, correlationPrefix, name }): OperatorInboxRule => ({
                id: ruleId,
                name,
                enabled: true,
                match: { correlationPrefix, recipient: { type: 'agent', id: participant.agent } },
                action: { kind: 'forward', to: [{ type: 'session', id: participant.sessionId ?? '' }] },
            })),
        })
        return here.map(({ ruleId }) => ({ project, directory, ruleId }))
    }))
    return added.flat()
}

async function removeRules({ channel, rules, client, log }: { channel: OpencodeChannelRow, rules: OpencodeChannelRule[], client: OpencodeClient, log: FastifyBaseLogger }): Promise<void> {
    const projects = [...new Set(rules.map((rule) => rule.project))]
    for (const project of projects) {
        const here = rules.filter((rule) => rule.project === project)
        const { error } = await tryCatch(() => opencodeInboxRules(log).remove({ platformId: channel.platformId, client, project, directory: here[0].directory, ruleIds: here.map((rule) => rule.ruleId) }))
        if (!isNil(error)) {
            log.warn({ opencodeChannel: { id: channel.id }, project, error }, '[opencodeChannels] Could not remove a channel\'s inbox rules')
        }
    }
}

async function sendBriefs({ channel, flowName, client }: { channel: OpencodeChannelRow, flowName: string | null, client: OpencodeClient }): Promise<void> {
    const finishTool = isNil(channel.opencodeStepId) ? null : `${opencodeMcpNames.serverName({ stepId: channel.opencodeStepId })}_${FINISH_TOOL}`
    const starters = channel.participants.filter((participant) => participant.starts).map((participant) => `${participant.agent} in project ${participant.projectName}`).join(', ')
    for (const participant of channel.participants) {
        const sessionId = participant.sessionId
        if (isNil(sessionId)) {
            continue
        }
        const sent = await client.session.message({ sessionID: sessionId, messageID: participant.messageId, directory: participant.directory })
        if (!isNil(sent.data)) {
            continue
        }
        const text = opencodeChannelText.brief({ channel, self: participant, flowName, finishTool })
        const prompted = await client.session.promptAsync({
            sessionID: sessionId,
            directory: participant.directory,
            messageID: participant.messageId,
            agent: participant.agent,
            ...(participant.starts ? {} : { noReply: true }),
            parts: [{ type: 'text', text: isNil(channel.finish) ? text : opencodeChannelText.kickoff({ text, task: channel.finish.kickoff, startedBy: participant.starts ? null : starters }) }],
        })
        if (!isNil(prompted.error)) {
            throw new OpencodeRequestError({ status: prompted.response?.status, message: opencodeErrors.describe({ error: prompted.error }) })
        }
    }
}

async function replacePingLines({ client, sessionId, directory, lines }: ReplacePingLinesParams): Promise<void> {
    const current = await client.operator.sessionPermissions.get({ sessionID: sessionId, directory })
    if (isNil(current.data)) {
        throw new OpencodeRequestError({ status: current.response?.status, message: opencodeErrors.describe({ error: current.error }) })
    }
    const saved = await client.operator.sessionPermissions.save({
        sessionID: sessionId,
        directory,
        rules: [...current.data.written.filter((line) => !opencodeChannelText.isPingLine(line)), ...lines],
        deleted: current.data.deleted,
    })
    if (isNil(saved.data)) {
        throw new OpencodeRequestError({ status: saved.response?.status, message: opencodeErrors.describe({ error: saved.error }) })
    }
}

async function openChannelOf({ step, reference }: { step: OpencodeStepRow, reference: ChannelReference }): Promise<OpencodeChannelRow | null> {
    if (reference.kind === 'correlation') {
        return channelRepo().findOneBy({ platformId: step.platformId, correlationId: reference.value, status: 'OPEN' })
    }
    return channelRepo().findOne({
        where: { projectId: step.projectId, flowRunId: step.flowRunId, stepName: reference.value, status: 'OPEN' },
        order: { created: 'DESC' },
    })
}

async function conversationOf({ client, correlationId }: { client: OpencodeClient, correlationId: string }): Promise<OperatorMessage[]> {
    const result = await client.operator.conversation.get({ correlationID: correlationId })
    if (isNil(result.data)) {
        throw new OpencodeRequestError({ status: result.response?.status, message: opencodeErrors.describe({ error: result.error }) })
    }
    return result.data.messages
        .filter((message) => isNil(message.via) && message.from.kind === AGENT_SENDER)
        .sort((left, right) => left.createdAt - right.createdAt)
}

function finishedByOf({ channel, count }: { channel: OpencodeChannelRow, count: number }): string | null {
    const finish = channel.finish
    if (isNil(finish)) {
        return null
    }
    if (!isNil(channel.result)) {
        return DONE
    }
    if (count >= finish.maxMessages) {
        return MAX_MESSAGES
    }
    return Date.now() - new Date(channel.created).getTime() >= finish.timeoutMinutes * MS_PER_MINUTE ? TIMEOUT : null
}

async function outputOf({ channel, client, messages, finishedBy }: OutputParams): Promise<Record<string, unknown>> {
    const results = await Promise.all(channel.participants.map(async (participant) => [labelOf({ participant }), await lastAnswerOf({ client, participant })] as const))
    return {
        correlationId: channel.correlationId,
        messages: messages.map((message) => {
            const view = messageViewOf({ channel, message })
            return { from: view.from, to: view.to, text: view.text, at: view.at }
        }),
        results: Object.fromEntries(results),
        finishedBy,
        result: channel.result?.value ?? null,
    }
}

async function lastAnswerOf({ client, participant }: { client: OpencodeClient, participant: OpencodeChannelParticipant }): Promise<string> {
    if (isNil(participant.sessionId)) {
        return ''
    }
    const { data: messages } = await tryCatch(() => opencodeReply.messagesOf({ client, sessionId: participant.sessionId ?? '', directory: participant.directory }))
    const answers = (messages ?? [])
        .filter((message) => message.info.role === ASSISTANT)
        .map((message) => textOf({ parts: message.parts }))
        .filter((text) => text.length > 0)
    return answers[answers.length - 1] ?? ''
}

async function viewOf({ channel, client, adminPanelUrl }: { channel: OpencodeChannelRow, client: OpencodeClient, adminPanelUrl: string }): Promise<OpencodeChannelView> {
    const correlations = [channel.correlationId, ...channel.joins.map((joined) => joined.correlationId)]
    const { data: conversations, error } = await tryCatch(() => Promise.all(correlations.map((correlationId) => conversationOf({ client, correlationId }))))
    const messages = (conversations ?? []).flat().sort((left, right) => left.createdAt - right.createdAt)
    return {
        id: channel.id,
        stepName: channel.stepName,
        correlationId: channel.correlationId,
        mode: channel.mode,
        status: channel.status,
        finishedBy: channel.finishedBy,
        created: new Date(channel.created).toISOString(),
        closedAt: isNil(channel.closedAt) ? null : new Date(channel.closedAt).toISOString(),
        participants: channel.participants.map((participant) => ({
            key: participant.key,
            namespace: participant.namespace,
            project: participant.project,
            projectName: participant.projectName,
            agent: participant.agent,
            sessionId: participant.sessionId,
            adminPanelUrl: isNil(participant.sessionId) ? null : opencodeLinks.session({ adminPanelUrl, directory: participant.directory, sessionId: participant.sessionId }),
        })),
        messages: messages.map((message) => messageViewOf({ channel, message })),
        ...(isNil(error) ? {} : { error: opencodeErrors.describe({ error }) }),
    }
}

function messageViewOf({ channel, message }: { channel: OpencodeChannelRow, message: OperatorMessage }): OpencodeChannelMessageView {
    return {
        id: message.id,
        from: isNil(message.from.agent) ? message.from.kind : `${message.from.project ?? message.project}.${message.from.agent}`,
        to: recipientOf({ channel, message }),
        text: message.body.text,
        at: new Date(message.createdAt).toISOString(),
        status: message.status,
    }
}

function recipientOf({ channel, message }: { channel: OpencodeChannelRow, message: OperatorMessage }): string {
    const to = message.to
    if ((to.type === 'project-agent' || to.type === 'project-group') && !isNil(to.project) && !isNil(to.id)) {
        return `${to.project}.${to.id}`
    }
    if (to.type === 'session' && !isNil(to.id)) {
        const participant = channel.participants.find((candidate) => candidate.sessionId === to.id)
        const joined = channel.joins.find((candidate) => candidate.sessionId === to.id)
        return !isNil(participant) ? labelOf({ participant }) : !isNil(joined) ? `${message.project}.${joined.agent}` : `session ${to.id}`
    }
    if ((to.type === 'agent' || to.type === 'group') && !isNil(to.id)) {
        return `${message.project}.${to.id}`
    }
    return to.type
}

function labelOf({ participant }: { participant: OpencodeChannelParticipant }): string {
    return `${participant.project}.${participant.agent}`
}

function doneByOf({ channel }: { channel: OpencodeChannelRow }): OpencodeChannelParticipant | undefined {
    const doneBy = channel.finish?.doneBy
    return isNil(doneBy) ? undefined : channel.participants.find((participant) => participant.key === doneBy)
}

function originOf({ step }: { step: OpencodeStepRow }): ChannelOrigin {
    return {
        platformId: step.platformId,
        projectId: step.projectId,
        flowId: step.flowId,
        flowRunId: step.flowRunId,
        flowVersionId: step.flowVersionId,
        stepName: isNil(step.stepName) ? null : step.stepName.split('/').pop() ?? step.stepName,
    }
}

function textOf({ parts }: { parts: Part[] }): string {
    return parts
        .flatMap((part) => part.type === 'text' && part.synthetic !== true && part.ignored !== true ? [part.text] : [])
        .join('')
        .trim()
}

function resultValueOf({ text }: { text: string }): unknown {
    try {
        const parsed: unknown = JSON.parse(text)
        return typeof parsed === 'object' && parsed !== null ? parsed : text
    }
    catch {
        return text
    }
}

const CHANNEL_PREFIX = 'iphiflow_ch_'

const JOIN_PREFIX = 'iphiflow_jn_'

const SESSION_SOURCE = 'iphi-flow'

const FINISH_TOOL = 'finish_channel'

const AGENT_SENDER = 'agent'

const ASSISTANT = 'assistant'

const DONE = 'done'

const MAX_MESSAGES = 'max messages'

const TIMEOUT = 'timeout'

const RUN_ENDED = 'run ended'

const MS_PER_MINUTE = 60 * 1000

const SWEEP_LIMIT = 50

const MAX_VIEWS = 3

const FinishArgs = z.object({ result: z.string() })

export type ChannelCheck =
    | { kind: 'pending' }
    | { kind: 'failed', failure: string }
    | { kind: 'done', output: Record<string, unknown> }

export type ChannelReference =
    | { kind: 'step', value: string }
    | { kind: 'correlation', value: string }

export type ChannelOrigin = {
    platformId: string
    projectId: string
    flowId: string
    flowRunId: string
    flowVersionId: string | null
    stepName: string | null
}

type OpenParams = {
    origin: ChannelOrigin
    request: OpencodeChannelRequest
    flowName: string | null
    opencodeStepId: string | null
}

type CreateChannelParams = {
    origin: ChannelOrigin
    request: OpencodeChannelRequest
    opencodeStepId: string | null
    log: FastifyBaseLogger
}

type DispatchParams = {
    step: OpencodeStepRow
    request: OpencodeChannelRequest
    flowName: string | null
}

type CloseParams = {
    channel: OpencodeChannelRow
    finishedBy: string
    output: Record<string, unknown> | null
}

type ParticipantSession = {
    opencodeStepId: string
    directory: string
    agent: string
}

type JoinParams = {
    step: OpencodeStepRow
    reference: ChannelReference
    client: OpencodeClient
}

type ViewsParams = {
    projectId: string
    flowRunId?: string
    flowVersionId?: string
    stepName: string
}

type AddRulesParams = {
    channel: OpencodeChannelRow
    client: OpencodeClient
    log: FastifyBaseLogger
    entries: { participant: OpencodeChannelParticipant, ruleId: string, correlationPrefix: string, name: string }[]
}

type ReplacePingLinesParams = {
    client: OpencodeClient
    sessionId: string
    directory: string
    lines: OpencodePermissionLine[]
}

type OutputParams = {
    channel: OpencodeChannelRow
    client: OpencodeClient
    messages: OperatorMessage[]
    finishedBy: string
}
