import { isNil } from '@activepieces/core-utils';
import {
  FlowActionType,
  FlowTriggerType,
  flowStructureUtil,
} from '@activepieces/shared';
import { t } from 'i18next';
import { ChevronDown, ChevronRight, Variable, Zap } from 'lucide-react';
import { RefObject, useEffect, useMemo, useRef, useState } from 'react';

import { LogoPlate } from '@/components/custom/logo-plate';
import { TextWithTooltip } from '@/components/custom/text-with-tooltip';
import { pieceSelectorUtils, stepsHooks } from '@/features/pieces';
import { cn } from '@/lib/utils';

import { useBuilderStateContext } from '../builder-hooks';
import {
  friendlyTreeUtils,
  StepWithIndex,
} from '../data-selector/friendly-tree';
import { pathHelpers } from '../data-selector/path-helpers';
import { VariablesTab } from '../data-selector/variables-tab';
import { textMentionUtils } from '../piece-properties/text-input-with-mentions/text-input-utils';
import { RunStepInputPane } from '../run-details/flow-step-input-output';

import { DataPane, useIsPaneCompact } from './data-pane';
import { DataView } from './data-view';
import { schemaViewUtils } from './schema-view-utils';
import { useViewMode, ViewModeControl } from './view-mode-control';
import { ViewMode, viewModeUtils } from './view-mode-utils';

const StepModalInputPane = () => {
  const hasRun = useBuilderStateContext((state) => !isNil(state.run));
  if (hasRun) {
    return <RunStepInputPane />;
  }
  return <EditInputPane />;
};

const EditInputPane = () => {
  const [steps, sampleData, zipArraysOfProperties, selectedStepName] =
    useBuilderStateContext((state) => [
      state.selectedStep
        ? flowStructureUtil.findPathToStep(
            state.flowVersion.trigger,
            state.selectedStep,
          )
        : EMPTY_STEPS,
      state.outputSampleData,
      state.isFocusInsideListMapperModeInput,
      state.selectedStep ?? '',
    ]);
  const orderedSteps = useMemo(() => [...steps].reverse(), [steps]);
  const schemas = friendlyTreeUtils.useStepOutputSchemas(steps);
  const [viewMode, setViewMode] = useViewMode('input');
  const compact = useIsPaneCompact('input');
  const paneRef = useRef<HTMLDivElement>(null);
  const canInsert = useMentionInsertTarget(paneRef);
  const insertMention = useBuilderStateContext((state) => state.insertMention);
  const [expandedSteps, setExpandedSteps] = useState<ReadonlySet<string>>(
    () => new Set(orderedSteps.slice(0, 1).map((step) => step.name)),
  );
  const toggleStep = (stepName: string) =>
    setExpandedSteps((current) => {
      const next = new Set(current);
      if (next.has(stepName)) {
        next.delete(stepName);
      } else {
        next.add(stepName);
      }
      return next;
    });
  const onInsert = (propertyPath: string) => {
    if (canInsert && insertMention) {
      insertMention(propertyPath);
    }
  };

  return (
    <div
      ref={paneRef}
      className={cn('size-full', textMentionUtils.dataSelectorCssClassSelector)}
    >
      <DataPane
        title={t('Input')}
        testId="step-modal-input"
        actions={
          <ViewModeControl
            value={viewMode}
            onChange={setViewMode}
            compact={compact}
          />
        }
      >
        <div className="flex flex-col px-2 py-1">
          {orderedSteps.map((step) => (
            <InputStepRow
              key={step.name}
              step={step}
              expanded={expandedSteps.has(step.name)}
              onToggle={() => toggleStep(step.name)}
              viewMode={viewMode}
              sampleData={sampleData}
              schema={schemas[step.name] ?? null}
              zipArraysOfProperties={zipArraysOfProperties}
              targetStepName={selectedStepName}
              onInsert={onInsert}
            />
          ))}
          <VariablesRow
            expanded={expandedSteps.has(VARIABLES_ROW)}
            onToggle={() => toggleStep(VARIABLES_ROW)}
          />
        </div>
      </DataPane>
    </div>
  );
};

