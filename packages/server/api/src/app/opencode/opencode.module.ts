import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { opencodeConnectionController } from './opencode-connection.controller'

export const opencodeModule: FastifyPluginAsyncZod = async (app) => {
    await app.register(opencodeConnectionController, { prefix: '/v1/opencode/connection' })
}
