/// <reference types="vitest/globals" />

import { join } from 'node:path';
import { vendorTestUtils } from '../../common/test/vendor-test-utils';
import { deepseek } from '../src';
import { askDeepseek } from '../src/lib/actions/ask-deepseek';

const { mockServer, contextOf, answerOf, resumeWith, startedRequest } = vendorTestUtils;

afterEach(() => {
  vi.restoreAllMocks();
});

vendorTestUtils.describePiece({
  piece: deepseek,
  folder: join(__dirname, '..'),
  packageName: '@iphi-flow/piece-opencode-deepseek',
  displayName: 'DeepSeek (via OpenCode)',
  actions: [
    {
      name: 'ask_deepseek',
      displayName: 'Ask Deepseek',
      props: ['model', 'prompt', 'frequencyPenalty', 'maxTokens', 'presencePenalty', 'responseFormat', 'temperature', 'topP', 'memoryKey', 'roles'],
    },
  ],
});

describe('DeepSeek (via OpenCode) actions', () => {
  test('Ask Deepseek asks for a JSON object in JSON mode and returns it as text', async () => {
    const requests = mockServer({});
    const { context } = contextOf({ propsValue: { model: 'deepseek-chat', prompt: 'List two colours as JSON', maxTokens: 100, responseFormat: 'json_object', temperature: 1, topP: 1 } });
    await askDeepseek.run(context);
    expect(startedRequest({ requests })).toMatchObject({
      vendor: 'DeepSeek',
      provider: 'deepseek',
      outputSchema: { type: 'object' },
      options: { temperature: 1, topP: 1, maxOutputTokens: 100 },
    });

    const done = contextOf({
      propsValue: { model: 'deepseek-chat', prompt: 'x', maxTokens: 100, responseFormat: 'json_object' },
      resumePayload: resumeWith({ output: answerOf({ structured: { colours: ['red', 'blue'] } }) }),
    });
    expect(await askDeepseek.run(done.context)).toBe('{"colours":["red","blue"]}');

    const text = contextOf({ propsValue: { model: 'deepseek-chat', prompt: 'x', maxTokens: 100, responseFormat: 'text' }, resumePayload: resumeWith({ output: answerOf({ answer: 'Red and blue' }) }) });
    expect(await askDeepseek.run(text.context)).toBe('Red and blue');
  });
});
