import {
  deepMergeAndCast,
  isNil,
  isManualPieceTrigger,
} from '@activepieces/core-utils';
import {
  PieceAuthProperty,
  PiecePropertyMap,
  piecePropertiesUtils,
} from '@activepieces/pieces-framework';
import {
  FlowAction,
  FlowActionType,
  BranchOperator,
  CodeAction,
  PieceAction,
  PieceTrigger,
  FlowTrigger,
  BranchExecutionType,
  RouterExecutionType,
  flowStructureUtil,
  StepSettings,
  RouterActionSettingsWithValidation,
  AiRouterActionSettingsWithValidation,
  AiRouterMatchMode,
  FlowTriggerType,
  PropertyExecutionType,
  DEFAULT_SAMPLE_DATA_SETTINGS,
  FlowVersion,
  FlowOperationType,
  AUTHENTICATION_PROPERTY_NAME,
} from '@activepieces/shared';

import {
  PieceSelectorItem,
  PieceSelectorOperation,
  PieceSelectorPieceItem,
  PieceStepMetadataWithSuggestions,
} from '@/features/pieces/types';

import { formUtils } from './form-utils';
const defaultCode = `export const code = async (inputs) => {
  return true;
};`;

const removeHiddenActions = (
  pieceMetadata: PieceStepMetadataWithSuggestions,
) => {
  const actions = Object.values(pieceMetadata.suggestedActions ?? {});
  return actions;
};

const isPieceActionOrTrigger = (
  pieceSelectorItem: PieceSelectorItem,
): pieceSelectorItem is PieceSelectorPieceItem => {
  return (
    pieceSelectorItem.type === FlowActionType.PIECE ||
    (flowStructureUtil.isTrigger(pieceSelectorItem.type) &&
      pieceSelectorItem.type === FlowTriggerType.PIECE)
  );
};

const isPieceStepInputValid = ({
  props,
  auth,
  input,
  requireAuth,
}: {
  props: PiecePropertyMap;
  auth: PieceAuthProperty | PieceAuthProperty[] | undefined;
  input: Record<string, unknown>;
  requireAuth: boolean;
}): boolean => {
  const schema = piecePropertiesUtils.buildSchema(props, auth);
  const hasAuth = !isNil(auth);
  const authValid =
    !requireAuth || !hasAuth || !isNil(input[AUTHENTICATION_PROPERTY_NAME]);
  return schema.safeParse(input).success && authValid;
};

const routerSettingsOverride = (settings: StepSettings | undefined) =>
  !isNil(settings) && 'executionType' in settings ? settings : undefined;

const aiRouterSettingsOverride = (settings: StepSettings | undefined) =>
  !isNil(settings) && 'question' in settings ? settings : undefined;

const isStepInitiallyValid = (
  pieceSelectorItem: PieceSelectorItem,
  overrideDefaultSettings?: StepSettings,
) => {
  switch (pieceSelectorItem.type) {
    case FlowActionType.CODE:
      return true;
    case FlowActionType.PIECE:
    case FlowTriggerType.PIECE: {
      const overridingInput =
        overrideDefaultSettings && 'input' in overrideDefaultSettings
          ? overrideDefaultSettings.input
          : undefined;
      const input = overridingInput ?? getInitalStepInput(pieceSelectorItem);
      return isPieceStepInputValid({
        props: pieceSelectorItem.actionOrTrigger.props,
        auth: pieceSelectorItem.pieceMetadata.auth,
        input,
        requireAuth: pieceSelectorItem.actionOrTrigger.requireAuth,
      });
    }
    case FlowActionType.LOOP_ON_ITEMS: {
      if (
        overrideDefaultSettings &&
        'input' in overrideDefaultSettings &&
        overrideDefaultSettings.input.items
      ) {
        return true;
      }
      return false;
    }
    case FlowTriggerType.EMPTY: {
      return false;
    }
    case FlowActionType.ROUTER: {
      if (overrideDefaultSettings) {
        return RouterActionSettingsWithValidation.safeParse(
          overrideDefaultSettings,
        ).success;
      }
      return false;
    }
    case FlowActionType.AI_ROUTER: {
      if (overrideDefaultSettings) {
        return AiRouterActionSettingsWithValidation.safeParse(
          overrideDefaultSettings,
        ).success;
      }
      return false;
    }
  }
};

const getInitalStepInput = (pieceSelectorItem: PieceSelectorItem) => {
  if (!isPieceActionOrTrigger(pieceSelectorItem)) {
    return {};
  }
  return formUtils.getDefaultValueForProperties({
    props: {
      ...pieceSelectorItem.actionOrTrigger.props,
    },
    existingInput: {},
  });
};

