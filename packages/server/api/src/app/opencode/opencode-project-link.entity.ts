import { BaseModelSchema } from '@activepieces/core-utils'
import { Platform, Project } from '@activepieces/shared'
import { EntitySchema } from 'typeorm'
import { z } from 'zod'
import { ApIdSchema, BaseColumnSchemaPart } from '../database/database-common'

const OpencodeProjectLinkRow = z.object({
    ...BaseModelSchema,
    platformId: z.string(),
    projectId: z.string(),
    namespace: z.string(),
    directory: z.string(),
    opencodeProjectId: z.string(),
})
export type OpencodeProjectLinkRow = z.infer<typeof OpencodeProjectLinkRow>

export type OpencodeProjectLinkSchema = OpencodeProjectLinkRow & {
    platform: Platform
    project: Project
}

export const OpencodeProjectLinkEntity = new EntitySchema<OpencodeProjectLinkSchema>({
    name: 'opencode_project_link',
    columns: {
        ...BaseColumnSchemaPart,
        platformId: {
            ...ApIdSchema,
            nullable: false,
        },
        projectId: {
            ...ApIdSchema,
            nullable: false,
        },
        namespace: {
            type: String,
            nullable: false,
        },
        directory: {
            type: String,
            nullable: false,
        },
        opencodeProjectId: {
            type: String,
            nullable: false,
        },
    },
    indices: [
        {
            name: 'idx_opencode_project_link_project_id',
            columns: ['projectId'],
            unique: true,
        },
        {
            name: 'idx_opencode_project_link_platform_id',
            columns: ['platformId'],
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
                foreignKeyConstraintName: 'fk_opencode_project_link_platform_id',
            },
        },
        project: {
            type: 'many-to-one',
            target: 'project',
            cascade: true,
            onDelete: 'CASCADE',
            joinColumn: {
                name: 'projectId',
                foreignKeyConstraintName: 'fk_opencode_project_link_project_id',
            },
        },
    },
})
