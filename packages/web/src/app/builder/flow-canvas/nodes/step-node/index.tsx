import { isNil } from '@activepieces/core-utils';
import {
  FlowActionType,
  FlowOperationType,
  FlowTriggerType,
  Step,
  flowStructureUtil,
} from '@activepieces/shared';
import {
  Handle,
  NodeProps,
  Position,
  useUpdateNodeInternals,
} from '@xyflow/react';
import { t } from 'i18next';
import { Plus } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

import { useBuilderStateContext } from '@/app/builder/builder-hooks';
import { PieceSelector } from '@/app/builder/pieces-selector';
import { stepsHooks } from '@/features/pieces';
import { cn } from '@/lib/utils';

import { useIsCanvasContextMenuOpen } from '../../context-menu/canvas-context-menu';
import { canvasRunUtils } from '../../utils/canvas-run-utils';
import { flowCanvasConsts } from '../../utils/consts';
import { flowCanvasUtils } from '../../utils/flow-canvas-utils';
import { ApStepNode, ApStepOutput } from '../../utils/types';

import { OutputLabel } from './output-label';
import { OutputStub } from './output-stub';
import { StepNodeCornerIcon } from './step-node-corner-icon';
import { StepNodeDisplayName } from './step-node-display-name';
import { StepNodeLogo } from './step-node-logo';
import { StepNodeSettingsBadges } from './step-node-settings-badges';
import { StepNodeSkippedLine } from './step-node-skipped-status';
import { useStepDraftVisual } from './step-node-status-in-draft';
import { useStepRunVisual } from './step-node-status-in-run';
import { StepNodeToolbar } from './step-node-toolbar';
import { TriggerWidget } from './trigger-widget';

const ApStepCanvasNode = React.memo(
  ({ data, dragging }: NodeProps & Omit<ApStepNode, 'position'>) => {
    if (data.step.type === FlowTriggerType.EMPTY) {
      return <EmptyTriggerNode data={data} />;
    }
    return <StepBoxNode data={data} isDragging={dragging} />;
  },
);

