import { QueryRunner } from 'typeorm'
import { Migration } from '../../migration'

export class AddOpencodeAskDirectory1875000000000 implements Migration {
    name = 'AddOpencodeAskDirectory1875000000000'
    breaking = false
    release = '0.93.0'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE "opencode_ask" ADD COLUMN IF NOT EXISTS "directory" character varying')
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE "opencode_ask" DROP COLUMN IF EXISTS "directory"')
    }
}
