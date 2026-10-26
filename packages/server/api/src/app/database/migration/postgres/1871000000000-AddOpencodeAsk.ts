import { QueryRunner } from 'typeorm'
import { Migration } from '../../migration'

export class AddOpencodeAsk1871000000000 implements Migration {
    name = 'AddOpencodeAsk1871000000000'
    breaking = false
    release = '0.93.0'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "opencode_ask" (
                "id" character varying(21) NOT NULL,
                "created" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "platformId" character varying(21) NOT NULL,
                "projectId" character varying(21) NOT NULL,
                "flowId" character varying(21) NOT NULL,
                "flowRunId" character varying(21) NOT NULL,
                "flowVersionId" character varying(21),
                "stepName" character varying NOT NULL,
                "opencodeStepId" character varying(21) NOT NULL,
                "sessionId" character varying NOT NULL,
                "requestId" character varying NOT NULL,
                "kind" character varying NOT NULL,
                "status" character varying NOT NULL,
                "agent" character varying,
                "permission" jsonb,
                "questions" jsonb,
                "deadline" TIMESTAMP WITH TIME ZONE NOT NULL,
                "answer" jsonb,
                "answeredVia" character varying,
                "answeredAt" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "PK_opencode_ask" PRIMARY KEY ("id"),
                CONSTRAINT "fk_opencode_ask_platform_id" FOREIGN KEY ("platformId") REFERENCES "platform"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
                CONSTRAINT "fk_opencode_ask_project_id" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION
            )
        `)
        await queryRunner.query('CREATE UNIQUE INDEX IF NOT EXISTS "idx_opencode_ask_platform_id_request_id" ON "opencode_ask" ("platformId", "requestId")')
        await queryRunner.query('CREATE INDEX IF NOT EXISTS "idx_opencode_ask_flow_run_id" ON "opencode_ask" ("flowRunId")')
        await queryRunner.query('CREATE INDEX IF NOT EXISTS "idx_opencode_ask_flow_version_id_step_name" ON "opencode_ask" ("flowVersionId", "stepName")')
        await queryRunner.query('CREATE INDEX IF NOT EXISTS "idx_opencode_ask_opencode_step_id" ON "opencode_ask" ("opencodeStepId")')
        await queryRunner.query('CREATE INDEX IF NOT EXISTS "idx_opencode_ask_status_deadline" ON "opencode_ask" ("status", "deadline")')
        await queryRunner.query('CREATE INDEX IF NOT EXISTS "idx_opencode_ask_project_id" ON "opencode_ask" ("projectId")')
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE IF EXISTS "opencode_ask"')
    }
}
