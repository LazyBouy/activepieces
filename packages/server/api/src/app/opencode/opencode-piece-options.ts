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

    async participants({ platformId, projectId }: { platformId: string, projectId: string }): Promise<OpencodeParticipantList> {
        const options = await opencodeOptionsService(log).options({ platformId, projectId })
        if (!options.enabled) {
            return { participants: [], error: opencodeErrors.routingOff() }
        }
        const client = await opencodeConnectionService(log).client({ platformId })
        const listed = await Promise.all(options.namespaces.flatMap((namespace) => namespace.projects.map(async (project) => {
            const { data: result } = await tryCatch(() => client.operator.agent.list({ directory: project.folder }, { throwOnError: true }))
            return (result?.data ?? [])
                .filter((agent) => agent.mode !== SUBAGENT && agent.hidden !== true && !agent.disabled)
                .map((agent) => ({ namespace: namespace.id, namespaceName: namespace.name, project: project.id, projectName: project.name, agent: agent.name }))
        })))
        return { participants: listed.flat(), ...(isNil(options.error) ? {} : { error: options.error }) }
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

const SUBAGENT = 'subagent'

export const OpencodeParticipantList = z.object({
    participants: z.array(z.object({
        namespace: z.string(),
        namespaceName: z.string(),
        project: z.string(),
        projectName: z.string(),
        agent: z.string(),
    })),
    error: z.string().optional(),
})
export type OpencodeParticipantList = z.infer<typeof OpencodeParticipantList>

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
