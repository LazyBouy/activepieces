/// <reference types="vitest/globals" />

import { PieceCategory, PropertyType } from '@activepieces/pieces-framework';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { jsonWebTokens } from '../src';
import { jsonWebTokensAuth } from '../src/lib/auth';
import { displayStrings } from './display-strings';

const metadata = jsonWebTokens.metadata();
const translation: Record<string, string> = JSON.parse(
  readFileSync(join(__dirname, '..', 'src', 'i18n', 'translation.json'), 'utf8'),
);

describe('JSON Web Tokens piece', () => {
  test('has the specified name, description, category and a custom connection', () => {
    expect(metadata.displayName).toBe('JSON Web Tokens');
    expect(metadata.description).toBe('Create, check and read signed JSON Web Tokens');
    expect(metadata.categories).toEqual([PieceCategory.CORE]);
    expect(metadata.authors).toEqual(['LazyBouy']);
    expect(Object.keys(jsonWebTokens.triggers())).toEqual([]);
    expect(jsonWebTokensAuth.type).toBe(PropertyType.CUSTOM_AUTH);
    expect(Object.keys(jsonWebTokensAuth.props)).toEqual(['key_type', 'secret', 'private_key', 'public_key', 'algorithm']);
  });

  test('the connection fields have the specified types and defaults', () => {
    const { key_type, secret, private_key, public_key, algorithm } = jsonWebTokensAuth.props;
    expect(key_type.displayName).toBe('Key type');
    expect(key_type.defaultValue).toBe('secret');
    expect(key_type.options.options.map((option) => option.label)).toEqual(['Shared secret', 'Key pair']);
    expect(secret.type).toBe(PropertyType.SECRET_TEXT);
    expect(private_key.type).toBe(PropertyType.SECRET_TEXT);
    expect(public_key.type).toBe(PropertyType.LONG_TEXT);
    expect(algorithm.required).toBe(false);
    expect(algorithm.options.options.map((option) => option.value)).toEqual([
      'HS256',
      'HS384',
      'HS512',
      'RS256',
      'RS384',
      'RS512',
      'PS256',
      'PS384',
      'PS512',
      'ES256',
      'ES384',
      'ES512',
    ]);
    expect(JSON.stringify(algorithm.options).toLowerCase()).not.toContain('none');
  });

  test('uses a drawn SVG logo embedded as a data URI', () => {
    expect(metadata.logoUrl.startsWith('data:image/svg+xml;base64,')).toBe(true);
    const svg = Buffer.from(metadata.logoUrl.split(',')[1], 'base64').toString('utf8');
    expect(svg).toContain('<svg');
    expect(svg).toContain('rx="14"');
  });

  test('lists the actions in the specified order', () => {
    expect(Object.values(metadata.actions).map((action) => action.displayName)).toEqual([
      'Create Token',
      'Verify Token',
      'Read Token',
    ]);
    expect(Object.keys(metadata.actions)).toEqual(['create_token', 'verify_token', 'read_token']);
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

  test('only Read Token works without a connection, and it says the result is not verified', () => {
    expect(jsonWebTokens.getAction('create_token')?.requireAuth).toBe(true);
    expect(jsonWebTokens.getAction('verify_token')?.requireAuth).toBe(true);
    expect(jsonWebTokens.getAction('read_token')?.requireAuth).toBe(false);
    expect(jsonWebTokens.getAction('read_token')?.description).toContain('not verified');
  });

  test('the translation file maps every display string to itself', () => {
    const strings = displayStrings.collectDisplayStrings();
    const missing = strings.filter((text) => translation[text] !== text);
    expect(missing).toEqual([]);
    expect(Object.entries(translation).filter(([key, value]) => key !== value)).toEqual([]);
    expect(Object.keys(translation).filter((key) => !strings.includes(key))).toEqual([]);
  });
});
