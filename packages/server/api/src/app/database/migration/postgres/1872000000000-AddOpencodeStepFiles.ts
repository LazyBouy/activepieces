import { QueryRunner } from 'typeorm'
import { Migration } from '../../migration'

export class AddOpencodeStepFiles1872000000000 implements Migration {
    name = 'AddOpencodeStepFiles1872000000000'
    breaking = false
    release = '0.93.0'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE "opencode_step" ADD COLUMN IF NOT EXISTS "files" jsonb')
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE "opencode_step" DROP COLUMN IF EXISTS "files"')
    }
}
