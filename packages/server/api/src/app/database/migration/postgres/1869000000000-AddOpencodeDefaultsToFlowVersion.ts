import { QueryRunner } from 'typeorm'
import { Migration } from '../../migration'

export class AddOpencodeDefaultsToFlowVersion1869000000000 implements Migration {
    name = 'AddOpencodeDefaultsToFlowVersion1869000000000'
    breaking = false
    release = '0.93.0'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE "flow_version" ADD COLUMN IF NOT EXISTS "opencodeDefaults" jsonb NOT NULL DEFAULT \'{}\'')
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE "flow_version" DROP COLUMN IF EXISTS "opencodeDefaults"')
    }
}
