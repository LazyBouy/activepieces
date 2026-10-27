import { isNil, tryParseFriendlyPieceError } from '@activepieces/core-utils';
import {
  StepOutputStatus,
  flowStructureUtil,
  AgentResult,
  FlowActionType,
  FlowTriggerType,
  isFlowRunStateTerminal,
  FlowRun,
  FlowRunStatus,
  ApFlagId,
  LogSliceRef,
  StepOutputType,
  RunInternalError,
  StepOutput,
  FlowAction,
  FlowTrigger,
  opencodeStepUtil,
} from '@activepieces/shared';
import { t } from 'i18next';
import { Download, Info, ShieldAlert } from 'lucide-react';
import { useMemo } from 'react';

import { StepOutputSkeleton } from '@/app/components/step-output-skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AgentTimeline } from '@/features/agents';
import { flowRunUtils } from '@/features/flow-runs';
import {
  OpencodeStepAsks,
  OpencodeStepChannels,
  OpencodeStepSessions,
} from '@/features/opencode';
import { piecesHooks } from '@/features/pieces';
import { flagsHooks } from '@/hooks/flags-hooks';
import { formatUtils } from '@/lib/format-utils';

import { useBuilderStateContext } from '../builder-hooks';
import { stepPropertiesSnapshotUtils } from '../data-display/build-step-properties-snapshot';
import { ErrorExplanationContext } from '../data-display/explanation-prompt';
import { FriendlyErrorView } from '../data-display/friendly-error-view';
import { friendlyTreeUtils } from '../data-selector/friendly-tree';
import {
  DataPane,
  DataPaneCountLine,
  DataPaneDataActions,
  DataPaneMessage,
  DataPaneStatus,
  useIsPaneCompact,
} from '../step-modal/data-pane';
import { DataView } from '../step-modal/data-view';
import { schemaViewUtils } from '../step-modal/schema-view-utils';
import { useViewMode, ViewModeControl } from '../step-modal/view-mode-control';
import { viewModeUtils } from '../step-modal/view-mode-utils';
import { isRunAgent } from '../test-step/agent-test-step';

import { AiRouterRoutes } from './ai-router-routes';
import { LoopIterationInput } from './loop-iteration-input';
import { truncatedInputUtils } from './truncated-input-utils';

const RunStepInputPane = ({
  testId = 'step-modal-input',
}: RunStepPaneProps = {}) => {
  const { run, selectedStep, stepOutput, retentionDays } =
    useSelectedStepRunOutput();
  const [viewMode, setViewMode] = useViewMode('input');
  const compact = useIsPaneCompact('input');
  const input = stepOutput?.input;
  const schemaNodes = useRunSchemaNodes({
    stepName: selectedStep?.name,
    data: input,
    schema: null,
  });
  if (isNil(run) || isNil(selectedStep)) {
    return null;
  }
  const blocker = getRunBlocker({ run, stepOutput, retentionDays });
  return (
    <DataPane
      title={t('Input')}
      testId={testId}
      titleAddon={<LoopIterationInput stepName={selectedStep.name} />}
      actions={
        isNil(blocker) && (
          <>
            <ViewModeControl
              value={viewMode}
              onChange={setViewMode}
              compact={compact}
            />
            <DataPaneDataActions
              data={input}
              fileName={`${selectedStep.name}-input`}
            />
          </>
        )
      }
    >
      {blocker ?? (
        <div className="flex flex-col gap-2 pb-3">
          {truncatedInputUtils.hasTruncatedValues(input) && (
            <div className="px-3 pt-2">
              <TruncatedInputNotice />
            </div>
          )}
          <DataView
            mode={viewMode}
            data={input}
            schemaNodes={schemaNodes}
            basePath={null}
          />
        </div>
      )}
    </DataPane>
  );
};

