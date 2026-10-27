import { ApId, Permission } from '@activepieces/core-utils'
import { ListOpencodeChannelsQuery, OpencodeChannelView, PrincipalType } from '@activepieces/shared'
import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { StatusCodes } from 'http-status-codes'
import { z } from 'zod'
import { ProjectResourceType } from '../core/security/authorization/common'
import { securityAccess } from '../core/security/authorization/fastify-security'
import { opencodeChannels } from './opencode-channels'

export const opencodeChannelsController: FastifyPluginAsyncZod = async (app) => {
    app.get('/', ListChannelsRequest, async (request) => {
        return opencodeChannels(request.log).views({
            projectId: request.projectId,
            flowRunId: request.query.flowRunId,
            flowVersionId: request.query.flowVersionId,
            stepName: request.query.stepName,
        })
    })
}

const ListChannelsRequest = {
    config: {
        security: securityAccess.project([PrincipalType.USER], Permission.READ_RUN, { type: ProjectResourceType.QUERY }),
    },
    schema: {
        querystring: ListOpencodeChannelsQuery.extend({ projectId: ApId }),
        response: { [StatusCodes.OK]: z.array(OpencodeChannelView) },
    },
}
