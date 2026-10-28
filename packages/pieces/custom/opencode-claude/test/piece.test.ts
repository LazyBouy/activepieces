/// <reference types="vitest/globals" />

import { ApFile } from '@activepieces/pieces-framework';
import { join } from 'node:path';
import { vendorTestUtils } from '../../common/test/vendor-test-utils';
import { claude } from '../src';
import { askClaude } from '../src/lib/actions/ask-claude';
import { extractStructuredData } from '../src/lib/actions/extract-structured-data';

const { mockServer, contextOf, answerOf, resumeWith, startedRequest } = vendorTestUtils;

afterEach(() => {
  vi.restoreAllMocks();
});

vendorTestUtils.describePiece({
  piece: claude,
  folder: join(__dirname, '..'),
  packageName: '@iphi-flow/piece-opencode-claude',
  displayName: 'Claude (via OpenCode)',
  actions: [
    { name: 'ask_claude', displayName: 'Ask Claude', props: ['model', 'prompt', 'systemPrompt', 'image', 'maxTokens', 'temperature', 'roles', 'thinkingMode', 'thinkingModeParams'] },
    { name: 'extract-structured-data', displayName: 'Extract Structured Data', props: ['model', 'text', 'image', 'mode', 'schema', 'maxTokens', 'prompt'] },
  ],
});

describe('Claude (via OpenCode) actions', () => {
  test('Ask Claude sends the system prompt, the roles after the question and the default token limit', async () => {
    const requests = mockServer({});
    const { context } = contextOf({
      propsValue: { model: 'claude-sonnet-4-5', prompt: 'Draft a reply', systemPrompt: 'Be polite.', temperature: 0.3, roles: [{ role: 'assistant', content: 'Sure.' }] },
    });
    await askClaude.run(context);
    expect(startedRequest({ requests })).toEqual({
      action: 'OPENCODE_VENDOR_PROMPT',
      vendor: 'Claude',
      provider: 'anthropic',
      model: 'claude-sonnet-4-5',
      prompt: 'Draft a reply\n\nAfter that, in this conversation:\nAssistant: Sure.',
      system: 'Be polite.',
      options: { maxOutputTokens: 1000, temperature: 0.3 },
      session: { kind: 'STEP' },
    });
  });

  test('Ask Claude\'s thinking mode uses the model\'s thinking variant without a temperature, with the image as a file', async () => {
    const requests = mockServer({});
    const { context } = contextOf({
      propsValue: {
        model: 'claude-sonnet-4-5',
        prompt: 'Look',
        image: new ApFile('chart.png', Buffer.from('png'), 'png'),
        temperature: 0.3,
        thinkingMode: true,
        thinkingModeParams: { budgetTokens: 20000 },
      },
    });
    await askClaude.run(context);
    const request = startedRequest({ requests });
    expect(request).toMatchObject({ variant: 'max', options: { maxOutputTokens: 1000 }, files: [{ fileId: 'file_1', filename: 'chart.png' }], system: "You are a helpful assistant." });
    expect(request['options']).not.toHaveProperty('temperature');
  });

  test('Ask Claude refuses a system role in Roles and a temperature above 1, and returns the reply text', async () => {
    mockServer({});
    const system = contextOf({ propsValue: { model: 'm', prompt: 'Hi', roles: [{ role: 'system', content: 'x' }] } });
    await expect(askClaude.run(system.context)).rejects.toThrow('The only available roles are: [user, assistant]');
    const hot = contextOf({ propsValue: { model: 'm', prompt: 'Hi', temperature: 1.5 } });
    await expect(askClaude.run(hot.context)).rejects.toThrow('Temperature must be between 0 and 1.');
    const done = contextOf({ propsValue: { model: 'm', prompt: 'Hi' }, resumePayload: resumeWith({ output: answerOf({ answer: 'Hello' }) }) });
    expect(await askClaude.run(done.context)).toBe('Hello');
  });

  test('Extract Structured Data builds the schema from the field list or takes a JSON schema, and needs text or a file', async () => {
    const requests = mockServer({});
    const fields = [{ name: 'invoice_number', description: 'The number', type: 'string', isRequired: true }, { name: 'paid', type: 'boolean', isRequired: false }];
    const { context } = contextOf({ propsValue: { model: 'm', text: 'INV-1, paid', mode: 'simple', schema: { fields } } });
    await extractStructuredData.run(context);
    expect(startedRequest({ requests })).toMatchObject({
      prompt: 'Extract the following data from the provided data.\n\nINV-1, paid',
      outputSchema: { type: 'object', properties: { invoice_number: { type: 'string', description: 'The number' }, paid: { type: 'boolean' } }, required: ['invoice_number'] },
      options: { maxOutputTokens: 2000 },
    });

    const advanced = mockServer({});
    const pdf = contextOf({ propsValue: { model: 'm', image: new ApFile('bill.pdf', Buffer.from('%PDF'), 'pdf'), mode: 'advanced', schema: { fields: '{"type":"object","properties":{"total":{"type":"number"}}}' } } });
    await extractStructuredData.run(pdf.context);
    expect(startedRequest({ requests: advanced })).toMatchObject({ prompt: 'Extract the following data from the provided data.', outputSchema: { type: 'object', properties: { total: { type: 'number' } } }, files: [{ filename: 'bill.pdf' }] });

    const empty = contextOf({ propsValue: { model: 'm', mode: 'simple', schema: { fields } } });
    await expect(extractStructuredData.run(empty.context)).rejects.toThrow('Please provide text or image/PDF to extract data from.');
    const done = contextOf({ propsValue: { model: 'm', text: 'x', mode: 'simple', schema: { fields } }, resumePayload: resumeWith({ output: answerOf({ structured: { invoice_number: 'INV-1' } }) }) });
    expect(await extractStructuredData.run(done.context)).toEqual({ invoice_number: 'INV-1' });
  });
});
