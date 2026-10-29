import { apId, isNil, spreadIfDefined, spreadIfNotUndefined, tryCatch } from '@activepieces/core-utils'
import { OPENCODE_DEFAULT_ASK_CAP_MINUTES, OPENCODE_DEFAULT_NAMESPACE, OpencodeCatalog, OpencodeConnection, OpencodeHealth, UpdateOpencodeConnectionRequest } from '@activepieces/shared'
import { OpencodeClient } from '@opencode-ai/sdk/v2/client'
import { FastifyBaseLogger } from 'fastify'
import { StatusCodes } from 'http-status-codes'
import { repoFactory } from '../core/db/repo-factory'
import { distributedLock } from '../database/redis-connections'
import { domainHelper } from '../helper/domain-helper'
import { encryptUtils } from '../helper/encryption'
import { system } from '../helper/system/system'
import { AppSystemProp } from '../helper/system/system-props'
import { opencodeAskEmail } from './opencode-ask-notices'
import { opencodeClient } from './opencode-client'
import { OpencodeConnectionEntity, OpencodeConnectionRow } from './opencode-connection.entity'
import { opencodeErrors } from './opencode-errors'

const connectionRepo = repoFactory(OpencodeConnectionEntity)

export const opencodeConnectionService = (log: FastifyBaseLogger) => ({
    async getOrCreate({ platformId }: PlatformParams): Promise<OpencodeConnectionRow> {
        const existing = await connectionRepo().findOneBy({ platformId })
        if (!isNil(existing)) {
            return existing
        }
        return distributedLock(log).runExclusive({
            key: `opencode_connection_${platformId}`,
            timeoutInSeconds: CREATE_LOCK_TIMEOUT_SECONDS,
            fn: async () => {
                const created = await connectionRepo().findOneBy({ platformId })
                if (!isNil(created)) {
                    return created
                }
                return createDefaultConnection({ platformId })
            },
        })
    },

    async get({ platformId }: PlatformParams): Promise<OpencodeConnection> {
        return toResponse({ row: await this.getOrCreate({ platformId }) })
    },

    async update({ platformId, request }: UpdateParams): Promise<OpencodeConnection> {
        const row = await this.getOrCreate({ platformId })
        const password = request.password === undefined
            ? undefined
            : request.password === null || request.password.length === 0
                ? null
                : await encryptUtils.encryptString(request.password)
        await connectionRepo().update({ id: row.id }, {
            ...spreadIfDefined('serverUrl', request.serverUrl),
            ...spreadIfDefined('username', request.username),
            ...spreadIfNotUndefined('password', password),
            ...spreadIfDefined('adminPanelUrl', request.adminPanelUrl),
            ...spreadIfDefined('callbackUrl', request.callbackUrl),
            ...spreadIfNotUndefined('projectsFolder', request.projectsFolder),
            ...spreadIfDefined('enabled', request.enabled),
            ...spreadIfDefined('askCapMinutes', request.askCapMinutes),
            ...spreadIfDefined('allowlist', request.allowlist),
        })
        return this.get({ platformId })
    },

    async testConnection({ platformId }: PlatformParams): Promise<OpencodeHealth> {
        const row = await this.getOrCreate({ platformId })
        const health = await checkHealth({ row })
        await connectionRepo().update({ id: row.id }, { lastHealth: health })
        return health
    },

    async client({ platformId }: PlatformParams): Promise<OpencodeClient> {
        const row = await this.getOrCreate({ platformId })
        return clientFor({ row })
    },

    async catalog({ platformId }: PlatformParams): Promise<OpencodeCatalog> {
        const client = await this.client({ platformId })
        const namespaces = await client.operator.namespace.list()
        const projects = await client.operator.projectSettings.list()
        if (isNil(namespaces.data) || isNil(projects.data)) {
            return { namespaces: [], error: opencodeErrors.describe({ error: namespaces.error ?? projects.error }) }
        }
        const projectList = projects.data
        return {
            namespaces: namespaces.data.map((summary) => ({
                id: summary.namespace.id,
                name: summary.namespace.name,
                folder: summary.namespace.folder ?? summary.target,
                projects: projectList
                    .filter((project) => project.namespace === summary.namespace.id)
                    .map((project) => ({ id: project.id, name: project.name, folder: project.key })),
            })),
        }
    },
})

