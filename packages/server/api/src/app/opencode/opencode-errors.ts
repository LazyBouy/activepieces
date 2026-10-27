import { isNil } from '@activepieces/core-utils'

function describe({ error }: { error: unknown }): string {
    if (error instanceof Error) {
        return error.message
    }
    if (typeof error === 'string' && error.length > 0) {
        return error
    }
    if (typeof error === 'object' && !isNil(error)) {
        const nested = 'data' in error && typeof error.data === 'object' && !isNil(error.data) && 'message' in error.data ? error.data.message : undefined
        if (typeof nested === 'string') {
            return nested
        }
        if ('message' in error && typeof error.message === 'string') {
            return error.message
        }
        if ('name' in error && typeof error.name === 'string') {
            return error.name
        }
    }
    return 'OpenCode gave no reason'
}

function nameOf({ error }: { error: unknown }): string | undefined {
    if (typeof error === 'object' && !isNil(error) && 'name' in error && typeof error.name === 'string') {
        return error.name
    }
    return undefined
}

function unreachable({ serverUrl, error }: { serverUrl: string, error: unknown }): string {
    return `OpenCode did not answer at ${serverUrl}: ${describe({ error })}.`
}

function notAllowlisted({ namespace, project }: { namespace: string, project: string }): string {
    return `${namespace}/${project} is not allowlisted. A platform admin can add it in Platform → AI → OpenCode.`
}

function sessionGone({ sessionId }: { sessionId: string }): string {
    return `The OpenCode session ${sessionId} no longer exists.`
}

function sessionError({ message }: { message: string }): string {
    return `OpenCode stopped with an error: ${message}.`
}

function savedAgent(): string {
    return 'Saved agents are not supported when AI runs on OpenCode. Pick an OpenCode agent in the step\'s OpenCode section.'
}

function knowledgeBaseTools(): string {
    return 'Knowledge-base tools are not supported when AI runs on OpenCode.'
}

function callbackUnreachable({ url }: { url: string }): string {
    return `OpenCode could not reach Activepieces at ${url} to use this step's tools.`
}

function mcpServerUnreachable({ url, reason }: { url: string, reason: string }): string {
    return `OpenCode could not connect to the MCP server ${url}: ${reason}.`
}

function askCapPassed({ summary, capMinutes }: { summary: string, capMinutes: number }): string {
    const cap = capMinutes % MINUTES_PER_HOUR === 0 ? `${capMinutes / MINUTES_PER_HOUR} h` : `${capMinutes} min`
    return `Nobody answered OpenCode's ${summary} within ${cap}.`
}

function answerRefused({ reason }: { reason: string }): string {
    return `OpenCode did not accept the answer: ${reason}`
}

function routingOff(): string {
    return 'Run AI on OpenCode is off. Turn it on in Platform → AI → OpenCode.'
}

function inboxTimeout({ minutes }: { minutes: number }): string {
    return `No reply arrived within ${minutes} min.`
}

function inboxNotDelivered({ reason }: { reason: string }): string {
    return `The project inbox did not deliver the message: ${reason}.`
}

function commandNotStarted({ command, seconds }: { command: string, seconds: number }): string {
    return `OpenCode did not start the command ${command} within ${seconds} seconds.`
}

function commandRefused({ command, reason }: { command: string, reason: string }): string {
    return `OpenCode refused the command ${command}: ${reason}.`
}

function noCommand({ command, namespace, project }: { command: string, namespace: string, project: string }): string {
    return `OpenCode has no command or skill ${command} in ${namespace}/${project}.`
}

export class OpencodeRequestError extends Error {
    readonly status: number | undefined

    constructor({ status, message }: { status: number | undefined, message: string }) {
        super(message)
        this.status = status
    }
}

export class OpencodeToolsError extends Error {
    constructor({ message }: { message: string }) {
        super(message)
    }
}

const MINUTES_PER_HOUR = 60

export const opencodeErrors = {
    describe,
    nameOf,
    unreachable,
    notAllowlisted,
    sessionGone,
    sessionError,
    savedAgent,
    knowledgeBaseTools,
    callbackUnreachable,
    mcpServerUnreachable,
    askCapPassed,
    answerRefused,
    routingOff,
    inboxTimeout,
    inboxNotDelivered,
    commandNotStarted,
    commandRefused,
    noCommand,
}
