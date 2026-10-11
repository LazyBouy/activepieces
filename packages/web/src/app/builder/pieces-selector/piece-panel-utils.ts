import { isNil } from '@activepieces/core-utils';
import {
  FlowActionType,
  FlowOperationType,
  FlowTriggerType,
} from '@activepieces/shared';

import { PieceSelectorTabType } from '@/features/pieces/stores/piece-selector-tabs-provider';
import {
  CategorizedStepMetadataWithSuggestions,
  PieceSelectorItem,
  PieceSelectorOperation,
  PieceSelectorPieceItem,
  PieceStepMetadataWithSuggestions,
  StepMetadataWithSuggestions,
} from '@/features/pieces/types';
import type { ResolvedPieceSelectorTab } from '@/features/pieces/utils/piece-selector-customization';
import { pieceSelectorUtils } from '@/features/pieces/utils/piece-selector-utils';
import { stepUtils } from '@/features/pieces/utils/step-utils';

function isPieceMetadata(
  metadata: StepMetadataWithSuggestions,
): metadata is PieceStepMetadataWithSuggestions {
  return (
    metadata.type === FlowActionType.PIECE ||
    metadata.type === FlowTriggerType.PIECE
  );
}

function isPieceItem(item: PieceSelectorItem): item is PieceSelectorPieceItem {
  return (
    item.type === FlowActionType.PIECE || item.type === FlowTriggerType.PIECE
  );
}

function getItems(metadata: StepMetadataWithSuggestions): PieceSelectorItem[] {
  switch (metadata.type) {
    case FlowActionType.PIECE:
      return pieceSelectorUtils.removeHiddenActions(metadata).map((action) => ({
        actionOrTrigger: action,
        type: FlowActionType.PIECE,
        pieceMetadata: metadata,
      }));
    case FlowTriggerType.PIECE:
      return Object.values(metadata.suggestedTriggers ?? {}).map((trigger) => ({
        actionOrTrigger: trigger,
        type: FlowTriggerType.PIECE,
        pieceMetadata: metadata,
      }));
    case FlowActionType.CODE:
    case FlowActionType.LOOP_ON_ITEMS:
    case FlowActionType.ROUTER:
    case FlowActionType.AI_ROUTER:
      return stepUtils
        .coreActionsMetadata()
        .filter((step) => step.type === metadata.type);
    default:
      return [];
  }
}

function getItemInfo(item: PieceSelectorItem): PiecePanelItemInfo {
  if (isPieceItem(item)) {
    return {
      displayName: item.actionOrTrigger.displayName,
      description: item.actionOrTrigger.description,
      classification: item.actionOrTrigger.classification,
      isTrigger: item.type === FlowTriggerType.PIECE,
    };
  }
  return {
    displayName: item.displayName,
    description: item.description,
    classification: undefined,
    isTrigger: false,
  };
}

function getItemLogo(item: PieceSelectorItem): {
  logoUrl: string;
  displayName: string;
} {
  if (isPieceItem(item)) {
    return {
      logoUrl: item.pieceMetadata.logoUrl,
      displayName: item.pieceMetadata.displayName,
    };
  }
  return { logoUrl: item.logoUrl, displayName: item.displayName };
}

function getItemKey(item: PieceSelectorItem): string {
  if (isPieceItem(item)) {
    return `${item.pieceMetadata.pieceName}/${item.actionOrTrigger.name}`;
  }
  return item.type;
}

function trimTrailingPeriod(text: string): string {
  return text.endsWith('.') ? text.slice(0, -1) : text;
}

function matchesQuery({
  texts,
  query,
}: {
  texts: (string | undefined)[];
  query: string;
}): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return true;
  }
  return texts.some(
    (text) => !isNil(text) && text.toLowerCase().includes(needle),
  );
}

function filterItems({
  items,
  query,
}: {
  items: PieceSelectorItem[];
  query: string;
}): PieceSelectorItem[] {
  return items.filter((item) => {
    const info = getItemInfo(item);
    return matchesQuery({ texts: [info.displayName, info.description], query });
  });
}

