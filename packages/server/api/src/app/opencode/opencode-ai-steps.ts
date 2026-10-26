import { apId, isNil } from '@activepieces/core-utils'
import { FastifyBaseLogger } from 'fastify'
import { aiExecution, AiStepAnswer } from '../ai/ai-execution'
import { system } from '../helper/system/system'
import { AppSystemProp } from '../helper/system/system-props'
import { OpencodeAiCall, opencodeDispatch } from './opencode-dispatch'

export const opencodeAiSteps = (log: FastifyBaseLogger) => ({
    async execute({ platformId, projectId, call }: ExecuteParams): Promise<OpencodeAiStepResponse> {
        const requestId = apId()
        const execution = aiExecution(log)
        const answerInThisRequest = isNil(call.waitpointId)
        const timeoutMs = system.getNumberOrThrow(AppSystemProp.FLOW_TIMEOUT_SECONDS) * 1000
        const answer = answerInThisRequest ? execution.waitForAnswer({ requestId, timeoutMs }) : undefined
        const step = await opencodeDispatch(log).start({
            platformId,
            projectId,
            requestId,
            webserverId: answerInThisRequest ? execution.serverId() : undefined,
            call,
        })
        log.info({ opencodeStep: { id: step.id, status: step.status }, flowRun: { id: call.flowRunId } }, '[opencodeAiSteps] Sent the AI step to OpenCode')
        if (!isNil(answer)) {
            return { requestId: step.requestId, ...await answer }
        }
        return { requestId: step.requestId }
    },
})

export type OpencodeAiStepResponse = AiStepAnswer & {
    requestId: string
}

type ExecuteParams = {
    platformId: string
    projectId: string
    call: OpencodeAiCall
}
