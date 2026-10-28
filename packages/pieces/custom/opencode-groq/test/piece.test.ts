/// <reference types="vitest/globals" />

import { join } from 'node:path';
import { vendorTestUtils } from '../../common/test/vendor-test-utils';
import { groq } from '../src';
import { askAi } from '../src/lib/actions/ask-ai';

const { mockServer, contextOf, answerOf, resumeWith, startedRequest } = vendorTestUtils;

afterEach(() => {
  vi.restoreAllMocks();
});

vendorTestUtils.describePiece({
  piece: groq,
  folder: join(__dirname, '..'),
  packageName: '@iphi-flow/piece-opencode-groq',
  displayName: 'Groq (via OpenCode)',
  actions: [
    { name: 'ask-ai', displayName: 'Ask AI', props: ['model', 'prompt', 'temperature', 'maxTokens', 'topP', 'frequencyPenalty', 'presencePenalty', 'memoryKey', 'roles'] },
  ],
});

describe('Groq (via OpenCode) actions', () => {
  test('Ask AI sends the question to Groq on OpenCode and returns the reasoning and the answer as Think and Content', async () => {
    const requests = mockServer({});
    const { context } = contextOf({ propsValue: { model: 'llama-3.3-70b-versatile', prompt: 'Why?', maxTokens: 200 } });
    await askAi.run(context);
    expect(startedRequest({ requests })).toMatchObject({ vendor: 'Groq', provider: 'groq', prompt: 'Why?', options: { maxOutputTokens: 200 } });

    const thought = contextOf({ propsValue: { model: 'm', prompt: 'Why?', maxTokens: 200 }, resumePayload: resumeWith({ output: answerOf({ answer: 'Because.', reasoning: 'Let me think.' }) }) });
    expect(await askAi.run(thought.context)).toEqual([{ Think: 'Let me think.', Content: 'Because.' }]);
    const plain = contextOf({ propsValue: { model: 'm', prompt: 'Why?', maxTokens: 200 }, resumePayload: resumeWith({ output: answerOf({ answer: 'Because.' }) }) });
    expect(await askAi.run(plain.context)).toEqual([{ Think: null, Content: 'Because.' }]);
  });
});
