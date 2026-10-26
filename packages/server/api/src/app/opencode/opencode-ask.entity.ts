import { BaseModelSchema } from '@activepieces/core-utils'
import { OpencodeAskAnswer, OpencodeAskKind, OpencodeAskPermission, OpencodeAskStatus, OpencodeQuestion, Platform, Project } from '@activepieces/shared'
import { EntitySchema } from 'typeorm'
import { z } from 'zod'
import { ApIdSchema, BaseColumnSchemaPart } from '../database/database-common'

const OpencodeAskRow = z.object({
    ...BaseModelSchema,
    platformId: z.string(),
    projectId: z.string(),
    flowId: z.string(),
    flowRunId: z.string(),
    flowVersionId: z.string().nullable(),
    stepName: z.string(),
    opencodeStepId: z.string(),
    sessionId: z.string(),
    requestId: z.string(),
    kind: z.enum(OpencodeAskKind),
    status: z.union([z.enum(OpencodeAskStatus), z.literal('ANSWERING')]),
    agent: z.string().nullable(),
    permission: OpencodeAskPermission.nullable(),
    questions: z.array(OpencodeQuestion).nullable(),
    deadline: z.string(),
    answer: OpencodeAskAnswer.nullable(),
    answeredVia: z.string().nullable(),
    answeredAt: z.string().nullable(),
})
export type OpencodeAskRow = z.infer<typeof OpencodeAskRow>

export type OpencodeAskSchema = OpencodeAskRow & {
    platform: Platform
    project: Project
}

export const OpencodeAskEntity = new EntitySchema<OpencodeAskSchema>({
    name: 'opencode_ask',
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
        flowId: {
            ...ApIdSchema,
            nullable: false,
        },
        flowRunId: {
            ...ApIdSchema,
            nullable: false,
        },
        flowVersionId: {
            ...ApIdSchema,
            nullable: true,
        },
        stepName: {
            type: String,
            nullable: false,
        },
        opencodeStepId: {
            ...ApIdSchema,
            nullable: false,
        },
        sessionId: {
            type: String,
            nullable: false,
        },
        requestId: {
            type: String,
            nullable: false,
        },
        kind: {
            type: String,
            nullable: false,
        },
        status: {
            type: String,
            nullable: false,
        },
        agent: {
            type: String,
            nullable: true,
        },
        permission: {
            type: 'jsonb',
            nullable: true,
        },
        questions: {
            type: 'jsonb',
            nullable: true,
        },
        deadline: {
            type: 'timestamp with time zone',
            nullable: false,
        },
        answer: {
            type: 'jsonb',
            nullable: true,
        },
        answeredVia: {
            type: String,
            nullable: true,
        },
        answeredAt: {
            type: 'timestamp with time zone',
            nullable: true,
        },
    },
    indices: [
        {
            name: 'idx_opencode_ask_platform_id_request_id',
            columns: ['platformId', 'requestId'],
            unique: true,
        },
        {
            name: 'idx_opencode_ask_flow_run_id',
            columns: ['flowRunId'],
        },
        {
            name: 'idx_opencode_ask_flow_version_id_step_name',
            columns: ['flowVersionId', 'stepName'],
        },
        {
            name: 'idx_opencode_ask_opencode_step_id',
            columns: ['opencodeStepId'],
        },
        {
            name: 'idx_opencode_ask_status_deadline',
            columns: ['status', 'deadline'],
        },
        {
            name: 'idx_opencode_ask_project_id',
            columns: ['projectId'],
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
                foreignKeyConstraintName: 'fk_opencode_ask_platform_id',
            },
        },
        project: {
            type: 'many-to-one',
            target: 'project',
            cascade: true,
            onDelete: 'CASCADE',
            joinColumn: {
                name: 'projectId',
                foreignKeyConstraintName: 'fk_opencode_ask_project_id',
            },
        },
    },
})
