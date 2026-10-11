// @vitest-environment jsdom
import {
  ActionBase,
  TriggerBase,
  TriggerStrategy,
} from '@activepieces/pieces-framework';
import {
  FlowActionType,
  FlowOperationType,
  FlowTriggerType,
  PackageType,
  PieceType,
  StepLocationRelativeToParent,
} from '@activepieces/shared';
import { describe, expect, it, vi } from 'vitest';

vi.mock('i18next', () => ({ t: (key: string) => key }));

import {
  PiecePanelRow,
  PiecePanelStackEntry,
  piecePanelUtils,
} from '@/app/builder/pieces-selector/piece-panel-utils';
import { PieceSelectorTabType } from '@/features/pieces/stores/piece-selector-tabs-provider';
import {
  PieceStepMetadataWithSuggestions,
  PrimitiveStepMetadata,
} from '@/features/pieces/types';
import { ResolvedPieceSelectorTab } from '@/features/pieces/utils/piece-selector-customization';

describe('piece panel keyboard helpers', () => {
  const rows: PiecePanelRow[] = [
    { kind: 'label', key: 'label', text: 'Popular' },
    groupRow('apps'),
    { kind: 'separator', key: 'separator' },
    groupRow('utility'),
    groupRow('custom'),
  ];

  it('starts on the first selectable row and skips labels and separators', () => {
    expect(piecePanelUtils.getFirstSelectableIndex(rows)).toBe(1);
    expect(piecePanelUtils.resolveActiveIndex({ rows, activeKey: null })).toBe(
      1,
    );
    expect(
      piecePanelUtils.moveActiveIndex({ rows, activeIndex: 1, step: 1 }),
    ).toBe(3);
    expect(
      piecePanelUtils.moveActiveIndex({ rows, activeIndex: 3, step: -1 }),
    ).toBe(1);
  });

  it('stops at both ends of the list instead of wrapping', () => {
    expect(
      piecePanelUtils.moveActiveIndex({ rows, activeIndex: 4, step: 1 }),
    ).toBe(4);
    expect(
      piecePanelUtils.moveActiveIndex({ rows, activeIndex: 1, step: -1 }),
    ).toBe(1);
  });

  it('falls back to the first row when the active row disappears', () => {
    expect(
      piecePanelUtils.resolveActiveIndex({ rows, activeKey: 'group:gone' }),
    ).toBe(1);
    expect(
      piecePanelUtils.resolveActiveIndex({ rows, activeKey: 'group:custom' }),
    ).toBe(4);
    expect(
      piecePanelUtils.resolveActiveIndex({ rows: [], activeKey: null }),
    ).toBe(-1);
  });

  it('maps keys to panel actions', () => {
    const base = {
      query: '',
      caretAtEnd: true,
      canPop: true,
      activeRowOpensSubView: true,
    };
    expect(
      piecePanelUtils.resolveKeyAction({ ...base, key: 'ArrowDown' }),
    ).toBe('next');
    expect(piecePanelUtils.resolveKeyAction({ ...base, key: 'ArrowUp' })).toBe(
      'previous',
    );
    expect(piecePanelUtils.resolveKeyAction({ ...base, key: 'Enter' })).toBe(
      'activate',
    );
    expect(
      piecePanelUtils.resolveKeyAction({ ...base, key: 'ArrowRight' }),
    ).toBe('push');
    expect(
      piecePanelUtils.resolveKeyAction({ ...base, key: 'ArrowLeft' }),
    ).toBe('pop');
    expect(
      piecePanelUtils.resolveKeyAction({ ...base, key: 'Backspace' }),
    ).toBe('pop');
    expect(piecePanelUtils.resolveKeyAction({ ...base, key: 'Escape' })).toBe(
      'close',
    );
    expect(piecePanelUtils.resolveKeyAction({ ...base, key: 'a' })).toBeNull();
  });

  it('keeps typing keys for the search box while it holds a query', () => {
    const typing = {
      query: 'sheet',
      caretAtEnd: false,
      canPop: true,
      activeRowOpensSubView: true,
    };
    expect(piecePanelUtils.resolveKeyAction({ ...typing, key: 'Escape' })).toBe(
      'clear',
    );
    expect(
      piecePanelUtils.resolveKeyAction({ ...typing, key: 'Backspace' }),
    ).toBeNull();
    expect(
      piecePanelUtils.resolveKeyAction({ ...typing, key: 'ArrowLeft' }),
    ).toBeNull();
    expect(
      piecePanelUtils.resolveKeyAction({ ...typing, key: 'ArrowRight' }),
    ).toBeNull();
  });

  it('does not pop the root view or push a row without a sub-view', () => {
    const atRoot = {
      query: '',
      caretAtEnd: true,
      canPop: false,
      activeRowOpensSubView: false,
    };
    expect(
      piecePanelUtils.resolveKeyAction({ ...atRoot, key: 'Backspace' }),
    ).toBeNull();
    expect(
      piecePanelUtils.resolveKeyAction({ ...atRoot, key: 'ArrowRight' }),
    ).toBeNull();
    expect(piecePanelUtils.opensSubView(groupRow('apps'))).toBe(true);
    expect(
      piecePanelUtils.opensSubView({
        kind: 'category',
        key: 'c',
        title: 'Popular',
        expanded: true,
      }),
    ).toBe(false);
  });
});

