import { isNil, tryCatch } from '@activepieces/core-utils'
import { isFlowRunStateTerminal } from '@activepieces/shared'
import dayjs from 'dayjs'
import { FastifyBaseLogger } from 'fastify'
import { LessThan } from 'typeorm'
import { repoFactory } from '../core/db/repo-factory'
import { flowRunService } from '../flows/flow-run/flow-run-service'
import { system } from '../helper/system/system'
import { AppSystemProp } from '../helper/system/system-props'
import { waitpointService } from '../waitpoints/waitpoint-service'
import { WaitpointStatus } from '../waitpoints/waitpoint-types'
import { CompletionResult, opencodeCompletion } from './opencode-completion'
import { opencodeConnectionService } from './opencode-connection.service'
import { opencodeDispatch } from './opencode-dispatch'
import { opencodeSessions } from './opencode-sessions'
import { OpencodeStepEntity, OpencodeStepRow, OpencodeStepStatus } from './opencode-step.entity'

const stepRepo = repoFactory(OpencodeStepEntity)

export const opencodeSweep = (log: FastifyBaseLogger) => ({
    async run(): Promise<OpencodeSweepSummary> {
        const resent = await this.resendPending()
        const checked = await this.checkDispatched({ platformId: undefined })
        const redelivered = await this.redeliverCompleting()
        const released = await opencodeSessions(log).releaseStale({ limit: BATCH_SIZE })
        released.forEach((stepId) => opencodeDispatch(log).dispatchLater({ stepId }))
        const queued = await this.retryQueued()
        return { resent, checked, redelivered, released: released.length, queued }
    },

    async resendPending(): Promise<number> {
        const pending = await olderThan({ status: 'PENDING', ageMs: PENDING_GRACE_MS })
        for (const step of pending) {
            await opencodeDispatch(log).dispatch({ stepId: step.id })
        }
        return pending.length
    },

    async checkDispatched({ platformId }: { platformId: string | undefined }): Promise<number> {
        const dispatched = await olderThan({ status: 'DISPATCHED', ageMs: DISPATCHED_GRACE_MS, platformId })
        for (const step of dispatched) {
            const { data: result, error } = await tryCatch(() => checkStep({ step, log }))
            if (isNil(result)) {
                log.warn({ opencodeStep: { id: step.id }, error }, '[opencodeSweep] Could not check a dispatched step')
                continue
            }
            opencodeDispatch(log).dispatchLater({ stepId: result.nextStepId })
        }
        return dispatched.length
    },

    async redeliverCompleting(): Promise<number> {
        const completing = await olderThan({ status: 'COMPLETING', ageMs: COMPLETING_GRACE_MS })
        for (const step of completing) {
            const { data: result, error } = await tryCatch(() => opencodeCompletion(log).redeliver({ stepId: step.id }))
            if (isNil(result)) {
                log.warn({ opencodeStep: { id: step.id }, error }, '[opencodeSweep] Could not hand a finished step back to its flow')
                continue
            }
            opencodeDispatch(log).dispatchLater({ stepId: result.nextStepId })
        }
        return completing.length
    },

    async retryQueued(): Promise<number> {
        const queued = await olderThan({ status: 'QUEUED', ageMs: 0 })
        for (const step of queued) {
            await opencodeDispatch(log).dispatch({ stepId: step.id })
        }
        return queued.length
    },
})

async function checkStep({ step, log }: { step: OpencodeStepRow, log: FastifyBaseLogger }): Promise<CompletionResult> {
    const expiry = await expiryOf({ step, log })
    if (!isNil(expiry)) {
        const client = await opencodeConnectionService(log).client({ platformId: step.platformId })
        await opencodeSessions(log).abort({ step, client })
        return opencodeCompletion(log).fail({ stepId: step.id, failure: expiry })
    }
    return opencodeCompletion(log).complete({ stepId: step.id })
}

async function expiryOf({ step, log }: { step: OpencodeStepRow, log: FastifyBaseLogger }): Promise<string | null> {
    if (isNil(step.waitpointId)) {
        const timeoutMs = system.getNumberOrThrow(AppSystemProp.FLOW_TIMEOUT_SECONDS) * 1000
        return isNil(step.dispatchedAt) || Date.now() - new Date(step.dispatchedAt).getTime() < timeoutMs ? null : TIMED_OUT
    }
    const flowRun = await flowRunService(log).getOne({ id: step.flowRunId, projectId: step.projectId })
    if (isNil(flowRun) || isFlowRunStateTerminal({ status: flowRun.status, ignoreInternalError: false })) {
        return FLOW_RUN_ENDED
    }
    const waitpoint = await waitpointService(log).findByIdAndFlowRunId({ waitpointId: step.waitpointId, flowRunId: step.flowRunId, projectId: step.projectId })
    if (isNil(waitpoint) || waitpoint.status !== WaitpointStatus.PENDING) {
        return TIMED_OUT
    }
    if (!isNil(waitpoint.resumeDateTime) && dayjs(waitpoint.resumeDateTime).isBefore(dayjs())) {
        return TIMED_OUT
    }
    return null
}

async function olderThan({ status, ageMs, platformId }: { status: OpencodeStepStatus, ageMs: number, platformId?: string }): Promise<OpencodeStepRow[]> {
    return stepRepo().find({
        where: {
            status,
            updated: LessThan(dayjs().subtract(ageMs, 'millisecond').toISOString()),
            ...(isNil(platformId) ? {} : { platformId }),
        },
        order: { updated: 'ASC' },
        take: BATCH_SIZE,
    })
}

const BATCH_SIZE = 100

const PENDING_GRACE_MS = 60 * 1000

const DISPATCHED_GRACE_MS = 30 * 1000

const COMPLETING_GRACE_MS = 60 * 1000

const FLOW_RUN_ENDED = 'The flow run ended before OpenCode answered.'

const TIMED_OUT = 'The AI step timed out before OpenCode answered.'

export type OpencodeSweepSummary = {
    resent: number
    checked: number
    redelivered: number
    released: number
    queued: number
}
