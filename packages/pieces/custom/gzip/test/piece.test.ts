/// <reference types="vitest/globals" />

import { PieceCategory } from '@activepieces/pieces-framework';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzip } from '../src';
import { displayStrings } from './display-strings';

const metadata = gzip.metadata();
const translation: Record<string, string> = JSON.parse(
  readFileSync(join(__dirname, '..', 'src', 'i18n', 'translation.json'), 'utf8'),
);

describe('Gzip piece', () => {
  test('has the specified name, description, category and no connection', () => {
    expect(metadata.displayName).toBe('Gzip');
    expect(metadata.description).toBe('Compress and decompress files with gzip');
    expect(metadata.categories).toEqual([PieceCategory.CORE]);
    expect(metadata.authors).toEqual(['LazyBouy']);
    expect(metadata.auth).toBeUndefined();
    expect(Object.keys(gzip.triggers())).toEqual([]);
  });

  test('uses a drawn SVG logo embedded as a data URI', () => {
    expect(metadata.logoUrl.startsWith('data:image/svg+xml;base64,')).toBe(true);
    const svg = Buffer.from(metadata.logoUrl.split(',')[1], 'base64').toString('utf8');
    expect(svg).toContain('<svg');
    expect(svg).toContain('rx="14"');
  });

  test('lists Compress File and Decompress File with the specified properties', () => {
    expect(Object.keys(metadata.actions)).toEqual(['compress_file', 'decompress_file']);
    expect(Object.values(metadata.actions).map((action) => action.displayName)).toEqual(['Compress File', 'Decompress File']);
    const compress = metadata.actions['compress_file'];
    expect(Object.values(compress.props).map((property) => property.displayName)).toEqual([
      'File',
      'File name',
      'Compression level',
    ]);
    expect(compress.props['compression_level'].defaultValue).toBe('balanced');
    expect(Object.values(metadata.actions['decompress_file'].props).map((property) => property.displayName)).toEqual([
      'File',
      'File name',
    ]);
  });

  test('every action declares audience, classification, AI metadata and an output schema', () => {
    Object.values(metadata.actions).forEach((action) => {
      expect(action.audience, action.name).toBe('both');
      expect(action.classification, action.name).toBe('READ');
      expect(action.aiMetadata?.description?.length ?? 0, action.name).toBeGreaterThan(40);
      expect(action.aiMetadata?.idempotent, action.name).toBe(true);
      expect(action.outputSchema?.fields.length ?? 0, action.name).toBeGreaterThan(0);
    });
  });

  test('the translation file maps every display string to itself', () => {
    const strings = displayStrings.collectDisplayStrings();
    const missing = strings.filter((text) => translation[text] !== text);
    expect(missing).toEqual([]);
    expect(Object.entries(translation).filter(([key, value]) => key !== value)).toEqual([]);
    expect(Object.keys(translation).filter((key) => !strings.includes(key))).toEqual([]);
  });
});