const getDefaultStepValues = ({
  stepName,
  pieceSelectorItem,
  overrideDefaultSettings,
  customLogoUrl,
}: {
  stepName: string;
  pieceSelectorItem: PieceSelectorItem;
  overrideDefaultSettings?: StepSettings;
  customLogoUrl?: string;
}): FlowAction | FlowTrigger => {
  const errorHandlingOptions: CodeAction['settings']['errorHandlingOptions'] = {
    continueOnFailure: {
      value: false,
    },
    retryOnFailure: {
      value: false,
    },
  };

  const input = getInitalStepInput(pieceSelectorItem);
  const isValid = isStepInitiallyValid(
    pieceSelectorItem,
    overrideDefaultSettings,
  );
  const common = {
    name: stepName,
    valid: isValid,
    displayName: isPieceActionOrTrigger(pieceSelectorItem)
      ? pieceSelectorItem.actionOrTrigger.displayName
      : pieceSelectorItem.displayName,
    skip: false,
    settings: {
      customLogoUrl,
      sampleData: DEFAULT_SAMPLE_DATA_SETTINGS,
    },
  };

  switch (pieceSelectorItem.type) {
    case FlowActionType.CODE:
      return deepMergeAndCast<CodeAction>(
        {
          type: FlowActionType.CODE,
          settings: overrideDefaultSettings ?? {
            sourceCode: {
              code: defaultCode,
              packageJson: '{}',
            },
            input,
            errorHandlingOptions,
            useDeno: true,
          },
        },
        common,
      );
    case FlowActionType.LOOP_ON_ITEMS:
      return deepMergeAndCast<FlowAction>(
        {
          type: FlowActionType.LOOP_ON_ITEMS,
          settings: overrideDefaultSettings ?? {
            items: '',
          },
        },
        common,
      );
    case FlowActionType.ROUTER:
      return deepMergeAndCast<FlowAction>(
        {
          type: FlowActionType.ROUTER,
          settings: routerSettingsOverride(overrideDefaultSettings) ?? {
            executionType: RouterExecutionType.EXECUTE_FIRST_MATCH,
            branches: [
              {
                conditions: [
                  [
                    {
                      operator: BranchOperator.TEXT_EXACTLY_MATCHES,
                      firstValue: '',
                      secondValue: '',
                      caseSensitive: false,
                    },
                  ],
                ],
                branchType: BranchExecutionType.CONDITION,
                branchName: 'Branch 1',
              },
              {
                branchType: BranchExecutionType.FALLBACK,
                branchName: 'Otherwise',
              },
            ],
          },
          children: [null, null],
        },
        common,
      );
    case FlowActionType.AI_ROUTER:
      return deepMergeAndCast<FlowAction>(
        {
          type: FlowActionType.AI_ROUTER,
          settings: aiRouterSettingsOverride(overrideDefaultSettings) ?? {
            text: '',
            question: '',
            matchMode: AiRouterMatchMode.BEST_MATCH,
            branches: [
              {
                branchType: BranchExecutionType.CONDITION,
                branchName: 'Route 1',
                description: '',
              },
              {
                branchType: BranchExecutionType.FALLBACK,
                branchName: 'Otherwise',
                description: 'Anything that fits none of the routes above',
              },
            ],
          },
          children: [null, null],
        },
        common,
      );
    case FlowActionType.PIECE: {
      if (!isPieceActionOrTrigger(pieceSelectorItem)) {
        throw new Error(
          `Invalid piece selector item ${JSON.stringify(pieceSelectorItem)}`,
        );
      }
      return deepMergeAndCast<PieceAction>(
        {
          type: FlowActionType.PIECE,
          settings: overrideDefaultSettings ?? {
            pieceName: pieceSelectorItem.pieceMetadata.pieceName,
            actionName: pieceSelectorItem.actionOrTrigger.name,
            pieceVersion: pieceSelectorItem.pieceMetadata.pieceVersion,
            input,
            errorHandlingOptions,
            propertySettings: Object.fromEntries(
              Object.entries(input).map(([key]) => [
                key,
                {
                  type: PropertyExecutionType.MANUAL,
                  schema: undefined,
                },
              ]),
            ),
          },
        },
        common,
      );
    }
    case FlowTriggerType.PIECE: {
      if (!isPieceActionOrTrigger(pieceSelectorItem)) {
        throw new Error(
          `Invalid piece selector item ${JSON.stringify(pieceSelectorItem)}`,
        );
      }
      return deepMergeAndCast<PieceTrigger>(
        {
          type: FlowTriggerType.PIECE,
          settings: overrideDefaultSettings ?? {
            pieceName: pieceSelectorItem.pieceMetadata.pieceName,
            triggerName: pieceSelectorItem.actionOrTrigger.name,
            pieceVersion: pieceSelectorItem.pieceMetadata.pieceVersion,
            input,
            propertySettings: Object.fromEntries(
              Object.entries(input).map(([key]) => [
                key,
                {
                  type: PropertyExecutionType.MANUAL,
                },
              ]),
            ),
          },
        },
        common,
      );
    }
    default:
      throw new Error('Unsupported type: ' + pieceSelectorItem.type);
  }
};

const isMcpToolTrigger = (pieceName: string, triggerName: string) => {
  return pieceName === '@activepieces/piece-mcp' && triggerName === 'mcp_tool';
};

const isChatTrigger = (pieceName: string, triggerName: string) => {
  return (
    pieceName === '@activepieces/piece-forms' &&
    triggerName === 'chat_submission'
  );
};

const getStepNameFromOperationType = (
  operation: PieceSelectorOperation,
  flowVersion: FlowVersion,
) => {
  switch (operation.type) {
    case FlowOperationType.UPDATE_ACTION:
      return operation.stepName;
    case FlowOperationType.ADD_ACTION:
      return flowStructureUtil.findUnusedName(flowVersion.trigger);
    case FlowOperationType.UPDATE_TRIGGER:
      return 'trigger';
  }
};
export const pieceSelectorUtils = {
  getDefaultStepValues,
  isPieceStepInputValid,
  isMcpToolTrigger,
  isChatTrigger,
  removeHiddenActions,
  getStepNameFromOperationType,
  isManualTrigger: isManualPieceTrigger,
};
