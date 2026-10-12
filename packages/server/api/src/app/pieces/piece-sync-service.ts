import { ActivepiecesError, ErrorCode, groupBy, isEmpty, isNil, tryCatch } from '@activepieces/core-utils'
import { PieceMetadataModelSummary } from '@activepieces/pieces-framework'
import { apVersionUtil } from '@activepieces/server-utils'
import { PieceAudienceFilter, PieceSyncMode, PieceType } from '@activepieces/shared'
import { FastifyBaseLogger } from 'fastify'
import semver from 'semver'
import { rejectedPromiseHandler } from '../helper/promise-handler'
import { system } from '../helper/system/system'
import { AppSystemProp } from '../helper/system/system-props'
import { SystemJobName } from '../helper/system-jobs/common'
import { systemJobHandlers } from '../helper/system-jobs/job-handlers'
import { systemJobsSchedule } from '../helper/system-jobs/system-job'
import { isToolSearchEnabled } from '../tool-search/tool-search-flag'
import { toolSearchReindexJob } from '../tool-search/tool-search-reindex.job'
import { pieceCache } from './metadata/piece-cache'
import { PieceMetadataSchema } from './metadata/piece-metadata-entity'
import { pieceMetadataService, pieceRepos } from './metadata/piece-metadata-service'

const CLOUD_API_URL = 'https://cloud.activepieces.com/api/v1/pieces'
const syncMode = system.get<PieceSyncMode>(AppSystemProp.PIECES_SYNC_MODE)
const CACHE_INVALIDATION_INTERVAL_MS = 15_000
const CATALOG_CACHE_TTL_MS = 60 * 60 * 1000
const REGISTRY_CACHE_TTL_MS = 15 * 60 * 1000
const registryCache = createTimedCache<PieceRegistryResponse[]>({ ttlMs: REGISTRY_CACHE_TTL_MS })
const catalogCache = createTimedCache<PieceMetadataModelSummary[]>({ ttlMs: CATALOG_CACHE_TTL_MS })

export const pieceSyncService = (log: FastifyBaseLogger) => ({
    async setup(): Promise<void> {
        systemJobHandlers.registerJobHandler(SystemJobName.PIECES_SYNC, async function syncPiecesJobHandler(): Promise<void> {
            await pieceSyncService(log).sync({ publishCacheRefresh: true })
        })
        rejectedPromiseHandler(pieceSyncService(log).sync({ publishCacheRefresh: false }), log)
        await systemJobsSchedule(log).upsertJob({
            job: {
                name: SystemJobName.PIECES_SYNC,
                data: {},
                jobId: SystemJobName.PIECES_SYNC,
            },
            schedule: {
                type: 'repeated',
                cron: `${Math.floor(Math.random() * 5)} */1 * * *`,
            },
        })
    },
    async sync({ publishCacheRefresh }: { publishCacheRefresh: boolean }): Promise<void> {
        if (!isSyncEnabled()) {
            log.info('Piece sync service is disabled')
            return
        }
        try {
            log.info({ syncMode }, 'Starting piece synchronization')
            const startTime = performance.now()
            const [dbPieces, cloudPieces] = await Promise.all([pieceRepos().find({
                select: {
                    name: true,
                    version: true,
                    pieceType: true,
                },
            }), listCloudPieces()])
            log.info({ dbCount: dbPieces.length, cloudCount: cloudPieces.length }, 'Fetched pieces from DB and Cloud')
            const piecesToSync = syncMode === PieceSyncMode.OFFICIAL_SELECTED
                ? selectLatestOfWantedPieces({ cloudPieces, dbPieces })
                : cloudPieces
            const { added, fetchFailed } = await installNewPieces(piecesToSync, dbPieces, log, publishCacheRefresh)
            const deleted = await deletePiecesIfNotOnCloud(dbPieces, cloudPieces, log)

            log.info({
                added,
                fetchFailed,
                deleted,
                durationMs: Math.floor(performance.now() - startTime),
            }, 'Piece synchronization completed')

            // React to the catalog-change signal: enqueue an async tool-search reconcile (never inline
            // — embedding must not block sync). The hash-gate means an unchanged catalog re-embeds
            // nothing, so this is cheap; only fire when something changed AND the engine is enabled —
            // without the flag guard a delta would enqueue a reconcile even when tool-search is off,
            // which (if an OpenAI key exists but pgvector does not) crashes silently on every change.
            if ((added > 0 || deleted > 0) && isToolSearchEnabled()) {
                rejectedPromiseHandler(toolSearchReindexJob(log).enqueue({ type: 'all' }), log)
            }
        }
        catch (error) {
            log.error({ error }, 'Error syncing pieces')
        }
    },
    async downloadPiece({ pieceName }: { pieceName: string }): Promise<void> {
        if (!isSyncEnabled()) {
            throw new ActivepiecesError({
                code: ErrorCode.VALIDATION,
                params: { message: 'Piece downloads are turned off on this instance' },
            })
        }
        const cloudPieces = await listCloudPiecesCached()
        const latest = pickLatestVersions(cloudPieces).find((piece) => piece.name === pieceName)
        if (isNil(latest)) {
            throw new ActivepiecesError({
                code: ErrorCode.ENTITY_NOT_FOUND,
                params: { entityType: 'piece', entityId: pieceName, message: `piece_not_in_catalog pieceName=${pieceName}` },
            })
        }
        const dbPieces = await pieceRepos().find({
            select: { name: true, version: true, pieceType: true },
            where: { name: pieceName },
        })
        const { added, fetchFailed } = await installNewPieces([latest], dbPieces, log, true)
        if (fetchFailed > 0) {
            throw new Error(`Could not download piece ${pieceName}@${latest.version} from the catalog`)
        }
        log.info({ piece: { name: pieceName, version: latest.version }, added }, 'Piece downloaded on demand')
        if (added > 0 && isToolSearchEnabled()) {
            rejectedPromiseHandler(toolSearchReindexJob(log).enqueue({ type: 'all' }), log)
        }
    },
    async listCatalog({ platformId, locale }: { platformId: string, locale: string | undefined }): Promise<PieceMetadataModelSummary[]> {
        if (syncMode !== PieceSyncMode.OFFICIAL_SELECTED) {
            return []
        }
        const [summaries, cloudPieces, localPieces] = await Promise.all([
            listCloudSummariesCached({ locale: locale ?? 'en' }),
            listCloudPiecesCached(),
            pieceMetadataService(log).registry({ release: apVersionUtil.getCurrentRelease(), platformId }),
        ])
        const latestCompatible = new Map(pickLatestVersions(cloudPieces).map((piece) => [piece.name, piece.version]))
        const downloaded = new Set(localPieces.map((piece) => piece.name))
        return summaries
            .filter((summary) => latestCompatible.has(summary.name) && !downloaded.has(summary.name))
            .map((summary) => ({ ...summary, version: latestCompatible.get(summary.name) ?? summary.version }))
    },
})

