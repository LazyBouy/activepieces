/// <reference types="vitest/globals" />

import { join } from 'node:path';
import { vendorTestUtils } from '../../common/test/vendor-test-utils';
import { localai } from '../src';
import { askLocalAi } from '../src/lib/actions/ask-localai';

const { mockServer, contextOf, answerOf, resumeWith, startedRequest } = vendorTestUtils;

afterEach(() => {
  vi.restoreAllMocks();
});

vendorTestUtils.describePiece({
  piece: localai,
  folder: join(__dirname, '..'),
  packageName: '@iphi-flow/piece-opencode-localai',
  displayName: 'LocalAI (via OpenCode)',
  actions: [{ name: 'ask_localai', displayName: 'Ask LocalAI', props: ['model', 'prompt', 'temperature', 'maxTokens', 'topP', 'frequencyPenalty', 'presencePenalty', 'roles'] }],
});

describe('LocalAI (via OpenCode) actions', () => {
  test('Ask LocalAI sends the official default sampling settings to the localai provider and returns the trimmed reply', async () => {
    const requests = mockServer({});
    const { context } = contextOf({ propsValue: { model: 'llama-3', prompt: 'Hi' } });
    await askLocalAi.run(context);
    expect(startedRequest({ requests })).toMatchObject({
      vendor: 'LocalAI',
      provider: 'localai',
      options: { temperature: 0.9, maxOutputTokens: 2048, topP: 1, frequencyPenalty: 0, presencePenalty: 0.6 },
    });

    const done = contextOf({ propsValue: { model: 'llama-3', prompt: 'Hi' }, resumePayload: resumeWith({ output: answerOf({ answer: '  Hello  ' }) }) });
    expect(await askLocalAi.run(done.context)).toBe('Hello');
  });
});
