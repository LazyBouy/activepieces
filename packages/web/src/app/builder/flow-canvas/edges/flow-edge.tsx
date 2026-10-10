import { isNil } from '@activepieces/core-utils';
import { FlowRun } from '@activepieces/shared';
import { EdgeLabelRenderer, EdgeProps } from '@xyflow/react';
import { t } from 'i18next';
import { Plus } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

import { PieceSelector } from '@/app/builder/pieces-selector';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import { useBuilderStateContext } from '../../builder-hooks';
import { canvasRunUtils } from '../utils/canvas-run-utils';
import { flowCanvasConsts } from '../utils/consts';
import { edgePathUtils } from '../utils/edge-path-utils';
import { flowCanvasUtils } from '../utils/flow-canvas-utils';
import {
  DropTargetState,
  stepPositionUtils,
} from '../utils/step-position-utils';
import { ApFlowEdge } from '../utils/types';

const ApFlowCanvasEdge = React.memo(
  ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    data,
  }: EdgeProps & Omit<ApFlowEdge, 'position'>) => {
    const geometry = edgePathUtils.buildEdgeGeometry({
      sourceX,
      sourceY,
      targetX,
      targetY,
    });
    const [
      readonly,
      isPieceSelectorOpen,
      isSuccessful,
      showsSampleData,
      count,
      dropTargetState,
      isStepDragging,
    ] = useBuilderStateContext((state) => {
      const runContext = { run: state.run, loopsIndexes: state.loopsIndexes };
      return [
        state.readonly,
        state.openedPieceSelectorStepNameOrAddButtonId === id,
        canvasRunUtils.isEdgeSuccessful({
          sourceStepName: data.sourceStepName,
          targetRunCheck: data.targetRunCheck,
          ...runContext,
        }),
        data.sourceStepName === state.flowVersion.trigger.name &&
          canvasRunUtils.isTriggerShowingSampleData({
            trigger: state.flowVersion.trigger,
            run: state.run,
          }),
        getItemCount({ data, ...runContext }),
        stepPositionUtils.getDropTargetState({
          stepDrag: state.stepDrag,
          dropTargetId: state.dropTargetId,
          id,
        }),
        state.stepDrag?.active === true,
      ];
    });
    const hover = useDelayedHover(flowCanvasConsts.EDGE_TOOLBAR_HIDE_DELAY);
    const isToolbarVisible =
      !readonly && !isStepDragging && (hover.isHovered || isPieceSelectorOpen);
    const tone: EdgeTone = showsSampleData
      ? 'pinned'
      : isSuccessful
      ? 'success'
      : isToolbarVisible
      ? 'hover'
      : 'idle';
    const markerId = `${id}-arrow`;
    const lastSegment = geometry.segments.length - 1;
    return (
      <>
        <defs>
          <marker
            id={markerId}
            viewBox="0 0 7 10"
            markerWidth={7}
            markerHeight={10}
            refX={7}
            refY={5}
            orient="auto"
            markerUnits="userSpaceOnUse"
            overflow="visible"
          >
            <path
              d="M 0.5 0.5 L 6.5 5 L 0.5 9.5 Z"
              strokeWidth={1}
              strokeLinejoin="round"
              className={cn(
                'transition-[fill,stroke] duration-300 ease-standard',
                MARKER_TONE_CLASS_NAMES[tone],
              )}
            />
          </marker>
        </defs>
        {geometry.segments.map((segment, index) => (
          <path
            key={segment}
            d={segment}
            fill="none"
            strokeWidth={2}
            strokeLinecap="square"
            className={cn(
              'transition-[stroke] duration-300 ease-standard',
              PATH_TONE_CLASS_NAMES[tone],
            )}
            markerEnd={
              index === lastSegment && data.targetIsJoin
                ? undefined
                : `url(#${markerId})`
            }
          />
        ))}
        <path
          data-edge-hover-area={id}
          d={geometry.path}
          fill="none"
          stroke="transparent"
          strokeWidth={EDGE_HOVER_WIDTH}
          style={{ pointerEvents: readonly ? 'none' : 'stroke' }}
          onPointerEnter={hover.enter}
          onPointerLeave={hover.leave}
        />
        <EdgeLabelRenderer>
          {dropTargetState !== 'none' && (
            <EdgeDropIndicator
              id={id}
              x={geometry.labelX}
              y={geometry.labelY}
              state={dropTargetState}
            />
          )}
          {isToolbarVisible && (
            <EdgeToolbar
              id={id}
              data={data}
              x={geometry.labelX}
              y={geometry.labelY}
              onPointerEnter={hover.enter}
              onPointerLeave={hover.leave}
            />
          )}
          {!isToolbarVisible && dropTargetState === 'none' && !isNil(count) && (
            <ItemCountLabel
              count={count}
              x={geometry.labelX}
              y={geometry.labelY}
              sitsAboveLine={geometry.isStraight || geometry.isBackEdge}
            />
          )}
        </EdgeLabelRenderer>
      </>
    );
  },
);

