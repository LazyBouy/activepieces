import { isNil } from '@activepieces/core-utils';
import {
  FlowAction,
  FlowActionType,
  FlowOperationType,
  FlowTrigger,
  FlowTriggerType,
  flowPieceUtil,
  flowStructureUtil,
  opencodeStepUtil,
} from '@activepieces/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import deepEqual from 'deep-equal';
import { t } from 'i18next';
import { useEffect, useRef } from 'react';
import { useForm, Resolver, useFormContext } from 'react-hook-form';

import { useBuilderStateContext } from '@/app/builder/builder-hooks';
import { Form } from '@/components/ui/form';
import { OpencodeStepSection } from '@/features/opencode';
import {
  stepsHooks,
  formUtils,
  PieceStepMetadata,
  StepMetadata,
} from '@/features/pieces';

import { ActionErrorHandlingForm } from '../piece-properties/action-error-handling';
import { DynamicPropertiesProvider } from '../piece-properties/dynamic-properties-context';
import {
  ActionTestRunnerProvider,
  TriggerTestRunnerProvider,
} from '../test-step/test-runner-context';

import { AgentSettings } from './agent-settings';
import { AiRouterSettings } from './ai-router-settings';
import { CodeSettings } from './code-settings';
import { LoopsSettings } from './loops-settings';
import { PieceSettings } from './piece-settings';
import { RouterSettings } from './router-settings';
import { useStepSettingsContext } from './step-settings-context';
import { UpdatePieceVersionDialog } from './update-piece-version-dialog/update-piece-version-dialog';

const StepSettingsForm = ({ children }: { children: React.ReactNode }) => {
  const { selectedStep, pieceModel, formSchema } = useStepSettingsContext();
  const [readonly, applyOperation] = useBuilderStateContext((state) => [
    state.readonly,
    state.applyOperation,
  ]);

  const currentValuesRef = useRef<FlowAction | FlowTrigger>(selectedStep);
  const form = useForm<FlowAction | FlowTrigger>({
    mode: 'all',
    disabled: readonly,
    reValidateMode: 'onChange',
    defaultValues: selectedStep,
    resetOptions: {
      keepDefaultValues: false,
      keepDirtyValues: true,
    },
    resolver: async (values, context, options) => {
      const result = await (
        zodResolver(formSchema) as unknown as Resolver<FlowAction | FlowTrigger>
      )(values, context, options);

      const cleanedNewValues = formUtils.removeUndefinedFromInput(values);
      const cleanedCurrentValues = formUtils.removeUndefinedFromInput(
        currentValuesRef.current,
      );
      const valid = Object.keys(result.errors).length === 0;
      cleanedNewValues.valid = valid;
      if (
        cleanedNewValues.type === FlowTriggerType.EMPTY ||
        (isNil(pieceModel) &&
          (cleanedNewValues.type === FlowActionType.PIECE ||
            cleanedNewValues.type === FlowTriggerType.PIECE))
      ) {
        return result;
      }
      if (
        deepEqual(
          stripSampleData(cleanedNewValues),
          stripSampleData(cleanedCurrentValues),
        )
      ) {
        return result;
      }
      currentValuesRef.current = JSON.parse(JSON.stringify(cleanedNewValues));
      if (cleanedNewValues.type === FlowTriggerType.PIECE) {
        applyOperation({
          type: FlowOperationType.UPDATE_TRIGGER,
          request: {
            ...cleanedNewValues,
            valid,
          },
        });
      } else {
        applyOperation({
          type: FlowOperationType.UPDATE_ACTION,
          request: {
            ...cleanedNewValues,
            valid,
          },
        });
      }
      return result;
    },
  });

  useEffect(() => {
    form.trigger();
  }, []);

  return (
    <Form {...form}>
      <form
        onSubmit={(e) => e.preventDefault()}
        onChange={(e) => e.preventDefault()}
        className="flex size-full min-h-0 flex-col"
      >
        <DynamicPropertiesProvider
          key={`${selectedStep.name}-${selectedStep.type}`}
        >
          <StepTestRunnerProvider step={selectedStep}>
            {children}
          </StepTestRunnerProvider>
        </DynamicPropertiesProvider>
      </form>
    </Form>
  );
};
StepSettingsForm.displayName = 'StepSettingsForm';

