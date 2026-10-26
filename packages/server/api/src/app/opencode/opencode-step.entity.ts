import { BaseModelSchema } from '@activepieces/core-utils'
import { OpencodeSessionMode, Platform, Project } from '@activepieces/shared'
import { EntitySchema } from 'typeorm'
import { z } from 'zod'
import { ApIdSchema, BaseColumnSchemaPart } from '../database/database-common'

export const OpencodeStepStatus = z.enum(['PENDING', 'QUEUED', 'DISPATCHED', 'COMPLETING', 'COMPLETED', 'FAILED'])
export type OpencodeStepStatus = z.infer<typeof OpencodeStepStatus>

export const OpencodeStepModel = z.object({
    providerID: z.string(),
    modelID: z.string(),
})
export type OpencodeStepModel = z.infer<typeof OpencodeStepModel>

export const OpencodeStepFiles = z.object({
    files: z.array(z.object({ name: z.string(), url: z.string(), size: z.number() })),
    skippedFiles: z.array(z.object({ name: z.string(), reason: z.string() })),
})
export type OpencodeStepFiles = z.infer<typeof OpencodeStepFiles>

const OpencodeStepRow = z.object({
    ...BaseModelSchema,
    platformId: z.string(),
    projectId: z.string(),
    flowId: z.string(),
    flowRunId: z.string(),
    flowVersionId: z.string().nullable(),
    stepName: z.string().nullable(),
    waitpointId: z.string().nullable(),
    requestId: z.string(),
    webserverId: z.string().nullable(),
    action: z.string(),
    request: z.record(z.string(), z.unknown()).nullable(),
    sessionMode: OpencodeSessionMode,
    namespace: z.string().nullable(),
    opencodeProjectId: z.string().nullable(),
    directory: z.string().nullable(),
    agent: z.string().nullable(),
    model: OpencodeStepModel.nullable(),
    runSessionId: z.string().nullable(),
    sessionId: z.string().nullable(),
    messageId: z.string(),
    status: OpencodeStepStatus,
    failure: z.string().nullable(),
    files: OpencodeStepFiles.nullable(),
    dispatchedAt: z.string().nullable(),
    completedAt: z.string().nullable(),
})
export type OpencodeStepRow = z.infer<typeof OpencodeStepRow>

export type OpencodeStepSchema = OpencodeStepRow & {
    platform: Platform
    project: Project
}

export const OpencodeStepEntity = new EntitySchema<OpencodeStepSchema>({
    name: 'opencode_step',
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
        waitpointId: {
            ...ApIdSchema,
            nullable: true,
        },
        requestId: {
            type: String,
            nullable: false,
        },
        webserverId: {
            type: String,
            nullable: true,
        },
        action: {
            type: String,
            nullable: false,
        },
        request: {
            type: 'jsonb',
            nullable: true,
        },
        sessionMode: {
            type: String,
            nullable: false,
        },
        namespace: {
            type: String,
            nullable: true,
        },
        opencodeProjectId: {
            type: String,
            nullable: true,
        },
        directory: {
            type: String,
            nullable: true,
        },
        agent: {
            type: String,
            nullable: true,
        },
        model: {
            type: 'jsonb',
            nullable: true,
        },
        runSessionId: {
            ...ApIdSchema,
            nullable: true,
        },
        sessionId: {
            type: String,
            nullable: true,
        },
        messageId: {
            type: String,
            nullable: false,
        },
        status: {
            type: String,
            nullable: false,
        },
        failure: {
            type: String,
            nullable: true,
        },
        files: {
            type: 'jsonb',
            nullable: true,
        },
        dispatchedAt: {
            type: 'timestamp with time zone',
            nullable: true,
        },
        completedAt: {
            type: 'timestamp with time zone',
            nullable: true,
        },
    },
    indices: [
        {
            name: 'idx_opencode_step_waitpoint_id',
            columns: ['waitpointId'],
            unique: true,
        },
        {
            name: 'idx_opencode_step_request_id',
            columns: ['requestId'],
            unique: true,
        },
        {
            name: 'idx_opencode_step_session_id',
            columns: ['sessionId'],
        },
        {
            name: 'idx_opencode_step_status_updated',
            columns: ['status', 'updated'],
        },
        {
            name: 'idx_opencode_step_run_session_id_status',
            columns: ['runSessionId', 'status'],
        },
        {
            name: 'idx_opencode_step_project_id',
            columns: ['projectId'],
        },
        {
            name: 'idx_opencode_step_platform_id',
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
                foreignKeyConstraintName: 'fk_opencode_step_platform_id',
            },
        },
        project: {
            type: 'many-to-one',
            target: 'project',
            cascade: true,
            onDelete: 'CASCADE',
            joinColumn: {
                name: 'projectId',
                foreignKeyConstraintName: 'fk_opencode_step_project_id',
            },
        },
    },
})