const RunStepOutputPane = ({
  testId = 'step-modal-output',
}: RunStepPaneProps = {}) => {
  const { run, selectedStep, stepOutput, retentionDays, pieceModel } =
    useSelectedStepRunOutput();
  const [viewMode, setViewMode] = useViewMode('output');
  const compact = useIsPaneCompact('output');
  const isSlicedOutput = stepOutput?.outputType === StepOutputType.SLICE;
  const parsedOutput = isSlicedOutput
    ? undefined
    : stepOutput?.errorMessage ?? stepOutput?.output;
  const pieceSchema = findPieceSchema({ step: selectedStep, pieceModel });
  const schemaNodes = useRunSchemaNodes({
    stepName: selectedStep?.name,
    data: parsedOutput,
    schema: stepOutput?.errorMessage ? null : pieceSchema,
  });
  if (isNil(run) || isNil(selectedStep)) {
    return null;
  }
  const blocker = getRunBlocker({ run, stepOutput, retentionDays });
  if (!isNil(blocker) || isNil(stepOutput)) {
    return (
      <DataPane
        title={t('Output')}
        testId={testId}
        titleAddon={<LoopIterationInput stepName={selectedStep.name} />}
      >
        {blocker}
      </DataPane>
    );
  }
  const isRunning = stepOutput.status === StepOutputStatus.RUNNING;
  const isFailed = stepOutput.status === StepOutputStatus.FAILED;
  const isAgent = isRunAgent(selectedStep);
  const slicedOutputRef = isSlicedOutput
    ? readSliceRef(stepOutput.output)
    : undefined;
  const friendlyError = tryParseFriendlyPieceError(stepOutput.errorMessage);
  const showData = !isRunning && isNil(slicedOutputRef) && !isAgent;
  return (
    <DataPane
      title={t('Output')}
      testId={testId}
      titleAddon={
        <>
          {!isRunning && (
            <DataPaneStatus
              status={isFailed ? 'failed' : 'success'}
              mode="run"
              detail={
                isNil(stepOutput.duration)
                  ? null
                  : `${t('Duration')}: ${formatUtils.formatDuration(
                      stepOutput.duration,
                    )}`
              }
            />
          )}
          <LoopIterationInput stepName={selectedStep.name} />
        </>
      }
      actions={
        showData && (
          <>
            <ViewModeControl
              value={viewMode}
              onChange={setViewMode}
              compact={compact}
            />
            <DataPaneDataActions
              data={parsedOutput}
              fileName={`${selectedStep.name}-output`}
            />
          </>
        )
      }
      subheader={
        showData && (
          <DataPaneCountLine count={viewModeUtils.getItemCount(parsedOutput)} />
        )
      }
    >
      <OpencodeStepAsks
        flowRunId={run.id}
        stepName={selectedStep.name}
        enabled={opencodeStepUtil.runsOnOpencode({ step: selectedStep })}
      />
      {opencodeStepUtil.isChannelStep({ step: selectedStep }) ? (
        <OpencodeStepChannels
          flowRunId={run.id}
          stepName={selectedStep.name}
          enabled={true}
          live={false}
        />
      ) : (
        <OpencodeStepSessions
          flowRunId={run.id}
          stepName={selectedStep.name}
          enabled={opencodeStepUtil.runsOnOpencode({ step: selectedStep })}
        />
      )}
      {isRunning ? (
        <StepOutputSkeleton className="p-4" />
      ) : slicedOutputRef ? (
        <div className="px-3 py-2">
          <SlicedOutputDownload slicedOutputRef={slicedOutputRef} />
        </div>
      ) : isAgent && isAgentResult(stepOutput.output) ? (
        <div className="px-3 py-2">
          <AgentTimeline agentResult={stepOutput.output} />
        </div>
      ) : (
        <div className="flex flex-col gap-2 pb-3">
          {friendlyError && (
            <div className="px-3 pt-2">
              <FriendlyErrorView
                error={friendlyError}
                explanationContext={buildExplanationContext({
                  step: selectedStep,
                  pieceModel,
                })}
                pieceDisplayName={pieceModel?.displayName}
              />
            </div>
          )}
          {selectedStep.type === FlowActionType.AI_ROUTER && (
            <div className="px-3 pt-2">
              <AiRouterRoutes
                output={stepOutput.output}
                input={stepOutput.input}
              />
            </div>
          )}
          <DataView
            mode={viewMode}
            data={parsedOutput}
            schemaNodes={schemaNodes}
            basePath={null}
          />
        </div>
      )}
    </DataPane>
  );
};