function filterCategories({
  categories,
  query,
}: {
  categories: CategorizedStepMetadataWithSuggestions[];
  query: string;
}): CategorizedStepMetadataWithSuggestions[] {
  return categories
    .map((category) => ({
      ...category,
      metadata: category.metadata.filter((metadata) =>
        matchesQuery({
          texts: [
            metadata.displayName,
            ...getItems(metadata).map((item) => getItemInfo(item).displayName),
          ],
          query,
        }),
      ),
    }))
    .filter((category) => category.metadata.length > 0);
}

function buildItemRows({
  items,
  keyPrefix,
  hideLogo = false,
  getLogoUrl,
}: {
  items: PieceSelectorItem[];
  keyPrefix: string;
  hideLogo?: boolean;
  getLogoUrl?: (item: PieceSelectorItem) => string | undefined;
}): PiecePanelRow[] {
  return items.map((item, index) => {
    const logo = getItemLogo(item);
    return {
      kind: 'item',
      key: `${keyPrefix}:item:${getItemKey(item)}:${index}`,
      item,
      hideLogo,
      logoUrl: getLogoUrl?.(item) ?? logo.logoUrl,
      logoName: logo.displayName,
    };
  });
}

function buildPieceRows({
  pieces,
  keyPrefix,
  showDescription,
}: {
  pieces: StepMetadataWithSuggestions[];
  keyPrefix: string;
  showDescription: boolean;
}): PiecePanelRow[] {
  return pieces.flatMap((metadata, index) =>
    isPieceMetadata(metadata)
      ? [
          {
            kind: 'piece',
            key: `${keyPrefix}:piece:${metadata.pieceName}:${index}`,
            metadata,
            showDescription,
          },
        ]
      : buildItemRows({
          items: getItems(metadata),
          keyPrefix: `${keyPrefix}:core:${index}`,
        }),
  );
}

function buildRootRows({
  tabs,
}: {
  tabs: ResolvedPieceSelectorTab[];
}): PiecePanelRow[] {
  const toRow = (tab: ResolvedPieceSelectorTab): PiecePanelRow => ({
    kind: 'group',
    key: `group:${tab.key}`,
    tab,
  });
  const builtinRows = tabs
    .filter((tab) => tab.type !== PieceSelectorTabType.CUSTOM)
    .map(toRow);
  const customRows = tabs
    .filter((tab) => tab.type === PieceSelectorTabType.CUSTOM)
    .map(toRow);
  if (builtinRows.length === 0 || customRows.length === 0) {
    return [...builtinRows, ...customRows];
  }
  return [
    ...builtinRows,
    { kind: 'separator', key: 'separator:custom-groups' },
    ...customRows,
  ];
}

function buildSearchResultRows({
  categories,
}: {
  categories: CategorizedStepMetadataWithSuggestions[];
}): PiecePanelRow[] {
  return categories.flatMap((category, categoryIndex) =>
    category.metadata.flatMap((metadata, index) => {
      const keyPrefix = `result:${categoryIndex}:${index}`;
      if (!isPieceMetadata(metadata)) {
        return buildItemRows({ items: getItems(metadata), keyPrefix });
      }
      return [
        {
          kind: 'piece',
          key: `${keyPrefix}:piece:${metadata.pieceName}`,
          metadata,
          showDescription: false,
        },
        ...buildItemRows({
          items: getItems(metadata),
          keyPrefix,
          hideLogo: true,
        }),
      ];
    }),
  );
}

function buildSectionRows({
  categories,
}: {
  categories: CategorizedStepMetadataWithSuggestions[];
}): PiecePanelRow[] {
  return categories.flatMap((category, index) => [
    {
      kind: 'label',
      key: `label:${index}:${category.title}`,
      text: category.title,
    },
    ...buildPieceRows({
      pieces: category.metadata,
      keyPrefix: `section:${index}`,
      showDescription: true,
    }),
  ]);
}

