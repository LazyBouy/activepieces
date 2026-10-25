import { DataSource } from 'typeorm'
import { PGliteDriver } from 'typeorm-pglite'
import { AddOpencodeConnection1868000000000 } from '../../../../src/app/database/migration/postgres/1868000000000-AddOpencodeConnection'

let dataSource: DataSource

async function tables(): Promise<string[]> {
    const rows: { table_name: string }[] = await dataSource.query(`
        SELECT "table_name" FROM information_schema.tables
        WHERE table_name IN ('opencode_connection', 'opencode_project_link')
        ORDER BY "table_name"
    `)
    return rows.map((row) => row.table_name)
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
})

afterAll(async () => {
    await dataSource.destroy()
})

describe('AddOpencodeConnection1868000000000', () => {
    const migration = new AddOpencodeConnection1868000000000()

    it('is a non-breaking migration with a release', () => {
        expect(migration.breaking).toBe(false)
        expect(migration.release).toBe('0.93.0')
    })

    it('creates both tables idempotently, keeps one connection per platform, cascades deletes, and drops them on down', async () => {
        const queryRunner = dataSource.createQueryRunner()

        await migration.up(queryRunner)
        await migration.up(queryRunner)
        await dataSource.query('INSERT INTO "platform" ("id") VALUES (\'platform_1\')')
        await dataSource.query('INSERT INTO "project" ("id") VALUES (\'project_1\')')
        await dataSource.query(`
            INSERT INTO "opencode_connection" ("id", "platformId", "serverUrl", "username", "adminPanelUrl", "callbackUrl", "askCapMinutes", "allowlist")
            VALUES ('connection_1', 'platform_1', 'http://127.0.0.1:4444', 'opencode', 'http://127.0.0.1:4444', 'http://localhost:4200/api', 1440, '["iphi-flow"]')
        `)
        await dataSource.query(`
            INSERT INTO "opencode_project_link" ("id", "platformId", "projectId", "namespace", "directory", "opencodeProjectId")
            VALUES ('link_1', 'platform_1', 'project_1', 'iphi-flow', '/root/opencode-home/iphi-flow/project_1', 'ab12c')
        `)

        expect(await tables()).toEqual(['opencode_connection', 'opencode_project_link'])
        await expect(dataSource.query(`
            INSERT INTO "opencode_connection" ("id", "platformId", "serverUrl", "username", "adminPanelUrl", "callbackUrl", "askCapMinutes", "allowlist")
            VALUES ('connection_2', 'platform_1', 'http://127.0.0.1:4444', 'opencode', 'http://127.0.0.1:4444', 'http://localhost:4200/api', 1440, '[]')
        `)).rejects.toThrow()

        await dataSource.query('DELETE FROM "project" WHERE "id" = \'project_1\'')
        expect(await dataSource.query('SELECT "id" FROM "opencode_project_link"')).toEqual([])
        await dataSource.query('DELETE FROM "platform" WHERE "id" = \'platform_1\'')
        expect(await dataSource.query('SELECT "id" FROM "opencode_connection"')).toEqual([])

        await migration.down(queryRunner)
        await migration.down(queryRunner)

        expect(await tables()).toEqual([])
        await queryRunner.release()
    })
})
