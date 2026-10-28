/// <reference types="vitest/globals" />

import { join } from 'node:path';
import { vendorTestUtils } from '../../common/test/vendor-test-utils';
import { azureOpenai } from '../src';
import { askGpt } from '../src/lib/actions/ask-gpt';

const { mockServer, contextOf, answerOf, resumeWith, startedRequest } = vendorTestUtils;

afterEach(() => {
  vi.restoreAllMocks();
});

vendorTestUtils.describePiece({
  piece: azureOpenai,
  folder: join(__dirname, '..'),
  packageName: '@iphi-flow/piece-opencode-azure-openai',
  displayName: 'Azure OpenAI (via OpenCode)',
  actions: [
    { name: 'ask_gpt', displayName: 'Ask GPT', props: ['deploymentId', 'prompt', 'temperature', 'maxTokens', 'topP', 'frequencyPenalty', 'presencePenalty', 'memoryKey', 'roles'] },
  ],
});

describe('Azure OpenAI (via OpenCode) actions', () => {
  test('Ask GPT sends the deployment as the Azure model with the sampling settings, and keeps the official range checks', async () => {
    const requests = mockServer({});
    const { context } = contextOf({
      propsValue: { deploymentId: 'gpt-4o', prompt: 'Hi', temperature: 0.9, maxTokens: 2048, topP: 1, frequencyPenalty: 0, presencePenalty: 0.6, roles: [{ role: 'system', content: 'Be kind.' }] },
    });
    await askGpt.run(context);
    expect(startedRequest({ requests })).toEqual({
      action: 'OPENCODE_VENDOR_PROMPT',
      vendor: 'Azure OpenAI',
      provider: 'azure',
      model: 'gpt-4o',
      prompt: 'Hi',
      system: 'Be kind.',
      options: { temperature: 0.9, topP: 1, frequencyPenalty: 0, presencePenalty: 0.6, maxOutputTokens: 2048 },
      session: { kind: 'STEP' },
    });

    const hot = contextOf({ propsValue: { deploymentId: 'gpt-4o', prompt: 'Hi', maxTokens: 10, temperature: 1.5, presencePenalty: 3 } });
    await expect(askGpt.run(hot.context)).rejects.toThrow('Temperature must be between 0 and 1. Presence penalty must be between -2 and 2.');

    const done = contextOf({ propsValue: { deploymentId: 'gpt-4o', prompt: 'Hi', maxTokens: 10 }, resumePayload: resumeWith({ output: answerOf({ answer: 'Hey' }) }) });
    expect(await askGpt.run(done.context)).toBe('Hey');
  });
});
