import { QueryRunner } from 'typeorm'
import { Migration } from '../../migration'

export class AddOpencodeStepAndRunSession1870000000000 implements Migration {
    name = 'AddOpencodeStepAndRunSession1870000000000'
    breaking = false
    release = '0.93.0'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "opencode_step" (
                "id" character varying(21) NOT NULL,
                "created" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "platformId" character varying(21) NOT NULL,
                "projectId" character varying(21) NOT NULL,
                "flowId" character varying(21) NOT NULL,
                "flowRunId" character varying(21) NOT NULL,
                "flowVersionId" character varying(21),
                "stepName" character varying,
                "waitpointId" character varying(21),
                "requestId" character varying NOT NULL,
                "webserverId" character varying,
                "action" character varying NOT NULL,
                "request" jsonb,
                "sessionMode" character varying NOT NULL,
                "namespace" character varying,
                "opencodeProjectId" character varying,
                "directory" character varying,
                "agent" character varying,
                "model" jsonb,
                "runSessionId" character varying(21),
                "sessionId" character varying,
                "messageId" character varying NOT NULL,
                "status" character varying NOT NULL,
                "failure" character varying,
                "dispatchedAt" TIMESTAMP WITH TIME ZONE,
                "completedAt" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "PK_opencode_step" PRIMARY KEY ("id"),
                CONSTRAINT "fk_opencode_step_platform_id" FOREIGN KEY ("platformId") REFERENCES "platform"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
                CONSTRAINT "fk_opencode_step_project_id" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION
            )
        `)
        await queryRunner.query('CREATE UNIQUE INDEX IF NOT EXISTS "idx_opencode_step_waitpoint_id" ON "opencode_step" ("waitpointId")')
        await queryRunner.query('CREATE UNIQUE INDEX IF NOT EXISTS "idx_opencode_step_request_id" ON "opencode_step" ("requestId")')
        await queryRunner.query('CREATE INDEX IF NOT EXISTS "idx_opencode_step_session_id" ON "opencode_step" ("sessionId")')
        await queryRunner.query('CREATE INDEX IF NOT EXISTS "idx_opencode_step_status_updated" ON "opencode_step" ("status", "updated")')
        await queryRunner.query('CREATE INDEX IF NOT EXISTS "idx_opencode_step_run_session_id_status" ON "opencode_step" ("runSessionId", "status")')
        await queryRunner.query('CREATE INDEX IF NOT EXISTS "idx_opencode_step_project_id" ON "opencode_step" ("projectId")')
        await queryRunner.query('CREATE INDEX IF NOT EXISTS "idx_opencode_step_platform_id" ON "opencode_step" ("platformId")')
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "opencode_run_session" (
                "id" character varying(21) NOT NULL,
                "created" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "platformId" character varying(21) NOT NULL,
                "projectId" character varying(21) NOT NULL,
                "flowRunId" character varying(21) NOT NULL,
                "namespace" character varying NOT NULL,
                "opencodeProjectId" character varying NOT NULL,
                "agent" character varying NOT NULL,
                "sessionId" character varying,
                "activeStepId" character varying(21),
                CONSTRAINT "PK_opencode_run_session" PRIMARY KEY ("id"),
                CONSTRAINT "fk_opencode_run_session_platform_id" FOREIGN KEY ("platformId") REFERENCES "platform"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
                CONSTRAINT "fk_opencode_run_session_project_id" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION
            )
        `)
        await queryRunner.query('CREATE UNIQUE INDEX IF NOT EXISTS "idx_opencode_run_session_location" ON "opencode_run_session" ("flowRunId", "namespace", "opencodeProjectId", "agent")')
        await queryRunner.query('CREATE INDEX IF NOT EXISTS "idx_opencode_run_session_project_id" ON "opencode_run_session" ("projectId")')
        await queryRunner.query('CREATE INDEX IF NOT EXISTS "idx_opencode_run_session_platform_id" ON "opencode_run_session" ("platformId")')
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE IF EXISTS "opencode_run_session"')
        await queryRunner.query('DROP TABLE IF EXISTS "opencode_step"')
    }
}