async function createDefaultConnection({ platformId }: PlatformParams): Promise<OpencodeConnectionRow> {
    const serverUrl = system.get(AppSystemProp.OPENCODE_URL) ?? DEFAULT_SERVER_URL
    const password = nonEmpty({ value: system.get(AppSystemProp.OPENCODE_PASSWORD) })
    const draft: OpencodeConnectionRow = {
        id: apId(),
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        platformId,
        serverUrl,
        username: nonEmpty({ value: system.get(AppSystemProp.OPENCODE_USERNAME) }) ?? DEFAULT_USERNAME,
        password: isNil(password) ? null : await encryptUtils.encryptString(password),
        adminPanelUrl: system.get(AppSystemProp.OPENCODE_ADMIN_PANEL_URL) ?? serverUrl,
        callbackUrl: system.get(AppSystemProp.OPENCODE_CALLBACK_URL) ?? await domainHelper.getPublicApiUrl({ path: '' }),
        projectsFolder: null,
        enabled: false,
        askCapMinutes: OPENCODE_DEFAULT_ASK_CAP_MINUTES,
        allowlist: [OPENCODE_DEFAULT_NAMESPACE],
        lastHealth: null,
    }
    const health = await checkHealth({ row: draft })
    return connectionRepo().save({ ...draft, enabled: health.healthy, lastHealth: health })
}

async function checkHealth({ row }: { row: OpencodeConnectionRow }): Promise<OpencodeHealth> {
    const checkedAt = new Date().toISOString()
    const { data: result, error } = await tryCatch(async () => {
        const client = await clientFor({ row })
        return client.global.health({ signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) })
    })
    if (isNil(result)) {
        return { healthy: false, error: opencodeErrors.describe({ error }), checkedAt }
    }
    if (isNil(result.data)) {
        const reason = result.response?.status === StatusCodes.UNAUTHORIZED ? CREDENTIALS_REFUSED : opencodeErrors.describe({ error: result.error })
        return { healthy: false, error: reason, checkedAt }
    }
    return { healthy: result.data.healthy, version: result.data.version, checkedAt }
}

function nonEmpty({ value }: { value: string | undefined }): string | undefined {
    return isNil(value) || value.length === 0 ? undefined : value
}

async function clientFor({ row }: { row: OpencodeConnectionRow }): Promise<OpencodeClient> {
    const version = `${row.serverUrl}|${row.username}|${row.password?.data ?? ''}`
    const cached = clientCache.get(row.platformId)
    if (!isNil(cached) && cached.version === version) {
        return cached.client
    }
    const password = isNil(row.password) ? undefined : await encryptUtils.decryptString(row.password)
    const client = await opencodeClient.create({ baseUrl: row.serverUrl, username: row.username, password })
    clientCache.set(row.platformId, { version, client })
    return client
}

function toResponse({ row }: { row: OpencodeConnectionRow }): OpencodeConnection {
    return {
        id: row.id,
        serverUrl: row.serverUrl,
        username: row.username,
        hasPassword: !isNil(row.password),
        adminPanelUrl: row.adminPanelUrl,
        callbackUrl: row.callbackUrl,
        projectsFolder: row.projectsFolder,
        enabled: row.enabled,
        askCapMinutes: row.askCapMinutes,
        allowlist: row.allowlist,
        lastHealth: row.lastHealth,
        emailNotices: opencodeAskEmail.emailConfigured(),
    }
}

const clientCache = new Map<string, { version: string, client: OpencodeClient }>()

const CREATE_LOCK_TIMEOUT_SECONDS = 60

const HEALTH_TIMEOUT_MS = 5000

const DEFAULT_SERVER_URL = 'http://127.0.0.1:4444'

const DEFAULT_USERNAME = 'opencode'

const CREDENTIALS_REFUSED = 'OpenCode refused the username or password (401)'

type PlatformParams = {
    platformId: string
}

type UpdateParams = {
    platformId: string
    request: UpdateOpencodeConnectionRequest
}
