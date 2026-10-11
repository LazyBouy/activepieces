import { isNil } from '@activepieces/core-utils';

function getStorage(): LogsPanelStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readSavedHeight({
  storage = getStorage(),
}: {
  storage?: LogsPanelStorage | null;
} = {}): number | null {
  const value = readPositiveNumber({ key: HEIGHT_STORAGE_KEY, storage });
  return isNil(value) ? null : Math.max(value, LOGS_PANEL_LAYOUT.minHeight);
}

function saveHeight({
  height,
  storage = getStorage(),
}: {
  height: number;
  storage?: LogsPanelStorage | null;
}): void {
  try {
    storage?.setItem(HEIGHT_STORAGE_KEY, String(Math.round(height)));
  } catch {
    return;
  }
}

function readSavedOpen({
  storage = getStorage(),
}: {
  storage?: LogsPanelStorage | null;
} = {}): boolean {
  try {
    return storage?.getItem(OPEN_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function saveOpen({
  open,
  storage = getStorage(),
}: {
  open: boolean;
  storage?: LogsPanelStorage | null;
}): void {
  try {
    storage?.setItem(OPEN_STORAGE_KEY, String(open));
  } catch {
    return;
  }
}

function readSavedListWidth({
  storage = getStorage(),
}: {
  storage?: LogsPanelStorage | null;
} = {}): ListWidthSetting | null {
  try {
    if (storage?.getItem(LIST_WIDTH_STORAGE_KEY) === FULL_LIST_WIDTH) {
      return FULL_LIST_WIDTH;
    }
  } catch {
    return null;
  }
  return readPositiveNumber({ key: LIST_WIDTH_STORAGE_KEY, storage });
}

function saveListWidth({
  width,
  storage = getStorage(),
}: {
  width: ListWidthSetting;
  storage?: LogsPanelStorage | null;
}): void {
  try {
    storage?.setItem(
      LIST_WIDTH_STORAGE_KEY,
      width === FULL_LIST_WIDTH ? FULL_LIST_WIDTH : String(Math.round(width)),
    );
  } catch {
    return;
  }
}

function getMaxHeight(columnHeight: number): number {
  return Math.max(
    Math.floor(columnHeight * LOGS_PANEL_LAYOUT.maxHeightRatio),
    LOGS_PANEL_LAYOUT.minHeight,
  );
}

function resolveOpenHeight({
  columnHeight,
  savedHeight,
}: {
  columnHeight: number;
  savedHeight: number | null;
}): number {
  const preferred =
    savedHeight ??
    Math.round(columnHeight * LOGS_PANEL_LAYOUT.defaultHeightRatio);
  return clamp({
    value: preferred,
    min: LOGS_PANEL_LAYOUT.minHeight,
    max: getMaxHeight(columnHeight),
  });
}

function resolveDragHeight({
  columnHeight,
  rawHeight,
}: {
  columnHeight: number;
  rawHeight: number;
}): number {
  return clamp({
    value: rawHeight,
    min: LOGS_PANEL_LAYOUT.collapsedHeight,
    max: getMaxHeight(columnHeight),
  });
}

function resolveDrop({
  columnHeight,
  rawHeight,
}: {
  columnHeight: number;
  rawHeight: number;
}): DropResult {
  if (rawHeight < LOGS_PANEL_LAYOUT.minHeight) {
    return { collapse: true, height: null };
  }
  return {
    collapse: false,
    height: clamp({
      value: rawHeight,
      min: LOGS_PANEL_LAYOUT.minHeight,
      max: getMaxHeight(columnHeight),
    }),
  };
}

function resolveListWidth({
  panelWidth,
  setting,
}: {
  panelWidth: number;
  setting: ListWidthSetting | null;
}): ResolvedListWidth {
  if (setting === FULL_LIST_WIDTH) {
    return { width: panelWidth, full: true };
  }
  const preferred =
    setting ??
    Math.min(
      LOGS_PANEL_LAYOUT.listDefaultWidth,
      panelWidth * LOGS_PANEL_LAYOUT.listDefaultRatio,
    );
  return {
    width: clamp({
      value: preferred,
      min: LOGS_PANEL_LAYOUT.listMinWidth,
      max: Math.max(
        Math.min(LOGS_PANEL_LAYOUT.listMaxWidth, panelWidth),
        LOGS_PANEL_LAYOUT.listMinWidth,
      ),
    }),
    full: false,
  };
}

function listWidthFromOffset({
  panelWidth,
  offset,
}: {
  panelWidth: number;
  offset: number;
}): ListWidthSetting {
  if (offset >= panelWidth - LOGS_PANEL_LAYOUT.fullListSnap) {
    return FULL_LIST_WIDTH;
  }
  return clamp({
    value: offset,
    min: LOGS_PANEL_LAYOUT.listMinWidth,
    max: LOGS_PANEL_LAYOUT.listMaxWidth,
  });
}

function togglePane({
  panes,
  pane,
}: {
  panes: LogsPanes;
  pane: keyof LogsPanes;
}): LogsPanes {
  const next = { ...panes, [pane]: !panes[pane] };
  if (!next.input && !next.output) {
    return panes;
  }
  return next;
}

function clampPaneRatio(ratio: number): number {
  return clamp({
    value: ratio,
    min: LOGS_PANEL_LAYOUT.paneMinRatio,
    max: 1 - LOGS_PANEL_LAYOUT.paneMinRatio,
  });
}

function readPositiveNumber({
  key,
  storage,
}: {
  key: string;
  storage: LogsPanelStorage | null;
}): number | null {
  try {
    const raw = storage?.getItem(key);
    if (isNil(raw)) {
      return null;
    }
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function clamp({
  value,
  min,
  max,
}: {
  value: number;
  min: number;
  max: number;
}): number {
  return Math.min(Math.max(value, min), Math.max(max, min));
}

const HEIGHT_STORAGE_KEY = 'ap.builder.logsPanelHeight';
const OPEN_STORAGE_KEY = 'ap.builder.logsPanelOpen';
const LIST_WIDTH_STORAGE_KEY = 'ap.builder.logsListWidth';
const FULL_LIST_WIDTH = 'full';

export const LOGS_PANEL_LAYOUT = {
  collapsedHeight: 36,
  minHeight: 160,
  defaultHeightRatio: 0.3,
  maxHeightRatio: 0.75,
  listDefaultWidth: 240,
  listDefaultRatio: 0.2,
  listMinWidth: 80,
  listMaxWidth: 500,
  fullListSnap: 24,
  durationMinListWidth: 200,
  paneMinRatio: 0.2,
  indent: 32,
};

export const DEFAULT_LOGS_PANES: LogsPanes = { input: false, output: true };

export const logsPanelLayoutUtils = {
  getStorage,
  readSavedHeight,
  saveHeight,
  readSavedOpen,
  saveOpen,
  readSavedListWidth,
  saveListWidth,
  resolveOpenHeight,
  resolveDragHeight,
  resolveDrop,
  resolveListWidth,
  listWidthFromOffset,
  togglePane,
  clampPaneRatio,
  HEIGHT_STORAGE_KEY,
  OPEN_STORAGE_KEY,
  LIST_WIDTH_STORAGE_KEY,
  FULL_LIST_WIDTH,
};

export type LogsPanelStorage = Pick<Storage, 'getItem' | 'setItem'>;

export type ListWidthSetting = number | typeof FULL_LIST_WIDTH;

export type LogsPanes = {
  input: boolean;
  output: boolean;
};

type DropResult =
  | { collapse: true; height: null }
  | { collapse: false; height: number };

type ResolvedListWidth = {
  width: number;
  full: boolean;
};
