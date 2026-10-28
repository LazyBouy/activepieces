/// <reference types="vitest/globals" />

import { httpClient, HttpMessageBody, HttpRequest, HttpResponse } from '@activepieces/pieces-common';
import { ApFile } from '@activepieces/pieces-framework';
import { join } from 'node:path';
import { vendorTestUtils } from '../../common/test/vendor-test-utils';
import { googleVertexAi } from '../src';
import { generateContent } from '../src/lib/actions/generate-content';

const { contextOf, answerOf, resumeWith, startedRequest } = vendorTestUtils;

afterEach(() => {
  vi.restoreAllMocks();
});

vendorTestUtils.describePiece({
  piece: googleVertexAi,
  folder: join(__dirname, '..'),
  packageName: '@iphi-flow/piece-opencode-google-vertexai',
  displayName: 'Google Vertex AI (via OpenCode)',
  actions: [
    {
      name: 'generate_content',
      displayName: 'Generate Content',
      props: ['model', 'systemMessage', 'userMessage', 'files', 'youtubeUrl', 'imageUrls', 'temperature', 'maxOutputTokens', 'thinkingLevel', 'thinkingBudget', 'includeThoughts'],
    },
  ],
});

describe('Google Vertex AI (via OpenCode) actions', () => {
  test('Generate Content sends the files and the fetched image URLs, the system message and the thinking level', async () => {
    const requests: HttpRequest[] = [];
    vi.spyOn(httpClient, 'sendRequest').mockImplementation(async <T extends HttpMessageBody>(request: HttpRequest): Promise<HttpResponse<T>> => {
      requests.push(request);
      const body = request.url.startsWith('https://images.example') ? Buffer.from('jpg') : { requestId: 'req_1' };
      return { status: 200, headers: {}, body: body as T };
    });
    const { context, uploads } = contextOf({
      propsValue: {
        model: 'gemini-2.5-flash',
        systemMessage: 'Be exact.',
        userMessage: 'Compare these',
        files: [{ file: new ApFile('notes.txt', Buffer.from('a')) }],
        imageUrls: ['https://images.example/photos/cat.jpg'],
        temperature: 0.4,
        thinkingLevel: 'HIGH',
      },
    });
    await generateContent.run(context);
    expect(uploads).toEqual(['notes.txt', 'cat.jpg']);
    expect(startedRequest({ requests })).toMatchObject({
      vendor: 'Google Vertex AI',
      provider: 'google-vertex',
      prompt: 'Compare these',
      system: 'Be exact.',
      files: [{ filename: 'notes.txt' }, { filename: 'cat.jpg' }],
      options: { temperature: 0.4 },
      variant: 'high',
    });
  });

  test('Generate Content returns the text, the candidates and the token counts, and keeps the official token-limit error', async () => {
    const done = contextOf({
      propsValue: { model: 'gemini-2.5-flash', userMessage: 'Hi', includeThoughts: true },
      resumePayload: resumeWith({ output: answerOf({ answer: 'Hello', reasoning: 'Greeting back' }) }),
    });
    expect(await generateContent.run(done.context)).toEqual({
      text: 'Hello',
      candidates: [{ content: { role: 'model', parts: [{ text: 'Greeting back', thought: true }, { text: 'Hello' }] }, finishReason: 'STOP', index: 0 }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 4, thoughtsTokenCount: 2, totalTokenCount: 16 },
    });

    const cut = contextOf({ propsValue: { model: 'gemini-2.5-flash', userMessage: 'Hi' }, resumePayload: resumeWith({ output: answerOf({ finish: 'length' }) }) });
    await expect(generateContent.run(cut.context)).rejects.toThrow('Generation stopped due to token limit. Consider removing the max output tokens or shortening your prompt.');

    const youtube = contextOf({ propsValue: { model: 'gemini-2.5-flash', userMessage: 'Watch', youtubeUrl: 'https://youtu.be/x' } });
    await expect(generateContent.run(youtube.context)).rejects.toThrow('A YouTube URL does not run on OpenCode. Use the official Google Vertex AI piece for this step.');
  });
});