const StepParametersTab = () => {
  const form = useFormContext<FlowAction | FlowTrigger>();
  const [readonly, flowVersion] = useBuilderStateContext((state) => [
    state.readonly,
    state.flowVersion,
  ]);
  const modifiedStep = form.getValues();
  const runAgentStep = isRunAgentStep(modifiedStep);

  return (
    <div className="flex flex-col gap-4">
      {modifiedStep.type === FlowActionType.LOOP_ON_ITEMS && (
        <LoopsSettings readonly={readonly}></LoopsSettings>
      )}
      {modifiedStep.type === FlowActionType.CODE && (
        <CodeSettings readonly={readonly}></CodeSettings>
      )}
      {modifiedStep.type === FlowActionType.PIECE && runAgentStep && (
        <AgentSettings
          step={modifiedStep}
          flowId={flowVersion.flowId}
          readonly={readonly}
        />
      )}
      {modifiedStep.type === FlowActionType.PIECE && !runAgentStep && (
        <PieceSettings
          step={modifiedStep}
          flowId={flowVersion.flowId}
          readonly={readonly}
        ></PieceSettings>
      )}
      {modifiedStep.type === FlowActionType.ROUTER && (
        <RouterSettings readonly={readonly}></RouterSettings>
      )}
      {modifiedStep.type === FlowActionType.AI_ROUTER && (
        <AiRouterSettings readonly={readonly}></AiRouterSettings>
      )}
      {modifiedStep.type === FlowTriggerType.PIECE && (
        <PieceSettings
          step={modifiedStep}
          flowId={flowVersion.flowId}
          readonly={readonly}
        ></PieceSettings>
      )}
    </div>
  );
};
StepParametersTab.displayName = 'StepParametersTab';

const StepSettingsTab = () => {
  const { selectedStep } = useStepSettingsContext();
  const [readonly, projectId, opencodeDefaults, trigger] =
    useBuilderStateContext((state) => [
      state.readonly,
      state.flow.projectId,
      state.flowVersion.opencodeDefaults,
      state.flowVersion.trigger,
    ]);
  const { stepMetadata } = stepsHooks.useStepMetadata({
    step: selectedStep,
  });
  const errorHandling = getErrorHandlingVisibility({
    step: selectedStep,
    stepMetadata,
  });
  const pieceVersion = getPieceVersion({ step: selectedStep, stepMetadata });

  return (
    <div className="flex flex-col gap-4">
      {errorHandling.show && (
        <ActionErrorHandlingForm
          hideContinueOnFailure={errorHandling.hideContinueOnFailure}
          hideRetryOnFailure={errorHandling.hideRetryOnFailure}
          disabled={readonly}
          className="border-t-0 pt-0"
        />
      )}
      {pieceVersion &&
        (selectedStep.type === FlowActionType.PIECE ||
          selectedStep.type === FlowTriggerType.PIECE) && (
          <div className="flex flex-col gap-1">
            <span className="text-xsm text-gray-12">{t('Piece Version')}</span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-11">v{pieceVersion}</span>
              {!readonly && (
                <UpdatePieceVersionDialog
                  step={selectedStep}
                  currentVersion={pieceVersion}
                />
              )}
            </div>
          </div>
        )}
      {opencodeStepUtil.isOpencodeStep({ step: selectedStep }) && (
        <OpencodeStepSection
          projectId={projectId}
          readonly={readonly}
          flowSessionMode={opencodeStepUtil.resolveFlowSessionMode({
            defaults: opencodeDefaults,
          })}
          channelSteps={opencodeStepUtil
            .openChannelStepsBefore({ trigger, stepName: selectedStep.name })
            .map((step) => ({
              name: step.name,
              displayName: step.displayName,
            }))}
        />
      )}
    </div>
  );
};
StepSettingsTab.displayName = 'StepSettingsTab';

