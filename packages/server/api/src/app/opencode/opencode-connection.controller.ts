import { OpencodeCatalog, OpencodeConnection, OpencodeHealth, PrincipalType, UpdateOpencodeConnectionRequest } from '@activepieces/shared'
import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { StatusCodes } from 'http-status-codes'
import { securityAccess } from '../core/security/authorization/fastify-security'
import { opencodeConnectionService } from './opencode-connection.service'

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
