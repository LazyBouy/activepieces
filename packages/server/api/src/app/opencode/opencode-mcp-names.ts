import { createHash } from 'node:crypto'
import { AgentTool, AgentToolType } from '@activepieces/shared'

function serverName({ stepId }: { stepId: string }): string {
    return `${SERVER_PREFIX}${stepId}`
}

function externalServerName({ stepId, index }: { stepId: string, index: number }): string {
    return `${SERVER_PREFIX}${stepId}_m${index}`
}

function toolKey({ toolName }: { toolName: string }): string {
    const safe = toolName.replace(/[^a-zA-Z0-9_-]/g, '_')
    if (safe.length <= MAX_TOOL_KEY_LENGTH) {
        return safe
    }
    const hash = createHash('sha256').update(toolName).digest('hex').slice(0, HASH_LENGTH)
    return `${safe.slice(0, MAX_TOOL_KEY_LENGTH - HASH_LENGTH - 1)}_${hash}`
}

function bridgedTools({ tools }: { tools: AgentTool[] }): AgentTool[] {
    return tools.filter((tool) => tool.type === AgentToolType.PIECE || tool.type === AgentToolType.FLOW)
}

function externalTools({ tools }: { tools: AgentTool[] }): AgentTool[] {
    return tools.filter((tool) => tool.type === AgentToolType.MCP)
}

function toolOfCall({ stepId, callName, tools }: { stepId: string, callName: string, tools: AgentTool[] }): AgentTool | undefined {
    const ownPrefix = `${serverName({ stepId })}_`
    if (!callName.startsWith(ownPrefix)) {
        return undefined
    }
    const rest = callName.slice(ownPrefix.length)
    const bridged = bridgedTools({ tools }).find((tool) => toolKey({ toolName: tool.toolName }) === rest)
    if (bridged !== undefined) {
        return bridged
    }
    return externalTools({ tools }).find((_tool, index) => rest.startsWith(`m${index}_`))
}

function denyAllLine(): OpencodePermissionLine {
    return { permission: `${SERVER_PREFIX}*`, pattern: '*', action: 'deny' }
}

function allowStepLine({ stepId }: { stepId: string }): OpencodePermissionLine {
    return { permission: `${serverName({ stepId })}_*`, pattern: '*', action: 'allow' }
}

function isBridgeLine({ permission }: { permission: string }): boolean {
    return permission.startsWith(SERVER_PREFIX)
}

const SERVER_PREFIX = 'iphiflow_'

const MAX_TOOL_KEY_LENGTH = 33

const HASH_LENGTH = 6

export const opencodeMcpNames = {
    serverName,
    externalServerName,
    toolKey,
    bridgedTools,
    externalTools,
    toolOfCall,
    denyAllLine,
    allowStepLine,
    isBridgeLine,
}

export type OpencodePermissionLine = {
    permission: string
    pattern: string
    action: 'allow' | 'deny' | 'ask'
}
