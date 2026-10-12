import { PackageType, PieceType } from '@activepieces/shared'
import { FastifyBaseLogger, FastifyInstance } from 'fastify'
import { StatusCodes } from 'http-status-codes'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { pieceCache } from '../../../../src/app/pieces/metadata/piece-cache'
import { pieceRepos } from '../../../../src/app/pieces/metadata/piece-metadata-service'
import { pieceSyncService } from '../../../../src/app/pieces/piece-sync-service'
import { createMockPieceMetadata } from '../../../helpers/mocks'
import { createTestContext } from '../../../helpers/test-context'
import { setupTestEnvironment, teardownTestEnvironment } from '../../../helpers/test-setup'

const originalEnv = vi.hoisted(() => {
    const previous = {
        mode: process.env.AP_PIECES_SYNC_MODE,
        list: process.env.AP_PIECES_SYNC_LIST,
    }
    process.env.AP_PIECES_SYNC_MODE = 'OFFICIAL_SELECTED'
    process.env.AP_PIECES_SYNC_LIST = 'selected-alpha, @activepieces/piece-selected-beta'
    return previous
})

const CLOUD_PIECES_URL = 'https://cloud.activepieces.com/api/v1/pieces'
const ALPHA = '@activepieces/piece-selected-alpha'
const BETA = '@activepieces/piece-selected-beta'
const GAMMA = '@activepieces/piece-selected-gamma'
const DELTA = '@activepieces/piece-selected-delta'

const REGISTRY = [
    { name: ALPHA, version: '1.0.0' },
    { name: ALPHA, version: '1.1.0' },
    { name: BETA, version: '2.0.0' },
    { name: GAMMA, version: '1.0.0' },
    { name: GAMMA, version: '1.2.0' },
]

let app: FastifyInstance
let mockLog: FastifyBaseLogger

function cloudPiece({ name, version }: { name: string, version: string }): ReturnType<typeof createMockPieceMetadata> {
    return createMockPieceMetadata({
        name,
        version,
        displayName: name,
        pieceType: PieceType.OFFICIAL,
        packageType: PackageType.REGISTRY,
    })
}

function cloudSummaries(): Record<string, unknown>[] {
    return [ALPHA, BETA, GAMMA, DELTA].map((name) => ({
        name,
        displayName: name,
        version: '9.0.0',
        logoUrl: 'https://cdn.activepieces.com/pieces/probe.png',
        description: `${name} description`,
        categories: [],
        actions: 1,
        triggers: 0,
    }))
}

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
    })
}

function stubCloudFetch(): void {
    const realFetch = globalThis.fetch
    vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
        const target = input instanceof Request ? input.url : String(input)
        if (!target.startsWith(CLOUD_PIECES_URL)) {
            return realFetch(input, init)
        }
        const url = new URL(target)
        if (url.pathname === '/api/v1/pieces/registry') {
            return jsonResponse(REGISTRY)
        }
        if (url.pathname === '/api/v1/pieces') {
            return jsonResponse(cloudSummaries())
        }
        const name = decodeURIComponent(url.pathname.replace('/api/v1/pieces/', ''))
        const version = url.searchParams.get('version')
        const entry = REGISTRY.find((piece) => piece.name === name && piece.version === version)
        if (entry === undefined) {
            return jsonResponse({ message: 'not found' }, 404)
        }
        return jsonResponse(cloudPiece(entry))
    })
}

async function settleBootSync(): Promise<void> {
    const deadline = Date.now() + 15_000
    while (Date.now() < deadline) {
        const row = await pieceRepos().findOneBy({ name: BETA })
        if (row !== null) {
            return
        }
        await new Promise(resolve => setTimeout(resolve, 100))
    }
    throw new Error('Boot piece sync did not settle in time')
}

async function storedVersions(): Promise<string[]> {
    const rows = await pieceRepos().find({ select: { name: true, version: true } })
    return rows.map((row) => `${row.name}@${row.version}`).sort()
}

beforeAll(async () => {
    stubCloudFetch()
    app = await setupTestEnvironment({ fresh: true })
    mockLog = app.log
    await settleBootSync()
})

afterAll(async () => {
    vi.unstubAllGlobals()
    if (originalEnv.mode === undefined) {
        delete process.env.AP_PIECES_SYNC_MODE
    }
    else {
        process.env.AP_PIECES_SYNC_MODE = originalEnv.mode
    }
    if (originalEnv.list === undefined) {
        delete process.env.AP_PIECES_SYNC_LIST
    }
    else {
        process.env.AP_PIECES_SYNC_LIST = originalEnv.list
    }
    await teardownTestEnvironment()
})

beforeEach(async () => {
    await pieceRepos().createQueryBuilder().delete().execute()
    await pieceCache(mockLog).invalidate()
})

describe('Selected piece sync', () => {
    it('downloads only the latest version of each listed piece', async () => {
        await pieceSyncService(mockLog).sync({ publishCacheRefresh: false })

        expect(await storedVersions()).toEqual([`${ALPHA}@1.1.0`, `${BETA}@2.0.0`])
    })

    it('keeps a piece downloaded on demand up to date even though it is not listed', async () => {
        await pieceRepos().save(cloudPiece({ name: GAMMA, version: '1.0.0' }))

        await pieceSyncService(mockLog).sync({ publishCacheRefresh: false })

        expect(await storedVersions()).toEqual([`${ALPHA}@1.1.0`, `${BETA}@2.0.0`, `${GAMMA}@1.0.0`, `${GAMMA}@1.2.0`])
    })

    it('downloads a single piece on request', async () => {
        const ctx = await createTestContext(app)

        const response = await ctx.post('/v1/pieces/sync', { pieceName: GAMMA })

        expect(response.statusCode).toBe(StatusCodes.OK)
        expect(await storedVersions()).toEqual([`${GAMMA}@1.2.0`])
    })

    it('rejects a piece that is not in the catalog', async () => {
        const ctx = await createTestContext(app)

        const response = await ctx.post('/v1/pieces/sync', { pieceName: DELTA })

        expect(response.statusCode).toBe(StatusCodes.NOT_FOUND)
        expect(await storedVersions()).toEqual([])
    })

    it('lists catalog pieces that are not downloaded, at their latest compatible version', async () => {
        await pieceSyncService(mockLog).sync({ publishCacheRefresh: false })
        const ctx = await createTestContext(app)

        const response = await ctx.get('/v1/pieces/catalog')

        expect(response.statusCode).toBe(StatusCodes.OK)
        const catalog: { name: string, version: string }[] = response.json()
        expect(catalog.map((piece) => `${piece.name}@${piece.version}`)).toEqual([`${GAMMA}@1.2.0`])
    })
})
