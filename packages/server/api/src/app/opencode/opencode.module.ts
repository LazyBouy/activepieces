import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { opencodeConnectionController } from './opencode-connection.controller'
import { opencodeMcpController } from './opencode-mcp.controller'
import { opencodeOptionsController } from './opencode-options.controller'

export const opencodeModule: FastifyPluginAsyncZod = async (app) => {
    await app.register(opencodeConnectionController, { prefix: '/v1/opencode/connection' })
    await app.register(opencodeOptionsController, { prefix: '/v1/projects/:projectId/opencode' })
    await app.register(opencodeMcpController, { prefix: '/v1/opencode/mcp' })
}
