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

export const opencodeErrors = {
    describe,
    nameOf,
}
