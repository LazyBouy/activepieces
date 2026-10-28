/// <reference types="vitest/globals" />

import { PropertyContext } from '@activepieces/pieces-framework';
import { opencodeVendor } from '../src';
import { vendorTestUtils } from './vendor-test-utils';

const identity = { vendor: 'OpenAI', provider: 'openai' };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the vendor model list', () => {
  const dropdown = opencodeVendor.modelDropdown({ identity, displayName: 'Model', description: 'The model.', required: true });
  const ctx = {
    server: { apiUrl: 'http://localhost:3000/', publicUrl: 'http://web/', token: 't' },
    project: { id: 'proj_1', externalId: async () => undefined },
    flows: {},
    connections: {},
  } as unknown as PropertyContext;

  test('lists only the matching OpenCode provider\'s models', async () => {
    vendorTestUtils.mockServer({
      providers: [
        { id: 'openrouter', name: 'OpenRouter', models: [{ id: 'qwen', name: 'Qwen' }] },
        { id: 'openai', name: 'OpenAI', models: [{ id: 'gpt-4o', name: 'GPT-4o' }, { id: 'gpt-4.1', name: 'GPT-4.1' }] },
      ],
    });
    const state = await dropdown.options({}, ctx);
    expect(state).toEqual({ disabled: false, options: [{ label: 'GPT-4o', value: 'gpt-4o' }, { label: 'GPT-4.1', value: 'gpt-4.1' }] });
  });

  test('says to connect the vendor when OpenCode has no such provider', async () => {
    vendorTestUtils.mockServer({ providers: [{ id: 'openrouter', name: 'OpenRouter', models: [{ id: 'qwen', name: 'Qwen' }] }] });
    const state = await dropdown.options({}, ctx);
    expect(state).toEqual({ disabled: true, options: [], placeholder: 'Connect OpenAI in the OpenCode admin panel' });
  });
});

describe('a vendor run', () => {
  test('pauses with a vendor prompt for the step\'s OpenCode section when there is no memory key', async () => {
    const requests = vendorTestUtils.mockServer({});
    const { context, waited } = vendorTestUtils.contextOf({ propsValue: {} });
    const result = await opencodeVendor.run({ context, identity, buildRequest: async () => ({ model: 'gpt-4o', prompt: 'Hi' }) });
    expect(result).toEqual({ status: 'paused' });
    expect(waited).toEqual(['test-waitpoint-id']);
    expect(vendorTestUtils.startedRequest({ requests })).toEqual({
      action: 'OPENCODE_VENDOR_PROMPT',
      vendor: 'OpenAI',
      provider: 'openai',
      model: 'gpt-4o',
      prompt: 'Hi',
      session: { kind: 'STEP' },
    });
  });

  test('starts a new session for a new memory key and remembers it when the answer comes back', async () => {
    const requests = vendorTestUtils.mockServer({});
    const { context } = vendorTestUtils.contextOf({ propsValue: {} });
    const build = vi.fn(async ({ continuing }: { continuing: boolean }) => ({ model: 'gpt-4o', prompt: continuing ? 'later' : 'first' }));
    await opencodeVendor.run({ context, identity, memoryKey: 'chat-1', buildRequest: build });
    expect(vendorTestUtils.startedRequest({ requests })).toMatchObject({ prompt: 'first', session: { kind: 'NEW' } });

    const resumed = vendorTestUtils.contextOf({ propsValue: {}, resumePayload: vendorTestUtils.resumeWith({ output: vendorTestUtils.answerOf({ sessionId: 'ses_9' }) }) });
    const result = await opencodeVendor.run({ context: resumed.context, identity, memoryKey: 'chat-1', buildRequest: build });
    expect(result).toMatchObject({ status: 'done', answer: { answer: 'The answer', sessionId: 'ses_9' } });
    expect(resumed.store.get('opencode-session:chat-1')).toBe('ses_9');
  });

  test('continues a remembered session and tells the request builder so', async () => {
    const requests = vendorTestUtils.mockServer({});
    const { context } = vendorTestUtils.contextOf({ propsValue: {}, stored: { 'opencode-session:chat-1': 'ses_7' } });
    await opencodeVendor.run({ context, identity, memoryKey: 'chat-1', buildRequest: async ({ continuing }) => ({ model: 'gpt-4o', prompt: continuing ? 'later' : 'first' }) });
    expect(vendorTestUtils.startedRequest({ requests })).toMatchObject({ prompt: 'later', session: { kind: 'MEMORY', sessionId: 'ses_7' } });
  });

  test('refuses to start without a model', async () => {
    vendorTestUtils.mockServer({});
    const { context } = vendorTestUtils.contextOf({ propsValue: {} });
    await expect(opencodeVendor.run({ context, identity, buildRequest: async () => ({ model: undefined, prompt: 'Hi' }) })).rejects.toThrow(
      'Pick a model. Connect OpenAI in the OpenCode admin panel if the list is empty.',
    );
  });

  test('answers in the request when the step cannot pause', async () => {
    vendorTestUtils.mockServer({ output: vendorTestUtils.answerOf({ reasoning: 'hm', sources: [{ url: 'https://a' }] }) });
    const { context } = vendorTestUtils.contextOf({ propsValue: {}, canPause: false });
    const result = await opencodeVendor.run({ context, identity, buildRequest: async () => ({ model: 'gpt-4o', prompt: 'Hi' }) });
    expect(result).toMatchObject({ status: 'done', answer: { reasoning: 'hm', sources: [{ url: 'https://a' }], usage: { input: 10, output: 4, reasoning: 2, cost: 0.001 } } });
  });
});

