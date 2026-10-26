import { ActivepiecesError, ErrorCode, isNil } from '@activepieces/core-utils'
import { AgentOutputField, AgentTool, AgentToolType } from '@activepieces/shared'
import { FastifyBaseLogger } from 'fastify'
import { z } from 'zod'
import { flowRunService } from '../flows/flow-run/flow-run-service'
import { OPENCODE_RUN_AGENT } from './opencode-agent-prompt'
import { opencodeAiSteps } from './opencode-ai-steps'
import { opencodeErrors } from './opencode-errors'

export const opencodeAgentRuns = (log: FastifyBaseLogger) => ({
    async start({ platformId, projectId, body }: StartParams): Promise<{ requestId: string }> {
        assertRunnable({ body })
        const flowRun = await flowRunService(log).getOneOrThrow({ id: body.flowRunId, projectId })
        const { requestId } = await opencodeAiSteps(log).execute({
            platformId,
            projectId,
            call: {
                flowId: flowRun.flowId,
                flowRunId: flowRun.id,
                waitpointId: body.waitpointId,
                request: {
                    action: OPENCODE_RUN_AGENT,
                    instruction: body.instruction,
                    structuredOutput: body.structuredOutput ?? [],
                    tools: body.tools ?? [],
                    ...(isNil(body.provider) ? {} : { provider: body.provider }),
                    ...(isNil(body.providerConfigId) ? {} : { providerConfigId: body.providerConfigId }),
                    ...(isNil(body.modelName) ? {} : { modelId: body.modelName }),
                },
            },
        })
        log.info({ flowRun: { id: flowRun.id }, waitpoint: { id: body.waitpointId } }, '[opencodeAgentRuns] Sent the agent step to OpenCode')
        return { requestId }
    },
})

function assertRunnable({ body }: { body: OpencodeAgentRunBody }): void {
    if (!isNil(body.agentId)) {
        throw invalid({ message: opencodeErrors.savedAgent() })
    }
    const tools = body.tools ?? []
    if (tools.some((tool) => tool.type === AgentToolType.KNOWLEDGE_BASE)) {
        throw invalid({ message: opencodeErrors.knowledgeBaseTools() })
    }
}

function invalid({ message }: { message: string }): ActivepiecesError {
    return new ActivepiecesError({ code: ErrorCode.VALIDATION, params: { message } })
}

export const OpencodeAgentRunBody = z.object({
    instruction: z.string(),
    flowRunId: z.string(),
    waitpointId: z.string(),
    agentId: z.string().optional(),
    tools: z.array(AgentTool).optional(),
    structuredOutput: z.array(AgentOutputField).optional(),
    modelName: z.string().optional(),
    provider: z.string().optional(),
    providerConfigId: z.string().optional(),
})
export type OpencodeAgentRunBody = z.infer<typeof OpencodeAgentRunBody>

type StartParams = {
    platformId: string
    projectId: string
    body: OpencodeAgentRunBody
}
