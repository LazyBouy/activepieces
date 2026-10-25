import { DataSource } from 'typeorm'
import { PGliteDriver } from 'typeorm-pglite'
import { AddOpencodeDefaultsToFlowVersion1869000000000 } from '../../../../src/app/database/migration/postgres/1869000000000-AddOpencodeDefaultsToFlowVersion'

let dataSource: DataSource

async function opencodeDefaultsColumn(): Promise<{ is_nullable: string, column_default: string | null }[]> {
    return dataSource.query(`
        SELECT "is_nullable", "column_default"
        FROM information_schema.columns
        WHERE table_name = 'flow_version' AND column_name = 'opencodeDefaults'
    `)
}

beforeAll(async () => {
    dataSource = new DataSource({
        type: 'postgres',
        driver: new PGliteDriver().driver,
        synchronize: false,
        entities: [],
    })
    await dataSource.initialize()
})

afterAll(async () => {
    await dataSource.destroy()
})

describe('AddOpencodeDefaultsToFlowVersion1869000000000', () => {
    const migration = new AddOpencodeDefaultsToFlowVersion1869000000000()

    it('is a non-breaking migration with a release', () => {
        expect(migration.breaking).toBe(false)
        expect(migration.release).toBe('0.93.0')
    })

    it('adds a NOT NULL jsonb column defaulting to empty settings, idempotently, and drops it on down', async () => {
        await dataSource.query('CREATE TABLE "flow_version" ("id" varchar PRIMARY KEY)')
        await dataSource.query('INSERT INTO "flow_version" ("id") VALUES (\'existing\')')
        const queryRunner = dataSource.createQueryRunner()

        await migration.up(queryRunner)
        await migration.up(queryRunner)
        await dataSource.query('INSERT INTO "flow_version" ("id") VALUES (\'inserted\')')
        await dataSource.query('INSERT INTO "flow_version" ("id", "opencodeDefaults") VALUES (\'shared\', \'{"sessionMode":"ONE_PER_RUN"}\')')
        const rows: { id: string, opencodeDefaults: unknown }[] = await dataSource.query('SELECT "id", "opencodeDefaults" FROM "flow_version" ORDER BY "id"')
        const [column] = await opencodeDefaultsColumn()

        expect(rows).toEqual([
            { id: 'existing', opencodeDefaults: {} },
            { id: 'inserted', opencodeDefaults: {} },
            { id: 'shared', opencodeDefaults: { sessionMode: 'ONE_PER_RUN' } },
        ])
        expect(column.is_nullable).toBe('NO')
        expect(column.column_default).toContain('{}')

        await migration.down(queryRunner)
        await migration.down(queryRunner)

        expect(await opencodeDefaultsColumn()).toEqual([])
        await queryRunner.release()
    })
})
