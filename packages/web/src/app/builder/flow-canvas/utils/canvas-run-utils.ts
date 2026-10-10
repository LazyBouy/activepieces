import { isNil, tryParseFriendlyPieceError } from '@activepieces/core-utils';
import {
  FlowActionType,
  FlowRun,
  FlowTrigger,
  FlowTriggerType,
  RunEnvironment,
  StepOutput,
  StepOutputStatus,
  flowStructureUtil,
} from '@activepieces/shared';

import { flowRunUtils } from '@/features/flow-runs';
import { pieceSelectorUtils } from '@/features/pieces';

import { ApEdgeRunCheck } from './types';

function getStepOutput({
  stepName,
  run,
  loopsIndexes,
}: RunContext & { stepName: string }): StepOutput | undefined {
  if (isNil(run) || isNil(run.steps)) {
    return undefined;
  }
  return flowRunUtils.extractStepOutput(stepName, loopsIndexes, run.steps);
}

function hasSucceeded(output: StepOutput | undefined): boolean {
  return (
    output?.status === StepOutputStatus.SUCCEEDED ||
    output?.status === StepOutputStatus.STOPPED
  );
}

function getItemCount(value: unknown): number | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }
  return value.length;
}

function getLoopIterationCount(output: StepOutput | undefined): number | null {
  if (output?.type !== FlowActionType.LOOP_ON_ITEMS) {
    return null;
  }
  const count = output.output?.iterations.length ?? 0;
  return count > 0 ? count : null;
}

function getRunCount({
  stepName,
  trigger,
  run,
  loopsIndexes,
}: RunContext & { stepName: string; trigger: FlowTrigger }): number {
  const output = getStepOutput({ stepName, run, loopsIndexes });
  if (isNil(output)) {
    return 0;
  }
  const iterationCount = getLoopIterationCount(output);
  if (!isNil(iterationCount)) {
    return iterationCount;
  }
  const enclosingLoop = findEnclosingLoop({ stepName, trigger });
  if (isNil(enclosingLoop)) {
    return 1;
  }
  const loopOutput = getStepOutput({
    stepName: enclosingLoop,
    run,
    loopsIndexes,
  });
  if (loopOutput?.type !== FlowActionType.LOOP_ON_ITEMS) {
    return 1;
  }
  const iterations = loopOutput.output?.iterations ?? [];
  return iterations.filter((iteration) => !isNil(iteration[stepName])).length;
}

function findEnclosingLoop({
  stepName,
  trigger,
}: {
  stepName: string;
  trigger: FlowTrigger;
}): string | null {
  const enclosing = flowStructureUtil
    .getAllSteps(trigger)
    .filter(
      (step) =>
        step.type === FlowActionType.LOOP_ON_ITEMS &&
        !isNil(step.firstLoopAction) &&
        flowStructureUtil
          .getAllSteps(step.firstLoopAction)
          .some((child) => child.name === stepName),
    );
  return enclosing.at(-1)?.name ?? null;
}

function isTriggerShowingSampleData({
  trigger,
  run,
}: {
  trigger: FlowTrigger;
  run: FlowRun | null;
}): boolean {
  if (
    isNil(run) ||
    run.environment !== RunEnvironment.TESTING ||
    trigger.type !== FlowTriggerType.PIECE
  ) {
    return false;
  }
  const { pieceName, triggerName } = trigger.settings;
  const isManual = pieceSelectorUtils.isManualTrigger({
    pieceName,
    triggerName: triggerName ?? '',
  });
  const isChat = pieceSelectorUtils.isChatTrigger(pieceName, triggerName ?? '');
  return !isManual && !isChat && !isNil(run.steps?.[trigger.name]);
}

function isEdgeSuccessful({
  sourceStepName,
  targetRunCheck,
  run,
  loopsIndexes,
}: RunContext & {
  sourceStepName: string;
  targetRunCheck: ApEdgeRunCheck;
}): boolean {
  const source = getStepOutput({ stepName: sourceStepName, run, loopsIndexes });
  if (!hasSucceeded(source)) {
    return false;
  }
  switch (targetRunCheck.kind) {
    case 'step':
      return !isNil(
        getStepOutput({ stepName: targetRunCheck.stepName, run, loopsIndexes }),
      );
    case 'branch':
      return isBranchTaken({
        output: source,
        branchIndex: targetRunCheck.branchIndex,
      });
    case 'cof-branch':
      return !targetRunCheck.onFailure;
  }
}

function isBranchTaken({
  output,
  branchIndex,
}: {
  output: StepOutput | undefined;
  branchIndex: number;
}): boolean {
  if (
    output?.type !== FlowActionType.ROUTER &&
    output?.type !== FlowActionType.AI_ROUTER
  ) {
    return false;
  }
  const result = output.output;
  if (!isBranchResultList(result)) {
    return false;
  }
  return result.branches.some(
    (branch) =>
      branch.branchIndex === branchIndex + ENGINE_BRANCH_INDEX_BASE &&
      branch.evaluation,
  );
}

