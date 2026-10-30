import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { FastifyBaseLogger, FastifyInstance } from 'fastify'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { startDevPieceWatcher } from '../../../../src/app/pieces/dev-piece-watcher'
import { filePiecesUtils } from '../../../../src/app/pieces/metadata/utils/file-pieces-utils'

const fixture = vi.hoisted(() => ({
    root: `${process.env.TMPDIR ?? '/tmp'}/ap-dev-pieces-test-${process.pid}-${Date.now()}`,
}))

vi.mock('node:process', async (importOriginal): Promise<typeof import('node:process')> => ({
    ...(await importOriginal<typeof import('node:process')>()),
    cwd: () => fixture.root,
}))

vi.mock('chokidar', () => ({
    default: { watch: vi.fn(() => ({ on: vi.fn(), close: vi.fn() })) },
}))

const customPieces = join(fixture.root, 'packages', 'pieces', 'custom')

const mockLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
const log = mockLog as unknown as FastifyBaseLogger

beforeAll(async () => {
    await writeBuiltPiece({ folder: 'built-only' })
    await writeBuiltPiece({ folder: 'with-source' })
    await writeFile(join(customPieces, 'with-source', 'package.json'), manifest({ folder: 'with-source' }))
    await mkdir(join(customPieces, 'with-source', 'src'), { recursive: true })
    await writeBuiltPiece({ folder: 'common' })
    await mkdir(join(customPieces, 'source-without-dist', 'src'), { recursive: true })
    await writeFile(join(customPieces, 'source-without-dist', 'package.json'), manifest({ folder: 'source-without-dist' }))
})

afterAll(async () => {
    await rm(fixture.root, { recursive: true, force: true })
})

afterEach(() => {
    vi.clearAllMocks()
    delete process.env.AP_DEV_PIECES
})

describe('filePiecesUtils.loadDistPiecesMetadata', () => {
    it('loads a piece whose folder holds only dist', async () => {
        const pieces = await filePiecesUtils(log).loadDistPiecesMetadata(['built-only'])
        expect(pieces.map((piece) => piece.name)).toEqual(['@fixture/piece-built-only'])
        expect(pieces[0].displayName).toBe('Fixture built-only')
    })

    it('still loads a source piece with its dist', async () => {
        const pieces = await filePiecesUtils(log).loadDistPiecesMetadata(['with-source'])
        expect(pieces.map((piece) => piece.name)).toEqual(['@fixture/piece-with-source'])
    })

    it('does not load the common library as a piece', async () => {
        const pieces = await filePiecesUtils(log).loadDistPiecesMetadata(['common'])
        expect(pieces).toEqual([])
    })

    it('does not load a source piece that has no dist', async () => {
        const pieces = await filePiecesUtils(log).loadDistPiecesMetadata(['source-without-dist'])
        expect(pieces).toEqual([])
    })

    it('warns about the names that match no built piece', async () => {
        const pieces = await filePiecesUtils(log).loadDistPiecesMetadata(['built-only', 'missing', 'source-without-dist'])
        expect(pieces.map((piece) => piece.name)).toEqual(['@fixture/piece-built-only'])
        expect(mockLog.warn).toHaveBeenCalledTimes(1)
        expect(mockLog.warn.mock.calls[0][0]).toEqual({ piece: { names: ['missing', 'source-without-dist'] } })
    })

    it('does not warn when every name matches', async () => {
        await filePiecesUtils(log).loadDistPiecesMetadata(['built-only', 'with-source'])
        expect(mockLog.warn).not.toHaveBeenCalled()
    })
})

describe('startDevPieceWatcher', () => {
    it('skips built-only pieces without an error', async () => {
        process.env.AP_DEV_PIECES = 'built-only'
        const app = { log, io: { emit: vi.fn() } } as unknown as FastifyInstance
        await expect(startDevPieceWatcher(app)).resolves.toBeUndefined()
        expect(mockLog.error).not.toHaveBeenCalled()
        expect(mockLog.info).toHaveBeenCalledWith('Not watching built-only: it has no source, only a built dist')
    })

    it('still watches a piece that has its source', async () => {
        process.env.AP_DEV_PIECES = 'with-source,built-only'
        const app = { log, io: { emit: vi.fn() } } as unknown as FastifyInstance
        await startDevPieceWatcher(app)
        expect(mockLog.error).not.toHaveBeenCalled()
        expect(mockLog.info).toHaveBeenCalledWith('Watching for changes: with-source')
        expect(mockLog.info).not.toHaveBeenCalledWith('Watching for changes: built-only')
    })
})

async function writeBuiltPiece({ folder }: { folder: string }): Promise<void> {
    const dist = join(customPieces, folder, 'dist')
    await mkdir(join(dist, 'src'), { recursive: true })
    await writeFile(join(dist, 'package.json'), manifest({ folder }))
    await writeFile(join(dist, 'src', 'index.js'), pieceModule({ folder }))
}

function manifest({ folder }: { folder: string }): string {
    return JSON.stringify({ name: `@fixture/piece-${folder}`, version: '0.1.0', main: './src/index.js' })
}

function pieceModule({ folder }: { folder: string }): string {
    return [
        'class Piece {',
        '  constructor() { this.authors = [\'fixture\'] }',
        `  metadata() { return { displayName: 'Fixture ${folder}', description: '', logoUrl: '', actions: {}, triggers: {}, categories: [], minimumSupportedRelease: '0.0.0', maximumSupportedRelease: '99999.99999.9999' } }`,
        '}',
        'module.exports = { piece: new Piece() }',
    ].join('\n')
}
