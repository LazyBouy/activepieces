import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { opencodeConnectionController } from './opencode-connection.controller'
import { opencodeOptionsController } from './opencode-options.controller'

export const opencodeModule: FastifyPluginAsyncZod = async (app) => {
    await app.register(opencodeConnectionController, { prefix: '/v1/opencode/connection' })
    await app.register(opencodeOptionsController, { prefix: '/v1/projects/:projectId/opencode' })
}
