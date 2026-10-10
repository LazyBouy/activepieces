import { tryCatchSync } from '@activepieces/core-utils';
import { matchPath } from 'react-router-dom';
import { create } from 'zustand';

import { routesThatRequireProjectId } from '@/lib/route-utils';

const STORAGE_KEY = 'primary-rail-collapsed';
const WIDTH_STORAGE_KEY = 'primary-rail-width';
const PROJECTS_COLLAPSED_STORAGE_KEY = 'primary-rail-projects-collapsed';
const PINNED_SORT_STORAGE_KEY = 'rail-pinned-sort';

// Inside one agent the rail is furniture: the page has its own header, its own
// conversation list and its own panel. The route only asks for it closed, so an
// explicit click on that page still wins until you navigate on.
const AGENT_ROUTES = [
  routesThatRequireProjectId.singleAgent,
  routesThatRequireProjectId.singleAgentRuns,
];

const ROUTES_THAT_HOLD_THE_RAIL_CLOSED = AGENT_ROUTES.flatMap((route) => [
  route,
  `/projects/:projectId${route}`,
]);

export function railIsCollapsed({
  preference,
  pathname,
  openedOn,
}: {
  preference: boolean;
  pathname: string;
  openedOn: string | null;
}): boolean {
  const routeHoldsItClosed =
    openedOn !== pathname &&
    ROUTES_THAT_HOLD_THE_RAIL_CLOSED.some(
      (route) => matchPath(route, pathname) !== null,
    );
  return preference || routeHoldsItClosed;
}

function readStorage(key: string): string | null {
  const { data } = tryCatchSync(() => window.localStorage.getItem(key));
  return data ?? null;
}

function writeStorage({ key, value }: { key: string; value: string }): void {
  tryCatchSync(() => window.localStorage.setItem(key, value));
}

function readInitial(): boolean {
  return readStorage(STORAGE_KEY) === 'true';
}

function persist(value: boolean): boolean {
  writeStorage({ key: STORAGE_KEY, value: String(value) });
  return value;
}

function clampWidth(width: number): number {
  return Math.min(RAIL_MAX_WIDTH, Math.max(RAIL_MIN_WIDTH, width));
}

function snapWidth(width: number): number {
  return clampWidth(Math.round(width / RAIL_WIDTH_STEP) * RAIL_WIDTH_STEP);
}

function readWidth(): number {
  const stored = Number(readStorage(WIDTH_STORAGE_KEY));
  if (!Number.isFinite(stored) || stored <= 0) {
    return RAIL_DEFAULT_WIDTH;
  }
  return clampWidth(stored);
}

function resolveDrag({
  pointerX,
  railLeft,
}: {
  pointerX: number;
  railLeft: number;
}): RailDragResult {
  if (pointerX < RAIL_COLLAPSE_POINTER_X) {
    return { collapsed: true, width: null };
  }
  return { collapsed: false, width: snapWidth(pointerX - railLeft) };
}

function resizeCursor({
  collapsed,
  width,
}: {
  collapsed: boolean;
  width: number;
}): RailResizeCursor {
  if (collapsed || width <= RAIL_MIN_WIDTH) {
    return 'e-resize';
  }
  if (width >= RAIL_MAX_WIDTH) {
    return 'w-resize';
  }
  return 'col-resize';
}

function isEditableTarget(target: RailShortcutTarget): boolean {
  if (target === null) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  const tagName = target.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true;
  }
  return target.closest(EDITOR_SELECTOR) !== null;
}

function isToggleShortcut({
  key,
  ctrlKey,
  metaKey,
  altKey,
  defaultPrevented,
  target,
  dialogOpen,
}: RailShortcutEvent): boolean {
  if (key !== RAIL_TOGGLE_KEY || ctrlKey || metaKey || altKey) {
    return false;
  }
  if (defaultPrevented || dialogOpen) {
    return false;
  }
  return !isEditableTarget(target);
}

function readProjectsCollapsed(): boolean {
  return readStorage(PROJECTS_COLLAPSED_STORAGE_KEY) === 'true';
}

function writeProjectsCollapsed(value: boolean): void {
  writeStorage({ key: PROJECTS_COLLAPSED_STORAGE_KEY, value: String(value) });
}

function readPinnedSort(): string | null {
  return readStorage(PINNED_SORT_STORAGE_KEY);
}

function writePinnedSort(value: string): void {
  writeStorage({ key: PINNED_SORT_STORAGE_KEY, value });
}

const EDITOR_SELECTOR = '.cm-editor, .monaco-editor, [contenteditable="true"]';

const RAIL_COLLAPSED_WIDTH = 42;
const RAIL_MIN_WIDTH = 200;
const RAIL_MAX_WIDTH = 500;
const RAIL_DEFAULT_WIDTH = 200;
const RAIL_WIDTH_STEP = 8;
const RAIL_COLLAPSE_POINTER_X = 100;
const RAIL_TOGGLE_KEY = '[';

export const useRailCollapsed = create<RailCollapsedState>((set, get) => ({
  preference: readInitial(),
  width: readWidth(),
  setCollapsed: (value) => set({ preference: persist(value) }),
  toggle: () => set((state) => ({ preference: persist(!state.preference) })),
  setWidth: (value) => set({ width: clampWidth(value) }),
  saveWidth: () =>
    writeStorage({ key: WIDTH_STORAGE_KEY, value: String(get().width) }),
}));

export const railSizing = {
  collapsedWidth: RAIL_COLLAPSED_WIDTH,
  minWidth: RAIL_MIN_WIDTH,
  maxWidth: RAIL_MAX_WIDTH,
  defaultWidth: RAIL_DEFAULT_WIDTH,
  clampWidth,
  snapWidth,
  readWidth,
  resolveDrag,
  resizeCursor,
};

export const railShortcut = {
  key: RAIL_TOGGLE_KEY,
  isToggleShortcut,
};

export const railPreferences = {
  readProjectsCollapsed,
  writeProjectsCollapsed,
  readPinnedSort,
  writePinnedSort,
};

export type RailDragResult =
  | { collapsed: true; width: null }
  | { collapsed: false; width: number };

export type RailResizeCursor = 'e-resize' | 'w-resize' | 'col-resize';

export type RailShortcutTarget = {
  tagName: string;
  isContentEditable: boolean;
  closest: (selector: string) => unknown;
} | null;

export type RailShortcutEvent = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
  target: RailShortcutTarget;
  dialogOpen: boolean;
};

type RailCollapsedState = {
  preference: boolean;
  width: number;
  setCollapsed: (value: boolean) => void;
  toggle: () => void;
  setWidth: (value: number) => void;
  saveWidth: () => void;
};
