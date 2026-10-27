import { BaseModelSchema } from '@activepieces/core-utils'
import { OpencodeChannelMode, OpencodeChannelStatus, Platform, Project } from '@activepieces/shared'
import { EntitySchema } from 'typeorm'
import { z } from 'zod'
import { ApIdSchema, BaseColumnSchemaPart } from '../database/database-common'

export const OpencodeChannelParticipant = z.object({
    key: z.string(),
    namespace: z.string(),
    project: z.string(),
    projectName: z.string(),
    directory: z.string(),
    agent: z.string(),
    sessionId: z.string().nullable(),
    messageId: z.string(),
    starts: z.boolean(),
})
export type OpencodeChannelParticipant = z.infer<typeof OpencodeChannelParticipant>

export const OpencodeChannelRule = z.object({
    project: z.string(),
    directory: z.string(),
    ruleId: z.string(),
})
export type OpencodeChannelRule = z.infer<typeof OpencodeChannelRule>

export const OpencodeChannelJoin = z.object({
    stepId: z.string(),
    correlationId: z.string(),
    sessionId: z.string(),
    directory: z.string(),
    project: z.string(),
    agent: z.string(),
    messageId: z.string(),
})
export type OpencodeChannelJoin = z.infer<typeof OpencodeChannelJoin>

export const OpencodeChannelFinish = z.object({
    kickoff: z.string(),
    doneBy: z.string().nullable(),
    maxMessages: z.number(),
    timeoutMinutes: z.number(),
})
export type OpencodeChannelFinish = z.infer<typeof OpencodeChannelFinish>

const OpencodeChannelRow = z.object({
    ...BaseModelSchema,
    platformId: z.string(),
    projectId: z.string(),
    flowId: z.string(),
    flowRunId: z.string(),
    flowVersionId: z.string().nullable(),
    stepName: z.string().nullable(),
    opencodeStepId: z.string().nullable(),
    correlationId: z.string(),
    namespace: z.string(),
    mode: OpencodeChannelMode,
    participants: z.array(OpencodeChannelParticipant),
    rules: z.array(OpencodeChannelRule),
    joins: z.array(OpencodeChannelJoin),
    finish: OpencodeChannelFinish.nullable(),
    status: OpencodeChannelStatus,
    finishedBy: z.string().nullable(),
    result: z.object({ value: z.unknown() }).nullable(),
    output: z.record(z.string(), z.unknown()).nullable(),
    closedAt: z.string().nullable(),
})
export type OpencodeChannelRow = z.infer<typeof OpencodeChannelRow>

export type OpencodeChannelSchema = OpencodeChannelRow & {
    platform: Platform
    project: Project
}

export const OpencodeChannelEntity = new EntitySchema<OpencodeChannelSchema>({
    name: 'opencode_channel',
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
            nullable: true,
        },
        opencodeStepId: {
            ...ApIdSchema,
            nullable: true,
        },
        correlationId: {
            type: String,
            nullable: false,
        },
        namespace: {
            type: String,
            nullable: false,
        },
        mode: {
            type: String,
            nullable: false,
        },
        participants: {
            type: 'jsonb',
            nullable: false,
        },
        rules: {
            type: 'jsonb',
            nullable: false,
        },
        joins: {
            type: 'jsonb',
            nullable: false,
        },
        finish: {
            type: 'jsonb',
            nullable: true,
        },
        status: {
            type: String,
            nullable: false,
        },
        finishedBy: {
            type: String,
            nullable: true,
        },
        result: {
            type: 'jsonb',
            nullable: true,
        },
        output: {
            type: 'jsonb',
            nullable: true,
        },
        closedAt: {
            type: 'timestamp with time zone',
            nullable: true,
        },
    },
    indices: [
        {
            name: 'idx_opencode_channel_correlation_id',
            columns: ['correlationId'],
            unique: true,
        },
        {
            name: 'idx_opencode_channel_opencode_step_id',
            columns: ['opencodeStepId'],
            unique: true,
        },
        {
            name: 'idx_opencode_channel_flow_run_id_step_name',
            columns: ['flowRunId', 'stepName'],
        },
        {
            name: 'idx_opencode_channel_flow_version_id_step_name',
            columns: ['flowVersionId', 'stepName'],
        },
        {
            name: 'idx_opencode_channel_status',
            columns: ['status'],
        },
        {
            name: 'idx_opencode_channel_project_id',
            columns: ['projectId'],
        },
        {
            name: 'idx_opencode_channel_platform_id',
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
                foreignKeyConstraintName: 'fk_opencode_channel_platform_id',
            },
        },
        project: {
            type: 'many-to-one',
            target: 'project',
            cascade: true,
            onDelete: 'CASCADE',
            joinColumn: {
                name: 'projectId',
                foreignKeyConstraintName: 'fk_opencode_channel_project_id',
            },
        },
    },
})
