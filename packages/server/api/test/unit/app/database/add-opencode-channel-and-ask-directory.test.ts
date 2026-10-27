import { DataSource } from 'typeorm'
import { PGliteDriver } from 'typeorm-pglite'
import { AddOpencodeChannel1874000000000 } from '../../../../src/app/database/migration/postgres/1874000000000-AddOpencodeChannel'
import { AddOpencodeAskDirectory1875000000000 } from '../../../../src/app/database/migration/postgres/1875000000000-AddOpencodeAskDirectory'

let dataSource: DataSource

async function tables(): Promise<string[]> {
    const rows: { table_name: string }[] = await dataSource.query(`
        SELECT "table_name" FROM information_schema.tables
        WHERE table_name = 'opencode_channel'
    `)
    return rows.map((row) => row.table_name)
}

async function askColumns(): Promise<string[]> {
    const rows: { column_name: string }[] = await dataSource.query(`
        SELECT "column_name" FROM information_schema.columns
        WHERE table_name = 'opencode_ask'
        ORDER BY "column_name"
    `)
    return rows.map((row) => row.column_name)
}

async function insertChannel({ id, correlationId, opencodeStepId }: { id: string, correlationId: string, opencodeStepId: string | null }): Promise<void> {
    await dataSource.query(`
        INSERT INTO "opencode_channel" ("id", "platformId", "projectId", "flowId", "flowRunId", "opencodeStepId", "correlationId", "namespace", "mode", "participants", "rules", "joins", "status")
        VALUES ($1, 'platform_1', 'project_1', 'flow_1', 'run_1', $2, $3, 'crew', 'OPEN', '[]', '[]', '[]', 'OPEN')
    `, [id, opencodeStepId, correlationId])
}

beforeAll(async () => {
    dataSource = new DataSource({
        type: 'postgres',
        driver: new PGliteDriver().driver,
        synchronize: false,
        entities: [],
    })
    await dataSource.initialize()
    await dataSource.query('CREATE TABLE "platform" ("id" varchar(21) PRIMARY KEY)')
    await dataSource.query('CREATE TABLE "project" ("id" varchar(21) PRIMARY KEY)')
    await dataSource.query('CREATE TABLE "opencode_ask" ("id" varchar(21) PRIMARY KEY)')
})

afterAll(async () => {
    await dataSource.destroy()
})

describe('AddOpencodeChannel1874000000000', () => {
    const migration = new AddOpencodeChannel1874000000000()

    it('is a non-breaking migration with a release', () => {
        expect(migration.breaking).toBe(false)
        expect(migration.release).toBe('0.93.0')
    })

    it('creates the channel table idempotently, keeps correlation ids and steps unique, cascades deletes, and drops it on down', async () => {
        const queryRunner = dataSource.createQueryRunner()

        await migration.up(queryRunner)
        await migration.up(queryRunner)
        await dataSource.query('INSERT INTO "platform" ("id") VALUES (\'platform_1\')')
        await dataSource.query('INSERT INTO "project" ("id") VALUES (\'project_1\')')
        await insertChannel({ id: 'channel_1', correlationId: 'iphiflow_ch_1', opencodeStepId: 'step_1' })
        await insertChannel({ id: 'channel_2', correlationId: 'iphiflow_ch_2', opencodeStepId: null })
        await insertChannel({ id: 'channel_3', correlationId: 'iphiflow_ch_3', opencodeStepId: null })

        expect(await tables()).toEqual(['opencode_channel'])
        await expect(insertChannel({ id: 'channel_4', correlationId: 'iphiflow_ch_1', opencodeStepId: null })).rejects.toThrow()
        await expect(insertChannel({ id: 'channel_5', correlationId: 'iphiflow_ch_5', opencodeStepId: 'step_1' })).rejects.toThrow()

        await dataSource.query('DELETE FROM "project" WHERE "id" = \'project_1\'')
        expect(await dataSource.query('SELECT "id" FROM "opencode_channel"')).toEqual([])

        await migration.down(queryRunner)
        await migration.down(queryRunner)

        expect(await tables()).toEqual([])
        await queryRunner.release()
    })
})

describe('AddOpencodeAskDirectory1875000000000', () => {
    const migration = new AddOpencodeAskDirectory1875000000000()

    it('is a non-breaking migration with a release', () => {
        expect(migration.breaking).toBe(false)
        expect(migration.release).toBe('0.93.0')
    })

    it('adds the nullable ask directory column idempotently and removes it on down', async () => {
        const queryRunner = dataSource.createQueryRunner()

        await migration.up(queryRunner)
        await migration.up(queryRunner)
        await dataSource.query('INSERT INTO "opencode_ask" ("id") VALUES (\'ask_1\')')

        expect(await askColumns()).toEqual(['directory', 'id'])
        expect(await dataSource.query('SELECT "directory" FROM "opencode_ask"')).toEqual([{ directory: null }])

        await migration.down(queryRunner)
        await migration.down(queryRunner)

        expect(await askColumns()).toEqual(['id'])
        await queryRunner.release()
    })
})
