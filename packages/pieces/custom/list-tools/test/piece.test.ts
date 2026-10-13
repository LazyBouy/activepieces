/// <reference types="vitest/globals" />

import { PieceCategory } from '@activepieces/pieces-framework';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { listTools } from '../src';
import { displayStrings } from './display-strings';

const metadata = listTools.metadata();
const translation: Record<string, string> = JSON.parse(
  readFileSync(join(__dirname, '..', 'src', 'i18n', 'translation.json'), 'utf8'),
);

describe('List Tools piece', () => {
  test('has the specified name, description, category and no connection', () => {
    expect(metadata.displayName).toBe('List Tools');
    expect(metadata.description).toBe('Filter, sort, de-duplicate, reshape and combine lists of items');
    expect(metadata.categories).toEqual([PieceCategory.CORE]);
    expect(metadata.auth).toBeUndefined();
    expect(Object.keys(listTools.triggers())).toEqual([]);
  });

  test('uses a drawn SVG logo embedded as a data URI', () => {
    expect(metadata.logoUrl.startsWith('data:image/svg+xml;base64,')).toBe(true);
    const svg = Buffer.from(metadata.logoUrl.split(',')[1], 'base64').toString('utf8');
    expect(svg).toContain('<svg');
    expect(svg).toContain('rx="14"');
  });

  test('lists the actions in the specified order', () => {
    expect(Object.values(metadata.actions).map((action) => action.displayName)).toEqual([
      'Filter List',
      'Sort List',
      'Limit List',
      'Remove Duplicates',
      'Keep New Items',
      'Forget Seen Items',
      'Expand Nested List',
      'Collect Values',
      'Group and Summarize',
      'Compare Lists',
      'Combine Lists',
      'Rename Fields',
      'Set Fields',
    ]);
    expect(Object.keys(metadata.actions)).toEqual([
      'filter_list',
      'sort_list',
      'limit_list',
      'remove_duplicates',
      'keep_new_items',
      'forget_seen_items',
      'expand_nested_list',
      'collect_values',
      'group_and_summarize',
      'compare_lists',
      'combine_lists',
      'rename_fields',
      'set_fields',
    ]);
  });

  test('every action declares audience, classification, AI metadata and an output schema', () => {
    Object.values(metadata.actions).forEach((action) => {
      expect(action.audience, action.name).toBeDefined();
      expect(action.classification, action.name).toBeDefined();
      expect(action.aiMetadata?.description?.length ?? 0, action.name).toBeGreaterThan(40);
      expect(typeof action.aiMetadata?.idempotent, action.name).toBe('boolean');
      expect(action.outputSchema?.fields.length ?? 0, action.name).toBeGreaterThan(0);
    });
    expect(listTools.getAction('keep_new_items')?.classification).toBe('WRITE');
    expect(listTools.getAction('forget_seen_items')?.classification).toBe('DESTRUCTIVE');
    expect(listTools.getAction('filter_list')?.classification).toBe('READ');
  });

  test('the translation file maps every display string to itself', async () => {
    const strings = await displayStrings.collectDisplayStrings();
    const missing = strings.filter((text) => translation[text] !== text);
    expect(missing).toEqual([]);
    expect(Object.entries(translation).filter(([key, value]) => key !== value)).toEqual([]);
    expect(Object.keys(translation).filter((key) => !strings.includes(key))).toEqual([]);
  });
});
