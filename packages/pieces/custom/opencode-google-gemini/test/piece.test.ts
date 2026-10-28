/// <reference types="vitest/globals" />

import { ApFile } from '@activepieces/pieces-framework';
import { join } from 'node:path';
import { vendorTestUtils } from '../../common/test/vendor-test-utils';
import { googleGemini } from '../src';
import { chatGemini } from '../src/lib/actions/chat-gemini';
import { generateContent } from '../src/lib/actions/generate-content';
import { generateContentFromImage } from '../src/lib/actions/generate-content-from-image';

const { mockServer, contextOf, answerOf, resumeWith, startedRequest } = vendorTestUtils;

afterEach(() => {
  vi.restoreAllMocks();
});

vendorTestUtils.describePiece({
  piece: googleGemini,
  folder: join(__dirname, '..'),
  packageName: '@iphi-flow/piece-opencode-google-gemini',
  displayName: 'Google Gemini (via OpenCode)',
  actions: [
    { name: 'generate_content', displayName: 'Generate Content', props: ['prompt', 'model', 'toolType', 'toolProperties'] },
    { name: 'generate_content_from_image', displayName: 'Generate Content from Image', props: ['prompt', 'image', 'model'] },
    { name: 'chat_gemini', displayName: 'Chat with Gemini', props: ['prompt', 'model', 'memoryKey'] },
  ],
});

describe('Google Gemini (via OpenCode) actions', () => {
  test('Generate Content asks for a web search or the linked pages, and refuses Maps and File Search', async () => {
    const requests = mockServer({});
    const search = contextOf({ propsValue: { prompt: 'Who won?', model: 'gemini-2.5-flash', toolType: 'google-search' } });
    await generateContent.run(search.context);
    expect(startedRequest({ requests })).toMatchObject({
      vendor: 'Google Gemini',
      provider: 'google',
      prompt: 'Who won?\n\nSearch the web for current information before you answer.',
    });

    const pages = mockServer({});
    const links = contextOf({ propsValue: { prompt: 'Sum up https://a.example', model: 'gemini-2.5-flash', toolType: 'url-context' } });
    await generateContent.run(links.context);
    expect(startedRequest({ requests: pages })).toMatchObject({ prompt: 'Sum up https://a.example\n\nRead the pages linked above before you answer.' });

    const maps = contextOf({ propsValue: { prompt: 'Cafes', model: 'm', toolType: 'google-maps', toolProperties: { latitude: 1, longitude: 2 } } });
    await expect(generateContent.run(maps.context)).rejects.toThrow('Google Maps does not run on OpenCode. Use the official Google Gemini piece for this step.');
    const files = contextOf({ propsValue: { prompt: 'Read', model: 'm', toolType: 'file-search' } });
    await expect(generateContent.run(files.context)).rejects.toThrow('File Search does not run on OpenCode. Use the official Google Gemini piece for this step.');

    const done = contextOf({ propsValue: { prompt: 'Hi', model: 'm' }, resumePayload: resumeWith({ output: answerOf({ answer: 'Hello' }) }) });
    expect(await generateContent.run(done.context)).toBe('Hello');
  });

  test('Generate Content from Image returns the text and a Gemini-shaped raw response', async () => {
    const requests = mockServer({});
    const { context } = contextOf({ propsValue: { prompt: 'Describe', image: new ApFile('cat.jpg', Buffer.from('jpg'), 'jpg'), model: 'gemini-2.5-flash' } });
    await generateContentFromImage.run(context);
    expect(startedRequest({ requests })).toMatchObject({ prompt: 'Describe', files: [{ filename: 'cat.jpg' }] });

    const done = contextOf({
      propsValue: { prompt: 'Describe', image: new ApFile('cat.jpg', Buffer.from('jpg'), 'jpg'), model: 'gemini-2.5-flash' },
      resumePayload: resumeWith({ output: answerOf({ answer: 'A cat', model: { providerID: 'google', modelID: 'gemini-2.5-flash' } }) }),
    });
    expect(await generateContentFromImage.run(done.context)).toEqual({
      text: 'A cat',
      raw: {
        modelVersion: 'gemini-2.5-flash',
        candidates: [{ content: { role: 'model', parts: [{ text: 'A cat' }] }, finishReason: 'STOP', index: 0 }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 4, thoughtsTokenCount: 2, totalTokenCount: 16 },
        sessionId: 'ses_1',
        adminPanelUrl: 'http://opencode/session/ses_1',
      },
    });
  });

  test('Chat with Gemini asks for the history and returns it as Gemini contents', async () => {
    const requests = mockServer({});
    const { context } = contextOf({ propsValue: { prompt: 'Hi', model: 'gemini-2.5-flash', memoryKey: 'gem' } });
    await chatGemini.run(context);
    expect(startedRequest({ requests })).toMatchObject({ prompt: 'Hi', withHistory: true, session: { kind: 'NEW' } });

    const done = contextOf({
      propsValue: { prompt: 'Hi', model: 'gemini-2.5-flash', memoryKey: 'gem' },
      resumePayload: resumeWith({ output: answerOf({ answer: 'Hello', sessionId: 'ses_g', history: [{ role: 'user', text: 'Hi' }, { role: 'assistant', text: 'Hello' }] }) }),
    });
    expect(await chatGemini.run(done.context)).toEqual({
      response: 'Hello',
      history: [{ role: 'user', parts: [{ text: 'Hi' }] }, { role: 'model', parts: [{ text: 'Hello' }] }],
    });
    expect(done.store.get('opencode-session:gem')).toBe('ses_g');
  });
});
