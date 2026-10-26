import { PrincipalType } from '@activepieces/shared'
import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { StatusCodes } from 'http-status-codes'
import { OpencodeAgentRunBody, opencodeAgentRuns } from './opencode-agent-run'
import { opencodeRouting } from './opencode-routing'

export const opencodeAgentRunController: FastifyPluginAsyncZod<OpencodeAgentRunControllerOptions> = async (app, { upstream }) => {
    app.addHook('preHandler', async (request, reply) => {
        if (request.method !== 'POST' || request.routeOptions.url?.endsWith(RUNS_PATH) !== true || request.principal.type !== PrincipalType.ENGINE) {
            return
        }
        const platformId = request.principal.platform.id
        if (!await opencodeRouting.isOn({ platformId })) {
            return
        }
        const { requestId } = await opencodeAgentRuns(request.log).start({
            platformId,
            projectId: request.principal.projectId,
            body: OpencodeAgentRunBody.parse(request.body),
        })
        return reply.status(StatusCodes.OK).send({ conversationId: requestId, runId: requestId })
    })
    await app.register(upstream)
}

const RUNS_PATH = '/runs'

type OpencodeAgentRunControllerOptions = {
    upstream: FastifyPluginAsyncZod
}
