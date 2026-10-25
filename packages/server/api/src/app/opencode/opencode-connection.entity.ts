import { BaseModelSchema } from '@activepieces/core-utils'
import { OpencodeHealth, Platform } from '@activepieces/shared'
import { EntitySchema } from 'typeorm'
import { z } from 'zod'
import { ApIdSchema, BaseColumnSchemaPart } from '../database/database-common'
import { EncryptedObject } from '../helper/encryption'

const OpencodeConnectionRow = z.object({
    ...BaseModelSchema,
    platformId: z.string(),
    serverUrl: z.string(),
    username: z.string(),
    password: EncryptedObject.nullable(),
    adminPanelUrl: z.string(),
    callbackUrl: z.string(),
    projectsFolder: z.string().nullable(),
    enabled: z.boolean(),
    askCapMinutes: z.number(),
    allowlist: z.array(z.string()),
    lastHealth: OpencodeHealth.nullable(),
})
export type OpencodeConnectionRow = z.infer<typeof OpencodeConnectionRow>

export type OpencodeConnectionSchema = OpencodeConnectionRow & {
    platform: Platform
}

export const OpencodeConnectionEntity = new EntitySchema<OpencodeConnectionSchema>({
    name: 'opencode_connection',
    columns: {
        ...BaseColumnSchemaPart,
        platformId: {
            ...ApIdSchema,
            nullable: false,
        },
        serverUrl: {
            type: String,
            nullable: false,
        },
        username: {
            type: String,
            nullable: false,
        },
        password: {
            type: 'json',
            nullable: true,
        },
        adminPanelUrl: {
            type: String,
            nullable: false,
        },
        callbackUrl: {
            type: String,
            nullable: false,
        },
        projectsFolder: {
            type: String,
            nullable: true,
        },
        enabled: {
            type: Boolean,
            nullable: false,
            default: false,
        },
        askCapMinutes: {
            type: Number,
            nullable: false,
        },
        allowlist: {
            type: 'jsonb',
            nullable: false,
        },
        lastHealth: {
            type: 'jsonb',
            nullable: true,
        },
    },
    indices: [
        {
            name: 'idx_opencode_connection_platform_id',
            columns: ['platformId'],
            unique: true,
        },
    ],
    relations: {
        platform: {
            type: 'many-to-one',
            target: 'platform',
            cascade: true,
            onDelete: 'CASCADE',
            joinColumn: {
                name: 'platformId',
                foreignKeyConstraintName: 'fk_opencode_connection_platform_id',
            },
        },
    },
})
