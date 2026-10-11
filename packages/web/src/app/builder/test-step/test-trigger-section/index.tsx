import { isNil } from '@activepieces/core-utils';
import {
  FlowTrigger,
  FlowTriggerType,
  flowStructureUtil,
} from '@activepieces/shared';
import { t } from 'i18next';
import { PackageOpen } from 'lucide-react';
import React from 'react';

import { triggerEventHooks } from '@/features/flows';

import { useBuilderStateContext } from '../../builder-hooks';
import { stepPropertiesSnapshotUtils } from '../../data-display/build-step-properties-snapshot';
import { ErrorExplanationContext } from '../../data-display/explanation-prompt';
import { DataPane, DataPaneMessage } from '../../step-modal/data-pane';
import { JsonTreeSkeleton } from '../json-tree-skeleton';
import { useTriggerTestRunner } from '../test-runner-context';
import { TestSampleDataViewer } from '../test-sample-data-viewer';

import { FirstTimeTestingSection } from './first-time-testing-section';
import { ManualWebhookTestButton } from './manual-webhook-test-button';
import { SimulationNote } from './simulation-section';
import { TriggerEventSelect } from './trigger-event-select';

type TestTriggerSectionProps = {
  isSaving: boolean;
  flowVersionId: string;
  flowId: string;
  projectId: string;
};