function useHasStepSettingsTab(): boolean {
  const { selectedStep } = useStepSettingsContext();
  const { stepMetadata } = stepsHooks.useStepMetadata({
    step: selectedStep,
  });
  return (
    getErrorHandlingVisibility({ step: selectedStep, stepMetadata }).show ||
    !isNil(getPieceVersion({ step: selectedStep, stepMetadata })) ||
    opencodeStepUtil.isOpencodeStep({ step: selectedStep })
  );
}

function getErrorHandlingVisibility({
  step,
  stepMetadata,
}: {
  step: FlowAction | FlowTrigger;
  stepMetadata: StepMetadata | undefined;
}): ErrorHandlingVisibility {
  const hidden: ErrorHandlingVisibility = {
    show: false,
    hideContinueOnFailure: true,
    hideRetryOnFailure: true,
  };
  if (isNil(stepMetadata)) {
    return hidden;
  }
  if (step.type === FlowActionType.CODE) {
    return {
      show: true,
      hideContinueOnFailure: false,
      hideRetryOnFailure: false,
    };
  }
  if (step.type !== FlowActionType.PIECE) {
    return hidden;
  }
  const options =
    stepMetadata.type === FlowActionType.PIECE
      ? stepMetadata.errorHandlingOptions
      : undefined;
  const hideContinueOnFailure = options?.continueOnFailure?.hide ?? false;
  const hideRetryOnFailure = options?.retryOnFailure?.hide ?? false;
  return {
    show: !hideContinueOnFailure || !hideRetryOnFailure,
    hideContinueOnFailure,
    hideRetryOnFailure,
  };
}

function getPieceVersion({
  step,
  stepMetadata,
}: {
  step: FlowAction | FlowTrigger;
  stepMetadata: StepMetadata | undefined;
}): string | null {
  if (
    step.type !== FlowActionType.PIECE &&
    step.type !== FlowTriggerType.PIECE
  ) {
    return null;
  }
  if (!isPieceMetadata(stepMetadata) || !stepMetadata.pieceVersion) {
    return null;
  }
  return flowPieceUtil.getExactVersion(stepMetadata.pieceVersion);
}

function isRunAgentStep(step: FlowAction | FlowTrigger): boolean {
  return (
    step.settings.pieceName === '@activepieces/piece-ai' &&
    step.settings.actionName === 'run_agent'
  );
}

const isFlowActionStep = (step: FlowAction | FlowTrigger): step is FlowAction =>
  flowStructureUtil.isAction(step.type);

const StepTestRunnerProvider = ({
  step,
  children,
}: {
  step: FlowAction | FlowTrigger;
  children: React.ReactNode;
}) => {
  if (isFlowActionStep(step)) {
    return (
      <ActionTestRunnerProvider step={step} key={step.name}>
        {children}
      </ActionTestRunnerProvider>
    );
  }
  return (
    <TriggerTestRunnerProvider step={step} key={step.name}>
      {children}
    </TriggerTestRunnerProvider>
  );
};

const stripSampleData = (step: FlowAction | FlowTrigger) => {
  const { sampleData: _, ...settingsWithoutSampleData } = step.settings;
  const { lastUpdatedDate: __, ...stepWithoutMetadata } = step;

  return { ...stepWithoutMetadata, settings: settingsWithoutSampleData };
};

const isPieceMetadata = (
  metadata: { type: FlowActionType | FlowTriggerType } | undefined,
): metadata is PieceStepMetadata =>
  metadata?.type === FlowActionType.PIECE ||
  metadata?.type === FlowTriggerType.PIECE;

export {
  StepSettingsForm,
  StepParametersTab,
  StepSettingsTab,
  useHasStepSettingsTab,
};

export const stepSettingsUtils = {
  isRunAgentStep,
};

type ErrorHandlingVisibility = {
  show: boolean;
  hideContinueOnFailure: boolean;
  hideRetryOnFailure: boolean;
};
