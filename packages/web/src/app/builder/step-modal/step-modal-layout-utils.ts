import {
  FlowAction,
  FlowActionType,
  FlowTrigger,
  FlowTriggerType,
  flowStructureUtil,
} from '@activepieces/shared';
import { z } from 'zod';

function getLayoutClass(step: FlowAction | FlowTrigger): StepModalLayoutClass {
  if (flowStructureUtil.isTrigger(step.type)) {
    return 'inputless';
  }
  if (
    step.type === FlowActionType.CODE ||
    step.type === FlowActionType.ROUTER ||
    step.type === FlowActionType.AI_ROUTER
  ) {
    return 'wide';
  }
  if (
    step.type === FlowActionType.PIECE &&
    step.settings.pieceName === AGENT_PIECE_NAME &&
    step.settings.actionName === AGENT_ACTION_NAME
  ) {
    return 'wide';
  }
  return 'regular';
}

function getStorageKey(step: FlowAction | FlowTrigger): string {
  if (step.type === FlowActionType.PIECE) {
    return `${LAYOUT_STORAGE_PREFIX}${step.settings.pieceName}`;
  }
  if (step.type === FlowTriggerType.PIECE) {
    return `${LAYOUT_STORAGE_PREFIX}${step.settings.pieceName}.trigger`;
  }
  return `${LAYOUT_STORAGE_PREFIX}${step.type}`;
}

function getDefaultWidths({
  total,
  layoutClass,
}: {
  total: number;
  layoutClass: StepModalLayoutClass;
}): ColumnWidths {
  const center = clampCenter({
    value: STEP_MODAL_LAYOUT.centerDefault[layoutClass],
    total,
    layoutClass,
  });
  if (layoutClass === 'inputless') {
    return { input: 0, center, output: total - center };
  }
  const input = Math.floor((total - center) / 2);
  return { input, center, output: total - center - input };
}

function fromPercentages({
  percentages,
  total,
  layoutClass,
}: {
  percentages: ColumnPercentages;
  total: number;
  layoutClass: StepModalLayoutClass;
}): ColumnWidths {
  const center = clampCenter({
    value: Math.round((total * percentages.center) / 100),
    total,
    layoutClass,
  });
  const remaining = total - center;
  if (layoutClass === 'inputless') {
    return { input: 0, center, output: remaining };
  }
  const wantedInput = Math.round((total * percentages.input) / 100);
  const input =
    remaining < STEP_MODAL_LAYOUT.sideMin * 2
      ? Math.floor(remaining / 2)
      : Math.min(
          Math.max(wantedInput, STEP_MODAL_LAYOUT.sideMin),
          remaining - STEP_MODAL_LAYOUT.sideMin,
        );
  return { input, center, output: remaining - input };
}

function toPercentages(widths: ColumnWidths): ColumnPercentages {
  const total = widths.input + widths.center + widths.output;
  if (total <= 0) {
    return { input: 0, center: 0, output: 0 };
  }
  return {
    input: (widths.input / total) * 100,
    center: (widths.center / total) * 100,
    output: (widths.output / total) * 100,
  };
}

function resizeEdge({
  start,
  edge,
  delta,
  layoutClass,
}: {
  start: ColumnWidths;
  edge: 'left' | 'right';
  delta: number;
  layoutClass: StepModalLayoutClass;
}): ColumnWidths {
  const snapped = snapToStep(delta);
  if (edge === 'left') {
    if (layoutClass === 'inputless') {
      return start;
    }
    const pair = start.input + start.center;
    const input = clampOrKeep({
      value: start.input + snapped,
      min: STEP_MODAL_LAYOUT.sideMin,
      max: pair - STEP_MODAL_LAYOUT.centerMin,
      fallback: start.input,
    });
    return { input, center: pair - input, output: start.output };
  }
  const pair = start.center + start.output;
  const center = clampOrKeep({
    value: start.center + snapped,
    min: STEP_MODAL_LAYOUT.centerMin,
    max: pair - STEP_MODAL_LAYOUT.sideMin,
    fallback: start.center,
  });
  return { input: start.input, center, output: pair - center };
}

