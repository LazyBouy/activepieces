import { isNil, tryCatch } from '@activepieces/core-utils'
import { AgentMcpTool, AgentTool, AgentToolType, buildAuthHeaders } from '@activepieces/shared'
import { McpRemoteConfig, OpencodeClient } from '@opencode-ai/sdk/v2/client'
import { FastifyBaseLogger } from 'fastify'
import { opencodeConnectionService } from './opencode-connection.service'
import { opencodeErrors, OpencodeRequestError, OpencodeToolsError } from './opencode-errors'
import { opencodeMcpNames } from './opencode-mcp-names'
import { opencodeMcpToken } from './opencode-mcp-token'
import { OpencodeStepRow } from './opencode-step.entity'

export const opencodeMcpBridge = (log: FastifyBaseLogger) => ({
    async attach({ step, client, tools }: AttachParams): Promise<void> {
        if (tools.length === 0 || isNil(step.sessionId)) {
            return
        }
        const directory = step.directory ?? undefined
        if (opencodeMcpNames.bridgedTools({ tools }).length > 0) {
            const connection = await opencodeConnectionService(log).getOrCreate({ platformId: step.platformId })
            const token = await opencodeMcpToken.sign({ stepId: step.id, projectId: step.projectId, platformId: step.platformId })
            await addServer({
                client,
                directory,
                log,
                name: opencodeMcpNames.serverName({ stepId: step.id }),
                config: { type: 'remote', url: endpointOf({ callbackUrl: connection.callbackUrl }), headers: { Authorization: `Bearer ${token}` }, oauth: false, enabled: true },
                failure: () => opencodeErrors.callbackUnreachable({ url: connection.callbackUrl }),
            })
        }
        const external = opencodeMcpNames.externalTools({ tools }).filter(isMcpTool)
        for (const [index, tool] of external.entries()) {
            await addServer({
                client,
                directory,
                log,
                name: opencodeMcpNames.externalServerName({ stepId: step.id, index }),
                config: { type: 'remote', url: tool.serverUrl, headers: buildAuthHeaders(tool.auth), oauth: false, enabled: true },
                failure: (reason) => opencodeErrors.mcpServerUnreachable({ url: tool.serverUrl, reason }),
            })
        }
        await allowStepTools({ client, step, sessionId: step.sessionId })
        log.info({ opencodeStep: { id: step.id }, flowRun: { id: step.flowRunId } }, '[opencodeMcpBridge] Gave the agent session its step tools')
    },

    async detach({ step, client, tools }: AttachParams): Promise<void> {
        const names = [
            ...(opencodeMcpNames.bridgedTools({ tools }).length > 0 ? [opencodeMcpNames.serverName({ stepId: step.id })] : []),
            ...opencodeMcpNames.externalTools({ tools }).map((_tool, index) => opencodeMcpNames.externalServerName({ stepId: step.id, index })),
        ]
        for (const name of names) {
            const { error } = await tryCatch(() => client.mcp.disconnect({ name, directory: step.directory ?? undefined }))
            if (!isNil(error)) {
                log.warn({ opencodeStep: { id: step.id }, error }, '[opencodeMcpBridge] Could not disconnect a step\'s MCP server')
            }
        }
    },
})

async function addServer({ client, directory, name, config, failure, log }: AddServerParams): Promise<void> {
    const added = await client.mcp.add({ directory, name, config })
    if (isNil(added.data)) {
        throw new OpencodeRequestError({ status: added.response?.status, message: opencodeErrors.describe({ error: added.error }) })
    }
    const status = added.data[name]
    if (status?.status === CONNECTED) {
        return
    }
    const reason = !isNil(status) && 'error' in status ? status.error : status?.status ?? 'no status'
    log.warn({ mcpServer: { name, url: config.url, status: reason } }, '[opencodeMcpBridge] OpenCode could not connect a step\'s MCP server')
    throw new OpencodeToolsError({ message: failure(reason) })
}

async function allowStepTools({ client, step, sessionId }: { client: OpencodeClient, step: OpencodeStepRow, sessionId: string }): Promise<void> {
    const directory = step.directory ?? undefined
    const current = await client.operator.sessionPermissions.get({ sessionID: sessionId, directory })
    if (isNil(current.data)) {
        throw new OpencodeRequestError({ status: current.response?.status, message: opencodeErrors.describe({ error: current.error }) })
    }
    const kept = current.data.written.filter((line) => !opencodeMcpNames.isBridgeLine(line))
    const saved = await client.operator.sessionPermissions.save({
        sessionID: sessionId,
        directory,
        rules: [...kept, opencodeMcpNames.denyAllLine(), opencodeMcpNames.allowStepLine({ stepId: step.id })],
        deleted: current.data.deleted,
    })
    if (isNil(saved.data)) {
        throw new OpencodeRequestError({ status: saved.response?.status, message: opencodeErrors.describe({ error: saved.error }) })
    }
}

function endpointOf({ callbackUrl }: { callbackUrl: string }): string {
    return `${callbackUrl.replace(/\/+$/, '')}/v1/opencode/mcp`
}

function isMcpTool(tool: AgentTool): tool is AgentMcpTool {
    return tool.type === AgentToolType.MCP
}

const CONNECTED = 'connected'

type AttachParams = {
    step: OpencodeStepRow
    client: OpencodeClient
    tools: AgentTool[]
}

type AddServerParams = {
    client: OpencodeClient
    log: FastifyBaseLogger
    directory: string | undefined
    name: string
    config: McpRemoteConfig
    failure: (reason: string) => string
}
