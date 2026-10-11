import { flowStructureUtil, StepOutputStatus } from '@activepieces/shared';
import { t } from 'i18next';
import { ChevronRight, CircleX, Pause } from 'lucide-react';
import React from 'react';

import { LogoPlate } from '@/components/custom/logo-plate';
import { LoadingSpinner } from '@/components/custom/spinner';
import { stepsHooks } from '@/features/pieces';
import { formatUtils } from '@/lib/format-utils';
import { cn } from '@/lib/utils';

import { useBuilderStateContext } from '../builder-hooks';

import { LOGS_PANEL_LAYOUT } from './logs-panel-layout-utils';
import { LogIterationRow, LogRow, LogStepRow } from './logs-tree-utils';

const LogsStepRow = React.memo(
  ({
    row,
    selected,
    showDuration,
    onSelect,
    onOpen,
    onToggle,
  }: LogsStepRowProps) => {
    const step = useBuilderStateContext((state) =>
      flowStructureUtil.getStep(row.stepName, state.flowVersion.trigger),
    );
    const { stepMetadata } = stepsHooks.useStepMetadata({ step });
    const failed = row.status === StepOutputStatus.FAILED;
    return (
      <button
        type="button"
        data-log-row={row.key}
        data-log-row-kind="step"
        data-log-step={row.stepName}
        data-selected={selected || undefined}
        aria-expanded={row.hasChildren ? row.expanded : undefined}
        aria-current={selected || undefined}
        className={rowClassName({ selected, failed })}
        style={{ paddingLeft: getContentOffset(row.depth) }}
        onClick={(event) => {
          if (isChevronTarget(event.target)) {
            onToggle(row.key);
            return;
          }
          onSelect(row);
        }}
        onDoubleClick={(event) => {
          if (!isChevronTarget(event.target)) {
            onOpen(row);
          }
        }}
      >
        <RowGuides row={row} />
        {row.isLoop && (
          <RowChevron expanded={row.expanded} disabled={!row.hasChildren} />
        )}
        <LogoPlate
          size="xxs"
          src={stepMetadata?.logoUrl}
          alt={stepMetadata?.displayName ?? row.displayName}
          className="mr-2"
        />
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-left text-xs font-medium text-gray-12',
            { 'text-danger-11': failed },
          )}
        >
          {step?.displayName ?? row.displayName}
        </span>
        {showDuration && row.duration !== undefined && (
          <span
            className={cn(
              'ml-2 shrink-0 text-xs text-gray-11 group-hover/log-row:text-gray-12/87',
              { 'text-gray-12/87': selected },
            )}
          >
            {formatUtils.formatDuration(row.duration, true)}
          </span>
        )}
        <RowStatusIcon status={row.status} />
      </button>
    );
  },
);
LogsStepRow.displayName = 'LogsStepRow';

const LogsIterationRow = React.memo(
  ({ row, onToggle }: LogsIterationRowProps) => (
    <button
      type="button"
      data-log-row={row.key}
      data-log-row-kind="iteration"
      aria-expanded={row.hasChildren ? row.expanded : undefined}
      className={rowClassName({ selected: false, failed: false })}
      style={{ paddingLeft: getContentOffset(row.depth) }}
      onClick={() => onToggle(row.key)}
    >
      <RowGuides row={row} />
      <RowChevron expanded={row.expanded} disabled={!row.hasChildren} />
      <span className="min-w-0 flex-1 truncate text-left text-xs text-gray-11 group-hover/log-row:text-gray-12/87">
        {t('Iteration {index}', { index: row.index + 1 })}
      </span>
    </button>
  ),
);
LogsIterationRow.displayName = 'LogsIterationRow';

const RowChevron = ({
  expanded,
  disabled,
}: {
  expanded: boolean;
  disabled: boolean;
}) => (
  <span
    data-log-chevron
    aria-hidden="true"
    className={cn('mr-1 flex size-3 shrink-0 items-center justify-center', {
      'opacity-40': disabled,
    })}
  >
    <ChevronRight
      className={cn(
        'size-3 text-gray-11 transition-transform duration-200 motion-reduce:transition-none',
        { 'rotate-90': expanded },
      )}
    />
  </span>
);

const RowStatusIcon = ({ status }: { status: StepOutputStatus }) => {
  switch (status) {
    case StepOutputStatus.RUNNING:
      return (
        <span className="ml-2 flex shrink-0" aria-label={t('Running')}>
          <LoadingSpinner className="size-3.5 stroke-accent-9 [animation-duration:400ms]" />
        </span>
      );
    case StepOutputStatus.FAILED:
      return (
        <CircleX
          aria-label={t('Failed')}
          className="ml-2 size-3.5 shrink-0 text-danger-9"
        />
      );
    case StepOutputStatus.PAUSED:
      return (
        <Pause
          aria-label={t('Paused')}
          className="ml-2 size-3.5 shrink-0 text-warning-9"
        />
      );
    default:
      return null;
  }
};

const RowGuides = ({ row }: { row: LogRow }) => {
  if (row.depth === 0) {
    return null;
  }
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0">
      {row.ancestorsContinue.map((continues, index) =>
        continues ? (
          <span
            key={index}
            className="absolute inset-y-0 w-0.5 bg-canvas-dot"
            style={{ left: getGuideOffset(index + 1) - GUIDE_HALF_WIDTH }}
          />
        ) : null,
      )}
      {row.isLast ? (
        <span
          className="absolute top-0 h-4 rounded-bl-lg border-b-2 border-l-2 border-canvas-dot"
          style={{
            left: getGuideOffset(row.depth) - GUIDE_HALF_WIDTH,
            width:
              getContentOffset(row.depth) -
              getGuideOffset(row.depth) +
              GUIDE_HALF_WIDTH -
              GUIDE_GAP,
          }}
        />
      ) : (
        <span
          className="absolute inset-y-0 w-0.5 bg-canvas-dot"
          style={{ left: getGuideOffset(row.depth) - GUIDE_HALF_WIDTH }}
        />
      )}
    </span>
  );
};

function rowClassName({
  selected,
  failed,
}: {
  selected: boolean;
  failed: boolean;
}): string {
  return cn(
    'group/log-row relative mx-2 flex h-8 w-[calc(100%-16px)] shrink-0 items-center rounded-sm pr-2 outline-hidden focus-visible:inset-ring-1 focus-visible:inset-ring-focus hover:bg-canvas-logs-row-hover',
    {
      'bg-canvas-logs-row-selected hover:bg-canvas-logs-row-selected':
        selected && !failed,
      'bg-danger-2 hover:bg-danger-2': selected && failed,
    },
  );
}

function getContentOffset(depth: number): number {
  return ROW_PADDING + depth * LOGS_PANEL_LAYOUT.indent;
}

function getGuideOffset(level: number): number {
  return getContentOffset(level - 1) + CHEVRON_CENTER;
}

function isChevronTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element && target.closest('[data-log-chevron]') !== null
  );
}

const ROW_PADDING = 8;
const CHEVRON_CENTER = 6;
const GUIDE_HALF_WIDTH = 1;
const GUIDE_GAP = 4;

export { LogsStepRow, LogsIterationRow };

type LogsStepRowProps = {
  row: LogStepRow;
  selected: boolean;
  showDuration: boolean;
  onSelect: (row: LogStepRow) => void;
  onOpen: (row: LogStepRow) => void;
  onToggle: (key: string) => void;
};

type LogsIterationRowProps = {
  row: LogIterationRow;
  onToggle: (key: string) => void;
};
