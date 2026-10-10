import { describe, expect, it } from 'vitest';

import { AutomationsFilters } from '@/features/automations/lib/types';
import {
  countActiveCriteria,
  countActiveFilters,
  parseAutomationsSort,
  summarizeSelection,
} from '@/features/automations/lib/utils';

function filters(
  overrides: Partial<AutomationsFilters> = {},
): AutomationsFilters {
  return {
    searchTerm: '',
    typeFilter: [],
    statusFilter: [],
    connectionFilter: [],
    ownerFilter: [],
    folderFilter: [],
    ...overrides,
  };
}

describe('countActiveFilters', () => {
  it('is zero when nothing is filtered', () => {
    expect(countActiveFilters(filters())).toBe(0);
  });

  it('counts each filter category once, whatever the number of values', () => {
    expect(
      countActiveFilters(
        filters({ typeFilter: ['flow', 'table'], ownerFilter: ['user-1'] }),
      ),
    ).toBe(2);
  });

  it('counts all five categories', () => {
    expect(
      countActiveFilters(
        filters({
          typeFilter: ['flow'],
          statusFilter: ['ENABLED'],
          connectionFilter: ['slack'],
          ownerFilter: ['user-1'],
          folderFilter: ['folder-1'],
        }),
      ),
    ).toBe(5);
  });

  it('ignores the search term', () => {
    expect(countActiveFilters(filters({ searchTerm: 'invoice' }))).toBe(0);
  });
});

describe('countActiveCriteria', () => {
  it('adds the search term to the filter count', () => {
    expect(
      countActiveCriteria(
        filters({ searchTerm: 'invoice', statusFilter: ['DISABLED'] }),
      ),
    ).toBe(2);
  });

  it('does not count a whitespace-only search', () => {
    expect(countActiveCriteria(filters({ searchTerm: '   ' }))).toBe(0);
  });

  it('counts a search on its own', () => {
    expect(countActiveCriteria(filters({ searchTerm: 'a' }))).toBe(1);
  });
});

describe('parseAutomationsSort', () => {
  it('keeps the two name sorts', () => {
    expect(parseAutomationsSort('name-asc')).toBe('name-asc');
    expect(parseAutomationsSort('name-desc')).toBe('name-desc');
  });

  it('falls back to the default sort for anything else', () => {
    expect(parseAutomationsSort('default')).toBe('default');
    expect(parseAutomationsSort(null)).toBe('default');
    expect(parseAutomationsSort('updated')).toBe('default');
  });
});

describe('summarizeSelection', () => {
  const options = [
    { value: 'flow', label: 'Flows' },
    { value: 'table', label: 'Tables' },
  ];

  it('reports nothing when no value is selected', () => {
    expect(summarizeSelection({ selectedValues: [], options })).toEqual({
      kind: 'none',
    });
  });

  it('uses the option label for a single value', () => {
    expect(summarizeSelection({ selectedValues: ['table'], options })).toEqual({
      kind: 'single',
      label: 'Tables',
    });
  });

  it('falls back to the raw value when the option is unknown', () => {
    expect(summarizeSelection({ selectedValues: ['agent'], options })).toEqual({
      kind: 'single',
      label: 'agent',
    });
  });

  it('reports a count for several values', () => {
    expect(
      summarizeSelection({ selectedValues: ['flow', 'table'], options }),
    ).toEqual({ kind: 'multiple', count: 2 });
  });
});
