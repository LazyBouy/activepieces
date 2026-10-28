/// <reference types="vitest/globals" />

import { ApFile } from '@activepieces/pieces-framework';
import { join } from 'node:path';
import { vendorTestUtils } from '../../common/test/vendor-test-utils';
import { openai } from '../src';
import { analyzeSentiment } from '../src/lib/actions/analyze-sentiment';
import { askChatGpt } from '../src/lib/actions/ask-chatgpt';
import { extractStructuredData } from '../src/lib/actions/extract-structured-data';
import { visionPrompt } from '../src/lib/actions/vision-prompt';

const { mockServer, contextOf, answerOf, resumeWith, startedRequest } = vendorTestUtils;

afterEach(() => {
  vi.restoreAllMocks();
});

vendorTestUtils.describePiece({
  piece: openai,
  folder: join(__dirname, '..'),
  packageName: '@iphi-flow/piece-opencode-openai',
  displayName: 'OpenAI (via OpenCode)',
  actions: [
    { name: 'ask_chatgpt', displayName: 'Ask ChatGPT', props: ['model', 'prompt', 'maxTokens', 'memoryKey', 'temperature', 'topP', 'frequencyPenalty', 'presencePenalty', 'roles'] },
    { name: 'vision_prompt', displayName: 'Vision Prompt', props: ['model', 'image', 'prompt', 'maxTokens', 'detail', 'temperature', 'topP', 'frequencyPenalty', 'presencePenalty', 'roles'] },
    { name: 'extract-structured-data', displayName: 'Extract Structured Data', props: ['model', 'text', 'params'] },
    { name: 'analyze_sentiment', displayName: 'Analyze Text Sentiment', props: ['model', 'text'] },
  ],
});

describe('OpenAI (via OpenCode) actions', () => {
  test('Ask ChatGPT sends the question, the roles\' system text and the sampling settings to OpenAI on OpenCode', async () => {
    const requests = mockServer({});
    const { context } = contextOf({
      propsValue: {
        model: 'gpt-4o',
        prompt: 'Summarize this',
        maxTokens: 300,
        temperature: 0.5,
        topP: 1,
        frequencyPenalty: 0,
        roles: [{ role: 'system', content: 'You are terse.' }, { role: 'user', content: 'Hi' }],
      },
    });
    await askChatGpt.run(context);
    expect(startedRequest({ requests })).toEqual({
      action: 'OPENCODE_VENDOR_PROMPT',
      vendor: 'OpenAI',
      provider: 'openai',
      model: 'gpt-4o',
      prompt: 'Earlier in this conversation:\nUser: Hi\n\nSummarize this',
      system: 'You are terse.',
      options: { temperature: 0.5, topP: 1, frequencyPenalty: 0, maxOutputTokens: 300 },
      session: { kind: 'STEP' },
    });
  });

  test('Ask ChatGPT returns the reply text, keeps the official temperature check, and continues a remembered conversation', async () => {
    mockServer({});
    const { context } = contextOf({ propsValue: { model: 'gpt-4o', prompt: 'Hi', maxTokens: 10 }, resumePayload: resumeWith({ output: answerOf({ answer: 'Hello!' }) }) });
    expect(await askChatGpt.run(context)).toBe('Hello!');

    const tooHot = contextOf({ propsValue: { model: 'gpt-4o', prompt: 'Hi', maxTokens: 10, temperature: 3 } });
    await expect(askChatGpt.run(tooHot.context)).rejects.toThrow('Temperature must be between 0 and 2.');

    const requests = mockServer({});
    const remembered = contextOf({
      propsValue: { model: 'gpt-4o', prompt: 'And then?', maxTokens: 10, memoryKey: 'chat', roles: [{ role: 'user', content: 'Earlier' }] },
      stored: { 'opencode-session:chat': 'ses_4' },
    });
    await askChatGpt.run(remembered.context);
    expect(startedRequest({ requests })).toMatchObject({ prompt: 'And then?', session: { kind: 'MEMORY', sessionId: 'ses_4' } });
  });

  test('Vision Prompt sends the image as a file and returns the reply text', async () => {
    const requests = mockServer({});
    const { context, uploads } = contextOf({
      propsValue: { model: 'gpt-4o', image: new ApFile('receipt.png', Buffer.from('png'), 'png'), prompt: 'What is the total?', roles: [] },
    });
    await visionPrompt.run(context);
    expect(uploads).toEqual(['receipt.png']);
    expect(startedRequest({ requests })).toMatchObject({ model: 'gpt-4o', prompt: 'What is the total?', files: [{ fileId: 'file_1', filename: 'receipt.png' }] });
  });

  test('Extract Structured Data asks for the defined fields and returns them', async () => {
    const requests = mockServer({});
    const params = [
      { propName: 'total', propDescription: 'The total', propDataType: 'number', propIsRequired: true },
      { propName: 'vendor', propDataType: 'string', propIsRequired: false },
    ];
    const { context } = contextOf({ propsValue: { model: 'gpt-4o', text: 'Invoice from ACME, total 42', params } });
    await extractStructuredData.run(context);
    expect(startedRequest({ requests })).toMatchObject({
      prompt: 'Extract the following data from the provided text.\n\nInvoice from ACME, total 42',
      outputSchema: {
        type: 'object',
        properties: { total: { type: 'number', description: 'The total' }, vendor: { type: 'string', description: 'vendor' } },
        required: ['total'],
      },
    });
    const done = contextOf({ propsValue: { model: 'gpt-4o', text: 'x', params }, resumePayload: resumeWith({ output: answerOf({ structured: { total: 42, vendor: 'ACME' } }) }) });
    expect(await extractStructuredData.run(done.context)).toEqual({ total: 42, vendor: 'ACME' });
  });

  test('Analyze Text Sentiment asks at temperature 0 for a labelled answer and normalizes it', async () => {
    const requests = mockServer({});
    const { context } = contextOf({ propsValue: { model: 'gpt-4o-mini', text: 'I love it' } });
    await analyzeSentiment.run(context);
    expect(startedRequest({ requests })).toMatchObject({ options: { temperature: 0 }, outputSchema: { required: ['sentiment', 'confidence', 'explanation'] } });

    const done = contextOf({
      propsValue: { model: 'gpt-4o-mini', text: 'I love it' },
      resumePayload: resumeWith({ output: answerOf({ structured: { sentiment: 'Positive', confidence: 1.5, explanation: 'Warm words' } }) }),
    });
    expect(await analyzeSentiment.run(done.context)).toEqual({ sentiment: 'positive', confidence: undefined, explanation: 'Warm words' });
  });
});
