import { isNil } from '@activepieces/core-utils'
import { flowStructureUtil, OpencodeDefaults, OpencodeStepSettings, opencodeStepUtil } from '@activepieces/shared'
import { FastifyBaseLogger } from 'fastify'
import { flowRunService } from '../flows/flow-run/flow-run-service'
import { flowVersionService } from '../flows/flow-version/flow-version.service'
import { waitpointService } from '../waitpoints/waitpoint-service'

async function resolve({ projectId, flowRunId, waitpointId, log }: ResolveParams): Promise<OpencodeStepContext> {
    const flowRun = await flowRunService(log).getOne({ id: flowRunId, projectId })
    const stepName = await stepNameOf({ projectId, flowRunId, waitpointId, log }) ?? flowRun?.stepNameToTest ?? null
    if (isNil(flowRun)) {
        return { flowVersionId: null, flowName: null, stepName, settings: undefined, defaults: undefined }
    }
    const flowVersion = await flowVersionService(log).getOne(flowRun.flowVersionId)
    if (isNil(flowVersion)) {
        return { flowVersionId: flowRun.flowVersionId, flowName: null, stepName, settings: undefined, defaults: undefined }
    }
    const step = isNil(stepName) ? undefined : flowStructureUtil.getStep(plainStepName({ stepKey: stepName }), flowVersion.trigger)
    return {
        flowVersionId: flowVersion.id,
        flowName: flowVersion.displayName,
        stepName,
        settings: isNil(step) ? undefined : opencodeStepUtil.settingsOf({ step }),
        defaults: flowVersion.opencodeDefaults,
    }
}

async function stepNameOf({ projectId, flowRunId, waitpointId, log }: ResolveParams): Promise<string | null> {
    if (isNil(waitpointId)) {
        return null
    }
    const waitpoint = await waitpointService(log).findByIdAndFlowRunId({ waitpointId, flowRunId, projectId })
    if (isNil(waitpoint) || waitpoint.stepName.length === 0) {
        return null
    }
    return waitpoint.stepName
}

function plainStepName({ stepKey }: { stepKey: string }): string {
    return stepKey.split('/').pop() ?? stepKey
}

export const opencodeStepContext = {
    resolve,
}

export type OpencodeStepContext = {
    flowVersionId: string | null
    flowName: string | null
    stepName: string | null
    settings: OpencodeStepSettings | undefined
    defaults: OpencodeDefaults | undefined
}

type ResolveParams = {
    projectId: string
    flowRunId: string
    waitpointId: string | undefined
    log: FastifyBaseLogger
}
