import { ActivepiecesError, ErrorCode } from '@activepieces/core-utils'
import { ListOpencodeAgentsQuery, OpencodeAgentList, OpencodeProjectOptions, Principal, PrincipalType } from '@activepieces/shared'
import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { StatusCodes } from 'http-status-codes'
import { z } from 'zod'
import { securityAccess } from '../core/security/authorization/fastify-security'
import { opencodeOptionsService } from './opencode-options.service'
import { OpencodeCommandList, OpencodeGroupList, opencodePieceOptions } from './opencode-piece-options'
import { OpencodePieceRunBody, opencodePieceRuns } from './opencode-piece-runs'
import { OpencodeProviderList, opencodeViews } from './opencode-views'

export const opencodePieceStepsController: FastifyPluginAsyncZod = async (app) => {
    app.post('/', StartEndpoint, async (request) => {
        const { projectId, platformId } = runPrincipal({ principal: request.principal })
        return opencodePieceRuns(request.log).start({ platformId, projectId, body: request.body })
    })

    app.get('/options', OptionsEndpoint, async (request) => {
        const { projectId, platformId } = runPrincipal({ principal: request.principal })
        return opencodeOptionsService(request.log).options({ platformId, projectId })
    })

    app.get('/agents', listEndpoint({ response: OpencodeAgentList }), async (request) => {
        const { projectId, platformId } = runPrincipal({ principal: request.principal })
        return opencodeOptionsService(request.log).agents({ platformId, projectId, ...request.query })
    })

    app.get('/commands', listEndpoint({ response: OpencodeCommandList }), async (request) => {
        const { projectId, platformId } = runPrincipal({ principal: request.principal })
        return opencodePieceOptions(request.log).commands({ platformId, projectId, ...request.query })
    })

    app.get('/groups', listEndpoint({ response: OpencodeGroupList }), async (request) => {
        const { projectId, platformId } = runPrincipal({ principal: request.principal })
        return opencodePieceOptions(request.log).groups({ platformId, projectId, ...request.query })
    })

    app.get('/models', listEndpoint({ response: OpencodeProviderList }), async (request) => {
        const { projectId, platformId } = runPrincipal({ principal: request.principal })
        return opencodeViews(request.log).providers({ platformId, projectId, ...request.query })
    })
}

function runPrincipal({ principal }: { principal: Principal }): { projectId: string, platformId: string } {
    if (principal.type !== PrincipalType.ENGINE) {
        throw new ActivepiecesError({ code: ErrorCode.AUTHORIZATION, params: { message: 'Only a running flow can use the OpenCode piece' } })
    }
    return { projectId: principal.projectId, platformId: principal.platform.id }
}

function listEndpoint<T extends z.ZodType>({ response }: { response: T }) {
    return {
        config: { security: securityAccess.publicPlatform(RUN_PRINCIPALS) },
        schema: {
            querystring: ListOpencodeAgentsQuery,
            response: { [StatusCodes.OK]: response },
        },
    }
}

const RUN_PRINCIPALS = [PrincipalType.ENGINE] as const

const StartEndpoint = {
    config: { security: securityAccess.publicPlatform(RUN_PRINCIPALS) },
    schema: {
        body: OpencodePieceRunBody,
        response: {
            [StatusCodes.OK]: z.object({
                requestId: z.string(),
                output: z.unknown().optional(),
                failure: z.string().optional(),
            }),
        },
    },
}

const OptionsEndpoint = {
    config: { security: securityAccess.publicPlatform(RUN_PRINCIPALS) },
    schema: {
        response: { [StatusCodes.OK]: OpencodeProjectOptions },
    },
}
