import { DataSource } from 'typeorm'
import { PGliteDriver } from 'typeorm-pglite'
import { AddStepPositionsToFlowVersion1867000000000 } from '../../../../src/app/database/migration/postgres/1867000000000-AddStepPositionsToFlowVersion'

let dataSource: DataSource

async function stepPositionsColumn(): Promise<{ is_nullable: string, column_default: string | null }[]> {
    return dataSource.query(`
        SELECT "is_nullable", "column_default"
        FROM information_schema.columns
        WHERE table_name = 'flow_version' AND column_name = 'stepPositions'
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

describe('AddStepPositionsToFlowVersion1867000000000', () => {
    const migration = new AddStepPositionsToFlowVersion1867000000000()

    it('is a non-breaking migration with a release', () => {
        expect(migration.breaking).toBe(false)
        expect(migration.release).toBe('0.93.0')
    })

    it('adds a NOT NULL jsonb column defaulting to an empty map, idempotently, and drops it on down', async () => {
        await dataSource.query('CREATE TABLE "flow_version" ("id" varchar PRIMARY KEY)')
        await dataSource.query('INSERT INTO "flow_version" ("id") VALUES (\'existing\')')
        const queryRunner = dataSource.createQueryRunner()

        await migration.up(queryRunner)
        await migration.up(queryRunner)
        await dataSource.query('INSERT INTO "flow_version" ("id") VALUES (\'inserted\')')
        const rows: { id: string, stepPositions: unknown }[] = await dataSource.query('SELECT "id", "stepPositions" FROM "flow_version" ORDER BY "id"')
        const [column] = await stepPositionsColumn()

        expect(rows).toEqual([
            { id: 'existing', stepPositions: {} },
            { id: 'inserted', stepPositions: {} },
        ])
        expect(column.is_nullable).toBe('NO')
        expect(column.column_default).toContain('{}')

        await migration.down(queryRunner)
        await migration.down(queryRunner)

        expect(await stepPositionsColumn()).toEqual([])
        await queryRunner.release()
    })
})
