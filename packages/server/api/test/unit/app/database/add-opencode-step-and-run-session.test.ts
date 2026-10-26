import { DataSource } from 'typeorm'
import { PGliteDriver } from 'typeorm-pglite'
import { AddOpencodeStepAndRunSession1870000000000 } from '../../../../src/app/database/migration/postgres/1870000000000-AddOpencodeStepAndRunSession'

let dataSource: DataSource

async function tables(): Promise<string[]> {
    const rows: { table_name: string }[] = await dataSource.query(`
        SELECT "table_name" FROM information_schema.tables
        WHERE table_name IN ('opencode_step', 'opencode_run_session')
        ORDER BY "table_name"
    `)
    return rows.map((row) => row.table_name)
}

async function insertStep({ id, waitpointId, requestId }: { id: string, waitpointId: string | null, requestId: string }): Promise<void> {
    await dataSource.query(`
        INSERT INTO "opencode_step" ("id", "platformId", "projectId", "flowId", "flowRunId", "waitpointId", "requestId", "action", "sessionMode", "messageId", "status")
        VALUES ($1, 'platform_1', 'project_1', 'flow_1', 'run_1', $2, $3, 'ASK_AI', 'NEW_PER_STEP', 'msg_1', 'PENDING')
    `, [id, waitpointId, requestId])
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

describe('AddOpencodeStepAndRunSession1870000000000', () => {
    const migration = new AddOpencodeStepAndRunSession1870000000000()

    it('is a non-breaking migration with a release', () => {
        expect(migration.breaking).toBe(false)
        expect(migration.release).toBe('0.93.0')
    })

    it('creates both tables idempotently, keeps one step per waitpoint and one run session per location, cascades deletes, and drops them on down', async () => {
        const queryRunner = dataSource.createQueryRunner()

        await migration.up(queryRunner)
        await migration.up(queryRunner)
        await dataSource.query('INSERT INTO "platform" ("id") VALUES (\'platform_1\')')
        await dataSource.query('INSERT INTO "project" ("id") VALUES (\'project_1\')')
        await insertStep({ id: 'step_1', waitpointId: 'waitpoint_1', requestId: 'request_1' })
        await insertStep({ id: 'step_2', waitpointId: null, requestId: 'request_2' })
        await insertStep({ id: 'step_3', waitpointId: null, requestId: 'request_3' })
        await dataSource.query(`
            INSERT INTO "opencode_run_session" ("id", "platformId", "projectId", "flowRunId", "namespace", "opencodeProjectId", "agent")
            VALUES ('session_1', 'platform_1', 'project_1', 'run_1', 'iphi-flow', 'p0001', 'flow')
        `)

        expect(await tables()).toEqual(['opencode_run_session', 'opencode_step'])
        await expect(insertStep({ id: 'step_4', waitpointId: 'waitpoint_1', requestId: 'request_4' })).rejects.toThrow()
        await expect(insertStep({ id: 'step_5', waitpointId: 'waitpoint_5', requestId: 'request_1' })).rejects.toThrow()
        await expect(dataSource.query(`
            INSERT INTO "opencode_run_session" ("id", "platformId", "projectId", "flowRunId", "namespace", "opencodeProjectId", "agent")
            VALUES ('session_2', 'platform_1', 'project_1', 'run_1', 'iphi-flow', 'p0001', 'flow')
        `)).rejects.toThrow()

        await dataSource.query('DELETE FROM "project" WHERE "id" = \'project_1\'')
        expect(await dataSource.query('SELECT "id" FROM "opencode_step"')).toEqual([])
        expect(await dataSource.query('SELECT "id" FROM "opencode_run_session"')).toEqual([])

        await migration.down(queryRunner)
        await migration.down(queryRunner)

        expect(await tables()).toEqual([])
        await queryRunner.release()
    })
})
