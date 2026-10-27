import { apId, isNil, tryCatch } from '@activepieces/core-utils'
import { isAxiosError } from 'axios'
import { FastifyBaseLogger } from 'fastify'
import { z } from 'zod'
import { flowRunService } from '../flows/flow-run/flow-run-service'
import { OpencodeAiStepResponse, opencodeAiSteps } from './opencode-ai-steps'
import { opencodeConnectionService } from './opencode-connection.service'
import { opencodeErrors } from './opencode-errors'
import { opencodeInbox } from './opencode-inbox'
import { OPENCODE_PIECE_ACTION, OpencodePieceRequest, opencodePieceSteps } from './opencode-piece-steps'
import { opencodeRouting } from './opencode-routing'

export const opencodePieceRuns = (log: FastifyBaseLogger) => ({
    async start({ platformId, projectId, body }: StartParams): Promise<OpencodeAiStepResponse> {
        if (!await opencodeRouting.isOn({ platformId })) {
            return { requestId: apId(), failure: opencodeErrors.routingOff() }
        }
        const flowRun = await flowRunService(log).getOneOrThrow({ id: body.flowRunId, projectId })
        const request = fromPiece({ request: body.request })
        if (request.action === OPENCODE_PIECE_ACTION.SEND_TO_INBOX && !request.wait) {
            const { data: answer, error } = await tryCatch(() => opencodeInbox(log).sendNow({ platformId, projectId, request }))
            return { requestId: apId(), ...(isNil(answer) ? { failure: await failureOf({ platformId, error, log }) } : answer) }
        }
        const response = await opencodeAiSteps(log).execute({
            platformId,
            projectId,
            call: {
                flowId: flowRun.flowId,
                flowRunId: flowRun.id,
                waitpointId: body.waitpointId,
                request,
                settings: opencodePieceSteps.settingsOf({ request }),
            },
        })
        log.info({ flowRun: { id: flowRun.id }, waitpoint: { id: body.waitpointId }, opencodeAction: request.action }, '[opencodePieceRuns] Sent the OpenCode piece step')
        return response
    },
})

function fromPiece({ request }: { request: OpencodePieceRequest }): OpencodePieceRequest {
    if (request.action !== OPENCODE_PIECE_ACTION.SEND_TO_INBOX) {
        return request
    }
    const { correlationId: _correlationId, inboxMessageId: _inboxMessageId, ...sent } = request
    return sent
}

async function failureOf({ platformId, error, log }: { platformId: string, error: unknown, log: FastifyBaseLogger }): Promise<string> {
    if (isAxiosError(error)) {
        const connection = await opencodeConnectionService(log).getOrCreate({ platformId })
        return opencodeErrors.unreachable({ serverUrl: connection.serverUrl, error })
    }
    return opencodeErrors.describe({ error })
}

export const OpencodePieceRunBody = z.object({
    flowId: z.string(),
    flowRunId: z.string(),
    waitpointId: z.string().optional(),
    request: OpencodePieceRequest,
})
export type OpencodePieceRunBody = z.infer<typeof OpencodePieceRunBody>

type StartParams = {
    platformId: string
    projectId: string
    body: OpencodePieceRunBody
}
