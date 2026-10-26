import { isNil } from '@activepieces/core-utils'
import { FastifyBaseLogger } from 'fastify'
import { repoFactory } from '../core/db/repo-factory'
import { engineRunCallbackService } from '../flows/flow-run/engine-run-callback-service'
import { rejectedPromiseHandler } from '../helper/promise-handler'
import { OPENCODE_RUN_AGENT, opencodeAgentPrompt } from './opencode-agent-prompt'
import { opencodeConnectionService } from './opencode-connection.service'
import { opencodeReply } from './opencode-reply'
import { OpencodeStepEntity } from './opencode-step.entity'
import { opencodeStoredRequest } from './opencode-stored-request'

const stepRepo = repoFactory(OpencodeStepEntity)

export const opencodeProgress = (log: FastifyBaseLogger) => ({
    notify({ platformId, sessionId }: SessionParams): void {
        if (scheduled.has(sessionId)) {
            return
        }
        const timer = setTimeout(() => {
            scheduled.delete(sessionId)
            rejectedPromiseHandler(this.push({ platformId, sessionId }), log)
        }, PROGRESS_INTERVAL_MS)
        timer.unref()
        scheduled.set(sessionId, timer)
    },

    async push({ platformId, sessionId }: SessionParams): Promise<number> {
        const steps = await stepRepo().findBy({ platformId, sessionId, status: 'DISPATCHED', action: OPENCODE_RUN_AGENT })
        if (steps.length === 0) {
            return 0
        }
        const client = await opencodeConnectionService(log).client({ platformId })
        const pushed = await Promise.all(steps.map(async (step) => {
            const stored = opencodeStoredRequest.parse(step.request)
            if (isNil(stored) || stored.request.action !== OPENCODE_RUN_AGENT) {
                return false
            }
            const replies = await opencodeReply.transcript({ client, sessionId, messageId: step.messageId, directory: step.directory ?? undefined })
            if (isNil(replies)) {
                return false
            }
            engineRunCallbackService(log).updateStepProgress({
                projectId: step.projectId,
                request: {
                    projectId: step.projectId,
                    runId: step.flowRunId,
                    output: opencodeAgentPrompt.progress({ request: stored.request, replies, stepId: step.id }),
                    sequence: Date.now(),
                },
            })
            return true
        }))
        return pushed.filter(Boolean).length
    },

    stop(): void {
        scheduled.forEach((timer) => clearTimeout(timer))
        scheduled.clear()
    },
})

const scheduled = new Map<string, NodeJS.Timeout>()

const PROGRESS_INTERVAL_MS = 1000

type SessionParams = {
    platformId: string
    sessionId: string
}