function isCategoryExpanded({
  index,
  title,
  toggledTitles,
  query,
}: {
  index: number;
  title: string;
  toggledTitles: string[];
  query: string;
}): boolean {
  if (query.trim() !== '') {
    return true;
  }
  return (index === 0) !== toggledTitles.includes(title);
}

function buildCategoryRows({
  categories,
  toggledTitles,
  query,
}: {
  categories: CategorizedStepMetadataWithSuggestions[];
  toggledTitles: string[];
  query: string;
}): PiecePanelRow[] {
  return categories.flatMap((category, index) => {
    const expanded = isCategoryExpanded({
      index,
      title: category.title,
      toggledTitles,
      query,
    });
    const categoryRow: PiecePanelRow = {
      kind: 'category',
      key: `category:${index}:${category.title}`,
      title: category.title,
      expanded,
    };
    if (!expanded) {
      return [categoryRow];
    }
    return [
      categoryRow,
      ...buildPieceRows({
        pieces: category.metadata,
        keyPrefix: `category:${index}`,
        showDescription: true,
      }),
    ];
  });
}

function buildLabelledItemRows({
  label,
  items,
  keyPrefix,
  getLogoUrl,
}: {
  label: string | null;
  items: PieceSelectorItem[];
  keyPrefix: string;
  getLogoUrl?: (item: PieceSelectorItem) => string | undefined;
}): PiecePanelRow[] {
  if (items.length === 0) {
    return [];
  }
  const itemRows = buildItemRows({ items, keyPrefix, getLogoUrl });
  if (isNil(label)) {
    return itemRows;
  }
  return [
    { kind: 'label', key: `${keyPrefix}:label`, text: label },
    ...itemRows,
  ];
}

function isSelectableRow(row: PiecePanelRow): boolean {
  return (
    row.kind === 'group' ||
    row.kind === 'category' ||
    row.kind === 'piece' ||
    row.kind === 'item'
  );
}

function opensSubView(row: PiecePanelRow | undefined): boolean {
  return !isNil(row) && (row.kind === 'group' || row.kind === 'piece');
}

function getSelectableIndexes(rows: PiecePanelRow[]): number[] {
  return rows.flatMap((row, index) => (isSelectableRow(row) ? [index] : []));
}

function getFirstSelectableIndex(rows: PiecePanelRow[]): number {
  return getSelectableIndexes(rows)[0] ?? -1;
}

function resolveActiveIndex({
  rows,
  activeKey,
}: {
  rows: PiecePanelRow[];
  activeKey: string | null;
}): number {
  const index = isNil(activeKey)
    ? -1
    : rows.findIndex((row) => row.key === activeKey && isSelectableRow(row));
  return index === -1 ? getFirstSelectableIndex(rows) : index;
}

function moveActiveIndex({
  rows,
  activeIndex,
  step,
}: {
  rows: PiecePanelRow[];
  activeIndex: number;
  step: 1 | -1;
}): number {
  const selectable = getSelectableIndexes(rows);
  if (selectable.length === 0) {
    return -1;
  }
  const position = selectable.indexOf(activeIndex);
  if (position === -1) {
    return step === 1 ? selectable[0] : selectable[selectable.length - 1];
  }
  const next = Math.min(Math.max(position + step, 0), selectable.length - 1);
  return selectable[next];
}

function resolveKeyAction({
  key,
  query,
  caretAtEnd,
  canPop,
  activeRowOpensSubView,
}: {
  key: string;
  query: string;
  caretAtEnd: boolean;
  canPop: boolean;
  activeRowOpensSubView: boolean;
}): PiecePanelKeyAction | null {
  switch (key) {
    case 'ArrowDown':
      return 'next';
    case 'ArrowUp':
      return 'previous';
    case 'Enter':
      return 'activate';
    case 'ArrowRight':
      return activeRowOpensSubView && caretAtEnd ? 'push' : null;
    case 'ArrowLeft':
    case 'Backspace':
      return canPop && query === '' ? 'pop' : null;
    case 'Escape':
      return query === '' ? 'close' : 'clear';
    default:
      return null;
  }
}

