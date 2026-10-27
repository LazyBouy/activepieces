import { QueryRunner } from 'typeorm'
import { Migration } from '../../migration'

export class AddOpencodePinnedSessions1873000000000 implements Migration {
    name = 'AddOpencodePinnedSessions1873000000000'
    breaking = false
    release = '0.93.0'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE "opencode_run_session" ALTER COLUMN "flowRunId" DROP NOT NULL')
        await queryRunner.query('CREATE UNIQUE INDEX IF NOT EXISTS "idx_opencode_run_session_pinned" ON "opencode_run_session" ("platformId", "sessionId") WHERE "flowRunId" IS NULL')
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP INDEX IF EXISTS "idx_opencode_run_session_pinned"')
        await queryRunner.query('DELETE FROM "opencode_run_session" WHERE "flowRunId" IS NULL')
        await queryRunner.query('ALTER TABLE "opencode_run_session" ALTER COLUMN "flowRunId" SET NOT NULL')
    }
}