function moveCenter({
  start,
  delta,
  layoutClass,
}: {
  start: ColumnWidths;
  delta: number;
  layoutClass: StepModalLayoutClass;
}): ColumnWidths {
  if (layoutClass === 'inputless') {
    return start;
  }
  const sides = start.input + start.output;
  const input = clampOrKeep({
    value: start.input + snapToStep(delta),
    min: STEP_MODAL_LAYOUT.sideMin,
    max: sides - STEP_MODAL_LAYOUT.sideMin,
    fallback: start.input,
  });
  return { input, center: start.center, output: sides - input };
}

function readLayout({
  key,
  storage = getStorage(),
}: {
  key: string;
  storage?: LayoutStorage | null;
}): ColumnPercentages | null {
  try {
    const raw = storage?.getItem(key);
    if (!raw) {
      return null;
    }
    const parsed = ColumnPercentagesSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      return null;
    }
    const sum = parsed.data.input + parsed.data.center + parsed.data.output;
    return Math.abs(sum - 100) < 1 ? parsed.data : null;
  } catch {
    return null;
  }
}

function saveLayout({
  key,
  percentages,
  storage = getStorage(),
}: {
  key: string;
  percentages: ColumnPercentages;
  storage?: LayoutStorage | null;
}): void {
  try {
    storage?.setItem(key, JSON.stringify(percentages));
  } catch {
    return;
  }
}

function clearLayout({
  key,
  storage = getStorage(),
}: {
  key: string;
  storage?: LayoutStorage | null;
}): void {
  try {
    storage?.removeItem(key);
  } catch {
    return;
  }
}

function getStorage(): LayoutStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function clampCenter({
  value,
  total,
  layoutClass,
}: {
  value: number;
  total: number;
  layoutClass: StepModalLayoutClass;
}): number {
  const sides = layoutClass === 'inputless' ? 1 : 2;
  const max = Math.max(total - sides * STEP_MODAL_LAYOUT.sideMin, 0);
  return Math.min(Math.max(value, STEP_MODAL_LAYOUT.centerMin), max);
}

function clampOrKeep({
  value,
  min,
  max,
  fallback,
}: {
  value: number;
  min: number;
  max: number;
  fallback: number;
}): number {
  if (max < min) {
    return fallback;
  }
  return Math.min(Math.max(value, min), max);
}

function snapToStep(delta: number): number {
  return Math.round(delta / STEP_MODAL_LAYOUT.step) * STEP_MODAL_LAYOUT.step;
}

const ColumnPercentagesSchema = z.object({
  input: z.number().min(0),
  center: z.number().positive(),
  output: z.number().min(0),
});

const AGENT_PIECE_NAME = '@activepieces/piece-ai';
const AGENT_ACTION_NAME = 'run_agent';
const LAYOUT_STORAGE_PREFIX = 'ap.stepModal.layout.';

const STEP_MODAL_LAYOUT: StepModalLayoutConstants = {
  centerMin: 368,
  sideMin: 120,
  sideContentMin: 280,
  step: 8,
  centerDefault: {
    regular: 420,
    wide: 640,
    inputless: 480,
  },
};

export const stepModalLayoutUtils = {
  LAYOUT: STEP_MODAL_LAYOUT,
  getLayoutClass,
  getStorageKey,
  getDefaultWidths,
  fromPercentages,
  toPercentages,
  resizeEdge,
  moveCenter,
  readLayout,
  saveLayout,
  clearLayout,
  getStorage,
};

export type StepModalLayoutClass = 'regular' | 'wide' | 'inputless';

export type ColumnWidths = {
  input: number;
  center: number;
  output: number;
};

export type ColumnPercentages = ColumnWidths;

export type LayoutStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

type StepModalLayoutConstants = {
  centerMin: number;
  sideMin: number;
  sideContentMin: number;
  step: number;
  centerDefault: Record<StepModalLayoutClass, number>;
};