function pushView({
  stack,
  view,
  id,
}: {
  stack: PiecePanelStackEntry[];
  view: PiecePanelViewModel;
  id: number;
}): PiecePanelStackEntry[] {
  return [...stack, { id, view, query: '' }];
}

function popView(stack: PiecePanelStackEntry[]): PiecePanelStackEntry[] {
  if (stack.length <= 1) {
    return stack;
  }
  const remaining = stack.slice(0, -1);
  return remaining.map((entry, index) =>
    index === remaining.length - 1 ? { ...entry, query: '' } : entry,
  );
}

function setTopQuery({
  stack,
  query,
}: {
  stack: PiecePanelStackEntry[];
  query: string;
}): PiecePanelStackEntry[] {
  return stack.map((entry, index) =>
    index === stack.length - 1 ? { ...entry, query } : entry,
  );
}

function getPanelMode(operation: PieceSelectorOperation): PiecePanelMode {
  switch (operation.type) {
    case FlowOperationType.ADD_ACTION:
      return 'next-step';
    case FlowOperationType.UPDATE_TRIGGER:
      return 'trigger';
    case FlowOperationType.UPDATE_ACTION:
      return 'replace';
  }
}

function getStepKind(operation: PieceSelectorOperation): 'action' | 'trigger' {
  return operation.type === FlowOperationType.UPDATE_TRIGGER
    ? 'trigger'
    : 'action';
}

function getOperationKey(operation: PieceSelectorOperation): string {
  return JSON.stringify(operation);
}

export const piecePanelUtils = {
  isPieceMetadata,
  isPieceItem,
  getItems,
  getItemInfo,
  getItemLogo,
  trimTrailingPeriod,
  matchesQuery,
  filterItems,
  filterCategories,
  buildItemRows,
  buildPieceRows,
  buildRootRows,
  buildSearchResultRows,
  buildSectionRows,
  buildCategoryRows,
  buildLabelledItemRows,
  isCategoryExpanded,
  isSelectableRow,
  opensSubView,
  getFirstSelectableIndex,
  resolveActiveIndex,
  moveActiveIndex,
  resolveKeyAction,
  pushView,
  popView,
  setTopQuery,
  getPanelMode,
  getStepKind,
  getOperationKey,
};

export type PiecePanelItemInfo = {
  displayName: string;
  description: string;
  classification: PieceSelectorPieceItem['actionOrTrigger']['classification'];
  isTrigger: boolean;
};

export type PiecePanelRow =
  | { kind: 'label'; key: string; text: string }
  | { kind: 'separator'; key: string }
  | { kind: 'group'; key: string; tab: ResolvedPieceSelectorTab }
  | { kind: 'category'; key: string; title: string; expanded: boolean }
  | {
      kind: 'piece';
      key: string;
      metadata: PieceStepMetadataWithSuggestions;
      showDescription: boolean;
    }
  | {
      kind: 'item';
      key: string;
      item: PieceSelectorItem;
      hideLogo: boolean;
      logoUrl: string;
      logoName: string;
    };

export type PiecePanelViewModel =
  | { kind: 'root' }
  | { kind: 'group'; tab: ResolvedPieceSelectorTab }
  | { kind: 'piece'; metadata: PieceStepMetadataWithSuggestions };

export type PiecePanelStackEntry = {
  id: number;
  view: PiecePanelViewModel;
  query: string;
};

export type PiecePanelMode = 'next-step' | 'trigger' | 'replace';

export type PiecePanelKeyAction =
  | 'next'
  | 'previous'
  | 'activate'
  | 'push'
  | 'pop'
  | 'clear'
  | 'close';