const EdgeToolbar = ({
  id,
  data,
  x,
  y,
  onPointerEnter,
  onPointerLeave,
}: {
  id: string;
  data: ApFlowEdge['data'];
  x: number;
  y: number;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}) => {
  return (
    <div
      data-edge-toolbar={id}
      style={{
        transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
        zIndex: LABEL_Z_INDEX,
      }}
      className="nodrag nopan pointer-events-auto absolute top-0 left-0 p-2"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <Tooltip delayDuration={flowCanvasConsts.CHROME_TOOLTIP_DELAY}>
        <PieceSelector
          id={id}
          operation={flowCanvasUtils.createAddOperationFromAddButtonData(
            data.insertLocation,
          )}
        >
          <TooltipTrigger asChild>
            <button
              type="button"
              data-testid="add-action-button"
              aria-label={t('Add step')}
              className="flex size-7 cursor-pointer items-center justify-center rounded-sm bg-canvas-plus text-canvas-plus-glyph outline-hidden transition-colors hover:bg-canvas-plus-hover hover:text-canvas-plus-glyph-hover focus-visible:outline-2 focus-visible:outline-focus-halo"
              onClick={(e) => e.stopPropagation()}
            >
              <Plus className="size-3.5" />
            </button>
          </TooltipTrigger>
        </PieceSelector>
        <TooltipContent side="top">{t('Add step')}</TooltipContent>
      </Tooltip>
    </div>
  );
};

const EdgeDropIndicator = ({
  id,
  x,
  y,
  state,
}: {
  id: string;
  x: number;
  y: number;
  state: DropTargetState;
}) => {
  const isArmed = state === 'armed';
  return (
    <div
      data-edge-drop-indicator={id}
      style={{
        transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
        zIndex: LABEL_Z_INDEX,
      }}
      className={cn(
        'pointer-events-none absolute top-0 left-0 transition-opacity duration-100 ease-standard motion-safe:animate-swap-in',
        { 'opacity-60': state === 'idle', 'opacity-0': state === 'fading' },
      )}
    >
      <span
        data-drop-target={id}
        data-drop-target-armed={isArmed || undefined}
        className={cn(
          'flex size-7 items-center justify-center rounded-sm bg-canvas-plus text-canvas-plus-glyph transition-colors',
          { 'bg-accent-3 text-accent-9 ring-2 ring-accent-9': isArmed },
        )}
      >
        <Plus className="size-3.5" />
      </span>
    </div>
  );
};

const ItemCountLabel = ({
  count,
  x,
  y,
  sitsAboveLine,
}: {
  count: number;
  x: number;
  y: number;
  sitsAboveLine: boolean;
}) => {
  const transform = sitsAboveLine
    ? `translate(-50%, -100%) translate(${x}px, ${y - ITEM_LABEL_LINE_GAP}px)`
    : `translate(-50%, -50%) translate(${x}px, ${
        y - ITEM_LABEL_CURVE_OFFSET
      }px)`;
  return (
    <div
      data-edge-item-count
      style={{ transform, zIndex: LABEL_Z_INDEX }}
      className="pointer-events-none absolute top-0 left-0 rounded-sm bg-canvas-label-backdrop px-0.5 text-xsm leading-tight whitespace-nowrap text-canvas-label"
    >
      {t('{count, plural, =1 {1 item} other {# items}}', { count })}
    </div>
  );
};

function getItemCount({
  data,
  run,
  loopsIndexes,
}: {
  data: ApFlowEdge['data'];
  run: FlowRun | null;
  loopsIndexes: Record<string, number>;
}): number | null {
  if (isNil(run) || isNil(data.sourceOutput)) {
    return null;
  }
  const output = canvasRunUtils.getStepOutput({
    stepName: data.sourceOutput.stepName,
    run,
    loopsIndexes,
  });
  if (data.sourceOutput.isLoopOutput) {
    return canvasRunUtils.getLoopIterationCount(output);
  }
  return canvasRunUtils.getItemCount(output?.output);
}

function useDelayedHover(delay: number) {
  const [isHovered, setIsHovered] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearPendingLeave = () => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };
  useEffect(() => clearPendingLeave, []);
  return {
    isHovered,
    enter: () => {
      clearPendingLeave();
      setIsHovered(true);
    },
    leave: () => {
      clearPendingLeave();
      timeoutRef.current = setTimeout(() => setIsHovered(false), delay);
    },
  };
}

const EDGE_HOVER_WIDTH = 40;
const LABEL_Z_INDEX = 1001;
const ITEM_LABEL_LINE_GAP = 7;
const ITEM_LABEL_CURVE_OFFSET = 12;

const PATH_TONE_CLASS_NAMES: Record<EdgeTone, string> = {
  idle: 'stroke-canvas-edge',
  hover: 'stroke-canvas-edge-hover',
  success: 'stroke-canvas-success',
  pinned: 'stroke-canvas-pinned',
};

const MARKER_TONE_CLASS_NAMES: Record<EdgeTone, string> = {
  idle: 'fill-canvas-edge stroke-canvas-edge',
  hover: 'fill-canvas-edge-hover stroke-canvas-edge-hover',
  success: 'fill-canvas-success stroke-canvas-success',
  pinned: 'fill-canvas-pinned stroke-canvas-pinned',
};

ApFlowCanvasEdge.displayName = 'ApFlowCanvasEdge';
export { ApFlowCanvasEdge };

type EdgeTone = 'idle' | 'hover' | 'success' | 'pinned';
