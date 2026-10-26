import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { agentRunController } from '../ee/agent/agent-run-controller'
import { opencodeAgentRunController } from '../opencode/opencode-agent-run.controller'
import { agentToolsController } from './agent-tools-controller'

export const agentsModule: FastifyPluginAsyncZod = async (app) => {
    await app.register(agentToolsController, { prefix: '/v1/projects/:projectId/agent-tools' })
    await app.register(opencodeAgentRunController, { prefix: '/v1/agents', upstream: agentRunController })
}
