import { ApId, Permission } from '@activepieces/core-utils'
import { ListOpencodeAgentsQuery, OpencodeAgentCardResult, OpencodeAgentList, OpencodeProjectOptions, OpencodeProjectViewResult, PrincipalType } from '@activepieces/shared'
import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { StatusCodes } from 'http-status-codes'
import { z } from 'zod'
import { ProjectResourceType } from '../core/security/authorization/common'
import { securityAccess } from '../core/security/authorization/fastify-security'
import { opencodeOptionsService } from './opencode-options.service'
import { opencodeViews } from './opencode-views'

export const opencodeOptionsController: FastifyPluginAsyncZod = async (app) => {
    app.get('/', OptionsEndpoint, async (request) => {
        return opencodeOptionsService(request.log).options({
            platformId: request.principal.platform.id,
            projectId: request.params.projectId,
        })
    })

    app.get('/agents', AgentsEndpoint, async (request) => {
        return opencodeOptionsService(request.log).agents({
            platformId: request.principal.platform.id,
            projectId: request.params.projectId,
            namespace: request.query.namespace,
            project: request.query.project,
        })
    })

    app.get('/agents/:name', AgentCardEndpoint, async (request) => {
        return opencodeViews(request.log).agentCard({
            platformId: request.principal.platform.id,
            projectId: request.params.projectId,
            name: request.params.name,
            namespace: request.query.namespace,
            project: request.query.project,
        })
    })

    app.get('/view', ProjectViewEndpoint, async (request) => {
        return opencodeViews(request.log).projectView({
            platformId: request.principal.platform.id,
            projectId: request.params.projectId,
            namespace: request.query.namespace,
            project: request.query.project,
        })
    })
}

const ProjectParams = z.object({
    projectId: ApId,
})

const OptionsEndpoint = {
    config: {
        security: securityAccess.project([PrincipalType.USER], Permission.READ_FLOW, { type: ProjectResourceType.PARAM }),
    },
    schema: {
        params: ProjectParams,
        response: {
            [StatusCodes.OK]: OpencodeProjectOptions,
        },
    },
}

const AgentsEndpoint = {
    config: {
        security: securityAccess.project([PrincipalType.USER], Permission.READ_FLOW, { type: ProjectResourceType.PARAM }),
    },
    schema: {
        params: ProjectParams,
        querystring: ListOpencodeAgentsQuery,
        response: {
            [StatusCodes.OK]: OpencodeAgentList,
        },
    },
}

const AgentCardEndpoint = {
    config: {
        security: securityAccess.project([PrincipalType.USER], Permission.READ_FLOW, { type: ProjectResourceType.PARAM }),
    },
    schema: {
        params: ProjectParams.extend({ name: z.string().min(1) }),
        querystring: ListOpencodeAgentsQuery,
        response: {
            [StatusCodes.OK]: OpencodeAgentCardResult,
        },
    },
}

const ProjectViewEndpoint = {
    config: {
        security: securityAccess.project([PrincipalType.USER], Permission.READ_FLOW, { type: ProjectResourceType.PARAM }),
    },
    schema: {
        params: ProjectParams,
        querystring: ListOpencodeAgentsQuery,
        response: {
            [StatusCodes.OK]: OpencodeProjectViewResult,
        },
    },
}
