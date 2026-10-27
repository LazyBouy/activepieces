import { QueryRunner } from 'typeorm'
import { Migration } from '../../migration'

export class AddOpencodeChannel1874000000000 implements Migration {
    name = 'AddOpencodeChannel1874000000000'
    breaking = false
    release = '0.93.0'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "opencode_channel" (
                "id" character varying(21) NOT NULL,
                "created" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "platformId" character varying(21) NOT NULL,
                "projectId" character varying(21) NOT NULL,
                "flowId" character varying(21) NOT NULL,
                "flowRunId" character varying(21) NOT NULL,
                "flowVersionId" character varying(21),
                "stepName" character varying,
                "opencodeStepId" character varying(21),
                "correlationId" character varying NOT NULL,
                "namespace" character varying NOT NULL,
                "mode" character varying NOT NULL,
                "participants" jsonb NOT NULL,
                "rules" jsonb NOT NULL,
                "joins" jsonb NOT NULL,
                "finish" jsonb,
                "status" character varying NOT NULL,
                "finishedBy" character varying,
                "result" jsonb,
                "output" jsonb,
                "closedAt" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "PK_opencode_channel" PRIMARY KEY ("id"),
                CONSTRAINT "fk_opencode_channel_platform_id" FOREIGN KEY ("platformId") REFERENCES "platform"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
                CONSTRAINT "fk_opencode_channel_project_id" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION
            )
        `)
        await queryRunner.query('CREATE UNIQUE INDEX IF NOT EXISTS "idx_opencode_channel_correlation_id" ON "opencode_channel" ("correlationId")')
        await queryRunner.query('CREATE UNIQUE INDEX IF NOT EXISTS "idx_opencode_channel_opencode_step_id" ON "opencode_channel" ("opencodeStepId")')
        await queryRunner.query('CREATE INDEX IF NOT EXISTS "idx_opencode_channel_flow_run_id_step_name" ON "opencode_channel" ("flowRunId", "stepName")')
        await queryRunner.query('CREATE INDEX IF NOT EXISTS "idx_opencode_channel_flow_version_id_step_name" ON "opencode_channel" ("flowVersionId", "stepName")')
        await queryRunner.query('CREATE INDEX IF NOT EXISTS "idx_opencode_channel_status" ON "opencode_channel" ("status")')
        await queryRunner.query('CREATE INDEX IF NOT EXISTS "idx_opencode_channel_project_id" ON "opencode_channel" ("projectId")')
        await queryRunner.query('CREATE INDEX IF NOT EXISTS "idx_opencode_channel_platform_id" ON "opencode_channel" ("platformId")')
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE IF EXISTS "opencode_channel"')
    }
}
