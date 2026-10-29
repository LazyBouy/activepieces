import { ActionBase, PieceMetadataModelSummary, PiecePropertyMap, TriggerBase } from '@activepieces/pieces-framework'

function compactPiece({ piece }: { piece: PieceMetadataModelSummary }): CompactPieceSummary {
    return {
        ...piece,
        suggestedActions: piece.suggestedActions?.map((action) => compactAction({ action })),
        suggestedTriggers: piece.suggestedTriggers?.map((trigger) => compactTrigger({ trigger })),
    }
}

function compactAction({ action }: { action: ActionBase }): CompactAction {
    const { outputSchema: _outputSchema, aiMetadata: _aiMetadata, ...rest } = action
    return { ...rest, props: compactProps({ props: action.props }) }
}

function compactTrigger({ trigger }: { trigger: TriggerBase }): CompactTrigger {
    const { outputSchema: _outputSchema, aiMetadata: _aiMetadata, sampleData: _sampleData, ...rest } = trigger
    return { ...rest, props: compactProps({ props: trigger.props }) }
}

function compactProps({ props }: { props: PiecePropertyMap }): CompactProps {
    return Object.fromEntries(Object.entries(props).map(([name, prop]) => [
        name,
        Object.fromEntries(Object.entries(prop).filter(([key]) => key !== AUTH_KEY)),
    ]))
}

const AUTH_KEY = 'auth'

export const pieceSuggestionsCompact = {
    compactPiece,
}

type CompactProps = Record<string, Record<string, unknown>>

type CompactAction = Omit<ActionBase, 'outputSchema' | 'aiMetadata' | 'props'> & { props: CompactProps }

type CompactTrigger = Omit<TriggerBase, 'outputSchema' | 'aiMetadata' | 'sampleData' | 'props'> & { props: CompactProps }

export type CompactPieceSummary = Omit<PieceMetadataModelSummary, 'suggestedActions' | 'suggestedTriggers'> & {
    suggestedActions?: CompactAction[]
    suggestedTriggers?: CompactTrigger[]
}