const TestTriggerSection = React.memo(
  ({ isSaving, flowVersionId, flowId }: TestTriggerSectionProps) => {
    const runner = useTriggerTestRunner();
    const currentStep = useBuilderStateContext((state) =>
      state.selectedStep
        ? flowStructureUtil.getStep(
            state.selectedStep,
            state.flowVersion.trigger,
          )
        : null,
    );

    const stepName = currentStep?.name;
    const { sampleData, sampleDataInput, lastTestDate } =
      useBuilderStateContext((state) => ({
        sampleData: stepName ? state.outputSampleData[stepName] : undefined,
        sampleDataInput: stepName ? state.inputSampleData[stepName] : undefined,
        lastTestDate:
          stepName && state.selectedStep
            ? findTriggerLastTestDate(state.flowVersion.trigger, stepName)
            : undefined,
      }));

    const { pollResults } = triggerEventHooks.usePollResults(
      flowVersionId,
      flowId,
    );

    if (!runner || !currentStep || currentStep.type !== FlowTriggerType.PIECE) {
      return null;
    }

    const {
      pieceModel,
      isPieceLoading,
      testType,
      mockData,
      isValid,
      isSimulating,
      isSavingMockdata,
      isPollingTesting,
      errorMessage,
      isTestingDialogOpen,
      setIsTestingDialogOpen,
      abortControllerRef,
      saveMockAsSampleData,
      resetSimulation,
      fireTest,
    } = runner;

    const sampleDataSelected = !isNil(lastTestDate) || !isNil(errorMessage);
    const isTestedBefore = !isNil(lastTestDate);
    const showFirstTimeTestingSection = !isTestedBefore && !isSimulating;

    if (isPieceLoading || isNil(testType)) {
      return (
        <DataPane title={t('Output')} testId="step-modal-output">
          {isPieceLoading && (
            <div className="px-3 py-2">
              <JsonTreeSkeleton />
            </div>
          )}
        </DataPane>
      );
    }

    const showSampleDataViewer =
      sampleDataSelected && !isSimulating && !isSavingMockdata;

    const triggerName = currentStep.settings.triggerName;
    const triggerInput = currentStep.settings.input as
      | Record<string, unknown>
      | undefined;
    const explanationContext: ErrorExplanationContext = {
      pieceName: currentStep.settings.pieceName,
      pieceVersion: currentStep.settings.pieceVersion,
      pieceDisplayName: pieceModel?.displayName,
      pieceAuthType: stepPropertiesSnapshotUtils.findAuthType(pieceModel),
      stepKind: 'trigger',
      stepName: triggerName,
      stepDisplayName: currentStep.displayName,
      stepDescription: stepPropertiesSnapshotUtils.findDescription({
        pieceModel,
        stepKind: 'trigger',
        stepName: triggerName,
      }),
      stepProperties: stepPropertiesSnapshotUtils.build({
        pieceModel,
        stepKind: 'trigger',
        stepName: triggerName,
        input: triggerInput,
      }),
    };

    const getSimulationNote = () => {
      switch (testType) {
        case 'simulation':
          return t('testPieceWebhookTriggerNote', {
            pieceName: pieceModel?.displayName,
            triggerName: triggerName
              ? pieceModel?.triggers[triggerName]?.displayName
              : undefined,
          });
        case 'webhook':
          return (
            <div className="flex flex-col gap-2">
              <p>
                {t(
                  'Send Data to the webhook URL to generate sample data to use in the next steps',
                )}
              </p>
              <ManualWebhookTestButton
                isWebhookTestingDialogOpen={isTestingDialogOpen}
                setIsWebhookTestingDialogOpen={(value) => {
                  setIsTestingDialogOpen(value);
                  if (!value) {
                    abortControllerRef.current.abort();
                    abortControllerRef.current = new AbortController();
                  }
                }}
              />
            </div>
          );
        default:
          return null;
      }
    };

    const isFirstTimeTesting = isPollingTesting || isTestingDialogOpen;

    if (showFirstTimeTestingSection && !errorMessage) {
      return (
        <DataPane title={t('Output')} testId="step-modal-output">
          {isFirstTimeTesting ? (
            <div className="px-3 py-2">
              <JsonTreeSkeleton />
            </div>
          ) : (
            <DataPaneMessage
              icon={<PackageOpen className="size-6 text-gray-11" />}
              title={t('No sample data yet')}
              description={t(
                'Test the trigger to capture sample data. You can then use the result in the following steps.',
              )}
              action={
                <FirstTimeTestingSection
                  isValid={isValid}
                  testType={testType}
                  isTesting={
                    isPollingTesting || isSimulating || isTestingDialogOpen
                  }
                  mockData={mockData}
                  isSaving={isSaving || isSavingMockdata}
                  onSimulateTrigger={fireTest}
                  onPollTrigger={fireTest}
                  onMcpToolTesting={fireTest}
                  onSaveMockAsSampleData={saveMockAsSampleData}
                />
              }
            />
          )}
        </DataPane>
      );
    }

    if (isSimulating) {
      return (
        <DataPane title={t('Output')} testId="step-modal-output">
          <SimulationNote
            note={getSimulationNote()}
            resetSimulation={resetSimulation}
            abortControllerRef={abortControllerRef}
          />
        </DataPane>
      );
    }

    if (!showSampleDataViewer) {
      return (
        <DataPane title={t('Output')} testId="step-modal-output">
          <div className="px-3 py-2">
            <JsonTreeSkeleton />
          </div>
        </DataPane>
      );
    }

    return (
      <TestSampleDataViewer
        currentStep={currentStep}
        hideCancel={true}
        consoleLogs={null}
        isTesting={isPollingTesting}
        sampleData={sampleData}
        sampleDataInput={sampleDataInput ?? null}
        errorMessage={errorMessage ?? null}
        lastTestDate={lastTestDate}
        pieceSchema={
          pieceModel?.triggers[triggerName ?? '']?.outputSchema ?? null
        }
        explanationContext={explanationContext}
        pieceDisplayName={pieceModel?.displayName}
      >
        {pollResults?.data && !errorMessage && (
          <div className="px-3 pt-2">
            <TriggerEventSelect
              pollResults={pollResults}
              sampleData={sampleData}
            />
          </div>
        )}
      </TestSampleDataViewer>
    );
  },
);
TestTriggerSection.displayName = 'TestTriggerSection';

const findTriggerLastTestDate = (
  trigger: FlowTrigger,
  stepName: string,
): string | undefined => {
  const step = flowStructureUtil.getStep(stepName, trigger);
  return step?.settings?.sampleData?.lastTestDate;
};

export { TestTriggerSection };
