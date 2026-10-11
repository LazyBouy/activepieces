import { isNil } from '@activepieces/core-utils';
import { z } from 'zod';

import { pathHelpers } from '../data-selector/path-helpers';

import { LayoutStorage, stepModalLayoutUtils } from './step-modal-layout-utils';

function readViewMode({
  pane,
  storage = stepModalLayoutUtils.getStorage(),
}: {
  pane: DataPaneKind;
  storage?: LayoutStorage | null;
}): ViewMode {
  try {
    const parsed = ViewModeSchema.safeParse(
      storage?.getItem(`${VIEW_MODE_STORAGE_PREFIX}${pane}`),
    );
    return parsed.success ? parsed.data : DEFAULT_VIEW_MODES[pane];
  } catch {
    return DEFAULT_VIEW_MODES[pane];
  }
}

function saveViewMode({
  pane,
  mode,
  storage = stepModalLayoutUtils.getStorage(),
}: {
  pane: DataPaneKind;
  mode: ViewMode;
  storage?: LayoutStorage | null;
}): void {
  try {
    storage?.setItem(`${VIEW_MODE_STORAGE_PREFIX}${pane}`, mode);
  } catch {
    return;
  }
}

function isViewMode(value: string): value is ViewMode {
  return ViewModeSchema.safeParse(value).success;
}

function getValueKind(value: unknown): ValueKind {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  switch (typeof value) {
    case 'string':
      return 'string';
    case 'number':
    case 'bigint':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'object':
      return 'object';
    default:
      return 'string';
  }
}

function getItemCount(value: unknown): number | null {
  return Array.isArray(value) ? value.length : null;
}

function buildTableModel(data: unknown): TableModel {
  if (isNil(data)) {
    return { kind: 'empty', columns: [], rows: [] };
  }
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return { kind: 'empty', columns: [], rows: [] };
    }
    if (data.every(isPlainObject)) {
      const columns = collectColumns(data);
      return {
        kind: 'objects',
        columns,
        rows: data.map((item) => columns.map((column) => item[column])),
      };
    }
    return {
      kind: 'values',
      columns: [VALUE_COLUMN],
      rows: data.map((item) => [item]),
    };
  }
  if (isPlainObject(data)) {
    const columns = Object.keys(data);
    if (columns.length === 0) {
      return { kind: 'empty', columns: [], rows: [] };
    }
    return {
      kind: 'single',
      columns,
      rows: [columns.map((column) => data[column])],
    };
  }
  return { kind: 'primitive', columns: [VALUE_COLUMN], rows: [[data]] };
}

function getColumnPath({
  basePath,
  model,
  columnIndex,
}: {
  basePath: string;
  model: TableModel;
  columnIndex: number;
}): string | null {
  const column = model.columns[columnIndex];
  if (isNil(column)) {
    return null;
  }
  switch (model.kind) {
    case 'objects':
      return pathHelpers.appendSegmentsToPropertyPath({
        basePath,
        segments: [0, column],
      });
    case 'single':
      return pathHelpers.appendSegmentsToPropertyPath({
        basePath,
        segments: [column],
      });
    case 'values':
      return pathHelpers.appendSegmentsToPropertyPath({
        basePath,
        segments: [0],
      });
    case 'primitive':
      return basePath;
    case 'empty':
      return null;
  }
}

function formatCell(value: unknown): string {
  if (value === undefined) {
    return '';
  }
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  const json = JSON.stringify(value) ?? '';
  return json.length > CELL_MAX_LENGTH
    ? `${json.slice(0, CELL_MAX_LENGTH)}…`
    : json;
}

function formatPreview(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    const singleLine = value.replace(/\s+/g, ' ').trim();
    return singleLine.length > PREVIEW_MAX_LENGTH
      ? `${singleLine.slice(0, PREVIEW_MAX_LENGTH)}…`
      : singleLine;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

function collectColumns(items: Record<string, unknown>[]): string[] {
  return items.reduce<string[]>((columns, item) => {
    const newKeys = Object.keys(item).filter((key) => !columns.includes(key));
    return [...columns, ...newKeys];
  }, []);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const ViewModeSchema = z.enum(['schema', 'table', 'json']);
const VIEW_MODE_STORAGE_PREFIX = 'ap.stepModal.viewMode.';
const VALUE_COLUMN = '__value__';
const CELL_MAX_LENGTH = 120;
const PREVIEW_MAX_LENGTH = 80;

const DEFAULT_VIEW_MODES: Record<DataPaneKind, ViewMode> = {
  input: 'schema',
  output: 'table',
};

const COMPACT_PANE_WIDTH = 400;

export const viewModeUtils = {
  VALUE_COLUMN,
  DEFAULT_VIEW_MODES,
  COMPACT_PANE_WIDTH,
  readViewMode,
  saveViewMode,
  isViewMode,
  getValueKind,
  getItemCount,
  buildTableModel,
  getColumnPath,
  formatCell,
  formatPreview,
};

export type ViewMode = z.infer<typeof ViewModeSchema>;

export type DataPaneKind = 'input' | 'output';

export type ValueKind =
  | 'string'
  | 'number'
  | 'boolean'
  | 'object'
  | 'array'
  | 'null';

export type TableModel = {
  kind: 'objects' | 'single' | 'values' | 'primitive' | 'empty';
  columns: string[];
  rows: unknown[][];
};
