/// <reference types="vitest/globals" />

import { PieceCategory } from '@activepieces/pieces-framework';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { opencode } from '../src';
import { displayStrings } from './display-strings';

const metadata = opencode.metadata();
const translation: Record<string, string> = JSON.parse(
  readFileSync(join(__dirname, '..', 'src', 'i18n', 'translation.json'), 'utf8'),
);

describe('OpenCode piece', () => {
  test('has the specified name, version, category and no connection', () => {
    const packageJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));
    expect(packageJson.name).toBe('@iphi-flow/piece-opencode');
    expect(packageJson.version).toBe('0.1.0');
    expect(metadata.displayName).toBe('OpenCode');
    expect(metadata.categories).toEqual([PieceCategory.ARTIFICIAL_INTELLIGENCE]);
    expect(metadata.auth).toBeUndefined();
    expect(Object.keys(opencode.triggers())).toEqual([]);
  });

  test('lists the actions in the specified order', () => {
    expect(Object.values(metadata.actions).map((action) => action.displayName)).toEqual([
      'Run an Agent',
      'Run a Command',
      'Send to Project Inbox',
      'Continue a Session',
    ]);
    expect(Object.keys(metadata.actions)).toEqual(['run_agent', 'run_command', 'send_to_inbox', 'continue_session']);
  });

  test('every action declares audience, classification, AI metadata and an output schema', () => {
    Object.values(metadata.actions).forEach((action) => {
      expect(action.audience, action.name).toBe('both');
      expect(action.classification, action.name).toBe('WRITE');
      expect(action.aiMetadata?.description?.length ?? 0, action.name).toBeGreaterThan(80);
      expect(action.aiMetadata?.idempotent, action.name).toBe(false);
      expect(action.outputSchema?.fields.length ?? 0, action.name).toBeGreaterThan(0);
    });
  });

  test('each action has the specified fields', () => {
    expect(Object.keys(metadata.actions['run_agent'].props)).toEqual(['namespace', 'project', 'agent', 'prompt', 'files', 'outputSchema', 'model', 'session', 'sessionId']);
    expect(Object.keys(metadata.actions['run_command'].props)).toEqual(['namespace', 'project', 'agent', 'command', 'arguments', 'session', 'sessionId']);
    expect(Object.keys(metadata.actions['send_to_inbox'].props)).toEqual(['project', 'message', 'to', 'recipient', 'wait', 'timeoutMinutes']);
    expect(Object.keys(metadata.actions['continue_session'].props)).toEqual(['sessionId', 'prompt', 'files', 'outputSchema']);
  });

  test('uses a drawn SVG logo embedded as a data URI', () => {
    expect(metadata.logoUrl.startsWith('data:image/svg+xml;base64,')).toBe(true);
    const svg = Buffer.from(metadata.logoUrl.split(',')[1], 'base64').toString('utf8');
    expect(svg).toContain('<svg');
    expect(svg).toContain('rx="14"');
  });

  test('the translation file maps every display string to itself', () => {
    const strings = displayStrings.collectDisplayStrings();
    const missing = strings.filter((text) => translation[text] !== text);
    expect(missing).toEqual([]);
    expect(Object.entries(translation).filter(([key, value]) => key !== value)).toEqual([]);
    expect(Object.keys(translation).filter((key) => !strings.includes(key))).toEqual([]);
  });
});
