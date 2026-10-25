import { QueryRunner } from 'typeorm'
import { Migration } from '../../migration'

export class AddOpencodeConnection1868000000000 implements Migration {
    name = 'AddOpencodeConnection1868000000000'
    breaking = false
    release = '0.93.0'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "opencode_connection" (
                "id" character varying(21) NOT NULL,
                "created" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "platformId" character varying(21) NOT NULL,
                "serverUrl" character varying NOT NULL,
                "username" character varying NOT NULL,
                "password" json,
                "adminPanelUrl" character varying NOT NULL,
                "callbackUrl" character varying NOT NULL,
                "projectsFolder" character varying,
                "enabled" boolean NOT NULL DEFAULT false,
                "askCapMinutes" integer NOT NULL,
                "allowlist" jsonb NOT NULL,
                "lastHealth" jsonb,
                CONSTRAINT "PK_opencode_connection" PRIMARY KEY ("id"),
                CONSTRAINT "fk_opencode_connection_platform_id" FOREIGN KEY ("platformId") REFERENCES "platform"("id") ON DELETE CASCADE ON UPDATE NO ACTION
            )
        `)
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "idx_opencode_connection_platform_id" ON "opencode_connection" ("platformId")
        `)
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "opencode_project_link" (
                "id" character varying(21) NOT NULL,
                "created" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "platformId" character varying(21) NOT NULL,
                "projectId" character varying(21) NOT NULL,
                "namespace" character varying NOT NULL,
                "directory" character varying NOT NULL,
                "opencodeProjectId" character varying NOT NULL,
                CONSTRAINT "PK_opencode_project_link" PRIMARY KEY ("id"),
                CONSTRAINT "fk_opencode_project_link_platform_id" FOREIGN KEY ("platformId") REFERENCES "platform"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
                CONSTRAINT "fk_opencode_project_link_project_id" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION
            )
        `)
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "idx_opencode_project_link_project_id" ON "opencode_project_link" ("projectId")
        `)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_opencode_project_link_platform_id" ON "opencode_project_link" ("platformId")
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP TABLE IF EXISTS "opencode_project_link"
        `)
        await queryRunner.query(`
            DROP TABLE IF EXISTS "opencode_connection"
        `)
    }
}
