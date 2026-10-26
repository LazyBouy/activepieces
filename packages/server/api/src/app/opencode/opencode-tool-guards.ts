import { FieldControlMode, PredefinedInputsStructure } from '@activepieces/shared'
import { redisConnections } from '../database/redis-connections'

function neutralize(value: unknown): unknown {
    if (typeof value === 'string') {
        return value.replace(OPENING_TEMPLATE_BRACE, `{${ZERO_WIDTH_SPACE}`)
    }
    if (Array.isArray(value)) {
        return value.map(neutralize)
    }
    if (typeof value === 'object' && value !== null) {
        return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, neutralize(entry)]))
    }
    return value
}

function pinnedFields({ predefined }: { predefined: PredefinedInputsStructure | undefined }): Set<string> {
    return new Set(Object.entries(predefined?.fields ?? {})
        .filter(([, field]) => field.mode !== FieldControlMode.AGENT_DECIDE)
        .map(([name]) => name))
}

function applyPins({ modelInput, predefined }: { modelInput: Record<string, unknown>, predefined: PredefinedInputsStructure | undefined }): Record<string, unknown> {
    const pinned = pinnedFields({ predefined })
    const chosen = Object.fromEntries(Object.entries(modelInput).filter(([name]) => !pinned.has(name) && name !== AUTH_FIELD))
    const authorValues = Object.fromEntries(Object.entries(predefined?.fields ?? {})
        .filter(([, field]) => field.mode === FieldControlMode.CHOOSE_YOURSELF)
        .map(([name, field]) => [name, field.value]))
    return { ...chosen, ...authorValues }
}

function absoluteUrlRefusal({ actionName, input }: { actionName: string, input: Record<string, unknown> }): string | null {
    if (actionName !== CUSTOM_API_CALL || typeof input['url'] !== 'string') {
        return null
    }
    return ABSOLUTE_URL.test(input['url'].trim()) ? ABSOLUTE_URL_REFUSED : null
}

async function claimCall({ stepId, toolKey }: { stepId: string, toolKey: string }): Promise<boolean> {
    const redis = await redisConnections.useExisting()
    const key = `opencode_mcp_calls:${stepId}:${toolKey}`
    const count = await redis.incr(key)
    if (count === 1) {
        await redis.expire(key, CALL_COUNT_TTL_SECONDS)
    }
    return count <= MAX_CALLS_PER_TURN
}

function capReached({ toolName }: { toolName: string }): string {
    return `${toolName} reached its limit of ${MAX_CALLS_PER_TURN} calls for this step.`
}

const OPENING_TEMPLATE_BRACE = /\{(?=\{)/g

const ZERO_WIDTH_SPACE = '\u200B'

const AUTH_FIELD = 'auth'

const CUSTOM_API_CALL = 'custom_api_call'

const ABSOLUTE_URL = /^[a-z][a-z0-9+.-]*:\/\//i

const ABSOLUTE_URL_REFUSED = 'This tool only takes a path on the service\'s own API, not a full URL.'

const MAX_CALLS_PER_TURN = 20

const CALL_COUNT_TTL_SECONDS = 4 * 60 * 60

export const opencodeToolGuards = {
    neutralize,
    pinnedFields,
    applyPins,
    absoluteUrlRefusal,
    claimCall,
    capReached,
    AUTH_FIELD,
    MAX_CALLS_PER_TURN,
}
