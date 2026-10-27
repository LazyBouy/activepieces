import { isNil, tryCatch } from '@activepieces/core-utils'
import { FastifyBaseLogger } from 'fastify'
import { z } from 'zod'
import { opencodeConnectionService } from './opencode-connection.service'
import { opencodeErrors } from './opencode-errors'
import { opencodeOptionsService } from './opencode-options.service'

export const opencodePieceOptions = (log: FastifyBaseLogger) => ({
    async commands({ platformId, projectId, namespace, project }: ListParams): Promise<OpencodeCommandList> {
        const located = await opencodeOptionsService(log).locate({ platformId, projectId, namespace, project })
        if (located.kind !== 'found') {
            return { commands: [], ...(located.kind === 'error' ? { error: located.error } : {}) }
        }
        const client = await opencodeConnectionService(log).client({ platformId })
        const { data: result, error } = await tryCatch(() => client.command.list({ directory: located.directory }, { throwOnError: true }))
        if (isNil(result)) {
            return { commands: [], error: opencodeErrors.describe({ error }) }
        }
        return {
            commands: result.data.map((command) => ({
                name: command.name,
                source: command.source ?? COMMAND_SOURCE,
                ...(isNil(command.description) ? {} : { description: command.description }),
            })),
        }
    },

    async groups({ platformId, projectId, namespace, project }: ListParams): Promise<OpencodeGroupList> {
        const located = await opencodeOptionsService(log).locate({ platformId, projectId, namespace, project })
        if (located.kind !== 'found') {
            return { groups: [], ...(located.kind === 'error' ? { error: located.error } : {}) }
        }
        const client = await opencodeConnectionService(log).client({ platformId })
        const { data: result, error } = await tryCatch(() => client.operator.projectRecord.list({ throwOnError: true }))
        if (isNil(result)) {
            return { groups: [], error: opencodeErrors.describe({ error }) }
        }
        const record = result.data.find((candidate) => candidate.key === located.directory)
        return { groups: (record?.groups ?? []).map((group) => ({ id: group.id, name: group.name })) }
    },
})

const COMMAND_SOURCE = 'command'

export const OpencodeCommandList = z.object({
    commands: z.array(z.object({
        name: z.string(),
        source: z.string(),
        description: z.string().optional(),
    })),
    error: z.string().optional(),
})
export type OpencodeCommandList = z.infer<typeof OpencodeCommandList>

export const OpencodeGroupList = z.object({
    groups: z.array(z.object({ id: z.string(), name: z.string() })),
    error: z.string().optional(),
})
export type OpencodeGroupList = z.infer<typeof OpencodeGroupList>

type ListParams = {
    platformId: string
    projectId: string
    namespace?: string
    project?: string
}