const StepBoxNode = ({
  data,
  isDragging,
}: {
  data: ApStepNode['data'];
  isDragging: boolean;
}) => {
  const stepName = data.step.name;
  const boxRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [hasVisibleFocus, setHasVisibleFocus] = useState(false);
  const isContextMenuOpen = useIsCanvasContextMenuOpen();
  useRefreshHandlesWhenTheyChange({
    stepName,
    signature: getHandleSignature(data),
  });
  const {
    step,
    trigger,
    isSelected,
    readonly,
    run,
    loopsIndexes,
    handleStepClick,
    handleStepDoubleClick,
    handleContextMenu,
  } = useStepInteractions({ stepName, fallbackStep: data.step });
  const { stepMetadata, isLoading } = stepsHooks.useStepMetadata({ step });
  const isTrigger = flowStructureUtil.isTrigger(step.type);
  const isSkipped = flowStructureUtil.isSkipped({ stepName, trigger });
  const runVisual = useStepRunVisual({ stepName, isSkipped });
  const draftVisual = useStepDraftVisual({ stepName, isSkipped });
  const visual = runVisual ?? draftVisual;
  const stepOutput = canvasRunUtils.getStepOutput({
    stepName,
    run,
    loopsIndexes,
  });
  const iterationCount = canvasRunUtils.getLoopIterationCount(stepOutput);
  const labelTexts =
    data.outputs.length > 1 ? data.outputs.map(getOutputLabelText) : [];
  const stubLength = getStubLength(labelTexts);
  const isPlainStep =
    !isTrigger &&
    data.outputs.length === 1 &&
    step.type !== FlowActionType.LOOP_ON_ITEMS &&
    !flowStructureUtil.isBranchedAction(step);
  const showStrikeLine =
    isSkipped &&
    isPlainStep &&
    data.hasIncomingEdge &&
    !data.outputs[0].hasStub;
  const showToolbar =
    !readonly &&
    !isDragging &&
    (isHovered || hasVisibleFocus || (isContextMenuOpen && isSelected));

  return (
    <div
      {...{
        [`data-${flowCanvasConsts.STEP_CONTEXT_MENU_ATTRIBUTE}`]: stepName,
      }}
      ref={boxRef}
      style={{ width: flowCanvasConsts.NODE_SIZE, height: data.height }}
      className="relative"
      onClick={(e) => handleStepClick(e)}
      onDoubleClick={(e) => handleStepDoubleClick(e)}
      onContextMenu={handleContextMenu}
      onPointerMove={(e) => setIsHovered(isOverBoxOrToolbar(e.target))}
      onPointerLeave={() => setIsHovered(false)}
      onFocus={(e) =>
        setHasVisibleFocus(
          e.currentTarget.contains(e.target) &&
            e.target.matches(':focus-visible'),
        )
      }
      onBlur={() => setHasVisibleFocus(false)}
    >
      {visual.ring && (
        <div
          data-step-running-ring={visual.ring}
          className={cn(
            'canvas-running-ring pointer-events-none absolute -inset-[3px] rounded-[10px]',
            {
              'rounded-l-[38px]': isTrigger,
              'canvas-running-ring-slow': visual.ring === 'paused',
            },
          )}
        />
      )}
      <div
        data-step-box
        className={cn(
          'absolute inset-0 cursor-pointer rounded-lg border-[1.5px] bg-canvas-step bg-clip-padding',
          BORDER_CLASS_NAMES[visual.border],
          {
            'rounded-l-[36px]': isTrigger,
            'ring-6 ring-canvas-selection-halo': isSelected,
            'cursor-grabbing': isDragging,
          },
        )}
      >
        <PieceSelector
          operation={{
            type: getPieceSelectorOperationType(step),
            stepName,
          }}
          id={stepName}
          openSelectorOnClick={false}
          stepToReplacePieceDisplayName={stepMetadata?.displayName}
        >
          <div
            className="flex size-full items-center justify-center"
            onClick={(e) => handleStepClick(e)}
          >
            <StepNodeLogo
              isSkipped={isSkipped}
              isLoading={isLoading}
              logoUrl={stepMetadata?.logoUrl}
              displayName={stepMetadata?.displayName ?? step.displayName}
            />
          </div>
        </PieceSelector>
      </div>
      {showStrikeLine && <StepNodeSkippedLine />}
      {visual.corner && <StepNodeCornerIcon corner={visual.corner} />}
      {!isSkipped && <StepNodeSettingsBadges step={step} />}
      {isTrigger && <TriggerWidget boxRef={boxRef} />}
      {data.hasInput && (
        <Handle
          type="target"
          id={flowCanvasUtils.INPUT_HANDLE_ID}
          position={Position.Left}
          isConnectable={false}
          isConnectableStart={false}
          isConnectableEnd={false}
          className={HANDLE_CLASS_NAME}
        >
          <span className={HANDLE_DOT_CLASS_NAME} />
        </Handle>
      )}
      {data.outputs.map((output) => (
        <Handle
          key={output.id}
          type="source"
          id={output.id}
          position={Position.Right}
          isConnectable={false}
          isConnectableStart={!readonly}
          isConnectableEnd={false}
          style={{ top: output.offset }}
          className={cn(HANDLE_CLASS_NAME, {
            'pointer-events-auto! cursor-crosshair!': !readonly,
          })}
          onClick={(e) => e.stopPropagation()}
        >
          <span
            className={cn(HANDLE_DOT_CLASS_NAME, {
              'group-hover/handle:scale-150 group-hover/handle:border-[1.5px] group-hover/handle:border-canvas-handle-border-hover group-hover/handle:bg-canvas-handle-hover':
                !readonly,
            })}
          />
        </Handle>
      ))}
      {labelTexts.map((text, index) => (
        <OutputLabel
          key={data.outputs[index].id}
          stepName={stepName}
          output={data.outputs[index]}
          text={text}
          maxWidth={getOutputLabelMaxWidth({
            output: data.outputs[index],
            stubLength,
          })}
        />
      ))}
      {data.outputs
        .filter((output) => output.hasStub)
        .map((output) => {
          const isLoopOutput = output.labelKind === 'loop';
          return (
            <OutputStub
              key={output.id}
              id={flowCanvasUtils.getOutputStubId({
                stepName,
                outputId: output.id,
              })}
              source={{ nodeId: stepName, handleId: output.id }}
              insertLocation={output.insertLocation}
              top={output.offset}
              left={
                flowCanvasConsts.NODE_SIZE + flowCanvasConsts.HANDLE_SIZE / 2
              }
              length={stubLength}
              hasRunData={
                isLoopOutput
                  ? iterationCount !== null
                  : canvasRunUtils.hasSucceeded(stepOutput)
              }
              itemCount={
                isLoopOutput
                  ? iterationCount
                  : output.labelKind === null
                  ? canvasRunUtils.getItemCount(stepOutput?.output)
                  : null
              }
            />
          );
        })}
      <StepNodeDisplayName
        stepDisplayName={step.displayName}
        pieceDisplayName={stepMetadata?.displayName ?? ''}
        isSkipped={isSkipped}
      />
      {showToolbar && <StepNodeToolbar step={step} />}
    </div>
  );
};

