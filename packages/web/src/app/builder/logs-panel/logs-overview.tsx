import { FlowRun, StepOutputStatus } from '@activepieces/shared';
import { useReactFlow } from '@xyflow/react';
import { t } from 'i18next';
import { Info, Trash2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { flowRunUtils } from '@/features/flow-runs';
import {
  isTimelineEmpty,
  TimelineBar,
} from '@/features/flow-runs/components/timeline-bar';
import { cn } from '@/lib/utils';

import { useBuilderStateContext } from '../builder-hooks';
import { flowCanvasHooks } from '../flow-canvas/hooks';
import { flowCanvasUtils } from '../flow-canvas/utils/flow-canvas-utils';

import { LOGS_PANEL_LAYOUT } from './logs-panel-layout-utils';
import { useRunStatusSummary } from './logs-run-status';
import { LogsIterationRow, LogsStepRow } from './logs-step-row';
import { LogsToggleButton } from './logs-toggle-button';
import { LogStepRow, logsTreeUtils } from './logs-tree-utils';

const LogsOverview = ({
  run,
  listWidth,
  showToggle,
  onCollapse,
}: LogsOverviewProps) => {
  const [
    trigger,
    selectedStep,
    loopsIndexes,
    setLoopIndex,
    selectStepByName,
    openStepModal,
    isRunOpenedFromList,
  ] = useBuilderStateContext((state) => [
    state.flowVersion.trigger,
    state.selectedStep,
    state.loopsIndexes,
    state.setLoopIndex,
    state.selectStepByName,
    state.openStepModal,
    state.isRunOpenedFromList,
  ]);
  const focusStepIfOffscreen = flowCanvasHooks.useFocusStepIfOffscreen();
  const tree = useMemo(
    () => logsTreeUtils.buildLogTree({ trigger, steps: run.steps ?? {} }),
    [trigger, run.steps],
  );
  const failedPathKeys = useMemo(
    () => logsTreeUtils.getFailedPathKeys(tree),
    [tree],
  );
  const [expandedOverrides, setExpandedOverrides] = useState<
    Record<string, boolean>
  >({});
  const rows = logsTreeUtils.flattenLogTree({
    nodes: tree,
    isExpanded: (key) => expandedOverrides[key] ?? failedPathKeys.has(key),
  });
  const selectedRow =
    rows.find((row): row is LogStepRow =>
      logsTreeUtils.isRowSelected({ row, selectedStep, loopsIndexes }),
    ) ?? null;

  const toggleRow = (key: string) => {
    setExpandedOverrides((current) => ({
      ...current,
      [key]: !(current[key] ?? failedPathKeys.has(key)),
    }));
  };

  const selectRow = (row: LogStepRow) => {
    row.loopPath.forEach((entry) => setLoopIndex(entry.loopName, entry.index));
    selectStepByName(row.stepName);
    focusStepIfOffscreen(row.stepName);
  };

  const openRow = (row: LogStepRow) => {
    row.loopPath.forEach((entry) => setLoopIndex(entry.loopName, entry.index));
    openStepModal({ stepName: row.stepName });
  };

  const handleListKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = ROW_STEP_BY_KEY.get(event.key);
    if (step !== undefined) {
      const target = logsTreeUtils.findAdjacentStepRow({
        rows,
        currentKey: selectedRow?.key ?? null,
        direction: step,
      });
      event.preventDefault();
      if (target) {
        selectRow(target);
        focusRowElement({ container: event.currentTarget, key: target.key });
      }
      return;
    }
    if (event.key === 'Enter' && selectedRow) {
      event.preventDefault();
      openRow(selectedRow);
    }
  };

  return (
    <div data-logs-overview className="flex h-full min-h-0 flex-col">
      <div
        className="flex h-9 shrink-0 items-center gap-2 border-b border-canvas-divider bg-canvas-logs px-2"
        onClick={(event) => {
          if (!isButtonTarget(event.target)) {
            onCollapse();
          }
        }}
      >
        <span className="text-xs font-semibold text-gray-12">{t('Logs')}</span>
        <div className="ml-auto flex items-center gap-1">
          {!isRunOpenedFromList && <ClearRunButton />}
          {showToggle && <LogsToggleButton />}
        </div>
      </div>
      <LogsRunSummary run={run} />
      <div
        data-logs-step-list
        className="min-h-0 flex-1 overflow-y-auto pb-2"
        onKeyDown={handleListKeyDown}
      >
        {rows.map((row) =>
          row.kind === 'step' ? (
            <LogsStepRow
              key={row.key}
              row={row}
              selected={row.key === selectedRow?.key}
              showDuration={listWidth >= LOGS_PANEL_LAYOUT.durationMinListWidth}
              onSelect={selectRow}
              onOpen={openRow}
              onToggle={toggleRow}
            />
          ) : (
            <LogsIterationRow key={row.key} row={row} onToggle={toggleRow} />
          ),
        )}
      </div>
    </div>
  );
};

