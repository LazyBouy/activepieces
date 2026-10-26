import { ActivepiecesError, ApId, ErrorCode, isNil, Permission } from '@activepieces/core-utils'
import { AnswerOpencodeAskRequest, ListOpencodeAsksQuery, OpencodeAsk, OpencodeAskLink, PrincipalType } from '@activepieces/shared'
import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { StatusCodes } from 'http-status-codes'
import { z } from 'zod'
import { ProjectResourceType } from '../core/security/authorization/common'
import { securityAccess } from '../core/security/authorization/fastify-security'
import { opencodeAskLink } from './opencode-ask-link'
import { OpencodeAskEntity } from './opencode-ask.entity'
import { opencodeAsks, opencodeAskVia } from './opencode-asks'

export const opencodeAsksController: FastifyPluginAsyncZod = async (app) => {
    app.get('/', ListAsksRequest, async (request) => {
        return opencodeAsks(request.log).list({ ...request.query, projectId: request.projectId })
    })

    app.post('/:id/answer', AnswerAskRequest, async (request) => {
        await opencodeAsks(request.log).answer({ askId: request.params.id, projectId: request.projectId, request: request.body, via: opencodeAskVia.RUN_PAGE })
        const view = await opencodeAsks(request.log).view({ askId: request.params.id, platformId: request.principal.platform.id })
        if (isNil(view)) {
            throw new ActivepiecesError({ code: ErrorCode.ENTITY_NOT_FOUND, params: { entityType: 'opencode_ask', entityId: request.params.id } })
        }
        return view
    })

    app.post('/:id/link', AskLinkRequest, async (request) => {
        return { url: await opencodeAskLink.urlOf({ askId: request.params.id, platformId: request.principal.platform.id }) }
    })
}

const ListAsksRequest = {
    config: {
        security: securityAccess.project([PrincipalType.USER], Permission.READ_RUN, { type: ProjectResourceType.QUERY }),
    },
    schema: {
        querystring: ListOpencodeAsksQuery.extend({ projectId: ApId }),
        response: { [StatusCodes.OK]: z.array(OpencodeAsk) },
    },
}

const AnswerAskRequest = {
    config: {
        security: securityAccess.project([PrincipalType.USER], Permission.WRITE_FLOW, { type: ProjectResourceType.TABLE, tableName: OpencodeAskEntity }),
    },
    schema: {
        params: z.object({ id: ApId }),
        body: AnswerOpencodeAskRequest,
        response: { [StatusCodes.OK]: OpencodeAsk },
    },
}

const AskLinkRequest = {
    config: {
        security: securityAccess.project([PrincipalType.USER], Permission.WRITE_FLOW, { type: ProjectResourceType.TABLE, tableName: OpencodeAskEntity }),
    },
    schema: {
        params: z.object({ id: ApId }),
        response: { [StatusCodes.OK]: OpencodeAskLink },
    },
}