function isSyncEnabled(): boolean {
    return syncMode === PieceSyncMode.OFFICIAL_AUTO || syncMode === PieceSyncMode.OFFICIAL_SELECTED
}

function selectLatestOfWantedPieces({ cloudPieces, dbPieces }: { cloudPieces: PieceRegistryResponse[], dbPieces: PieceMetadataOnly[] }): PieceRegistryResponse[] {
    const downloadedNames = dbPieces
        .filter((piece) => piece.pieceType === PieceType.OFFICIAL)
        .map((piece) => piece.name)
    const wanted = new Set([...configuredPieceNames(), ...downloadedNames])
    return pickLatestVersions(cloudPieces).filter((piece) => wanted.has(piece.name))
}

function configuredPieceNames(): string[] {
    const configured = system.get(AppSystemProp.PIECES_SYNC_LIST)
    if (isNil(configured) || isEmpty(configured)) {
        return []
    }
    return configured
        .split(',')
        .map((name) => name.trim())
        .filter((name) => name.length > 0)
        .map((name) => name.startsWith('@') ? name : `@activepieces/piece-${name}`)
}

function pickLatestVersions(pieces: PieceRegistryResponse[]): PieceRegistryResponse[] {
    return Object.values(groupBy(pieces, (piece) => piece.name)).map((group) => sortByVersionDesc(group)[0])
}

async function listCloudPiecesCached(): Promise<PieceRegistryResponse[]> {
    return registryCache.get({ key: 'registry', load: listCloudPieces })
}

async function listCloudSummariesCached({ locale }: { locale: string }): Promise<PieceMetadataModelSummary[]> {
    return catalogCache.get({
        key: locale,
        load: async () => {
            const queryParams = new URLSearchParams({ locale })
            const response = await fetch(`${CLOUD_API_URL}?${queryParams.toString()}`)
            if (!response.ok) {
                throw new Error(`Failed to fetch the piece catalog: ${response.status}`)
            }
            const summaries: PieceMetadataModelSummary[] = await response.json()
            return summaries
        },
    })
}