const ClearRunButton = () => {
  const { switchToDraft, isSwitchingToDraftPending } =
    flowCanvasHooks.useSwitchToDraft();
  return (
    <Button
      type="button"
      variant="secondary"
      size="xs"
      loading={isSwitchingToDraftPending}
      onClick={() => switchToDraft()}
    >
      <Trash2 className="size-3" />
      {t('Clear')}
    </Button>
  );
};

const LogsRunSummary = ({ run }: { run: FlowRun }) => {
  const { text, isFailure, isTerminal, duration } = useRunStatusSummary(run);
  return (
    <div
      data-logs-run-summary
      className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 text-xs text-gray-11"
    >
      <span className={cn('min-w-0', { 'text-danger-11': isFailure })}>
        <span data-logs-run-status>{text}</span>
        {duration && <span>{` · ${duration}`}</span>}
      </span>
      {run.failedStep && (
        <JumpToFailedStepButton failedStepName={run.failedStep.name} />
      )}
      <ResumeLiveFollowButton isRunTerminal={isTerminal} />
      {isTerminal && !isTimelineEmpty(run.timeline) && (
        <HoverCard openDelay={200} closeDelay={100}>
          <HoverCardTrigger className="inline-flex cursor-default items-center">
            <Info className="size-3.5 text-gray-11" />
          </HoverCardTrigger>
          <HoverCardContent className="w-[28rem] p-3">
            <TimelineBar timeline={run.timeline} />
          </HoverCardContent>
        </HoverCard>
      )}
    </div>
  );
};

const ResumeLiveFollowButton = ({
  isRunTerminal,
}: {
  isRunTerminal: boolean;
}) => {
  const [userManuallySelectedStepDuringRun, resumeLiveFollow] =
    useBuilderStateContext((state) => [
      state.userManuallySelectedStepDuringRun,
      state.resumeLiveFollow,
    ]);
  if (isRunTerminal || !userManuallySelectedStepDuringRun) {
    return null;
  }
  return (
    <Button
      type="button"
      variant="link"
      className="h-auto text-xs"
      onClick={resumeLiveFollow}
    >
      {t('Follow run updates')}
    </Button>
  );
};

const JumpToFailedStepButton = ({
  failedStepName,
}: {
  failedStepName: string;
}) => {
  const [selectedStep, selectFailedStep, run, loopsIndexes] =
    useBuilderStateContext((state) => [
      state.selectedStep,
      state.selectFailedStep,
      state.run,
      state.loopsIndexes,
    ]);
  const { fitView } = useReactFlow();
  const selectedStepOutput =
    run && selectedStep
      ? flowRunUtils.extractStepOutput(
          selectedStep,
          loopsIndexes,
          run.steps ?? {},
        )
      : null;
  if (
    selectedStep === failedStepName &&
    selectedStepOutput?.status === StepOutputStatus.FAILED
  ) {
    return null;
  }
  return (
    <Button
      type="button"
      variant="link"
      className="h-auto text-xs text-danger-11 hover:text-danger-11"
      onClick={() => {
        selectFailedStep();
        fitView(flowCanvasUtils.createFocusStepInGraphParams(failedStepName));
      }}
    >
      {t('See error')}
    </Button>
  );
};

function focusRowElement({
  container,
  key,
}: {
  container: HTMLElement;
  key: string;
}): void {
  requestAnimationFrame(() => {
    const element = container.querySelector(
      `[data-log-row="${CSS.escape(key)}"]`,
    );
    if (element instanceof HTMLElement) {
      element.focus();
      element.scrollIntoView({ block: 'nearest' });
    }
  });
}

const ROW_STEP_BY_KEY = new Map<string, 1 | -1>([
  ['ArrowDown', 1],
  ['ArrowUp', -1],
]);

function isButtonTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('button') !== null;
}

LogsOverview.displayName = 'LogsOverview';
export { LogsOverview };

type LogsOverviewProps = {
  run: FlowRun;
  listWidth: number;
  showToggle: boolean;
  onCollapse: () => void;
};