describe('piece panel search filtering', () => {
  const sheets = pieceMetadata({
    displayName: 'Google Sheets',
    actions: [
      action('insert_row', 'Insert Row'),
      action('find_rows', 'Find Rows'),
    ],
  });
  const store = pieceMetadata({
    displayName: 'Storage',
    actions: [action('get', 'Get'), action('put', 'Put')],
  });

  it('matches display names and descriptions without case', () => {
    expect(
      piecePanelUtils.matchesQuery({
        texts: ['Insert Row'],
        query: ' insert ',
      }),
    ).toBe(true);
    expect(
      piecePanelUtils.matchesQuery({ texts: ['Insert Row'], query: 'delete' }),
    ).toBe(false);
    expect(piecePanelUtils.matchesQuery({ texts: [], query: '' })).toBe(true);
  });

  it('filters a sub-view list of actions', () => {
    const items = piecePanelUtils.getItems(sheets);
    const filtered = piecePanelUtils.filterItems({ items, query: 'find' });
    expect(
      filtered.map((item) => piecePanelUtils.getItemInfo(item).displayName),
    ).toEqual(['Find Rows']);
  });

  it('keeps pieces whose name or actions match and drops empty categories', () => {
    const categories = [
      { title: 'Popular', metadata: [sheets] },
      { title: 'Utility', metadata: [store] },
    ];
    expect(
      piecePanelUtils
        .filterCategories({ categories, query: 'put' })
        .map((category) => category.title),
    ).toEqual(['Utility']);
    expect(
      piecePanelUtils.filterCategories({ categories, query: 'google' })[0]
        .metadata,
    ).toEqual([sheets]);
    expect(piecePanelUtils.filterCategories({ categories, query: '' })).toEqual(
      categories,
    );
  });
});

describe('piece panel row builders', () => {
  const sheets = pieceMetadata({
    displayName: 'Google Sheets',
    actions: [
      action('insert_row', 'Insert Row'),
      action('find_rows', 'Find Rows'),
    ],
  });

  it('lists built-in groups first and custom groups after a separator', () => {
    const rows = piecePanelUtils.buildRootRows({
      tabs: [
        tab('EXPLORE', PieceSelectorTabType.EXPLORE),
        tab('custom-1', PieceSelectorTabType.CUSTOM),
        tab('APPS', PieceSelectorTabType.APPS),
      ],
    });
    expect(rows.map((row) => row.key)).toEqual([
      'group:EXPLORE',
      'group:APPS',
      'separator:custom-groups',
      'group:custom-1',
    ]);
    expect(
      piecePanelUtils
        .buildRootRows({ tabs: [tab('APPS', PieceSelectorTabType.APPS)] })
        .map((row) => row.kind),
    ).toEqual(['group']);
  });

  it('puts each matching piece before its matching actions in search results', () => {
    const rows = piecePanelUtils.buildSearchResultRows({
      categories: [{ title: 'All', metadata: [sheets, codeStep()] }],
    });
    expect(rows.map((row) => row.kind)).toEqual([
      'piece',
      'item',
      'item',
      'item',
    ]);
    const [, firstAction, , codeRow] = rows;
    expect(firstAction.kind === 'item' && firstAction.hideLogo).toBe(true);
    expect(codeRow.kind === 'item' && codeRow.hideLogo).toBe(false);
  });

  it('expands only the first category until one is toggled or a query is typed', () => {
    const categories = [
      { title: 'Popular', metadata: [sheets] },
      { title: 'Highlights', metadata: [sheets] },
    ];
    const collapsed = piecePanelUtils.buildCategoryRows({
      categories,
      toggledTitles: [],
      query: '',
    });
    expect(collapsed.map((row) => row.kind)).toEqual([
      'category',
      'piece',
      'category',
    ]);
    const toggled = piecePanelUtils.buildCategoryRows({
      categories,
      toggledTitles: ['Popular', 'Highlights'],
      query: '',
    });
    expect(toggled.map((row) => row.kind)).toEqual([
      'category',
      'category',
      'piece',
    ]);
    const searching = piecePanelUtils.buildCategoryRows({
      categories,
      toggledTitles: ['Popular'],
      query: 'sheet',
    });
    expect(searching.filter((row) => row.kind === 'piece')).toHaveLength(2);
    expect(new Set(searching.map((row) => row.key)).size).toBe(
      searching.length,
    );
  });

  it('heads a piece sub-view with a section label and leaves empty lists empty', () => {
    const items = piecePanelUtils.getItems(sheets);
    expect(
      piecePanelUtils
        .buildLabelledItemRows({ label: 'Actions', items, keyPrefix: 'p' })
        .map((row) => row.kind),
    ).toEqual(['label', 'item', 'item']);
    expect(
      piecePanelUtils.buildLabelledItemRows({
        label: 'Actions',
        items: [],
        keyPrefix: 'p',
      }),
    ).toEqual([]);
  });

  it('lists triggers for a trigger piece and marks them as triggers', () => {
    const webhook = pieceMetadata({
      displayName: 'Schedule',
      triggers: [trigger('every_hour', 'Every Hour')],
    });
    const [item] = piecePanelUtils.getItems(webhook);
    expect(item.type).toBe(FlowTriggerType.PIECE);
    expect(piecePanelUtils.getItemInfo(item).isTrigger).toBe(true);
  });
});