const EmptyTriggerNode = ({ data }: { data: ApStepNode['data'] }) => {
  const stepName = data.step.name;
  const { step, readonly, handleStepClick, handleContextMenu } =
    useStepInteractions({ stepName, fallbackStep: data.step });
  const isPieceSelectorOpen = useBuilderStateContext(
    (state) => state.openedPieceSelectorStepNameOrAddButtonId === stepName,
  );
  const output = data.outputs[0];
  const hasNextStep = !isNil(data.step.nextAction);
  useRefreshHandlesWhenTheyChange({
    stepName,
    signature: `${hasNextStep}`,
  });
  return (
    <div
      {...{
        [`data-${flowCanvasConsts.STEP_CONTEXT_MENU_ATTRIBUTE}`]: stepName,
      }}
      style={{
        width: flowCanvasConsts.NODE_SIZE,
        height: flowCanvasConsts.NODE_SIZE,
      }}
      className="relative"
      onContextMenu={handleContextMenu}
    >
      <PieceSelector
        operation={{ type: FlowOperationType.UPDATE_TRIGGER }}
        id={stepName}
        openSelectorOnClick={false}
      >
        <div
          data-empty-trigger
          className={cn(
            'group/placeholder absolute -inset-0.5 flex items-center justify-center rounded-lg border-2 border-dashed border-canvas-placeholder-ink bg-canvas-placeholder',
            { 'cursor-pointer': !readonly },
          )}
          onClick={(e) => handleStepClick(e)}
        >
          <Plus
            className={cn(
              'size-10 text-canvas-placeholder-ink transition-colors duration-200',
              {
                'group-hover/placeholder:text-accent-9': !readonly,
                'text-accent-9': isPieceSelectorOpen,
              },
            )}
          />
        </div>
      </PieceSelector>
      <div
        data-step-label
        className="pointer-events-none absolute top-full left-1/2 mt-2.5 -translate-x-1/2 text-base leading-6 font-medium whitespace-nowrap text-gray-12"
      >
        {step.displayName}
      </div>
      {hasNextStep && output && (
        <Handle
          type="source"
          id={output.id}
          position={Position.Right}
          isConnectable={false}
          isConnectableStart={false}
          isConnectableEnd={false}
          className={HANDLE_CLASS_NAME}
        >
          <span className={HANDLE_DOT_CLASS_NAME} />
        </Handle>
      )}
    </div>
  );
};

function useStepInteractions({
  stepName,
  fallbackStep,
}: {
  stepName: string;
  fallbackStep: Step;
}) {
  const [
    step,
    trigger,
    isSelected,
    readonly,
    run,
    loopsIndexes,
    selectStepByName,
    setSelectedBranchIndex,
    setOpenedPieceSelectorStepNameOrAddButtonId,
    openStepModal,
  ] = useBuilderStateContext((state) => [
    flowStructureUtil.getStep(stepName, state.flowVersion.trigger) ??
      fallbackStep,
    state.flowVersion.trigger,
    state.selectedStep === stepName || state.selectedNodes.includes(stepName),
    state.readonly,
    state.run,
    state.loopsIndexes,
    state.selectStepByName,
    state.setSelectedBranchIndex,
    state.setOpenedPieceSelectorStepNameOrAddButtonId,
    state.openStepModal,
  ]);
  const handleStepClick = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    stopPropagation = true,
  ) => {
    selectStepByName(stepName);
    setSelectedBranchIndex(null);
    if (stopPropagation) {
      e.stopPropagation();
    }
  };
  const handleStepDoubleClick = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
  ) => {
    e.stopPropagation();
    openStepModal({ stepName });
  };
  const handleContextMenu = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
  ) => {
    handleStepClick(e, false);
    setOpenedPieceSelectorStepNameOrAddButtonId(null);
  };
  return {
    step,
    trigger,
    isSelected,
    readonly,
    run,
    loopsIndexes,
    handleStepClick,
    handleStepDoubleClick,
    handleContextMenu,
  };
}

