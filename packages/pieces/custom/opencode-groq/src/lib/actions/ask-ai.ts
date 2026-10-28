import { createAction, Property } from '@activepieces/pieces-framework';
import { opencodeVendor } from '@iphi-flow/opencode-pieces-common';
import { identity } from '../identity';
import { askAiOutputSchema } from '../output-schemas';

export const askAi = createAction({
  audience: 'both',
  name: 'ask-ai',
  classification: 'READ',
  displayName: 'Ask AI',
  description: 'Send a question or instruction to a Groq model and get a text reply.',
  aiMetadata: {
    description:
      'Sends a prompt to a Groq-hosted chat model through OpenCode and returns the generated text with the model\'s reasoning, if any, as a Think/Content pair, with optional sampling controls and a roles array for system instructions. Runs stateless by default, or continues one OpenCode session across runs and flows when a memory key is set. Requires a model, a question and a maximum token count; not idempotent: each call produces a fresh completion.',
    idempotent: false,
  },
  props: {
    model: opencodeVendor.modelDropdown({ identity, displayName: 'Model', description: 'The Groq model, as OpenCode lists them.', required: true }),
    prompt: Property.LongText({
      displayName: 'Question',
      description: 'What you want the model to answer or do.',
      placeholder: 'e.g. Summarize this email in three bullet points',
      required: true,
    }),
    temperature: Property.Number({
      displayName: 'Temperature',
      required: false,
      description: 'From 0 to 2. Lower is more focused, higher is more varied.',
      defaultValue: 0.9,
      advanced: true,
    }),
    maxTokens: Property.Number({
      displayName: 'Maximum Tokens',
      required: true,
      description: 'Longest reply in tokens, about 4 characters each.',
      defaultValue: 2048,
    }),
    topP: Property.Number({
      displayName: 'Top P',
      required: false,
      description: 'From 0 to 1. Adjust this or Temperature, not both.',
      defaultValue: 1,
      advanced: true,
    }),
    frequencyPenalty: Property.Number({
      displayName: 'Frequency Penalty',
      required: false,
      description: 'From -2 to 2. Groq models do not support this yet.',
      defaultValue: 0,
      advanced: true,
    }),
    presencePenalty: Property.Number({
      displayName: 'Presence Penalty',
      required: false,
      description: 'From -2 to 2. Groq models do not support this yet.',
      defaultValue: 0.6,
      advanced: true,
    }),
    memoryKey: Property.ShortText({
      displayName: 'Conversation Memory ID',
      description: 'Runs that share this ID continue one conversation. Empty: no memory.',
      placeholder: 'e.g. support-chat-42',
      required: false,
    }),
    roles: Property.Json({
      displayName: 'Roles',
      required: false,
      description: 'Messages sent before the question, such as a system instruction.',
      advanced: true,
      defaultValue: [{ role: 'system', content: 'You are a helpful assistant.' }],
    }),
  },
  outputSchema: askAiOutputSchema,
  async run(context) {
    const { model, prompt, temperature, maxTokens, topP, frequencyPenalty, presencePenalty, memoryKey, roles } = context.propsValue;
    const turns = opencodeVendor.rolesOf({ value: roles, allowed: ['system', 'user', 'assistant'] });
    const result = await opencodeVendor.run({
      context,
      identity,
      memoryKey,
      buildRequest: async ({ continuing }) => ({
        model,
        prompt: opencodeVendor.promptOf({ question: prompt, before: continuing ? [] : turns }),
        system: opencodeVendor.systemOf({ texts: [], turns }),
        ...opencodeVendor.optionsOf({ options: { temperature, topP, frequencyPenalty, presencePenalty, maxOutputTokens: maxTokens } }),
      }),
    });
    if (result.status === 'paused') {
      return {};
    }
    const { answer } = result;
    return [{ Think: answer.reasoning.length > 0 ? answer.reasoning : null, Content: answer.answer }];
  },
});
