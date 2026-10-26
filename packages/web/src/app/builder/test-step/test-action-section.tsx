import { isNil } from '@activepieces/core-utils';
import {
  FlowAction,
  FlowActionType,
  Step,
  flowStructureUtil,
} from '@activepieces/shared';
import { t } from 'i18next';
import { PackageOpen } from 'lucide-react';
import React, { useContext } from 'react';

import { Button } from '@/components/ui/button';
import { piecesHooks } from '@/features/pieces';

import { useBuilderStateContext } from '../builder-hooks';
import { stepPropertiesSnapshotUtils } from '../data-display/build-step-properties-snapshot';
import { ErrorExplanationContext } from '../data-display/explanation-prompt';
import { DynamicPropertiesContext } from '../piece-properties/dynamic-properties-context';
import { DataPane, DataPaneMessage } from '../step-modal/data-pane';

import { useActionTestRunner } from './test-runner-context';
import { TestSampleDataViewer } from './test-sample-data-viewer';
import { TestButtonTooltip } from './test-step-tooltip';

const TestStepSectionImplementation = React.memo(
  ({
    isSaving,
    flowVersionId,
    currentStep,
  }: TestActionComponentProps & { currentStep: FlowAction }) => {
    const [
      sampleData,
      sampleDataInput,
      errorMessage,
      consoleLogs,
      isStepBeingTested,
      removeStepTestListener,
      revertSampleDataLocally,
    ] = useBuilderStateContext((state) => {
      return [
        state.outputSampleData[currentStep.name],
        state.inputSampleData[currentStep.name],
        state.errorLogs[currentStep.name],
        currentStep.type === FlowActionType.CODE
          ? state.consoleLogs[currentStep.name]
          : null,
        state.isStepBeingTested,
        state.removeStepTestListener,
        state.revertSampleDataLocallyCallbacks[currentStep.name],
      ];
    });

    const runner = useActionTestRunner();
    const onTestButtonClick = () => runner?.fireTest();

    const lastTestDate = currentStep.settings.sampleData?.lastTestDate;

    const sampleDataExists =
      !isNil(lastTestDate) ||
      !isNil(errorMessage) ||
      isStepBeingTested(currentStep.name);

    const isTesting = runner?.isTesting ?? false;
    const { isLoadingDynamicProperties } = useContext(DynamicPropertiesContext);

    const pieceName =
      currentStep.type === FlowActionType.PIECE
        ? currentStep.settings.pieceName
        : undefined;
    const pieceVersion =
      currentStep.type === FlowActionType.PIECE
        ? currentStep.settings.pieceVersion
        : undefined;
    const { pieceModel } = piecesHooks.usePiece({
      name: pieceName ?? '',
      version: pieceVersion,
      enabled: !isNil(pieceName),
    });
    const stepKind = 'action';
    const stepName =
      currentStep.type === FlowActionType.PIECE
        ? currentStep.settings.actionName
        : currentStep.type;
    const stepInput =
      currentStep.type === FlowActionType.PIECE
        ? (currentStep.settings.input as Record<string, unknown> | undefined)
        : undefined;
    const explanationContext: ErrorExplanationContext = {
      pieceName,
      pieceVersion,
      pieceDisplayName: pieceModel?.displayName,
      pieceAuthType: stepPropertiesSnapshotUtils.findAuthType(pieceModel),
      stepKind,
      stepName,
      stepDisplayName: currentStep.displayName,
      stepDescription: stepPropertiesSnapshotUtils.findDescription({
        pieceModel,
        stepKind,
        stepName,
      }),
      stepProperties: stepPropertiesSnapshotUtils.build({
        pieceModel,
        stepKind,
        stepName,
        input: stepInput,
      }),
    };

    if (!sampleDataExists && !isTesting) {
      return (
        <DataPane title={t('Output')} testId="step-modal-output">
          <DataPaneMessage
            icon={<PackageOpen className="size-6 text-gray-11" />}
            title={t('No sample data yet')}
            description={t(
              'Run this step to capture sample data. You can then use the result in following steps.',
            )}
            action={
              <TestButtonTooltip saving={isSaving} invalid={!currentStep.valid}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onTestButtonClick}
                  loading={isSaving}
                  disabled={!currentStep.valid || isLoadingDynamicProperties}
                >
                  {t('Run a test')}
                </Button>
              </TestButtonTooltip>
            }
          />
        </DataPane>
      );
    }

    return (
      <TestSampleDataViewer
        currentStep={currentStep}
        flowVersionId={flowVersionId}
        isTesting={isTesting}
        sampleData={sampleData}
        sampleDataInput={sampleDataInput ?? null}
        lastTestDate={lastTestDate}
        errorMessage={errorMessage}
        consoleLogs={consoleLogs}
        explanationContext={explanationContext}
        pieceDisplayName={pieceModel?.displayName}
        pieceSchema={pieceModel?.actions[stepName ?? '']?.outputSchema ?? null}
        onCancelTesting={() => {
          removeStepTestListener(currentStep.name);
          revertSampleDataLocally?.();
        }}
      ></TestSampleDataViewer>
    );
  },
);

const isAction = (step: Step): step is FlowAction => {
  return flowStructureUtil.isAction(step.type);
};
const TestActionSection = React.memo((props: TestActionComponentProps) => {
  const currentStep = useBuilderStateContext((state) =>
    state.selectedStep
      ? flowStructureUtil.getStep(state.selectedStep, state.flowVersion.trigger)
      : null,
  );
  if (isNil(currentStep) || !isAction(currentStep)) {
    return null;
  }

  return <TestStepSectionImplementation {...props} currentStep={currentStep} />;
});

TestStepSectionImplementation.displayName = 'TestStepSectionImplementation';
TestActionSection.displayName = 'TestActionSection';

type TestActionComponentProps = {
  isSaving: boolean;
  flowVersionId: string;
  projectId: string;
};

export { TestActionSection };
