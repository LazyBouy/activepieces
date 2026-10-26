import { isNil } from '@activepieces/core-utils'
import { AssistantMessage, OpencodeClient, Part } from '@opencode-ai/sdk/v2/client'
import { opencodeErrors, OpencodeRequestError } from './opencode-errors'
import { OpencodeReply } from './opencode-prompts'

async function read({ client, sessionId, messageId, directory }: ReadParams): Promise<ReplyState> {
    const result = await client.session.messages({ sessionID: sessionId, directory })
    if (isNil(result.data)) {
        if (result.response?.status === NOT_FOUND) {
            return { kind: 'gone' }
        }
        throw new OpencodeRequestError({ status: result.response?.status, message: opencodeErrors.describe({ error: result.error }) })
    }
    const sent = result.data.some((message) => message.info.id === messageId)
    if (!sent) {
        return { kind: 'not-sent' }
    }
    const replies = result.data
        .filter((message): message is { info: AssistantMessage, parts: Part[] } => message.info.role === 'assistant' && message.info.parentID === messageId)
        .sort((left, right) => left.info.id.localeCompare(right.info.id))
    const last = replies[replies.length - 1]
    if (isNil(last)) {
        return { kind: 'pending' }
    }
    if (!isNil(last.info.error)) {
        return { kind: 'done', reply: { text: '', structured: undefined, error: opencodeErrors.describe({ error: last.info.error }) }, summary: summaryOf({ replies }) }
    }
    if (isNil(last.info.time.completed)) {
        return { kind: 'pending' }
    }
    if (isNil(last.info.structured) && MID_TURN_FINISHES.includes(last.info.finish ?? '') && await isBusy({ client, sessionId, directory })) {
        return { kind: 'pending' }
    }
    return {
        kind: 'done',
        reply: { text: textOf({ parts: last.parts }), structured: last.info.structured },
        summary: summaryOf({ replies }),
    }
}

async function isBusy({ client, sessionId, directory }: { client: OpencodeClient, sessionId: string, directory: string | undefined }): Promise<boolean> {
    const result = await client.session.status({ directory })
    if (isNil(result.data)) {
        return true
    }
    const status = result.data[sessionId]
    return !isNil(status) && status.type !== IDLE
}

function textOf({ parts }: { parts: Part[] }): string {
    return parts
        .flatMap((part) => part.type === 'text' && part.synthetic !== true && part.ignored !== true ? [part.text] : [])
        .join('')
        .trim()
}

function summaryOf({ replies }: { replies: { info: AssistantMessage }[] }): ReplySummary {
    const last = replies[replies.length - 1]
    return {
        model: isNil(last) ? null : { providerID: last.info.providerID, modelID: last.info.modelID },
        usage: replies.reduce((total, { info }) => ({
            input: total.input + info.tokens.input,
            output: total.output + info.tokens.output,
            reasoning: total.reasoning + info.tokens.reasoning,
            cost: total.cost + info.cost,
        }), { input: 0, output: 0, reasoning: 0, cost: 0 }),
    }
}

const NOT_FOUND = 404

const MID_TURN_FINISHES = ['tool-calls', 'unknown']

const IDLE = 'idle'

export const opencodeReply = {
    read,
}

export type ReplySummary = {
    model: { providerID: string, modelID: string } | null
    usage: { input: number, output: number, reasoning: number, cost: number }
}

export type ReplyState =
    | { kind: 'pending' }
    | { kind: 'gone' }
    | { kind: 'not-sent' }
    | { kind: 'done', reply: OpencodeReply, summary: ReplySummary }

type ReadParams = {
    client: OpencodeClient
    sessionId: string
    messageId: string
    directory: string | undefined
}