describe('piece panel view stack', () => {
  const root: PiecePanelStackEntry = {
    id: 0,
    view: { kind: 'root' },
    query: 'sheet',
  };

  it('pushes a view with an empty query and keeps the view below unchanged', () => {
    const stack = piecePanelUtils.pushView({
      stack: [root],
      view: { kind: 'group', tab: tab('APPS', PieceSelectorTabType.APPS) },
      id: 1,
    });
    expect(stack).toHaveLength(2);
    expect(stack[0]).toBe(root);
    expect(stack[1]).toMatchObject({ id: 1, query: '' });
  });

  it('pops back to the previous view and clears its query', () => {
    const stack = piecePanelUtils.popView([
      root,
      { id: 1, view: { kind: 'root' }, query: 'get' },
    ]);
    expect(stack).toEqual([{ ...root, query: '' }]);
    expect(piecePanelUtils.popView([root])).toEqual([root]);
  });

  it('only changes the query of the top view', () => {
    const stack = piecePanelUtils.setTopQuery({
      stack: [root, { id: 1, view: { kind: 'root' }, query: '' }],
      query: 'row',
    });
    expect(stack.map((entry) => entry.query)).toEqual(['sheet', 'row']);
  });
});

describe('piece panel modes', () => {
  it('derives the mode and step kind from the operation', () => {
    const addAction = {
      type: FlowOperationType.ADD_ACTION,
      actionLocation: {
        parentStep: 'trigger',
        stepLocationRelativeToParent: StepLocationRelativeToParent.AFTER,
      },
    } as const;
    expect(piecePanelUtils.getPanelMode(addAction)).toBe('next-step');
    expect(piecePanelUtils.getStepKind(addAction)).toBe('action');
    expect(
      piecePanelUtils.getPanelMode({ type: FlowOperationType.UPDATE_TRIGGER }),
    ).toBe('trigger');
    expect(
      piecePanelUtils.getStepKind({ type: FlowOperationType.UPDATE_TRIGGER }),
    ).toBe('trigger');
    expect(
      piecePanelUtils.getPanelMode({
        type: FlowOperationType.UPDATE_ACTION,
        stepName: 'step_1',
      }),
    ).toBe('replace');
  });
});

function groupRow(key: string): PiecePanelRow {
  return {
    kind: 'group',
    key: `group:${key}`,
    tab: tab(key, PieceSelectorTabType.APPS),
  };
}

function tab(
  key: string,
  type: PieceSelectorTabType,
): ResolvedPieceSelectorTab {
  return { key, type, name: key, icon: null };
}

function action(name: string, displayName: string): ActionBase {
  return {
    name,
    displayName,
    description: `${displayName} description.`,
    props: {},
    requireAuth: false,
  };
}

function trigger(name: string, displayName: string): TriggerBase {
  return {
    name,
    displayName,
    description: `${displayName} description.`,
    props: {},
    requireAuth: false,
    type: TriggerStrategy.POLLING,
    sampleData: {},
    testStrategy: TriggerBase.shape.testStrategy.def.entries.SIMULATION,
  };
}

function pieceMetadata({
  displayName,
  actions = [],
  triggers = [],
}: {
  displayName: string;
  actions?: ActionBase[];
  triggers?: TriggerBase[];
}): PieceStepMetadataWithSuggestions {
  return {
    displayName,
    logoUrl: `https://example.test/${displayName}.svg`,
    description: `${displayName} description`,
    type: triggers.length > 0 ? FlowTriggerType.PIECE : FlowActionType.PIECE,
    pieceName: `@activepieces/piece-${displayName.toLowerCase()}`,
    pieceVersion: '0.1.0',
    categories: [],
    packageType: PackageType.REGISTRY,
    pieceType: PieceType.OFFICIAL,
    auth: undefined,
    suggestedActions: actions,
    suggestedTriggers: triggers,
  };
}

function codeStep(): PrimitiveStepMetadata {
  return {
    type: FlowActionType.CODE,
    displayName: 'Code',
    description: 'Run code',
    logoUrl: 'https://example.test/code.svg',
  };
}