const InputStepRow = ({
  step,
  expanded,
  onToggle,
  viewMode,
  sampleData,
  schema,
  zipArraysOfProperties,
  targetStepName,
  onInsert,
}: InputStepRowProps) => {
  const { stepMetadata } = stepsHooks.useStepMetadata({ step });
  const isTrigger = flowStructureUtil.isTrigger(step.type);
  const stepData = getStepData({ step, sampleData });
  const needsTesting = stepNeedsTesting(step);
  const itemCount = needsTesting ? null : viewModeUtils.getItemCount(stepData);
  const schemaNodes = useMemo(
    () =>
      expanded && !needsTesting
        ? schemaViewUtils.fromDataSelectorNodes({
            nodes: schemaViewUtils.rootChildren(
              friendlyTreeUtils.buildStepNode({
                step,
                sampleData,
                schema,
                zipArraysOfProperties,
                targetStepName,
              }),
            ),
          })
        : [],
    [
      expanded,
      needsTesting,
      step,
      sampleData,
      schema,
      zipArraysOfProperties,
      targetStepName,
    ],
  );
  const label = `${step.dfsIndex + 1}. ${step.displayName}`;

  return (
    <div data-input-step={step.name} className="flex flex-col">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className="flex h-8 min-w-0 items-center gap-2 rounded-sm px-1 text-left hover:bg-gray-4"
      >
        {expanded ? (
          <ChevronDown className="size-3.5 shrink-0 text-gray-11" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0 text-gray-11" />
        )}
        <LogoPlate
          size="row"
          border
          className="border-gray-6"
          src={stepMetadata?.logoUrl}
          alt={stepMetadata?.displayName ?? step.displayName}
        />
        <TextWithTooltip tooltipMessage={label}>
          <span className="min-w-0 truncate text-xsm font-medium text-gray-12">
            {label}
          </span>
        </TextWithTooltip>
        {isTrigger && <Zap className="size-3 shrink-0 text-accent-9" />}
        {!isNil(itemCount) && (
          <span className="ml-auto shrink-0 pl-2 text-xs text-gray-11">
            {t('{count, plural, =1 {1 item} other {# items}}', {
              count: itemCount,
            })}
          </span>
        )}
      </button>
      {expanded && (
        <div className="pb-2 pl-6">
          {needsTesting ? (
            <p className="py-1 text-xs text-gray-11">
              {isTrigger
                ? t('No sample data yet — load it from the trigger.')
                : t('No sample data yet — test this step first.')}
            </p>
          ) : (
            <DataView
              mode={viewMode}
              data={stepData}
              schemaNodes={schemaNodes}
              basePath={pathHelpers.propertyPathStarter(step.name)}
              onInsert={onInsert}
            />
          )}
        </div>
      )}
    </div>
  );
};

const VariablesRow = ({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) => (
  <div className="flex flex-col">
    <button
      type="button"
      aria-expanded={expanded}
      onClick={onToggle}
      className="flex h-8 min-w-0 items-center gap-2 rounded-sm px-1 text-left hover:bg-gray-4"
    >
      {expanded ? (
        <ChevronDown className="size-3.5 shrink-0 text-gray-11" />
      ) : (
        <ChevronRight className="size-3.5 shrink-0 text-gray-11" />
      )}
      <span className="flex size-5 shrink-0 items-center justify-center rounded-sm border border-gray-6 bg-panel">
        <Variable className="size-3 text-gray-11" />
      </span>
      <span className="truncate text-xsm font-medium text-gray-12">
        {t('Variables')}
      </span>
    </button>
    {expanded && (
      <div className="pb-2 pl-4">
        <VariablesTab />
      </div>
    )}
  </div>
);

function useMentionInsertTarget(
  paneRef: RefObject<HTMLDivElement | null>,
): boolean {
  const [canInsert, setCanInsert] = useState(() =>
    isMentionInput(document.activeElement),
  );
  useEffect(() => {
    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (isMentionInput(target)) {
        setCanInsert(true);
        return;
      }
      if (target instanceof Node && paneRef.current?.contains(target)) {
        return;
      }
      setCanInsert(false);
    };
    document.addEventListener('focusin', handleFocusIn);
    return () => document.removeEventListener('focusin', handleFocusIn);
  }, [paneRef]);
  return canInsert;
}

function isMentionInput(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(`.${textMentionUtils.inputWithMentionsCssClass}`) !== null
  );
}

function getStepData({
  step,
  sampleData,
}: {
  step: StepWithIndex;
  sampleData: Record<string, unknown>;
}): unknown {
  const data = sampleData[step.name];
  if (
    step.type === FlowActionType.LOOP_ON_ITEMS &&
    typeof data === 'object' &&
    data !== null &&
    !Array.isArray(data)
  ) {
    return Object.fromEntries(
      Object.entries(data).filter(([key]) => key !== 'iterations'),
    );
  }
  return data;
}

function stepNeedsTesting(step: StepWithIndex): boolean {
  if (!isNil(step.settings.sampleData?.lastTestDate)) {
    return false;
  }
  if (step.type !== FlowTriggerType.PIECE) {
    return true;
  }
  return !pieceSelectorUtils.isManualTrigger({
    pieceName: step.settings.pieceName,
    triggerName: step.settings.triggerName ?? '',
  });
}

const EMPTY_STEPS: StepWithIndex[] = [];
const VARIABLES_ROW = '__variables__';

export { StepModalInputPane };

type InputStepRowProps = {
  step: StepWithIndex;
  expanded: boolean;
  onToggle: () => void;
  viewMode: ViewMode;
  sampleData: Record<string, unknown>;
  schema: ReturnType<typeof friendlyTreeUtils.useStepOutputSchemas>[string];
  zipArraysOfProperties: boolean;
  targetStepName: string;
  onInsert: (propertyPath: string) => void;
};