function useSelectedStepRunOutput(): SelectedStepRunOutput {
  const [run, loopsIndexes, selectedStep] = useBuilderStateContext((state) => [
    state.run,
    state.loopsIndexes,
    state.selectedStep
      ? flowStructureUtil.getStep(
          state.selectedStep,
          state.flowVersion.trigger,
        ) ?? null
      : null,
  ]);
  const stepOutput = useMemo(() => {
    return run && selectedStep && run.steps
      ? flowRunUtils.extractStepOutput(
          selectedStep.name,
          loopsIndexes,
          run.steps,
        )
      : undefined;
  }, [run, selectedStep, loopsIndexes]);
  const { data: retentionDays } = flagsHooks.useFlag<number>(
    ApFlagId.EXECUTION_DATA_RETENTION_DAYS,
  );
  const pieceName = getPieceName(selectedStep);
  const { pieceModel } = piecesHooks.usePiece({
    name: pieceName ?? '',
    version: getPieceVersion(selectedStep),
    enabled: !isNil(pieceName),
  });
  return {
    run,
    selectedStep,
    stepOutput,
    retentionDays: retentionDays ?? null,
    pieceModel,
  };
}

function useRunSchemaNodes({
  stepName,
  data,
  schema,
}: {
  stepName: string | undefined;
  data: unknown;
  schema: ReturnType<typeof findPieceSchema>;
}) {
  return useMemo(
    () =>
      schemaViewUtils.fromDataSelectorNodes({
        nodes: schemaViewUtils.rootChildren(
          friendlyTreeUtils.buildDataNode({
            stepName: stepName ?? 'step',
            displayName: stepName ?? '',
            data,
            schema,
          }),
        ),
      }),
    [stepName, data, schema],
  );
}

function getRunBlocker({
  run,
  stepOutput,
  retentionDays,
}: {
  run: FlowRun;
  stepOutput: StepOutput | undefined;
  retentionDays: number | null;
}): React.ReactNode | null {
  if (
    run.status === FlowRunStatus.INTERNAL_ERROR &&
    !isNil(run.internalError) &&
    isNil(stepOutput)
  ) {
    return <InternalErrorPanel internalError={run.internalError} />;
  }
  const isRunDone = isFlowRunStateTerminal({
    status: run.status,
    ignoreInternalError: true,
  });
  if (
    !isRunDone &&
    run.status !== FlowRunStatus.PAUSED &&
    run.status !== FlowRunStatus.INTERNAL_ERROR &&
    isNil(stepOutput)
  ) {
    return <StepOutputSkeleton className="p-4" />;
  }
  const message =
    run.status === FlowRunStatus.INTERNAL_ERROR && isNil(stepOutput)
      ? t(
          'There are no logs captured for this run, because of an internal error, please contact support.',
        )
      : handleRunFailureOrEmptyLog(run, retentionDays);
  if (message) {
    return (
      <DataPaneMessage
        icon={<Info className="size-6 text-gray-11" />}
        title={message}
      />
    );
  }
  if (isNil(stepOutput)) {
    return (
      <DataPaneMessage
        icon={<Info className="size-6 text-gray-11" />}
        title={t("This step didn't run")}
        description={t(
          'This step was skipped during this run, no input or output was captured.',
        )}
      />
    );
  }
  return null;
}

function buildExplanationContext({
  step,
  pieceModel,
}: {
  step: FlowAction | FlowTrigger;
  pieceModel: SelectedStepRunOutput['pieceModel'];
}): ErrorExplanationContext {
  const stepKind: 'action' | 'trigger' =
    step.type === FlowTriggerType.PIECE ? 'trigger' : 'action';
  const stepName = getStepKey(step);
  const stepInput =
    step.type === FlowActionType.PIECE || step.type === FlowTriggerType.PIECE
      ? toRecord(step.settings.input)
      : undefined;
  return {
    pieceName: getPieceName(step) ?? undefined,
    pieceVersion: getPieceVersion(step),
    pieceDisplayName: pieceModel?.displayName,
    pieceAuthType: stepPropertiesSnapshotUtils.findAuthType(pieceModel),
    stepKind,
    stepName,
    stepDisplayName: step.displayName,
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
}

function findPieceSchema({
  step,
  pieceModel,
}: {
  step: FlowAction | FlowTrigger | null;
  pieceModel: SelectedStepRunOutput['pieceModel'];
}) {
  if (isNil(step)) {
    return null;
  }
  const stepKey = getStepKey(step) ?? '';
  return (
    pieceModel?.actions[stepKey]?.outputSchema ??
    pieceModel?.triggers[stepKey]?.outputSchema ??
    null
  );
}

function getStepKey(step: FlowAction | FlowTrigger): string | undefined {
  if (step.type === FlowActionType.PIECE) {
    return step.settings.actionName;
  }
  if (step.type === FlowTriggerType.PIECE) {
    return step.settings.triggerName;
  }
  return step.type;
}

function getPieceName(step: FlowAction | FlowTrigger | null): string | null {
  if (
    step?.type === FlowActionType.PIECE ||
    step?.type === FlowTriggerType.PIECE
  ) {
    return step.settings.pieceName;
  }
  return null;
}

function getPieceVersion(
  step: FlowAction | FlowTrigger | null,
): string | undefined {
  if (
    step?.type === FlowActionType.PIECE ||
    step?.type === FlowTriggerType.PIECE
  ) {
    return step.settings.pieceVersion;
  }
  return undefined;
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }
  return Object.fromEntries(Object.entries(value));
}

