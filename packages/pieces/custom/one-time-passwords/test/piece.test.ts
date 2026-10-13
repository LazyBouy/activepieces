/// <reference types="vitest/globals" />

import { PieceCategory, PropertyType } from '@activepieces/pieces-framework';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { oneTimePasswords } from '../src';
import { oneTimePasswordsAuth } from '../src/lib/auth';
import { displayStrings } from './display-strings';
import { testUtils } from './test-utils';

const metadata = oneTimePasswords.metadata();
const translation: Record<string, string> = JSON.parse(
  readFileSync(join(__dirname, '..', 'src', 'i18n', 'translation.json'), 'utf8'),
);

describe('One-Time Passwords piece', () => {
  test('has the specified name, description, category and a secret connection', () => {
    expect(metadata.displayName).toBe('One-Time Passwords');
    expect(metadata.description).toBe('Generate time-based one-time codes (TOTP)');
    expect(metadata.categories).toEqual([PieceCategory.CORE]);
    expect(metadata.authors).toEqual(['LazyBouy']);
    expect(Object.keys(oneTimePasswords.triggers())).toEqual([]);
    expect(oneTimePasswordsAuth.type).toBe(PropertyType.SECRET_TEXT);
    expect(oneTimePasswordsAuth.displayName).toBe('Secret');
  });

  test('uses a drawn SVG logo embedded as a data URI', () => {
    expect(metadata.logoUrl.startsWith('data:image/svg+xml;base64,')).toBe(true);
    const svg = Buffer.from(metadata.logoUrl.split(',')[1], 'base64').toString('utf8');
    expect(svg).toContain('<svg');
    expect(svg).toContain('rx="14"');
  });

  test('has one action, Generate Code, with the specified options', () => {
    expect(Object.keys(metadata.actions)).toEqual(['generate_code']);
    const action = metadata.actions['generate_code'];
    expect(action.displayName).toBe('Generate Code');
    expect(Object.values(action.props).map((property) => property.displayName)).toEqual([
      'Algorithm',
      'Digits',
      'Period (seconds)',
    ]);
    expect(action.props['algorithm'].defaultValue).toBe('SHA1');
    expect(action.props['digits'].defaultValue).toBe(6);
    expect(action.props['period'].defaultValue).toBe(30);
  });

  test('the action declares audience, classification, AI metadata and an output schema', () => {
    const action = metadata.actions['generate_code'];
    expect(action.audience).toBe('both');
    expect(action.classification).toBe('READ');
    expect(action.aiMetadata?.description?.length ?? 0).toBeGreaterThan(40);
    expect(action.aiMetadata?.idempotent).toBe(true);
    expect(action.outputSchema?.fields.map((field) => field.key)).toEqual(['code', 'secondsRemaining', 'validUntil']);
  });

  test('the connection is checked by decoding the secret', async () => {
    expect(await testUtils.validate('JBSW Y3DP EHPK 3PXP')).toEqual({ valid: true });
    expect(await testUtils.validate('jbswy3dpehpk3pxp')).toEqual({ valid: true });
    expect(await testUtils.validate('not a secret 1')).toEqual({
      valid: false,
      error: 'The secret is not valid base32. Copy the key shown when two-step sign-in is set up; it uses only the letters A to Z and the digits 2 to 7.',
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
