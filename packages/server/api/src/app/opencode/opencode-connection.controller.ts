import { OpencodeCatalog, OpencodeConnection, OpencodeHealth, OpencodeServerOverview, PrincipalType, UpdateOpencodeConnectionRequest } from '@activepieces/shared'
import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { StatusCodes } from 'http-status-codes'
import { securityAccess } from '../core/security/authorization/fastify-security'
import { opencodeConnectionService } from './opencode-connection.service'
import { opencodeViews } from './opencode-views'

export const opencodeConnectionController: FastifyPluginAsyncZod = async (app) => {
    app.get('/', GetConnectionEndpoint, async (request) => {
        return opencodeConnectionService(request.log).get({ platformId: request.principal.platform.id })
    })

    app.post('/', UpdateConnectionEndpoint, async (request) => {
        return opencodeConnectionService(request.log).update({ platformId: request.principal.platform.id, request: request.body })
    })

    app.post('/test', TestConnectionEndpoint, async (request) => {
        return opencodeConnectionService(request.log).testConnection({ platformId: request.principal.platform.id })
    })

    app.get('/catalog', CatalogEndpoint, async (request) => {
        return opencodeConnectionService(request.log).catalog({ platformId: request.principal.platform.id })
    })

    app.get('/overview', OverviewEndpoint, async (request) => {
        return opencodeViews(request.log).serverOverview({ platformId: request.principal.platform.id })
    })
}

const OverviewEndpoint = {
    config: {
        security: securityAccess.platformAdminOnly([PrincipalType.USER]),
    },
    schema: {
        response: {
            [StatusCodes.OK]: OpencodeServerOverview,
        },
    },
}

const GetConnectionEndpoint = {
    config: {
        security: securityAccess.platformAdminOnly([PrincipalType.USER]),
    },
    schema: {
        response: {
            [StatusCodes.OK]: OpencodeConnection,
        },
    },
}

const UpdateConnectionEndpoint = {
    config: {
        security: securityAccess.platformAdminOnly([PrincipalType.USER]),
    },
    schema: {
        body: UpdateOpencodeConnectionRequest,
        response: {
            [StatusCodes.OK]: OpencodeConnection,
        },
    },
}

const TestConnectionEndpoint = {
    config: {
        security: securityAccess.platformAdminOnly([PrincipalType.USER]),
    },
    schema: {
        response: {
            [StatusCodes.OK]: OpencodeHealth,
        },
    },
}

const CatalogEndpoint = {
    config: {
        security: securityAccess.platformAdminOnly([PrincipalType.USER]),
    },
    schema: {
        response: {
            [StatusCodes.OK]: OpencodeCatalog,
        },
    },
}
