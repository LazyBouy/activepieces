import { ActivepiecesError, AiStepAction, ErrorCode, isNil } from '@activepieces/core-utils'
import { ChooseAiRouteRequest, ChooseAiRouteResponse, StartAiRouteResponse } from '@activepieces/shared'
import { FastifyBaseLogger } from 'fastify'
import { opencodeAiSteps } from './opencode-ai-steps'
import { OpencodeAiCall } from './opencode-dispatch'

export const opencodeRouter = (log: FastifyBaseLogger) => ({
    async start({ platformId, projectId, waitpointId, request }: StartParams): Promise<StartAiRouteResponse> {
        const { requestId } = await opencodeAiSteps(log).execute({ platformId, projectId, call: routeCall({ request, waitpointId }) })
        return { requestId }
    },

    async choose({ platformId, projectId, request }: ChooseParams): Promise<ChooseAiRouteResponse> {
        const { output, failure } = await opencodeAiSteps(log).execute({ platformId, projectId, call: routeCall({ request }), timeoutMs: CHOOSE_WAIT_MS })
        if (!isNil(failure)) {
            throw new ActivepiecesError({ code: ErrorCode.ENGINE_OPERATION_FAILURE, params: { message: failure } })
        }
        const parsed = ChooseAiRouteResponse.safeParse(output)
        if (!parsed.success) {
            throw new ActivepiecesError({ code: ErrorCode.ENGINE_OPERATION_FAILURE, params: { message: 'The routing model answered in a shape the AI Router does not understand' } })
        }
        log.info({ matched: parsed.data.matched, matchMode: request.matchMode }, '[opencodeRouter] Chose the AI router routes on OpenCode')
        return parsed.data
    },
})

function routeCall({ request, waitpointId }: { request: RouteRequest, waitpointId?: string }): OpencodeAiCall {
    return {
        flowId: request.flowId,
        flowRunId: request.flowRunId,
        ...(isNil(waitpointId) ? {} : { waitpointId }),
        request: {
            action: AiStepAction.ROUTE,
            state: request.state,
            question: request.question,
            options: request.options,
            matchMode: request.matchMode,
        },
    }
}

const CHOOSE_WAIT_MS = 25_000

type RouteRequest = Omit<ChooseAiRouteRequest, 'waitpointId'>

type ChooseParams = {
    platformId: string
    projectId: string
    request: RouteRequest
}

type StartParams = ChooseParams & {
    waitpointId: string
}
