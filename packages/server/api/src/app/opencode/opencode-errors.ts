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

function toolsNotBridged(): string {
    return 'Activepieces tools on an OpenCode agent step are not available yet. Remove the tools from this step to run it on OpenCode.'
}

export class OpencodeRequestError extends Error {
    readonly status: number | undefined

    constructor({ status, message }: { status: number | undefined, message: string }) {
        super(message)
        this.status = status
    }
}

export const opencodeErrors = {
    describe,
    nameOf,
    unreachable,
    notAllowlisted,
    sessionGone,
    sessionError,
    savedAgent,
    knowledgeBaseTools,
    toolsNotBridged,
}
