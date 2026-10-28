/// <reference types="vitest/globals" />

import { join } from 'node:path';
import { vendorTestUtils } from '../../common/test/vendor-test-utils';
import { perplexityAi } from '../src';
import { askAi } from '../src/lib/actions/ask-ai';

const { mockServer, contextOf, answerOf, resumeWith, startedRequest } = vendorTestUtils;

afterEach(() => {
  vi.restoreAllMocks();
});

vendorTestUtils.describePiece({
  piece: perplexityAi,
  folder: join(__dirname, '..'),
  packageName: '@iphi-flow/piece-opencode-perplexity-ai',
  displayName: 'Perplexity AI (via OpenCode)',
  actions: [
    { name: 'ask-ai', displayName: 'Ask AI', props: ['model', 'prompt', 'temperature', 'max_tokens', 'top_p', 'presence_penalty', 'frequency_penalty', 'roles'] },
  ],
});

describe('Perplexity AI (via OpenCode) actions', () => {
  test('Ask AI sends the question with the sampling settings and returns the answer with the cited URLs', async () => {
    const requests = mockServer({});
    const { context } = contextOf({ propsValue: { model: 'sonar-pro', prompt: 'News?', temperature: 0.2, top_p: 0.9, presence_penalty: 0, frequency_penalty: 1 } });
    await askAi.run(context);
    expect(startedRequest({ requests })).toMatchObject({
      vendor: 'Perplexity AI',
      provider: 'perplexity',
      options: { temperature: 0.2, topP: 0.9, presencePenalty: 0, frequencyPenalty: 1 },
    });

    const done = contextOf({
      propsValue: { model: 'sonar-pro', prompt: 'News?' },
      resumePayload: resumeWith({ output: answerOf({ answer: 'Things happened [1].', sources: [{ url: 'https://news.example/a', title: 'A' }, { url: 'https://news.example/b' }] }) }),
    });
    expect(await askAi.run(done.context)).toEqual({ result: 'Things happened [1].', citations: ['https://news.example/a', 'https://news.example/b'] });

    const bad = contextOf({ propsValue: { model: 'sonar-pro', prompt: 'News?', max_tokens: 0 } });
    await expect(askAi.run(bad.context)).rejects.toThrow('Maximum Tokens must be at least 1.');
  });
});