function useRefreshHandlesWhenTheyChange({
  stepName,
  signature,
}: {
  stepName: string;
  signature: string;
}) {
  const updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => {
    updateNodeInternals(stepName);
  }, [stepName, signature, updateNodeInternals]);
}

function getHandleSignature(data: ApStepNode['data']): string {
  const outputs = data.outputs
    .map((output) => `${output.id}:${output.offset}`)
    .join('|');
  return `${data.hasInput}-${outputs}`;
}

function getOutputLabelText(output: ApStepOutput): string {
  switch (output.labelKind) {
    case 'fallback':
      return t('Otherwise');
    case 'done':
      return t('Done');
    case 'loop':
      return t('Loop');
    case 'success':
      return t('Success');
    case 'failure':
      return t('Failure');
    case 'branch':
      return output.branchName ?? '';
    case null:
      return '';
  }
}

function getStubLength(labelTexts: string[]): number {
  const longest = Math.max(0, ...labelTexts.map((text) => text.length));
  if (longest <= 2) {
    return flowCanvasConsts.STUB_LENGTHS.short;
  }
  if (longest <= 6) {
    return flowCanvasConsts.STUB_LENGTHS.medium;
  }
  return flowCanvasConsts.STUB_LENGTHS.long;
}

function getOutputLabelMaxWidth({
  output,
  stubLength,
}: {
  output: ApStepOutput;
  stubLength: number;
}): number {
  if (!output.hasStub) {
    return flowCanvasConsts.OUTPUT_LABEL_MAX_WIDTH;
  }
  return (
    stubLength +
    flowCanvasConsts.HANDLE_SIZE / 2 -
    flowCanvasConsts.OUTPUT_LABEL_OFFSET -
    LABEL_TO_PLUS_GAP
  );
}

function isOverBoxOrToolbar(target: EventTarget): boolean {
  return (
    target instanceof Element &&
    target.closest(
      '[data-step-box], [data-step-toolbar], [data-step-corner], [data-step-badge]',
    ) !== null
  );
}

function getPieceSelectorOperationType(step: Step) {
  if (flowStructureUtil.isTrigger(step.type)) {
    return FlowOperationType.UPDATE_TRIGGER;
  }
  return FlowOperationType.UPDATE_ACTION;
}

const LABEL_TO_PLUS_GAP = 4;

const HANDLE_CLASS_NAME =
  "group/handle size-4! min-h-0! min-w-0! rounded-full! border-0! bg-transparent! before:absolute before:-inset-1 before:rounded-full before:content-['']";

const HANDLE_DOT_CLASS_NAME =
  'pointer-events-none absolute inset-0 rounded-full border border-canvas-handle-border bg-canvas-handle [transition:scale_200ms_ease,background-color_200ms_ease,border-width_100ms_ease]';

const BORDER_CLASS_NAMES: Record<
  ReturnType<typeof canvasRunUtils.resolveRunVisual>['border'],
  string
> = {
  idle: 'border-canvas-step-border',
  success: 'border-2 border-canvas-success',
  danger: 'border-2 border-canvas-danger',
  warning: 'border-2 border-canvas-warning',
  pinned: 'border-2 border-canvas-pinned',
  skipped: 'border-canvas-divider',
  none: 'border-transparent',
};

ApStepCanvasNode.displayName = 'ApStepCanvasNode';
export { ApStepCanvasNode };
