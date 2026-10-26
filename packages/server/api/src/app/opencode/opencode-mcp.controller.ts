import { isNil, tryCatchSync } from '@activepieces/core-utils'
import { McpToolResult } from '@activepieces/shared'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { FastifyBaseLogger, FastifyReply } from 'fastify'
import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { StatusCodes } from 'http-status-codes'
import { In } from 'typeorm'
import { z } from 'zod'
import { repoFactory } from '../core/db/repo-factory'
import { securityAccess } from '../core/security/authorization/fastify-security'
import { OPENCODE_RUN_AGENT } from './opencode-agent-prompt'
import { opencodeMcpToken } from './opencode-mcp-token'
import { OpencodeMcpTool, opencodeMcpTools } from './opencode-mcp-tools'
import { OpencodeStepEntity, OpencodeStepRow, OpencodeStepStatus } from './opencode-step.entity'
import { opencodeStoredRequest } from './opencode-stored-request'
import { opencodeToolGuards } from './opencode-tool-guards'

const stepRepo = repoFactory(OpencodeStepEntity)

export const opencodeMcpController: FastifyPluginAsyncZod = async (app) => {
    app.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, body: string, done) => {
        if (body.trim() === '') {
            done(null, {})
            return
        }
        const parsed = parseJson({ body })
        if (isNil(parsed)) {
            done(Object.assign(new Error('The request body is not valid JSON'), { statusCode: StatusCodes.BAD_REQUEST }), undefined)
            return
        }
        done(null, parsed)
    })

    app.get('/', McpEndpointConfig, async (_request, reply) => {
        return reply.status(StatusCodes.METHOD_NOT_ALLOWED).send({ message: 'Use POST with the step\'s bearer token.' })
    })

    app.post('/', McpEndpointConfig, async (request, reply) => {
        const step = await authorizedStep({ authorization: request.headers.authorization })
        if (isNil(step)) {
            return refuse({ reply })
        }
        const stored = opencodeStoredRequest.parse(step.request)
        if (isNil(stored) || stored.request.action !== OPENCODE_RUN_AGENT) {
            return refuse({ reply })
        }
        const tools = await opencodeMcpTools(request.log).build({
            stepId: step.id,
            projectId: step.projectId,
            platformId: step.platformId,
            tools: stored.request.tools ?? [],
            withSchemas: listsTools({ body: request.body }),
        })
        const server = buildServer({ step, tools, log: request.log })
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
        reply.raw.on('close', () => {
            transport.close().catch(() => undefined)
            server.close().catch(() => undefined)
        })
        await server.connect(transport)
        await transport.handleRequest(request.raw, reply.raw, request.body)
    })
}

async function authorizedStep({ authorization }: { authorization: string | undefined }): Promise<OpencodeStepRow | null> {
    const [type, token] = authorization?.split(' ') ?? []
    if (type !== 'Bearer' || isNil(token)) {
        return null
    }
    const payload = await opencodeMcpToken.verify({ token })
    if (isNil(payload)) {
        return null
    }
    return stepRepo().findOneBy({ id: payload.stepId, projectId: payload.projectId, platformId: payload.platformId, status: In(OPEN_STATUSES) })
}

function buildServer({ step, tools, log }: { step: OpencodeStepRow, tools: OpencodeMcpTool[], log: FastifyBaseLogger }): McpServer {
    const server = new McpServer({ name: 'Activepieces step tools', version: '1.0.0' })
    for (const tool of tools) {
        server.registerTool(tool.key, { title: tool.key, description: tool.description, inputSchema: tool.inputSchema }, async (args: Record<string, unknown>) => {
            if (!await opencodeToolGuards.claimCall({ stepId: step.id, toolKey: tool.key })) {
                return toolError({ text: opencodeToolGuards.capReached({ toolName: tool.key }) })
            }
            const result = await tool.run(args)
            log.info({ opencodeStep: { id: step.id }, tool: { name: tool.key, phase: 'result', output: result.isError === true ? 'error' : 'ok' } }, '[opencodeMcp] Agent tool finished')
            return result
        })
    }
    return server
}

function listsTools({ body }: { body: unknown }): boolean {
    const messages = Array.isArray(body) ? body : [body]
    return messages.some((message) => RpcMethod.safeParse(message).data?.method === TOOLS_LIST)
}

function refuse({ reply }: { reply: FastifyReply }): FastifyReply {
    return reply.status(StatusCodes.UNAUTHORIZED).send({ message: 'This token does not belong to a running step.' })
}

function toolError({ text }: { text: string }): McpToolResult {
    return { content: [{ type: 'text', text }], isError: true }
}

function parseJson({ body }: { body: string }): unknown {
    const { data } = tryCatchSync(() => JSON.parse(body))
    return data ?? null
}

const OPEN_STATUSES: OpencodeStepStatus[] = ['PENDING', 'QUEUED', 'DISPATCHED']

const TOOLS_LIST = 'tools/list'

const RpcMethod = z.object({ method: z.string() })

const McpEndpointConfig = {
    config: { security: securityAccess.public() },
    schema: { hide: true },
}
