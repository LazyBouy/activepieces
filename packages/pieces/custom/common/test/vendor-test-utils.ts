/// <reference types="vitest/globals" />

import { httpClient, HttpMessageBody, HttpRequest, HttpResponse } from '@activepieces/pieces-common';
import { createMockActionContext, Piece, PieceCategory, pieceTranslation, ResumePayload } from '@activepieces/pieces-framework';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function mockServer({ providers = [], output }: MockServerParams): HttpRequest[] {
  const requests: HttpRequest[] = [];
  vi.spyOn(httpClient, 'sendRequest').mockImplementation(async <T extends HttpMessageBody>(request: HttpRequest): Promise<HttpResponse<T>> => {
    requests.push(request);
    const body = request.url.endsWith('v1/opencode/steps/models') ? { providers } : { requestId: 'req_1', ...(output === undefined ? {} : { output }) };
    return { status: 200, headers: {}, body: body as T };
  });
  return requests;
}

function contextOf({ propsValue, resumePayload, canPause = true, stored = {} }: ContextParams) {
  const store = new Map<string, unknown>(Object.entries(stored));
  const waited: string[] = [];
  const uploads: string[] = [];
  const base = createMockActionContext({ propsValue, resumePayload, canPause, onWaitForWaitpoint: (id) => waited.push(id) });
  const context = {
    ...base,
    store: {
      put: async <T>(key: string, value: T) => {
        store.set(key, value);
        return value;
      },
      get: async <T>(key: string) => (store.get(key) ?? null) as T | null,
      delete: async (key: string) => {
        store.delete(key);
      },
    },
    files: {
      ...base.files,
      upload: async ({ fileName }: { fileName: string }) => {
        uploads.push(fileName);
        return { id: `file_${uploads.length}`, url: `http://files/${fileName}` };
      },
    },
  };
  return { context, store, waited, uploads };
}

function answerOf(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    answer: 'The answer',
    reasoning: '',
    sources: [],
    finish: 'stop',
    messageId: 'msg_reply',
    sessionId: 'ses_1',
    adminPanelUrl: 'http://opencode/session/ses_1',
    model: { providerID: 'vendor', modelID: 'model-1' },
    usage: { input: 10, output: 4, reasoning: 2, cost: 0.001 },
    ...overrides,
  };
}

function resumeWith({ output }: { output: Record<string, unknown> }): ResumePayload {
  return { body: { output }, headers: {}, queryParams: {} };
}

function startedRequest({ requests }: { requests: HttpRequest[] }): Record<string, unknown> {
  const started = requests.find((request) => request.url.endsWith('v1/opencode/steps'));
  const body = started?.body;
  if (typeof body !== 'object' || body === null || !('request' in body)) {
    throw new Error('no step was started');
  }
  const request = body.request;
  return typeof request === 'object' && request !== null ? Object.fromEntries(Object.entries(request)) : {};
}

function describePiece({ piece, folder, packageName, displayName, actions }: DescribePieceParams): void {
  const metadata = piece.metadata();
  describe(`${displayName} piece`, () => {
    test('has the specified name, version, category and no connection', () => {
      const packageJson = JSON.parse(readFileSync(join(folder, 'package.json'), 'utf8'));
      expect(packageJson.name).toBe(packageName);
      expect(packageJson.version).toBe('0.1.0');
      expect(metadata.displayName).toBe(displayName);
      expect(metadata.categories).toEqual([PieceCategory.ARTIFICIAL_INTELLIGENCE]);
      expect(metadata.auth).toBeUndefined();
      expect(Object.keys(piece.triggers())).toEqual([]);
    });

    test('offers the official chat and text actions with their inputs', () => {
      expect(Object.keys(metadata.actions)).toEqual(actions.map((action) => action.name));
      actions.forEach((action) => {
        expect(metadata.actions[action.name].displayName, action.name).toBe(action.displayName);
        expect(Object.keys(metadata.actions[action.name].props), action.name).toEqual(action.props);
        expect(metadata.actions[action.name].aiMetadata?.description?.length ?? 0, action.name).toBeGreaterThan(80);
      });
    });

    test('the translation file maps every display string to itself', () => {
      const translation: Record<string, string> = JSON.parse(readFileSync(join(folder, 'src', 'i18n', 'translation.json'), 'utf8'));
      const strings = displayStringsOf({ metadata });
      expect(strings.filter((text) => translation[text] !== text)).toEqual([]);
      expect(Object.keys(translation).filter((key) => !strings.includes(key))).toEqual([]);
    });
  });
}

function displayStringsOf({ metadata }: { metadata: unknown }): string[] {
  const name = typeof metadata === 'object' && metadata !== null && 'displayName' in metadata && typeof metadata.displayName === 'string' ? metadata.displayName : '';
  const fromPaths = pieceTranslation.pathsToValuesToTranslate.flatMap((path) => collect({ value: metadata, keys: path.split('.') }));
  return [...new Set([name, ...fromPaths])].filter((text) => text !== '');
}

function collect({ value, keys }: { value: unknown; keys: string[] }): string[] {
  if (keys.length === 0) {
    return typeof value === 'string' ? [value] : [];
  }
  if (typeof value !== 'object' || value === null) {
    return [];
  }
  const [head, ...rest] = keys;
  if (head === '*') {
    return Object.values(value).flatMap((child) => collect({ value: child, keys: rest }));
  }
  return collect({ value: Object.getOwnPropertyDescriptor(value, head)?.value, keys: rest });
}

export const vendorTestUtils = {
  mockServer,
  contextOf,
  answerOf,
  resumeWith,
  startedRequest,
  describePiece,
  displayStringsOf,
};

type DescribePieceParams = {
  piece: Piece;
  folder: string;
  packageName: string;
  displayName: string;
  actions: { name: string; displayName: string; props: string[] }[];
};

type MockServerParams = {
  providers?: { id: string; name: string; models: { id: string; name: string }[] }[];
  output?: Record<string, unknown>;
};

type ContextParams = {
  propsValue: Record<string, unknown>;
  resumePayload?: ResumePayload;
  canPause?: boolean;
  stored?: Record<string, unknown>;
};