function isBranchResultList(value: unknown): value is {
  branches: { branchIndex: number; evaluation: boolean }[];
} {
  return (
    typeof value === 'object' &&
    value !== null &&
    'branches' in value &&
    Array.isArray(value.branches)
  );
}

function resolveRunVisual({
  output,
  isSkipped,
  showsSampleData,
  runCount,
}: {
  output: StepOutput | undefined;
  isSkipped: boolean;
  showsSampleData: boolean;
  runCount: number;
}): StepStatusVisual {
  if (isSkipped) {
    return SKIPPED_VISUAL;
  }
  switch (output?.status) {
    case undefined:
      return IDLE_VISUAL;
    case StepOutputStatus.RUNNING:
      return { border: 'none', corner: null, ring: 'running' };
    case StepOutputStatus.PAUSED:
      return { border: 'none', corner: { kind: 'paused' }, ring: 'paused' };
    case StepOutputStatus.FAILED:
      return {
        border: 'danger',
        corner: {
          kind: 'failed',
          tooltip: toReadableError(output.errorMessage),
        },
        ring: null,
      };
    case StepOutputStatus.SUCCEEDED:
    case StepOutputStatus.STOPPED:
      if (showsSampleData) {
        return { border: 'pinned', corner: { kind: 'pinned' }, ring: null };
      }
      return {
        border: 'success',
        corner: { kind: 'success', count: runCount > 1 ? runCount : null },
        ring: null,
      };
  }
}

function resolveDraftVisual({
  status,
  isSkipped,
  errorMessage,
}: {
  status: DraftStepStatus | null;
  isSkipped: boolean;
  errorMessage: string | null;
}): StepStatusVisual {
  if (isSkipped) {
    return SKIPPED_VISUAL;
  }
  switch (status) {
    case null:
    case 'untested':
      return IDLE_VISUAL;
    case 'invalid':
      return { border: 'idle', corner: { kind: 'incomplete' }, ring: null };
    case 'testing':
      return { border: 'none', corner: null, ring: 'running' };
    case 'needs-test':
      return { border: 'warning', corner: { kind: 'changed' }, ring: null };
    case 'failed':
      return {
        border: 'danger',
        corner: { kind: 'failed', tooltip: toReadableError(errorMessage) },
        ring: null,
      };
    case 'tested':
      return {
        border: 'idle',
        corner: { kind: 'success', count: null },
        ring: null,
      };
  }
}

function toReadableError(message: string | null | undefined): string | null {
  if (isNil(message) || message.length === 0) {
    return null;
  }
  return tryParseFriendlyPieceError(message)?.message ?? message;
}

function getDraftStatus({
  isValid,
  isBeingTested,
  hasError,
  lastTestDate,
  lastUpdatedDate,
}: {
  isValid: boolean;
  isBeingTested: boolean;
  hasError: boolean;
  lastTestDate: string | undefined;
  lastUpdatedDate: string;
}): DraftStepStatus {
  if (!isValid) {
    return 'invalid';
  }
  if (isBeingTested) {
    return 'testing';
  }
  if (isNil(lastTestDate)) {
    return 'untested';
  }
  if (lastUpdatedDate > lastTestDate) {
    return 'needs-test';
  }
  if (hasError) {
    return 'failed';
  }
  return 'tested';
}

const ENGINE_BRANCH_INDEX_BASE = 1;

const IDLE_VISUAL: StepStatusVisual = {
  border: 'idle',
  corner: null,
  ring: null,
};

const SKIPPED_VISUAL: StepStatusVisual = {
  border: 'skipped',
  corner: { kind: 'skipped' },
  ring: null,
};

export const canvasRunUtils = {
  getStepOutput,
  hasSucceeded,
  getItemCount,
  getLoopIterationCount,
  getRunCount,
  isTriggerShowingSampleData,
  isEdgeSuccessful,
  resolveRunVisual,
  resolveDraftVisual,
  getDraftStatus,
};

type RunContext = {
  run: FlowRun | null;
  loopsIndexes: Record<string, number>;
};

export type DraftStepStatus =
  | 'invalid'
  | 'testing'
  | 'failed'
  | 'needs-test'
  | 'tested'
  | 'untested';

export type StepCornerIcon =
  | { kind: 'success'; count: number | null }
  | { kind: 'failed'; tooltip: string | null }
  | { kind: 'paused' }
  | { kind: 'pinned' }
  | { kind: 'incomplete' }
  | { kind: 'changed' }
  | { kind: 'skipped' };

export type StepStatusVisual = {
  border:
    | 'idle'
    | 'success'
    | 'danger'
    | 'warning'
    | 'pinned'
    | 'skipped'
    | 'none';
  corner: StepCornerIcon | null;
  ring: 'running' | 'paused' | null;
};
