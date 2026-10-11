import { isNil } from '@activepieces/core-utils';
import { flowStructureUtil } from '@activepieces/shared';
import { t } from 'i18next';
import { Ellipsis } from 'lucide-react';
import React, { useLayoutEffect, useRef, useState } from 'react';

import { LogoPlate } from '@/components/custom/logo-plate';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { flowRunUtils } from '@/features/flow-runs';
import { stepsHooks } from '@/features/pieces';
import { formatUtils } from '@/lib/format-utils';
import { cn } from '@/lib/utils';

import { useBuilderStateContext } from '../builder-hooks';
import {
  RunStepInputPane,
  RunStepOutputPane,
} from '../run-details/flow-step-input-output';
import { PaneWidthContext } from '../step-modal/data-pane';

import { logsPanelLayoutUtils, LogsPanes } from './logs-panel-layout-utils';
import { LogsToggleButton } from './logs-toggle-button';

const LogsDetails = ({ className }: { className?: string }) => {
  const [step, run, loopsIndexes, logsPanes, toggleLogsPane, openStepModal] =
    useBuilderStateContext((state) => [
      state.selectedStep
        ? flowStructureUtil.getStep(
            state.selectedStep,
            state.flowVersion.trigger,
          ) ?? null
        : null,
      state.run,
      state.loopsIndexes,
      state.logsPanes,
      state.toggleLogsPane,
      state.openStepModal,
    ]);
  const { stepMetadata } = stepsHooks.useStepMetadata({
    step: step ?? undefined,
  });
  const stepOutput =
    run && step
      ? flowRunUtils.extractStepOutput(step.name, loopsIndexes, run.steps ?? {})
      : undefined;
  const statusText = stepOutput
    ? flowRunUtils.getStatusIconForStep(stepOutput.status).text
    : null;
  const durationText =
    stepOutput && !isNil(stepOutput.duration)
      ? formatUtils.formatDuration(stepOutput.duration, true)
      : null;

  return (
    <div
      data-logs-details
      className={cn('flex min-w-0 flex-col bg-gray-1', className)}
    >
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-canvas-divider bg-canvas-logs px-2">
        {step && (
          <div className="flex min-w-0 items-center gap-2">
            <LogoPlate
              size="xxs"
              src={stepMetadata?.logoUrl}
              alt={stepMetadata?.displayName ?? step.displayName}
            />
            <span className="min-w-0 truncate text-xs font-semibold text-gray-12">
              {step.displayName}
            </span>
            {statusText && (
              <span className="shrink-0 text-xs text-gray-11">
                {statusText}
                {durationText && ` · ${durationText}`}
              </span>
            )}
          </div>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <PaneToggle
            pressed={logsPanes.input}
            onClick={() => toggleLogsPane('input')}
          >
            {t('Input')}
          </PaneToggle>
          <PaneToggle
            pressed={logsPanes.output}
            onClick={() => toggleLogsPane('output')}
          >
            {t('Output')}
          </PaneToggle>
          <div className="flex items-center gap-1">
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t('More')}
                  disabled={isNil(step)}
                >
                  <Ellipsis className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => {
                    if (step) {
                      openStepModal({ stepName: step.name });
                    }
                  }}
                >
                  {t('Open step')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <LogsToggleButton />
          </div>
        </div>
      </div>
      {step ? (
        <LogsDetailsPanes panes={logsPanes} />
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center px-4 text-center text-xs text-gray-11">
          {t('Select a step to see its data')}
        </div>
      )}
    </div>
  );
};

const LogsDetailsPanes = ({ panes }: { panes: LogsPanes }) => {
  const bodyRef = useRef<HTMLDivElement>(null);
  const bodyWidth = useElementWidth(bodyRef);
  const [ratio, setRatio] = useState(DEFAULT_PANE_RATIO);
  const [isDragging, setIsDragging] = useState(false);
  const showBoth = panes.input && panes.output;
  const available = Math.max(bodyWidth - (showBoth ? DIVIDER_WIDTH : 0), 0);
  const inputWidth = showBoth
    ? Math.round(available * ratio)
    : panes.input
    ? available
    : 0;
  const outputWidth = showBoth
    ? available - inputWidth
    : panes.output
    ? available
    : 0;

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const body = bodyRef.current;
    if (event.button !== 0 || isNil(body)) {
      return;
    }
    event.preventDefault();
    const bounds = body.getBoundingClientRect();
    setIsDragging(true);
    const handleMove = (moveEvent: PointerEvent) => {
      setRatio(
        logsPanelLayoutUtils.clampPaneRatio(
          (moveEvent.clientX - bounds.left) / Math.max(bounds.width, 1),
        ),
      );
    };
    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
      setIsDragging(false);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
  };

  return (
    <PaneWidthContext.Provider
      value={{
        input: panes.input ? inputWidth : null,
        output: panes.output ? outputWidth : null,
      }}
    >
      <div
        ref={bodyRef}
        className={cn('relative flex min-h-0 flex-1', {
          'cursor-ew-resize select-none': isDragging,
        })}
      >
        {panes.input && (
          <div
            data-logs-pane="input"
            className={cn('h-full min-w-0 overflow-hidden', {
              'shrink-0': showBoth,
              'flex-1': !showBoth,
            })}
            style={showBoth ? { width: inputWidth } : undefined}
          >
            <RunStepInputPane testId="logs-input" />
          </div>
        )}
        {showBoth && (
          <div className="relative w-px shrink-0 bg-canvas-divider">
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label={t('Resize columns')}
              data-logs-pane-divider
              onPointerDown={startDrag}
              className="absolute inset-y-0 -left-0.75 z-10 w-1.5 cursor-ew-resize touch-none"
            />
          </div>
        )}
        {panes.output && (
          <div
            data-logs-pane="output"
            className="h-full min-w-0 flex-1 overflow-hidden"
          >
            <RunStepOutputPane testId="logs-output" />
          </div>
        )}
      </div>
    </PaneWidthContext.Provider>
  );
};

const PaneToggle = ({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <Button
    type="button"
    variant="secondary"
    size="xs"
    aria-pressed={pressed}
    data-logs-pane-toggle
    className="aria-pressed:bg-canvas-logs-toggle-on aria-pressed:enabled:hover:bg-canvas-logs-toggle-on"
    onClick={onClick}
  >
    {children}
  </Button>
);

function useElementWidth(ref: React.RefObject<HTMLDivElement | null>): number {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (isNil(element)) {
      return;
    }
    const measure = () => setWidth(element.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

const DEFAULT_PANE_RATIO = 0.5;
const DIVIDER_WIDTH = 1;

LogsDetails.displayName = 'LogsDetails';
export { LogsDetails };
