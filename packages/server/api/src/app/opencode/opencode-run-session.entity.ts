import { BaseModelSchema } from '@activepieces/core-utils'
import { Platform, Project } from '@activepieces/shared'
import { EntitySchema } from 'typeorm'
import { z } from 'zod'
import { ApIdSchema, BaseColumnSchemaPart } from '../database/database-common'

const OpencodeRunSessionRow = z.object({
    ...BaseModelSchema,
    platformId: z.string(),
    projectId: z.string(),
    flowRunId: z.string().nullable(),
    namespace: z.string(),
    opencodeProjectId: z.string(),
    agent: z.string(),
    sessionId: z.string().nullable(),
    activeStepId: z.string().nullable(),
})
export type OpencodeRunSessionRow = z.infer<typeof OpencodeRunSessionRow>

export type OpencodeRunSessionSchema = OpencodeRunSessionRow & {
    platform: Platform
    project: Project
}

export const OpencodeRunSessionEntity = new EntitySchema<OpencodeRunSessionSchema>({
    name: 'opencode_run_session',
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
        flowRunId: {
            ...ApIdSchema,
            nullable: true,
        },
        namespace: {
            type: String,
            nullable: false,
        },
        opencodeProjectId: {
            type: String,
            nullable: false,
        },
        agent: {
            type: String,
            nullable: false,
        },
        sessionId: {
            type: String,
            nullable: true,
        },
        activeStepId: {
            ...ApIdSchema,
            nullable: true,
        },
    },
    indices: [
        {
            name: 'idx_opencode_run_session_location',
            columns: ['flowRunId', 'namespace', 'opencodeProjectId', 'agent'],
            unique: true,
        },
        {
            name: 'idx_opencode_run_session_pinned',
            columns: ['platformId', 'sessionId'],
            unique: true,
            where: '"flowRunId" IS NULL',
        },
        {
            name: 'idx_opencode_run_session_project_id',
            columns: ['projectId'],
        },
        {
            name: 'idx_opencode_run_session_platform_id',
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
                foreignKeyConstraintName: 'fk_opencode_run_session_platform_id',
            },
        },
        project: {
            type: 'many-to-one',
            target: 'project',
            cascade: true,
            onDelete: 'CASCADE',
            joinColumn: {
                name: 'projectId',
                foreignKeyConstraintName: 'fk_opencode_run_session_project_id',
            },
        },
    },
})
