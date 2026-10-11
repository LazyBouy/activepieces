import { isNil } from '@activepieces/core-utils';
import { t } from 'i18next';
import React, { useLayoutEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

import { ColumnGrip } from './column-grip';
import { PaneWidthContext } from './data-pane';
import {
  ColumnPercentages,
  ColumnWidths,
  StepModalLayoutClass,
  stepModalLayoutUtils,
} from './step-modal-layout-utils';

const StepModalColumns = ({
  layoutClass,
  storageKey,
  input,
  center,
  output,
}: StepModalColumnsProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const containerWidth = useContainerWidth(containerRef);
  const [percentages, setPercentages] = useState<ColumnPercentages | null>(() =>
    stepModalLayoutUtils.readLayout({ key: storageKey }),
  );
  const [activeDrag, setActiveDrag] = useState<DragKind | null>(null);
  const isInputless = layoutClass === 'inputless';
  const total = Math.max(containerWidth - (isInputless ? 1 : 2), 0);
  const widths = resolveWidths({ total, layoutClass, percentages });

  const commit = (next: ColumnWidths) => {
    const nextPercentages = stepModalLayoutUtils.toPercentages(next);
    setPercentages(nextPercentages);
    stepModalLayoutUtils.saveLayout({
      key: storageKey,
      percentages: nextPercentages,
    });
  };

  const reset = () => {
    setPercentages(null);
    stepModalLayoutUtils.clearLayout({ key: storageKey });
  };

  const startDrag =
    (kind: DragKind) => (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || isNil(widths)) {
        return;
      }
      event.preventDefault();
      const start = widths;
      const startX = event.clientX;
      const session = { latest: start, moved: false };
      setActiveDrag(kind);
      const handleMove = (moveEvent: PointerEvent) => {
        const delta = moveEvent.clientX - startX;
        session.latest = computeDrag({ kind, start, delta, layoutClass });
        session.moved = true;
        setPercentages(stepModalLayoutUtils.toPercentages(session.latest));
      };
      const handleUp = () => {
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
        window.removeEventListener('pointercancel', handleUp);
        setActiveDrag(null);
        if (session.moved) {
          commit(session.latest);
        }
      };
      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
      window.addEventListener('pointercancel', handleUp);
    };

  const handleEdgeKeyDown =
    (edge: 'left' | 'right') =>
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (isNil(widths)) {
        return;
      }
      const direction =
        event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
      if (direction === 0) {
        return;
      }
      event.preventDefault();
      commit(
        stepModalLayoutUtils.resizeEdge({
          start: widths,
          edge,
          delta: direction * stepModalLayoutUtils.LAYOUT.step,
          layoutClass,
        }),
      );
    };

  const leftEdge = isNil(widths) ? 0 : widths.input;
  const centerStart = isNil(widths)
    ? 0
    : isInputless
    ? 0
    : widths.input + DIVIDER_WIDTH;
  const rightEdge = isNil(widths) ? 0 : centerStart + widths.center;

  return (
    <PaneWidthContext.Provider
      value={{
        input: widths?.input ?? null,
        output: widths?.output ?? null,
      }}
    >
      <div
        ref={containerRef}
        data-step-modal-columns
        data-layout-class={layoutClass}
        className={cn('relative flex min-h-0 flex-1', {
          'cursor-ew-resize select-none': !isNil(activeDrag),
        })}
      >
        {widths && (
          <>
            {!isInputless && (
              <>
                <div
                  data-step-modal-column="input"
                  className="h-full min-w-0 shrink-0 overflow-hidden"
                  style={{ width: widths.input }}
                >
                  {input}
                </div>
                <div aria-hidden className="w-px shrink-0 bg-gray-6" />
              </>
            )}
            <div
              data-step-modal-column="center"
              className="flex h-full min-w-0 shrink-0 flex-col overflow-hidden bg-canvas-step"
              style={{ width: widths.center }}
            >
              {center}
            </div>
            <div aria-hidden className="w-px shrink-0 bg-gray-6" />
            <div
              data-step-modal-column="output"
              className="h-full min-w-0 flex-1 overflow-hidden"
            >
              {output}
            </div>
            {!isInputless && (
              <ResizeEdge
                position={leftEdge}
                valueNow={widths.input}
                onPointerDown={startDrag('left')}
                onDoubleClick={reset}
                onKeyDown={handleEdgeKeyDown('left')}
              />
            )}
            <ResizeEdge
              position={rightEdge}
              valueNow={widths.center}
              onPointerDown={startDrag('right')}
              onDoubleClick={reset}
              onKeyDown={handleEdgeKeyDown('right')}
            />
            <ColumnGrip
              left={centerStart + widths.center / 2}
              isDragging={activeDrag === 'grip'}
              onPointerDown={startDrag('grip')}
              onDoubleClick={reset}
            />
          </>
        )}
      </div>
    </PaneWidthContext.Provider>
  );
};

const ResizeEdge = ({
  position,
  valueNow,
  onPointerDown,
  onDoubleClick,
  onKeyDown,
}: ResizeEdgeProps) => (
  <div
    role="separator"
    aria-orientation="vertical"
    aria-label={t('Resize columns')}
    aria-valuenow={Math.round(valueNow)}
    tabIndex={0}
    data-step-modal-resize-edge
    onPointerDown={onPointerDown}
    onDoubleClick={onDoubleClick}
    onKeyDown={onKeyDown}
    className="absolute inset-y-0 z-20 w-2 -translate-x-1/2 cursor-ew-resize touch-none outline-none focus-visible:bg-focus-halo"
    style={{ left: position + DIVIDER_WIDTH / 2 }}
  />
);

function useContainerWidth(
  ref: React.RefObject<HTMLDivElement | null>,
): number {
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

function resolveWidths({
  total,
  layoutClass,
  percentages,
}: {
  total: number;
  layoutClass: StepModalLayoutClass;
  percentages: ColumnPercentages | null;
}): ColumnWidths | null {
  if (total <= 0) {
    return null;
  }
  if (isNil(percentages)) {
    return stepModalLayoutUtils.getDefaultWidths({ total, layoutClass });
  }
  return stepModalLayoutUtils.fromPercentages({
    percentages,
    total,
    layoutClass,
  });
}

function computeDrag({
  kind,
  start,
  delta,
  layoutClass,
}: {
  kind: DragKind;
  start: ColumnWidths;
  delta: number;
  layoutClass: StepModalLayoutClass;
}): ColumnWidths {
  if (kind === 'grip') {
    return stepModalLayoutUtils.moveCenter({ start, delta, layoutClass });
  }
  return stepModalLayoutUtils.resizeEdge({
    start,
    edge: kind,
    delta,
    layoutClass,
  });
}

const DIVIDER_WIDTH = 1;

export { StepModalColumns };

type DragKind = 'left' | 'right' | 'grip';

type StepModalColumnsProps = {
  layoutClass: StepModalLayoutClass;
  storageKey: string;
  input: React.ReactNode;
  center: React.ReactNode;
  output: React.ReactNode;
};

type ResizeEdgeProps = {
  position: number;
  valueNow: number;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onDoubleClick: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
};
