import { isNil } from '@activepieces/core-utils'
import { OpencodeClient, OperatorInboxRule } from '@opencode-ai/sdk/v2/client'
import { FastifyBaseLogger } from 'fastify'
import { distributedLock } from '../database/redis-connections'
import { opencodeErrors, OpencodeRequestError } from './opencode-errors'

export const opencodeInboxRules = (log: FastifyBaseLogger) => ({
    async addFirst({ platformId, client, project, directory, rules }: AddParams): Promise<void> {
        await change({ platformId, client, project, directory, log, edit: (current) => [...rules, ...current.filter((rule) => !rules.some((added) => added.id === rule.id))] })
    },

    async remove({ platformId, client, project, directory, ruleIds }: RemoveParams): Promise<void> {
        await change({ platformId, client, project, directory, log, edit: (current) => current.filter((rule) => !ruleIds.includes(rule.id)) })
    },
})

async function change({ platformId, client, project, directory, edit, log }: ChangeParams): Promise<void> {
    await distributedLock(log).runExclusive({
        key: `opencode_inbox_rules_${platformId}_${project}`,
        timeoutInSeconds: LOCK_TIMEOUT_SECONDS,
        fn: async () => {
            const current = await client.operator.projectInbox.rules({ project, directory })
            if (isNil(current.data)) {
                throw new OpencodeRequestError({ status: current.response?.status, message: opencodeErrors.describe({ error: current.error }) })
            }
            const saved = await client.operator.projectInbox.setRules({ project, directory, rules: edit(current.data.rules) })
            if (isNil(saved.data)) {
                throw new OpencodeRequestError({ status: saved.response?.status, message: opencodeErrors.describe({ error: saved.error }) })
            }
        },
    })
}

const LOCK_TIMEOUT_SECONDS = 30

type AddParams = {
    platformId: string
    client: OpencodeClient
    project: string
    directory: string
    rules: OperatorInboxRule[]
}

type RemoveParams = {
    platformId: string
    client: OpencodeClient
    project: string
    directory: string
    ruleIds: string[]
}

type ChangeParams = {
    platformId: string
    client: OpencodeClient
    project: string
    directory: string
    edit: (current: OperatorInboxRule[]) => OperatorInboxRule[]
    log: FastifyBaseLogger
}
