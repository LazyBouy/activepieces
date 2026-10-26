import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { opencodeAskLinkController } from './opencode-ask-link.controller'
import { opencodeAsksController } from './opencode-asks.controller'
import { opencodeConnectionController } from './opencode-connection.controller'
import { opencodeMcpController } from './opencode-mcp.controller'
import { opencodeOptionsController } from './opencode-options.controller'
import { opencodeStepSessionsController } from './opencode-step-sessions.controller'

export const opencodeModule: FastifyPluginAsyncZod = async (app) => {
    await app.register(opencodeConnectionController, { prefix: '/v1/opencode/connection' })
    await app.register(opencodeOptionsController, { prefix: '/v1/projects/:projectId/opencode' })
    await app.register(opencodeMcpController, { prefix: '/v1/opencode/mcp' })
    await app.register(opencodeAsksController, { prefix: '/v1/opencode/asks' })
    await app.register(opencodeAskLinkController, { prefix: '/v1/opencode/ask-links' })
    await app.register(opencodeStepSessionsController, { prefix: '/v1/opencode/step-sessions' })
}