function createTimedCache<T>({ ttlMs }: { ttlMs: number }): TimedCache<T> {
    const entries = new Map<string, { fetchedAt: number, value: T }>()
    return {
        async get({ key, load }: { key: string, load: () => Promise<T> }): Promise<T> {
            const cached = entries.get(key)
            if (!isNil(cached) && Date.now() - cached.fetchedAt < ttlMs) {
                return cached.value
            }
            const value = await load()
            entries.set(key, { fetchedAt: Date.now(), value })
            return value
        },
    }
}

async function deletePiecesIfNotOnCloud(dbPieces: PieceMetadataOnly[], cloudPieces: PieceRegistryResponse[], log: FastifyBaseLogger): Promise<number> {
    const cloudMap = new Map<string, true>(cloudPieces.map(cloudPiece => [`${cloudPiece.name}:${cloudPiece.version}`, true]))
    const piecesToDelete = dbPieces.filter(piece => piece.pieceType === PieceType.OFFICIAL && !cloudMap.has(`${piece.name}:${piece.version}`))
    await pieceMetadataService(log).bulkDelete(piecesToDelete.map(piece => ({ name: piece.name, version: piece.version })))
    return piecesToDelete.length
}

async function installNewPieces(cloudPieces: PieceRegistryResponse[], dbPieces: PieceMetadataOnly[], log: FastifyBaseLogger, _publishCacheRefresh: boolean): Promise<{ added: number, fetchFailed: number }> {
    const dbMap = new Map<string, true>(dbPieces.map(dbPiece => [`${dbPiece.name}:${dbPiece.version}`, true]))
    const newPiecesToFetch = cloudPieces.filter(piece => !dbMap.has(`${piece.name}:${piece.version}`))
    const batchSize = 5
    let added = 0
    let fetchFailed = 0
    let addedAtLastInvalidation = 0
    let lastInvalidationTime = performance.now()
    for (let done = 0; done < newPiecesToFetch.length; done += batchSize) {
        const currentBatch = newPiecesToFetch.slice(done, done + batchSize)
        await Promise.all(currentBatch.map(async (piece) => {
            const queryParams = new URLSearchParams({ audience: PieceAudienceFilter.ALL })
            if (piece.version) {
                queryParams.append('version', piece.version)
            }
            const url = `${CLOUD_API_URL}/${piece.name}?${queryParams.toString()}`
            const response = await fetch(url)
            if (!response.ok) {
                log.warn({ piece: { name: piece.name, version: piece.version }, status: response.status }, '[pieceSyncService#installNewPieces] Error reading piece metadata')
                fetchFailed++
                return
            }
            const pieceMetadata = await response.json()
            const { error } = await tryCatch(() => pieceMetadataService(log).create({
                pieceMetadata,
                packageType: pieceMetadata.packageType,
                pieceType: pieceMetadata.pieceType,
                publishCacheRefresh: false,
            }))
            if (error) {
                log.debug({ piece: { name: piece.name, version: piece.version } }, '[pieceSyncService#installNewPieces] Piece already exists, skipping')
            }
            else {
                added++
            }
        }))
        if (added > addedAtLastInvalidation && performance.now() - lastInvalidationTime > CACHE_INVALIDATION_INTERVAL_MS) {
            await pieceCache(log).invalidate()
            addedAtLastInvalidation = added
            lastInvalidationTime = performance.now()
        }
    }
    if (added > addedAtLastInvalidation) {
        await pieceCache(log).invalidate()
    }
    return { added, fetchFailed }
}


async function listCloudPieces(): Promise<PieceRegistryResponse[]> {
    const queryParams = new URLSearchParams()
    queryParams.append('edition', system.getEdition())
    queryParams.append('release', apVersionUtil.getCurrentRelease())
    const response = await fetch(`${CLOUD_API_URL}/registry?${queryParams.toString()}`)
    if (!response.ok) {
        throw new Error(`Failed to fetch cloud pieces: ${response.status}`)
    }
    const pieces: PieceRegistryResponse[] = await response.json()
    const piecesByName = groupBy(pieces, p => p.name)
    const latest = []
    const others = []

    for (const group of Object.values(piecesByName)) {
        const sortedByVersion = sortByVersionDesc(group)
        latest.push(sortedByVersion[0])
        others.push(...sortedByVersion.slice(1))
    }

    return [...latest, ...others]
}

function sortByVersionDesc(items: PieceRegistryResponse[]) {
    return [...items].sort((a, b) =>
        semver.rcompare(a.version, b.version),
    )
}

type PieceRegistryResponse = {
    name: string
    version: string
}


type PieceMetadataOnly = Pick<PieceMetadataSchema, 'name' | 'version' | 'pieceType'>

type TimedCache<T> = {
    get(params: { key: string, load: () => Promise<T> }): Promise<T>
}
