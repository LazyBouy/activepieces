import { AiProviderKeyStatus, AIProviderName, isNil } from '@activepieces/core-utils'
import { modelTierCatalog } from '@activepieces/server-utils'
import { AIProviderModel, AIProviderModelType, CreateAIProviderRequest, PrincipalType, spreadIfDefined, UpdateAIProviderRequest } from '@activepieces/shared'
import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { StatusCodes } from 'http-status-codes'
import { z } from 'zod'
import { ProjectResourceType } from '../core/security/authorization/common'
import { securityAccess } from '../core/security/authorization/fastify-security'
import { opencodeModelKeys, opencodeModels } from '../opencode/opencode-models'
import { opencodeRouting } from '../opencode/opencode-routing'
import { aiProviderService } from './ai-provider-service'

export const aiProviderController: FastifyPluginAsyncZod = async (app) => {
    app.get('/', ListAIProvidersForProject, async (request) => {
        const providers = await aiProviderService(app.log).listForProject({
            platformId: request.principal.platform.id,
            projectId: request.projectId,
        })
        if (!await routesToOpencode({ principalType: request.principal.type, platformId: request.principal.platform.id })) {
            return providers
        }
        const opencode = await opencodeModels(app.log).providerEntry({ platformId: request.principal.platform.id, projectId: request.projectId })
        return [opencode, ...providers]
    })
    app.get('/configs', ListAIProviderConfigs, async (request) => {
        return aiProviderService(app.log).listConfigs(request.principal.platform.id)
    })
    app.get('/configs/:id/models', ListModelsForConfig, async (request) => {
        return aiProviderService(app.log).listModelsForConfig({
            platformId: request.principal.platform.id,
            configId: request.params.id,
        })
    })
    app.get('/tiers', ListModelTiers, async () => ({
        flow: modelTierCatalog.current('flow'),
        chat: modelTierCatalog.current('chat'),
    }))
    app.get('/:provider/models', ListModels, async (request) => {
        const platformId = request.principal.platform.id
        const routed = await routesToOpencode({ principalType: request.principal.type, platformId })
        const opencodeKey = opencodeModelKeys.keyOf({ configId: request.query.configId })
        if (routed && !isNil(opencodeKey)) {
            return opencodeModels(app.log).models({ platformId, projectId: request.projectId, configId: opencodeKey })
        }
        const models = await aiProviderService(app.log).listModels({
            platformId,
            provider: request.params.provider,
            scope: { type: 'project', projectId: request.projectId },
            ...spreadIfDefined('configId', request.query.configId),
        })
        return routed ? models.filter((model) => model.type === AIProviderModelType.IMAGE) : models
    })
    app.post('/', CreateAIProvider, async (request) => {
        const platformId = request.principal.platform.id
        return aiProviderService(app.log).create(platformId, request.body)
    })
    app.post('/:id/recheck', RecheckAIProvider, async (request) => {
        const status = await aiProviderService(app.log).recheck({
            platformId: request.principal.platform.id,
            providerId: request.params.id,
        })
        return { status }
    })
    app.post('/:id', UpdateAIProvider, async (request) => {
        const platformId = request.principal.platform.id
        return aiProviderService(app.log).update(platformId, request.params.id, request.body)
    })
    app.delete('/:id', DeleteAIProvider, async (request, reply) => {
        const platformId = request.principal.platform.id
        await aiProviderService(app.log).delete(platformId, request.params.id)
        return reply.status(StatusCodes.NO_CONTENT).send()
    })
}

async function routesToOpencode({ principalType, platformId }: { principalType: PrincipalType, platformId: string }): Promise<boolean> {
    return principalType === PrincipalType.ENGINE && opencodeRouting.isOn({ platformId })
}

const ListAIProvidersForProject = {
    config: {
        security: securityAccess.project([PrincipalType.USER, PrincipalType.ENGINE], undefined, { type: ProjectResourceType.QUERY }),
    },
    schema: {
        querystring: z.object({
            projectId: z.string().optional(),
        }),
    },
}

const ListAIProviderConfigs = {
    config: {
        security: securityAccess.platformAdminOnly([PrincipalType.USER]),
    },
}

const ListModelsForConfig = {
    config: {
        security: securityAccess.platformAdminOnly([PrincipalType.USER]),
    },
    schema: {
        params: z.object({
            id: z.string(),
        }),
        response: {
            [StatusCodes.OK]: z.array(AIProviderModel),
        },
    },
}

const ModelTierList = z.object({
    tiers: z.array(z.object({
        id: z.string(),
        label: z.string(),
        modelId: z.string(),
    })),
    defaultTierId: z.string(),
})

const ListModelTiers = {
    config: {
        security: securityAccess.unscoped([PrincipalType.USER, PrincipalType.ENGINE]),
    },
    schema: {
        response: {
            [StatusCodes.OK]: z.object({
                flow: ModelTierList,
                chat: ModelTierList,
            }),
        },
    },
}

const ListModels = {
    config: {
        security: securityAccess.project([PrincipalType.USER, PrincipalType.ENGINE], undefined, { type: ProjectResourceType.QUERY }),
    },
    schema: {
        params: z.object({
            provider: z.nativeEnum(AIProviderName),
        }),
        querystring: z.object({
            projectId: z.string().optional(),
            configId: z.string().optional(),
        }),
        response: {
            [StatusCodes.OK]: z.array(AIProviderModel),
        },
    },
}

const CreateAIProvider = {
    config: {
        security: securityAccess.platformAdminOnly([PrincipalType.USER]),
    },
    schema: {
        body: CreateAIProviderRequest,
    },
}

const RecheckAIProvider = {
    config: {
        security: securityAccess.platformAdminOnly([PrincipalType.USER]),
    },
    schema: {
        params: z.object({
            id: z.string(),
        }),
        response: {
            [StatusCodes.OK]: z.object({
                status: AiProviderKeyStatus,
            }),
        },
    },
}

const UpdateAIProvider = {
    config: {
        security: securityAccess.platformAdminOnly([PrincipalType.USER]),
    },
    schema: {
        params: z.object({
            id: z.string(),
        }),
        body: UpdateAIProviderRequest,
    },
}

const DeleteAIProvider = {
    config: {
        security: securityAccess.platformAdminOnly([PrincipalType.USER]),
    },
    schema: {
        params: z.object({
            id: z.string(),
        }),
    },
}
