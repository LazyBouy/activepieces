// @vitest-environment jsdom
import {
  ActionBase,
  PieceMetadataModel,
  PieceMetadataModelSummary,
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
  PieceSelectorPieceItem,
  PieceSelectorSection,
  PieceSelectorSectionEntry,
  PieceSelectorTriggerOption,
  PieceStepMetadataWithSuggestions,
  PrimitiveStepMetadata,
  StepMetadataWithSuggestions,
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

  it('cycles Tab through the panel controls in both directions and starts at either end from outside', () => {
    expect(
      piecePanelUtils.nextTabStopIndex({
        count: 3,
        currentIndex: 0,
        backwards: false,
      }),
    ).toBe(1);
    expect(
      piecePanelUtils.nextTabStopIndex({
        count: 3,
        currentIndex: 2,
        backwards: false,
      }),
    ).toBe(0);
    expect(
      piecePanelUtils.nextTabStopIndex({
        count: 3,
        currentIndex: 0,
        backwards: true,
      }),
    ).toBe(2);
    expect(
      piecePanelUtils.nextTabStopIndex({
        count: 3,
        currentIndex: -1,
        backwards: false,
      }),
    ).toBe(0);
    expect(
      piecePanelUtils.nextTabStopIndex({
        count: 3,
        currentIndex: -1,
        backwards: true,
      }),
    ).toBe(2);
    expect(
      piecePanelUtils.nextTabStopIndex({
        count: 0,
        currentIndex: -1,
        backwards: false,
      }),
    ).toBe(-1);
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

  it('opens the catalog from its row and downloads from a catalog row instead of pushing', () => {
    const browseRow: PiecePanelRow = {
      kind: 'browse-catalog',
      key: 'catalog:browse',
    };
    const catalogRow: PiecePanelRow = {
      kind: 'catalog-piece',
      key: 'catalog:@activepieces/piece-asana',
      piece: catalogPiece({ displayName: 'Asana' }),
      status: 'idle',
    };
    expect(piecePanelUtils.isSelectableRow(browseRow)).toBe(true);
    expect(piecePanelUtils.opensSubView(browseRow)).toBe(true);
    expect(piecePanelUtils.isSelectableRow(catalogRow)).toBe(true);
    expect(piecePanelUtils.opensSubView(catalogRow)).toBe(false);
    expect(
      piecePanelUtils.moveActiveIndex({
        rows: [
          groupRow('apps'),
          { kind: 'separator', key: 'separator:catalog' },
          browseRow,
        ],
        activeIndex: 0,
        step: 1,
      }),
    ).toBe(2);
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

  it('lists the six categories first and custom groups after a separator', () => {
    const rows = piecePanelUtils.buildRootRows({
      tabs: [...CATEGORY_TABS, tab('custom-1', PieceSelectorTabType.CUSTOM)],
    });
    expect(rows.map((row) => row.key)).toEqual([
      'group:AI_AND_AGENTS',
      'group:APPS',
      'group:DATA_TRANSFORMATION',
      'group:FLOW_CONTROL',
      'group:UTILITY',
      'group:APPROVALS',
      'separator:custom-groups',
      'group:custom-1',
    ]);
    expect(
      piecePanelUtils
        .buildRootRows({ tabs: [tab('APPS', PieceSelectorTabType.APPS)] })
        .map((row) => row.kind),
    ).toEqual(['group']);
  });

  it('lists the trigger rows first in trigger mode, then custom groups and the catalog row', () => {
    const webhook = pieceMetadata({
      displayName: 'Webhook',
      triggers: [trigger('catch_webhook', 'Catch Webhook')],
    });
    const catchWebhook: PieceSelectorPieceItem = {
      actionOrTrigger: trigger('catch_webhook', 'Catch Webhook'),
      type: FlowTriggerType.PIECE,
      pieceMetadata: webhook,
    };
    const options: PieceSelectorTriggerOption[] = [
      { id: 'webhook', kind: 'pick', item: catchWebhook },
      { id: 'schedule', kind: 'piece', metadata: webhook },
      { id: 'other', kind: 'list', list: 'other' },
    ];
    const rows = piecePanelUtils.buildRootRows({
      tabs: [tab('custom-1', PieceSelectorTabType.CUSTOM)],
      triggerOptions: options,
      showCatalog: true,
    });
    expect(rows.map((row) => row.key)).toEqual([
      'trigger:webhook',
      'trigger:schedule',
      'trigger:other',
      'separator:custom-groups',
      'group:custom-1',
      'separator:catalog',
      'catalog:browse',
    ]);
    const [pickRow, pieceRow, listRow] = rows;
    expect(rows.slice(0, 3).every(piecePanelUtils.isSelectableRow)).toBe(true);
    expect(piecePanelUtils.opensSubView(pickRow)).toBe(false);
    expect(piecePanelUtils.opensSubView(pieceRow)).toBe(true);
    expect(piecePanelUtils.opensSubView(listRow)).toBe(true);
    expect(
      piecePanelUtils.getTriggerOptionView({
        id: 'other',
        kind: 'list',
        list: 'other',
      }),
    ).toEqual({ kind: 'trigger-list', list: 'other' });
    expect(
      piecePanelUtils.getTriggerOptionView({
        id: 'schedule',
        kind: 'piece',
        metadata: webhook,
      }),
    ).toEqual({ kind: 'piece', metadata: webhook });
  });

  it('ends the root list with the catalog row after a separator when the catalog is available', () => {
    const tabs = [
      ...CATEGORY_TABS,
      tab('custom-1', PieceSelectorTabType.CUSTOM),
    ];
    expect(
      piecePanelUtils
        .buildRootRows({ tabs, showCatalog: true })
        .map((row) => row.key)
        .slice(-4),
    ).toEqual([
      'separator:custom-groups',
      'group:custom-1',
      'separator:catalog',
      'catalog:browse',
    ]);
    expect(
      piecePanelUtils
        .buildRootRows({ tabs, showCatalog: false })
        .some((row) => row.kind === 'browse-catalog'),
    ).toBe(false);
    expect(
      piecePanelUtils
        .buildRootRows({ tabs: [], showCatalog: true })
        .map((row) => row.kind),
    ).toEqual(['browse-catalog']);
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

  it('opens every section expanded and collapses one when it is toggled', () => {
    const sections: PieceSelectorSection[] = [
      {
        id: 'popular',
        title: 'Popular',
        entries: [step(codeStep()), step(sheets)],
      },
      { id: 'others', title: 'Others', entries: [step(sheets)] },
    ];
    const expanded = piecePanelUtils.buildCategoryRows({
      sections,
      collapsedTitles: [],
      query: '',
    });
    expect(expanded.map((row) => row.kind)).toEqual([
      'category',
      'item',
      'piece',
      'category',
      'piece',
    ]);
    const collapsed = piecePanelUtils.buildCategoryRows({
      sections,
      collapsedTitles: piecePanelUtils.toggleTitle({
        titles: [],
        title: 'Popular',
      }),
      query: '',
    });
    expect(collapsed.map((row) => row.kind)).toEqual([
      'category',
      'category',
      'piece',
    ]);
    expect(
      piecePanelUtils.toggleTitle({ titles: ['Popular'], title: 'Popular' }),
    ).toEqual([]);
    const searching = piecePanelUtils.buildCategoryRows({
      sections,
      collapsedTitles: ['Popular', 'Others'],
      query: 'sheet',
    });
    expect(searching.filter((row) => row.kind === 'piece')).toHaveLength(2);
    expect(new Set(searching.map((row) => row.key)).size).toBe(
      searching.length,
    );
  });

  it('shows action entries as item rows and hides empty sections while filtering', () => {
    const [insertRow] = piecePanelUtils.getItems(sheets);
    const sections: PieceSelectorSection[] = [
      {
        id: 'ask',
        title: 'Ask a person',
        entries: [{ kind: 'item', item: insertRow }],
      },
      { id: 'list', title: null, entries: [step(sheets)] },
    ];
    const rows = piecePanelUtils.buildCategoryRows({
      sections,
      collapsedTitles: [],
      query: '',
      getLogoUrl: () => 'https://example.test/override.svg',
    });
    expect(rows.map((row) => row.kind)).toEqual(['category', 'item', 'piece']);
    const [, itemRow] = rows;
    expect(itemRow.kind === 'item' && itemRow.logoUrl).toBe(
      'https://example.test/override.svg',
    );
    expect(
      piecePanelUtils
        .buildCategoryRows({ sections, collapsedTitles: [], query: 'find' })
        .map((row) => row.kind),
    ).toEqual(['piece']);
  });

  it('adds the root results that are not already shown under a label', () => {
    const slack = pieceMetadata({
      displayName: 'Slack',
      actions: [
        action('request_approval_message', 'Request Approval'),
        action('send_message', 'Send Message'),
      ],
    });
    const store = pieceMetadata({
      displayName: 'Storage',
      actions: [action('get', 'Get')],
    });
    const [approval] = piecePanelUtils.getItems(slack);
    const shownRows = piecePanelUtils.buildCategoryRows({
      sections: [
        {
          id: 'ask',
          title: 'Ask a person',
          entries: [{ kind: 'item', item: approval }, step(store)],
        },
      ],
      collapsedTitles: [],
      query: '',
    });
    const resultRows = piecePanelUtils.buildSearchResultRows({
      categories: [{ title: 'All', metadata: [slack, store, codeStep()] }],
    });
    const otherRows = piecePanelUtils.buildOtherGroupRows({
      shownRows,
      resultRows,
      label: 'Found in other groups',
    });
    expect(
      otherRows.map((row) =>
        row.kind === 'label'
          ? row.text
          : row.kind === 'item'
          ? piecePanelUtils.getItemInfo(row.item).displayName
          : row.kind === 'piece'
          ? row.metadata.displayName
          : row.kind,
      ),
    ).toEqual(['Found in other groups', 'Slack', 'Send Message', 'Code']);
    expect(
      piecePanelUtils.buildOtherGroupRows({
        shownRows: resultRows,
        resultRows,
        label: 'Found in other groups',
      }),
    ).toEqual([]);
  });

  it('leaves out members of the open category that the query hides', () => {
    const http = pieceMetadata({
      displayName: 'HTTP',
      actions: [action('send_request', 'Send HTTP request')],
    });
    const sections = [
      {
        id: 'popular',
        title: 'Popular',
        entries: [step(http), step(codeStep())],
      },
    ];
    const memberRows = piecePanelUtils.buildCategoryRows({
      sections,
      collapsedTitles: [],
      query: '',
    });
    const resultRows = piecePanelUtils.buildSearchResultRows({
      categories: [{ title: 'All', metadata: [http, codeStep()] }],
    });
    expect(
      piecePanelUtils.buildOtherGroupRows({
        shownRows: memberRows,
        resultRows,
        label: 'Found in other groups',
      }),
    ).toEqual([]);
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

  it('carries the search query into a pushed catalog view', () => {
    const stack = piecePanelUtils.pushView({
      stack: [root],
      view: { kind: 'catalog', initialQuery: 'asana' },
      id: 1,
    });
    expect(stack[1]).toEqual({
      id: 1,
      view: { kind: 'catalog', initialQuery: 'asana' },
      query: 'asana',
    });
  });

  it('pushes only on top of the view that asked for it', () => {
    const catalog: PiecePanelStackEntry = {
      id: 1,
      view: { kind: 'catalog', initialQuery: '' },
      query: '',
    };
    const pieceView = {
      kind: 'piece' as const,
      metadata: pieceMetadata({ displayName: 'Asana' }),
    };
    const pushed = piecePanelUtils.pushView({
      stack: [root, catalog],
      view: pieceView,
      id: 2,
      parentId: 1,
    });
    expect(pushed.map((entry) => entry.view.kind)).toEqual([
      'root',
      'catalog',
      'piece',
    ]);
    const stale = [root];
    expect(
      piecePanelUtils.pushView({
        stack: stale,
        view: pieceView,
        id: 3,
        parentId: 1,
      }),
    ).toBe(stale);
  });

  it('only changes the query of the top view', () => {
    const stack = piecePanelUtils.setTopQuery({
      stack: [root, { id: 1, view: { kind: 'root' }, query: '' }],
      query: 'row',
    });
    expect(stack.map((entry) => entry.query)).toEqual(['sheet', 'row']);
  });
});

describe('piece panel catalog', () => {
  const zendesk = catalogPiece({ displayName: 'Zendesk', triggers: 2 });
  const asana = catalogPiece({
    displayName: 'Asana',
    description: 'Work management for teams',
  });
  const webhookOnly = catalogPiece({
    displayName: 'Hook Relay',
    actions: 0,
    triggers: 1,
  });
  const pieces = [zendesk, webhookOnly, asana];

  it('keeps pieces with actions for a step and pieces with triggers for a trigger, sorted by name', () => {
    expect(
      piecePanelUtils
        .filterCatalogPieces({ pieces, stepKind: 'action', query: '' })
        .map((piece) => piece.displayName),
    ).toEqual(['Asana', 'Zendesk']);
    expect(
      piecePanelUtils
        .filterCatalogPieces({ pieces, stepKind: 'trigger', query: '' })
        .map((piece) => piece.displayName),
    ).toEqual(['Hook Relay', 'Zendesk']);
    expect(pieces.map((piece) => piece.displayName)).toEqual([
      'Zendesk',
      'Hook Relay',
      'Asana',
    ]);
  });

  it('filters the catalog by name and description', () => {
    expect(
      piecePanelUtils
        .filterCatalogPieces({ pieces, stepKind: 'action', query: 'ZEND' })
        .map((piece) => piece.displayName),
    ).toEqual(['Zendesk']);
    expect(
      piecePanelUtils
        .filterCatalogPieces({ pieces, stepKind: 'action', query: 'teams' })
        .map((piece) => piece.displayName),
    ).toEqual(['Asana']);
    expect(
      piecePanelUtils.filterCatalogPieces({
        pieces,
        stepKind: 'action',
        query: 'nothing matches',
      }),
    ).toEqual([]);
  });

  it('builds one row per catalog piece with its download status', () => {
    const rows = piecePanelUtils.buildCatalogRows({
      pieces: [asana, zendesk],
      downloads: { [zendesk.name]: 'failed' },
    });
    expect(rows).toEqual([
      {
        kind: 'catalog-piece',
        key: `catalog:${asana.name}`,
        piece: asana,
        status: 'idle',
      },
      {
        kind: 'catalog-piece',
        key: `catalog:${zendesk.name}`,
        piece: zendesk,
        status: 'failed',
      },
    ]);
  });

  it('tracks downloads per piece without changing the previous state', () => {
    const before = { [zendesk.name]: 'failed' as const };
    const downloading = piecePanelUtils.setCatalogDownloadStatus({
      downloads: before,
      pieceName: asana.name,
      status: 'downloading',
    });
    expect(downloading).toEqual({
      [zendesk.name]: 'failed',
      [asana.name]: 'downloading',
    });
    expect(before).toEqual({ [zendesk.name]: 'failed' });
    expect(
      piecePanelUtils.isCatalogDownloadPending({
        downloads: downloading,
        pieceName: asana.name,
      }),
    ).toBe(true);
    expect(
      piecePanelUtils.isCatalogDownloadPending({
        downloads: downloading,
        pieceName: zendesk.name,
      }),
    ).toBe(false);
    expect(
      piecePanelUtils.setCatalogDownloadStatus({
        downloads: downloading,
        pieceName: asana.name,
        status: 'idle',
      }),
    ).toEqual({ [zendesk.name]: 'failed' });
  });

  it('turns a downloaded piece into the metadata its sub-view lists', () => {
    const model = pieceModel({
      actions: [action('create_task', 'Create Task')],
      triggers: [trigger('new_task', 'New Task')],
    });
    const forAction = piecePanelUtils.toPieceStepMetadata({
      piece: model,
      stepKind: 'action',
    });
    expect(forAction).toMatchObject({
      type: FlowActionType.PIECE,
      pieceName: model.name,
      pieceVersion: model.version,
      displayName: model.displayName,
    });
    expect(
      piecePanelUtils
        .getItems(forAction)
        .map((item) => piecePanelUtils.getItemInfo(item).displayName),
    ).toEqual(['Create Task']);
    const forTrigger = piecePanelUtils.toPieceStepMetadata({
      piece: model,
      stepKind: 'trigger',
    });
    expect(forTrigger.type).toBe(FlowTriggerType.PIECE);
    expect(
      piecePanelUtils
        .getItems(forTrigger)
        .map((item) => piecePanelUtils.getItemInfo(item).displayName),
    ).toEqual(['New Task']);
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

function step(
  metadata: StepMetadataWithSuggestions,
): PieceSelectorSectionEntry {
  return { kind: 'step', metadata };
}

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

const CATEGORY_TABS = [
  tab('AI_AND_AGENTS', PieceSelectorTabType.AI_AND_AGENTS),
  tab('APPS', PieceSelectorTabType.APPS),
  tab('DATA_TRANSFORMATION', PieceSelectorTabType.DATA_TRANSFORMATION),
  tab('FLOW_CONTROL', PieceSelectorTabType.FLOW_CONTROL),
  tab('UTILITY', PieceSelectorTabType.UTILITY),
  tab('APPROVALS', PieceSelectorTabType.APPROVALS),
];

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

function catalogPiece({
  displayName,
  description = `${displayName} description`,
  actions = 3,
  triggers = 0,
}: {
  displayName: string;
  description?: string;
  actions?: number;
  triggers?: number;
}): PieceMetadataModelSummary {
  return {
    name: `@activepieces/piece-${displayName.toLowerCase().replace(' ', '-')}`,
    displayName,
    description,
    logoUrl: `https://example.test/${displayName}.svg`,
    version: '0.1.0',
    authors: [],
    categories: [],
    actions,
    triggers,
    contextInfo: undefined,
    projectUsage: 0,
    pieceType: PieceType.OFFICIAL,
    packageType: PackageType.REGISTRY,
  };
}

function pieceModel({
  actions,
  triggers,
}: {
  actions: ActionBase[];
  triggers: TriggerBase[];
}): PieceMetadataModel {
  return {
    name: '@activepieces/piece-asana',
    displayName: 'Asana',
    description: 'Work management for teams',
    logoUrl: 'https://example.test/asana.svg',
    version: '0.4.2',
    authors: [],
    categories: [],
    actions: Object.fromEntries(actions.map((item) => [item.name, item])),
    triggers: Object.fromEntries(triggers.map((item) => [item.name, item])),
    contextInfo: undefined,
    projectUsage: 0,
    pieceType: PieceType.OFFICIAL,
    packageType: PackageType.REGISTRY,
  };
}