function readSliceRef(value: unknown): LogSliceRef | undefined {
  if (
    typeof value === 'object' &&
    value !== null &&
    'url' in value &&
    typeof value.url === 'string' &&
    'size' in value &&
    typeof value.size === 'number'
  ) {
    return {
      fileId: 'fileId' in value ? String(value.fileId) : '',
      url: value.url,
      size: value.size,
    };
  }
  return undefined;
}

function isAgentResult(value: unknown): value is AgentResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    'steps' in value
  );
}

const InternalErrorPanel = ({
  internalError,
}: {
  internalError: RunInternalError;
}) => (
  <div className="flex flex-col gap-3 p-4">
    <div className="flex items-center gap-2 flex-wrap">
      <ShieldAlert className="w-4 h-4 text-danger-11 shrink-0" />
      <span className="text-sm font-medium">{t('Internal error')}</span>
      <Badge variant="outline" className="gap-1">
        <ShieldAlert className="w-3 h-3" />
        {t('Platform Admin Only')}
      </Badge>
    </div>
    <div className="flex flex-col gap-1 text-xs text-gray-11">
      <span>
        {t('Source')}: {internalError.source}
      </span>
      {internalError.code && (
        <span>
          {t('Code')}: {internalError.code}
        </span>
      )}
      <span>
        {t('Occurred at')}:{' '}
        {formatUtils.formatDate(new Date(internalError.occurredAt))}
      </span>
    </div>
    <pre className="text-xs bg-gray-3 rounded-md p-3 whitespace-pre-wrap break-words font-mono">
      {internalError.message}
    </pre>
  </div>
);

const TruncatedInputNotice = () => (
  <div className="flex items-start gap-2 p-3 bg-gray-3 rounded-md text-sm">
    <Info className="w-4 h-4 mt-0.5 text-gray-11 shrink-0" />
    <span>
      {t(
        'Some input values were too large to keep in the run logs and are shown as truncated. The step ran with the full values.',
      )}{' '}
      <a
        href="https://www.activepieces.com/docs/install/troubleshooting/truncated-logs"
        target="_blank"
        rel="noreferrer"
        className="text-accent-11 underline"
      >
        {t('Learn more')}
      </a>
    </span>
  </div>
);

const SlicedOutputDownload = ({
  slicedOutputRef,
}: {
  slicedOutputRef: LogSliceRef;
}) => (
  <div className="flex flex-col gap-3 p-4 bg-gray-3 rounded-md">
    <div className="flex items-start gap-2 text-sm">
      <Info className="w-4 h-4 mt-0.5 text-gray-11 shrink-0" />
      <span>
        {t(
          'Output is too large to display inline ({size}). Download to inspect.',
          { size: formatUtils.formatStorageSize(slicedOutputRef.size) },
        )}
      </span>
    </div>
    <Button asChild variant="outline" size="sm" className="w-fit gap-2">
      <a
        href={slicedOutputRef.url}
        target="_blank"
        rel="noopener noreferrer"
        download
      >
        <Download className="w-4 h-4" />
        {t('Download output')}
      </a>
    </Button>
  </div>
);

function handleRunFailureOrEmptyLog(
  run: FlowRun | null,
  retentionDays: number | null,
) {
  if (
    isNil(run) ||
    !isFlowRunStateTerminal({ status: run.status, ignoreInternalError: true })
  ) {
    return null;
  }

  if (isNil(run.logsFileId)) {
    return t(
      'Logs are kept for {days} days after execution and then deleted.',
      { days: retentionDays },
    );
  }
  return null;
}

export { RunStepInputPane, RunStepOutputPane };

type RunStepPaneProps = {
  testId?: string;
};

type SelectedStepRunOutput = {
  run: FlowRun | null;
  selectedStep: FlowAction | FlowTrigger | null;
  stepOutput: StepOutput | undefined;
  retentionDays: number | null;
  pieceModel: ReturnType<typeof piecesHooks.usePiece>['pieceModel'];
};
