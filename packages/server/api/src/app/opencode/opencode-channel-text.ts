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
        'Answer every message that reaches you with ping send, replyTo set to its id. An answer you only write in your reply reaches no one.',
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

function pingLines({ directory, peers }: { directory: string, peers: ChannelPeer[] }): OpencodePermissionLine[] {
    return [
        ...CLOSED_PATTERNS.map((pattern) => ({ permission: PING, pattern, action: 'deny' as const })),
        ...peers.flatMap((peer) => {
            const pattern = sendPatternOf({ viewer: directory, peer })
            return isNil(pattern) ? [] : [{ permission: PING, pattern, action: 'allow' as const }]
        }),
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

function sendPatternOf({ viewer, peer }: { viewer: string, peer: ChannelPeer }): string | null {
    if (peer.directory !== viewer) {
        return `SEND(project/${peer.project}/agent/${peer.agent})`
    }
    return isNil(peer.sessionId) ? null : `SEND(session/${peer.sessionId})`
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

export type ChannelPeer = {
    directory: string
    project: string
    agent: string
    sessionId: string | null
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
