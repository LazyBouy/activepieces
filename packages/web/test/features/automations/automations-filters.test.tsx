/**
 * @vitest-environment jsdom
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const embed = vi.hoisted(() => ({
  state: { hideTables: false, isEmbedded: false, hideFolders: false },
}));

vi.mock('i18next', () => ({
  t: (key: string, params?: Record<string, unknown>) =>
    params ? `${key}|${JSON.stringify(params)}` : key,
}));
vi.mock('@/components/providers/embed-provider', () => ({
  useEmbedding: () => ({ embedState: embed.state }),
}));
vi.mock('@/features/automations/hooks/use-owner-options', () => ({
  useOwnerOptions: () => [{ value: 'user-1', label: 'Ada Lovelace' }],
}));

import { AutomationsFilters } from '@/features/automations/components/automations-filters';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

Element.prototype.scrollIntoView = () => undefined;
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let container: HTMLDivElement | undefined;

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = undefined;
  container = undefined;
  embed.state = { hideTables: false, isEmbedded: false, hideFolders: false };
  document.body.innerHTML = '';
});

describe('AutomationsFilters', () => {
  it('puts the select-all checkbox first and reflects partial selection', () => {
    const onToggleAllSelection = vi.fn();
    render({ selectedCount: 1, selectableCount: 3, onToggleAllSelection });

    const first =
      document.querySelector<HTMLButtonElement>('[role="checkbox"]');
    expect(first?.getAttribute('data-state')).toBe('indeterminate');
    const label = document.querySelector(
      `label[for="${first?.getAttribute('id')}"]`,
    );
    expect(label?.textContent).toBe('Select all');

    act(() => {
      first?.click();
    });
    expect(onToggleAllSelection).toHaveBeenCalledTimes(1);
  });

  it('checks select-all when every item is selected', () => {
    render({ selectedCount: 3, selectableCount: 3 });
    expect(
      document.querySelector('[role="checkbox"]')?.getAttribute('data-state'),
    ).toBe('checked');
  });

  it('shows the chosen sort option in the sort trigger', () => {
    render({ sort: 'name-desc' });
    const trigger = document.querySelector('[data-slot="select-trigger"]');
    expect(trigger?.textContent).toContain('Sort by name Z to A');
  });

  it('shows no count pill and no summary line when nothing is filtered', () => {
    render({});
    expect(document.querySelector('[data-slot="filter-count"]')).toBeNull();
    expect(document.body.textContent).not.toContain('filtersActiveCount');
  });

  it('counts active filter categories on the filter button', () => {
    render({ typeFilter: ['flow', 'table'], statusFilter: ['ENABLED'] });
    const button = document.querySelector('button[aria-label="Filters"]');
    expect(
      button?.querySelector('[data-slot="filter-count"]')?.textContent,
    ).toBe('2');
  });

  it('includes the search in the active-filters line and clears everything', () => {
    const onClearAllFilters = vi.fn();
    const onFilterChange = vi.fn();
    render({
      searchTerm: 'invoice',
      ownerFilter: ['user-1'],
      onClearAllFilters,
      onFilterChange,
    });

    expect(document.body.textContent).toContain(
      'filtersActiveCount|{"count":2}',
    );
    const clearButton = [...document.querySelectorAll('button')].find(
      (button) => button.textContent === 'Clear all',
    );
    act(() => {
      clearButton?.click();
    });
    expect(onClearAllFilters).toHaveBeenCalledTimes(1);
    expect(onFilterChange).toHaveBeenCalledTimes(1);
  });

  it('opens a popover holding every filter with a summary of its values', () => {
    render({
      typeFilter: ['table'],
      statusFilter: ['ENABLED', 'DISABLED'],
      folders: [folder({ id: 'folder-1', displayName: 'Finance' })],
    });
    openFilters();

    const popover = document.querySelector('[data-slot="popover-content"]');
    const labels = [...(popover?.querySelectorAll('label') ?? [])].map(
      (label) => label.textContent,
    );
    expect(labels).toEqual([
      'Type',
      'Status',
      'Connections',
      'Owner',
      'Folder',
    ]);
    const triggers = [
      ...(popover?.querySelectorAll('button[data-size="sm"]') ?? []),
    ].map((button) => button.textContent);
    expect(triggers).toEqual([
      'Tables',
      '{count} selected|{"count":2}',
      'All',
      'All',
      'All',
    ]);
    expect(
      [...(popover?.querySelectorAll('button') ?? [])].some(
        (button) => button.textContent === 'Clear all',
      ),
    ).toBe(true);
  });

  it('hides the owner filter when embedded and the folder filter without folders', () => {
    embed.state = { hideTables: false, isEmbedded: true, hideFolders: false };
    render({});
    openFilters();

    const labels = [
      ...(document.querySelectorAll('[data-slot="popover-content"] label') ??
        []),
    ].map((label) => label.textContent);
    expect(labels).toEqual(['Type', 'Status', 'Connections']);
    expect(
      [
        ...document.querySelectorAll('[data-slot="popover-content"] button'),
      ].some((button) => button.textContent === 'Clear all'),
    ).toBe(false);
  });
});

function openFilters() {
  const button = document.querySelector<HTMLButtonElement>(
    'button[aria-label="Filters"]',
  );
  act(() => {
    button?.click();
  });
}

function folder({ id, displayName }: { id: string; displayName: string }) {
  return {
    id,
    displayName,
    created: '2026-01-01T00:00:00.000Z',
    updated: '2026-01-01T00:00:00.000Z',
    projectId: 'project-1',
    displayOrder: 0,
    externalId: null,
    numberOfFlows: 0,
    numberOfTables: 0,
  };
}

function render(overrides: Partial<Props>) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const props: Props = {
    searchTerm: '',
    onSearchChange: vi.fn(),
    typeFilter: [],
    onTypeFilterChange: vi.fn(),
    statusFilter: [],
    onStatusFilterChange: vi.fn(),
    connectionFilter: [],
    onConnectionFilterChange: vi.fn(),
    ownerFilter: [],
    onOwnerFilterChange: vi.fn(),
    folderFilter: [],
    onFolderFilterChange: vi.fn(),
    onFilterChange: vi.fn(),
    folders: [],
    connections: [],
    pieces: [],
    agentsVisible: false,
    onClearAllFilters: vi.fn(),
    sort: 'default',
    onSortChange: vi.fn(),
    selectedCount: 0,
    selectableCount: 0,
    onToggleAllSelection: vi.fn(),
    ...overrides,
  };
  act(() => {
    root?.render(<AutomationsFilters {...props} />);
  });
}

type Props = React.ComponentProps<typeof AutomationsFilters>;