describe('the vendor message helpers', () => {
  test('roles keep the official role check and read text from content parts', () => {
    expect(opencodeVendor.rolesOf({ value: [{ role: 'system', content: 'Be brief.' }, { role: 'user', content: [{ type: 'text', text: 'Hi' }] }], allowed: ['system', 'user', 'assistant'] })).toEqual([
      { role: 'system', content: 'Be brief.' },
      { role: 'user', content: 'Hi' },
    ]);
    expect(opencodeVendor.rolesOf({ value: undefined, allowed: ['user'] })).toEqual([]);
    expect(() => opencodeVendor.rolesOf({ value: [{ role: 'system', content: 'x' }], allowed: ['user', 'assistant'] })).toThrow('The only available roles are: [user, assistant]');
  });

  test('the visible message puts earlier turns before the question and later turns and notes after it', () => {
    const turns = [
      { role: 'system' as const, content: 'Hidden from the lines' },
      { role: 'user' as const, content: 'Hi' },
      { role: 'assistant' as const, content: 'Hello' },
    ];
    expect(opencodeVendor.promptOf({ question: 'What now?', before: turns })).toBe('Earlier in this conversation:\nUser: Hi\nAssistant: Hello\n\nWhat now?');
    expect(opencodeVendor.promptOf({ question: 'Q', after: [{ role: 'assistant', content: 'A' }], notes: ['Search first.'] })).toBe(
      'Q\n\nAfter that, in this conversation:\nAssistant: A\n\nSearch first.',
    );
    expect(opencodeVendor.systemOf({ texts: ['  Standing rules ', undefined, ''], turns })).toBe('Standing rules\n\nHidden from the lines');
    expect(opencodeVendor.systemOf({ texts: [], turns: [] })).toBeUndefined();
  });

  test('model options keep only the numbers given', () => {
    expect(opencodeVendor.optionsOf({ options: { temperature: 0, topP: null, seed: undefined, maxOutputTokens: 300 } })).toEqual({ options: { temperature: 0, maxOutputTokens: 300 } });
    expect(opencodeVendor.optionsOf({ options: { temperature: null } })).toEqual({});
  });

  test('input checks name the input and its range', () => {
    expect(() => opencodeVendor.checkInputs({ checks: [{ label: 'Temperature', value: 3, min: 0, max: 2 }] })).toThrow('Temperature must be between 0 and 2.');
    expect(() => opencodeVendor.checkInputs({ checks: [{ label: 'Memory Key', value: 'x'.repeat(129), maxLength: 128 }] })).toThrow('Memory Key can be at most 128 characters.');
    expect(() => opencodeVendor.checkInputs({ checks: [{ label: 'Maximum Tokens', value: 1.5, min: 1, integer: true }] })).toThrow('Maximum Tokens must be a whole number.');
    expect(() => opencodeVendor.checkInputs({ checks: [{ label: 'Temperature', value: undefined, min: 0, max: 2 }] })).not.toThrow();
  });

  test('thinking budgets above 16,000 use the max variant, and features that need the vendor\'s API name the official piece', () => {
    expect(opencodeVendor.thinkingVariantOf({ budget: 1024 })).toBe('high');
    expect(opencodeVendor.thinkingVariantOf({ budget: 20000 })).toBe('max');
    expect(opencodeVendor.unsupported({ feature: 'Google Maps', identity: { vendor: 'Google Gemini', provider: 'google' } }).message).toBe(
      'Google Maps does not run on OpenCode. Use the official Google Gemini piece for this step.',
    );
  });

  test('a Gemini-shaped response carries the answer, its finish reason and the token counts', () => {
    const answer = {
      answer: 'Hi',
      structured: undefined,
      reasoning: 'thought',
      sources: [],
      finish: 'length',
      messageId: 'm',
      sessionId: 's',
      adminPanelUrl: null,
      model: { providerID: 'google', modelID: 'gemini-2.5-flash' },
      usage: { input: 3, output: 2, reasoning: 1, cost: 0 },
      history: [],
    };
    expect(opencodeVendor.geminiResponseOf({ answer, includeThoughts: true })).toEqual({
      modelVersion: 'gemini-2.5-flash',
      candidates: [{ content: { role: 'model', parts: [{ text: 'thought', thought: true }, { text: 'Hi' }] }, finishReason: 'MAX_TOKENS', index: 0 }],
      usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2, thoughtsTokenCount: 1, totalTokenCount: 6 },
    });
  });
});
