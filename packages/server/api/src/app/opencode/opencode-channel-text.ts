import { isNil } from '@activepieces/core-utils'
import { OpencodeChannelParticipant, OpencodeChannelRow } from './opencode-channel.entity'
import { OpencodePermissionLine } from './opencode-mcp-names'

function brief({ channel, self, flowName, finishTool }: BriefParams): string {
    const others = channel.participants.filter((participant) => participant.key !== self.key)
    const doneBy = channel.participants.find((participant) => participant.key === channel.finish?.doneBy)
    return [
        `Activepieces opened the agent channel "${channel.stepName ?? channel.correlationId}" for one run of the flow "${flowName ?? channel.flowId}".`,
        `You are ${self.agent} in project ${self.projectName}. Correlation id: ${channel.correlationId}. Put it in every ping you send in this channel (correlationID).`,
        'The others in this channel, and how to reach each with ping send:',
        ...others.map((other) => `- ${other.agent} in ${placeOf({ viewer: self.directory, other })}: target ${targetOf({ viewer: self.directory, other })}`),
        'To answer a message, use ping send with replyTo set to its id.',
        ...doneLine({ self, doneBy, finishTool }),
        ...(isNil(channel.finish) ? [] : [`The channel ends after ${channel.finish.maxMessages} messages or ${channel.finish.timeoutMinutes} minutes at the latest.`]),
    ].join('\n')
}

function kickoff({ text, task, startedBy }: { text: string, task: string, startedBy: string | null }): string {
    return isNil(startedBy) ? `${text}\n\nTask:\n${task}` : `${text}\n\nTask (${startedBy} starts it; act on the messages that reach you):\n${task}`
}

function joinNote({ channel, correlationId, directory }: JoinNoteParams): string {
    return [
        `This step joins the agent channel "${channel.stepName ?? channel.correlationId}".`,
        `You may message these agents with ping send, putting ${correlationId} in correlationID:`,
        ...channel.participants.map((other) => `- ${other.agent} in ${placeOf({ viewer: directory, other })}: target ${targetOf({ viewer: directory, other })}`),
        'They answer with replyTo, and the answer comes back to this session.',
    ].join('\n')
}

function pingLines({ directory, others }: { directory: string, others: OpencodeChannelParticipant[] }): OpencodePermissionLine[] {
    return [
        ...CLOSED_PATTERNS.map((pattern) => ({ permission: PING, pattern, action: 'deny' as const })),
        ...others.map((other) => ({ permission: PING, pattern: sendPatternOf({ viewer: directory, other }), action: 'allow' as const })),
    ]
}

function isPingLine({ permission }: { permission: string }): boolean {
    return permission === PING
}

function doneLine({ self, doneBy, finishTool }: { self: OpencodeChannelParticipant, doneBy: OpencodeChannelParticipant | undefined, finishTool: string | null }): string[] {
    if (isNil(doneBy)) {
        return []
    }
    if (doneBy.key === self.key && !isNil(finishTool)) {
        return [`When the work is finished, call the tool ${finishTool} with the result. That ends the channel.`]
    }
    return [`${doneBy.agent} in project ${doneBy.projectName} ends the channel when the work is finished.`]
}

function targetOf({ viewer, other }: { viewer: string, other: OpencodeChannelParticipant }): string {
    return other.directory === viewer
        ? JSON.stringify({ type: 'session', id: other.sessionId })
        : JSON.stringify({ type: 'project.agent', id: `${other.project}/${other.agent}` })
}

function placeOf({ viewer, other }: { viewer: string, other: OpencodeChannelParticipant }): string {
    return other.directory === viewer ? 'this project' : `project ${other.projectName}`
}

function sendPatternOf({ viewer, other }: { viewer: string, other: OpencodeChannelParticipant }): string {
    return other.directory === viewer ? `SEND(agent/${other.agent})` : `SEND(project/${other.project}/agent/${other.agent})`
}

const PING = 'ping'

const CLOSED_PATTERNS = ['SEND(*)', 'SEND(agent/*)', 'SEND(group/*)', 'SEND(inbox)', 'SEND(project/*)']

export const opencodeChannelText = {
    brief,
    kickoff,
    joinNote,
    pingLines,
    isPingLine,
}

type BriefParams = {
    channel: OpencodeChannelRow
    self: OpencodeChannelParticipant
    flowName: string | null
    finishTool: string | null
}

type JoinNoteParams = {
    channel: OpencodeChannelRow
    correlationId: string
    directory: string
}
