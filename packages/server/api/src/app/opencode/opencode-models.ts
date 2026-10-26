import { AIProviderName, isNil, tryCatch } from '@activepieces/core-utils'
import { AIProviderModel, AIProviderModelType, ProjectAIProvider } from '@activepieces/shared'
import { FastifyBaseLogger } from 'fastify'
import { repoFactory } from '../core/db/repo-factory'
import { opencodeConnectionService } from './opencode-connection.service'
import { opencodeErrors } from './opencode-errors'
import { OpencodeProjectLinkEntity } from './opencode-project-link.entity'
import { OpencodeStepModel } from './opencode-step.entity'

const linkRepo = repoFactory(OpencodeProjectLinkEntity)

export const opencodeModels = (log: FastifyBaseLogger) => ({
    async providerEntry({ platformId, projectId }: ProjectParams): Promise<ProjectAIProvider> {
        const providers = await listOpencodeProviders({ platformId, projectId, log })
        return {
            provider: AIProviderName.CUSTOM,
            name: PROVIDER_NAME,
            enabledForChat: false,
            keys: [
                { id: DEFAULT_KEY_ID, name: DEFAULT_KEY_NAME },
                ...providers.map((provider) => ({ id: `${KEY_PREFIX}${provider.id}`, name: provider.name })),
            ],
        }
    },

    async models({ platformId, projectId, configId }: ModelsParams): Promise<AIProviderModel[]> {
        if (configId === DEFAULT_KEY_ID) {
            return [{ id: DEFAULT_MODEL_ID, name: DEFAULT_MODEL_NAME, type: AIProviderModelType.TEXT }]
        }
        const providerId = configId.slice(KEY_PREFIX.length)
        const providers = await listOpencodeProviders({ platformId, projectId, log })
        const provider = providers.find((candidate) => candidate.id === providerId)
        if (isNil(provider)) {
            return []
        }
        return provider.models.map((model) => ({ id: model.id, name: model.name, type: AIProviderModelType.TEXT }))
    },
})

function keyOf({ configId }: { configId: string | undefined }): string | null {
    return !isNil(configId) && configId.startsWith(KEY_PREFIX) ? configId : null
}

function resolveModel({ providerConfigId, modelId }: { providerConfigId: string | undefined, modelId: string | undefined }): OpencodeStepModel | null {
    const key = keyOf({ configId: providerConfigId })
    if (isNil(key) || key === DEFAULT_KEY_ID || isNil(modelId) || modelId === DEFAULT_MODEL_ID) {
        return null
    }
    return { providerID: key.slice(KEY_PREFIX.length), modelID: modelId }
}

async function listOpencodeProviders({ platformId, projectId, log }: ProjectParams & { log: FastifyBaseLogger }): Promise<ListedOpencodeProvider[]> {
    const link = await linkRepo().findOneBy({ platformId, projectId })
    const client = await opencodeConnectionService(log).client({ platformId })
    const { data: result, error } = await tryCatch(() => client.config.providers(isNil(link) ? {} : { directory: link.directory }))
    const listed = result?.data
    if (isNil(listed)) {
        log.warn({ platform: { id: platformId }, project: { id: projectId }, error: opencodeErrors.describe({ error: result?.error ?? error }) }, '[opencodeModels] Could not list the OpenCode providers')
        return []
    }
    return listed.providers.map((provider) => ({
        id: provider.id,
        name: provider.name,
        models: Object.values(provider.models).map((model) => ({ id: model.id, name: model.name })),
    }))
}

const KEY_PREFIX = 'opencode:'

const DEFAULT_KEY_ID = 'opencode:default'

const DEFAULT_KEY_NAME = 'Default model'

const DEFAULT_MODEL_ID = 'default'

const DEFAULT_MODEL_NAME = 'Default (the agent, project, namespace or settings model)'

const PROVIDER_NAME = 'OpenCode'

export const opencodeModelKeys = {
    keyOf,
    resolveModel,
    DEFAULT_KEY_ID,
    DEFAULT_MODEL_ID,
}

type ProjectParams = {
    platformId: string
    projectId: string
}

type ModelsParams = ProjectParams & {
    configId: string
}

type ListedOpencodeProvider = {
    id: string
    name: string
    models: { id: string, name: string }[]
}
