import { ApId, Permission } from '@activepieces/core-utils'
import { ListOpencodeStepSessionsQuery, OpencodeStepSessionView, PrincipalType } from '@activepieces/shared'
import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { StatusCodes } from 'http-status-codes'
import { z } from 'zod'
import { ProjectResourceType } from '../core/security/authorization/common'
import { securityAccess } from '../core/security/authorization/fastify-security'
import { opencodeViews } from './opencode-views'

export const opencodeStepSessionsController: FastifyPluginAsyncZod = async (app) => {
    app.get('/', ListStepSessionsRequest, async (request) => {
        return opencodeViews(request.log).stepSessions({
            platformId: request.principal.platform.id,
            projectId: request.projectId,
            flowRunId: request.query.flowRunId,
            flowVersionId: request.query.flowVersionId,
            stepName: request.query.stepName,
        })
    })
}

const ListStepSessionsRequest = {
    config: {
        security: securityAccess.project([PrincipalType.USER], Permission.READ_RUN, { type: ProjectResourceType.QUERY }),
    },
    schema: {
        querystring: ListOpencodeStepSessionsQuery.extend({ projectId: ApId }),
        response: { [StatusCodes.OK]: z.array(OpencodeStepSessionView) },
    },
}
