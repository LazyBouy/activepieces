import { AiStepAction } from '@activepieces/core-utils'
import { repoFactory } from '../core/db/repo-factory'
import { OpencodeConnectionEntity } from './opencode-connection.entity'

const connectionRepo = repoFactory(OpencodeConnectionEntity)

async function isOn({ platformId }: { platformId: string }): Promise<boolean> {
    const connection = await connectionRepo().findOneBy({ platformId })
    return connection?.enabled === true
}

function isRoutedAction({ action }: { action: AiStepAction }): boolean {
    return ROUTED_DIRECT_ACTIONS.includes(action)
}

const ROUTED_DIRECT_ACTIONS: AiStepAction[] = [
    AiStepAction.ASK_AI,
    AiStepAction.SUMMARIZE_TEXT,
    AiStepAction.CLASSIFY_TEXT,
    AiStepAction.EXTRACT_STRUCTURED_DATA,
]

export const opencodeRouting = {
    isOn,
    isRoutedAction,
}
