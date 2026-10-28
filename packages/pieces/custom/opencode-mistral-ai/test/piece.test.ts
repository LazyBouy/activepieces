/// <reference types="vitest/globals" />

import { join } from 'node:path';
import { vendorTestUtils } from '../../common/test/vendor-test-utils';
import { mistralAi } from '../src';
import { createChatCompletion } from '../src/lib/actions/create-chat-completion';
import { generateChatCompletion } from '../src/lib/actions/generate-chat-completion';

const { mockServer, contextOf, answerOf, resumeWith, startedRequest } = vendorTestUtils;

afterEach(() => {
  vi.restoreAllMocks();
});

vendorTestUtils.describePiece({
  piece: mistralAi,
  folder: join(__dirname, '..'),
  packageName: '@iphi-flow/piece-opencode-mistral-ai',
  displayName: 'Mistral AI (via OpenCode)',
  actions: [
    { name: 'create_chat_completion', displayName: 'Ask Mistral', props: ['model', 'prompt', 'temperature', 'top_p', 'max_tokens', 'random_seed', 'timeout'] },
    { name: 'generate_chat_completion', displayName: 'Generate Chat Completion', props: ['model', 'system_prompt', 'messages', 'response_format', 'temperature', 'max_tokens', 'random_seed'] },
  ],
});

describe('Mistral AI (via OpenCode) actions', () => {
  test('Ask Mistral sends the question with the sampling settings and the seed', async () => {
    const requests = mockServer({});
    const { context } = contextOf({ propsValue: { model: 'mistral-small-latest', prompt: 'Hi', temperature: 1, top_p: 1, max_tokens: 50, random_seed: 7, timeout: 30000 } });
    await createChatCompletion.run(context);
    expect(startedRequest({ requests })).toMatchObject({
      vendor: 'Mistral AI',
      provider: 'mistral',
      prompt: 'Hi',
      options: { temperature: 1, topP: 1, maxOutputTokens: 50, seed: 7 },
    });
  });

  test('Generate Chat Completion sends the messages before the last user turn, and returns the official reply fields', async () => {
    const requests = mockServer({});
    const messages = [
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello' },
      { role: 'user', content: 'Give me JSON' },
    ];
    const { context } = contextOf({ propsValue: { model: 'mistral-small-latest', system_prompt: 'JSON only.', messages, response_format: 'json_object' } });
    await generateChatCompletion.run(context);
    expect(startedRequest({ requests })).toMatchObject({
      prompt: 'Earlier in this conversation:\nUser: Hi\nAssistant: Hello\n\nGive me JSON',
      system: 'JSON only.',
      outputSchema: { type: 'object' },
    });

    const done = contextOf({
      propsValue: { model: 'mistral-small-latest', messages, response_format: 'json_object' },
      resumePayload: resumeWith({ output: answerOf({ structured: { ok: true }, model: { providerID: 'mistral', modelID: 'mistral-small-latest' } }) }),
    });
    expect(await generateChatCompletion.run(done.context)).toEqual({
      id: 'msg_reply',
      model: 'mistral-small-latest',
      content: '{"ok":true}',
      finish_reason: 'stop',
      prompt_tokens: 10,
      completion_tokens: 4,
      total_tokens: 14,
    });

    const none = contextOf({ propsValue: { model: 'm', messages: [] } });
    await expect(generateChatCompletion.run(none.context)).rejects.toThrow('Provide at least one message.');
  });
});
