import { isNil, tryCatch } from '@activepieces/core-utils'
import { FastifyBaseLogger } from 'fastify'
import { z } from 'zod'
import { repoFactory } from '../core/db/repo-factory'
import { distributedLock } from '../database/redis-connections'
import { rejectedPromiseHandler } from '../helper/promise-handler'
import { opencodeCompletion } from './opencode-completion'
import { OpencodeConnectionEntity } from './opencode-connection.entity'
import { opencodeConnectionService } from './opencode-connection.service'
import { opencodeDispatch } from './opencode-dispatch'
import { opencodeErrors } from './opencode-errors'
import { opencodeProgress } from './opencode-progress'
import { OpencodeStepEntity } from './opencode-step.entity'
import { opencodeSweep } from './opencode-sweep'

const stepRepo = repoFactory(OpencodeStepEntity)
const connectionRepo = repoFactory(OpencodeConnectionEntity)

export const opencodeBridge = (log: FastifyBaseLogger) => ({
    start(): void {
        if (!isNil(state.timer)) {
            return
        }
        state.timer = setInterval(() => rejectedPromiseHandler(this.reconcile(), log), RECONCILE_INTERVAL_MS)
        rejectedPromiseHandler(this.reconcile(), log)
    },

    stop(): void {
        if (!isNil(state.timer)) {
            clearInterval(state.timer)
            state.timer = null
        }
        state.running.forEach((controller) => controller.abort())
        state.running.clear()
        opencodeProgress(log).stop()
    },

    async reconcile(): Promise<void> {
        const enabled = await connectionRepo().findBy({ enabled: true })
        const wanted = new Set(enabled.map((connection) => connection.platformId))
        state.running.forEach((controller, platformId) => {
            if (!wanted.has(platformId)) {
                controller.abort()
                state.running.delete(platformId)
            }
        })
        wanted.forEach((platformId) => {
            if (state.running.has(platformId)) {
                return
            }
            const controller = new AbortController()
            state.running.set(platformId, controller)
            rejectedPromiseHandler(this.lead({ platformId, signal: controller.signal }).finally(() => {
                if (state.running.get(platformId) === controller) {
                    state.running.delete(platformId)
                }
            }), log)
        })
    },

    async lead({ platformId, signal }: LeadParams): Promise<void> {
        while (!signal.aborted) {
            const { error } = await tryCatch(() => distributedLock(log).runExclusive({
                key: `opencode_bridge_${platformId}`,
                timeoutInSeconds: LEADER_LOCK_SECONDS,
                fn: () => this.listen({ platformId, signal }),
            }))
            if (!isNil(error) && !signal.aborted) {
                log.debug({ platform: { id: platformId }, error }, '[opencodeBridge] Not listening this round')
            }
            await pause({ ms: RECONNECT_DELAY_MS, signal })
        }
    },

    async listen({ platformId, signal }: LeadParams): Promise<void> {
        const client = await opencodeConnectionService(log).client({ platformId })
        const { stream } = await client.global.event({
            signal,
            sseMaxRetryAttempts: 1,
            onSseError: (error) => log.warn({ platform: { id: platformId }, error }, '[opencodeBridge] The OpenCode event stream failed'),
        })
        rejectedPromiseHandler(opencodeSweep(log).checkDispatched({ platformId }).then(() => undefined), log)
        for await (const event of stream) {
            rejectedPromiseHandler(this.handleEvent({ platformId, event }), log)
        }
    },

    async handleEvent({ platformId, event }: { platformId: string, event: unknown }): Promise<void> {
        const parsed = BridgeEvent.safeParse(event)
        if (!parsed.success) {
            return
        }
        const payload = parsed.data.payload
        switch (payload.type) {
            case 'session.idle':
                await completeSession({ platformId, sessionId: payload.properties.sessionID, log })
                return
            case 'session.status':
                if (payload.properties.status.type === IDLE) {
                    await completeSession({ platformId, sessionId: payload.properties.sessionID, log })
                }
                return
            case 'session.error':
                if (!isNil(payload.properties.sessionID)) {
                    await failSession({ platformId, sessionId: payload.properties.sessionID, failure: opencodeErrors.sessionError({ message: opencodeErrors.describe({ error: payload.properties.error }) }), log })
                }
                return
            case 'session.deleted':
                await failSession({ platformId, sessionId: payload.properties.sessionID, failure: opencodeErrors.sessionGone({ sessionId: payload.properties.sessionID }), log })
                return
            case 'message.part.updated':
            case 'message.part.delta':
                opencodeProgress(log).notify({ platformId, sessionId: payload.properties.sessionID })
                return
        }
    },
})

async function completeSession({ platformId, sessionId, log }: SessionEventParams): Promise<void> {
    const steps = await stepRepo().findBy({ platformId, sessionId, status: 'DISPATCHED' })
    for (const step of steps) {
        const { nextStepId } = await opencodeCompletion(log).complete({ stepId: step.id })
        opencodeDispatch(log).dispatchLater({ stepId: nextStepId })
    }
}

async function failSession({ platformId, sessionId, failure, log }: SessionEventParams & { failure: string }): Promise<void> {
    const steps = await stepRepo().findBy({ platformId, sessionId, status: 'DISPATCHED' })
    for (const step of steps) {
        const completed = await opencodeCompletion(log).complete({ stepId: step.id })
        const result = completed.finished ? completed : await opencodeCompletion(log).fail({ stepId: step.id, failure })
        opencodeDispatch(log).dispatchLater({ stepId: result.nextStepId })
    }
}

async function pause({ ms, signal }: { ms: number, signal: AbortSignal }): Promise<void> {
    if (signal.aborted) {
        return
    }
    await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, ms)
        signal.addEventListener('abort', () => {
            clearTimeout(timer)
            resolve()
        }, { once: true })
    })
}

const state: BridgeState = { timer: null, running: new Map() }

const IDLE = 'idle'

const RECONCILE_INTERVAL_MS = 30 * 1000

const RECONNECT_DELAY_MS = 2 * 1000

const LEADER_LOCK_SECONDS = 30

const BridgeEvent = z.object({
    payload: z.discriminatedUnion('type', [
        z.object({ type: z.literal('session.idle'), properties: z.object({ sessionID: z.string() }) }),
        z.object({ type: z.literal('session.status'), properties: z.object({ sessionID: z.string(), status: z.object({ type: z.string() }) }) }),
        z.object({ type: z.literal('session.error'), properties: z.object({ sessionID: z.string().optional(), error: z.unknown().optional() }) }),
        z.object({ type: z.literal('session.deleted'), properties: z.object({ sessionID: z.string() }) }),
        z.object({ type: z.literal('message.part.updated'), properties: z.object({ sessionID: z.string() }) }),
        z.object({ type: z.literal('message.part.delta'), properties: z.object({ sessionID: z.string() }) }),
    ]),
})

type BridgeState = {
    timer: NodeJS.Timeout | null
    running: Map<string, AbortController>
}

type LeadParams = {
    platformId: string
    signal: AbortSignal
}

type SessionEventParams = {
    platformId: string
    sessionId: string
    log: FastifyBaseLogger
}
