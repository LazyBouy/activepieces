import { createAction, Property } from '@activepieces/pieces-framework';
import { opencodeVendor } from '@iphi-flow/opencode-pieces-common';
import { identity } from '../identity';

export const askChatGpt = createAction({
  audience: 'both',
  name: 'ask_chatgpt',
  classification: 'READ',
  displayName: 'Ask ChatGPT',
  description: 'Send a question or instruction to an OpenAI model and get a reply.',
  aiMetadata: {
    description:
      'Sends a prompt to an OpenAI chat model through OpenCode and returns the reply text, with sampling controls (temperature, top P, frequency and presence penalties) and an optional roles array whose system entries become the message\'s system text. Stateless by default; with a memory key, runs that share the key continue one OpenCode session. The model list shows the OpenAI models connected in OpenCode. Not idempotent: each call produces a fresh completion.',
    idempotent: false,
  },
  props: {
    model: opencodeVendor.modelDropdown({ identity, displayName: 'Model', description: 'The OpenAI model that writes the reply.', required: true }),
    prompt: Property.LongText({
      displayName: 'Question',
      description: 'What you want the model to answer or do.',
      placeholder: 'e.g. Summarize this email in three bullet points',
      required: true,
    }),
    maxTokens: Property.Number({
      displayName: 'Maximum Tokens',
      required: true,
      description: 'Longest reply in tokens, about 4 characters each.',
      defaultValue: 2048,
    }),
    memoryKey: Property.ShortText({
      displayName: 'Conversation Memory ID',
      description: 'Runs that share this ID continue one conversation. Empty: no memory.',
      placeholder: 'e.g. support-chat-42',
      required: false,
    }),
    temperature: Property.Number({
      displayName: 'Temperature',
      required: false,
      description: 'From 0 to 2. Lower is more focused, higher is more varied.',
      defaultValue: 1,
      advanced: true,
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
      description: 'From -2 to 2. Higher values make the model repeat itself less.',
      defaultValue: 0,
      advanced: true,
    }),
    presencePenalty: Property.Number({
      displayName: 'Presence Penalty',
      required: false,
      description: 'From -2 to 2. Higher values push the model toward new topics.',
      advanced: true,
    }),
    roles: Property.Json({
      displayName: 'Roles',
      required: false,
      description: 'Messages sent before the question, such as a system instruction.',
      advanced: true,
      defaultValue: [{ role: 'system', content: 'You are a helpful assistant.' }],
    }),
  },
  async run(context) {
    const { model, prompt, maxTokens, memoryKey, temperature, topP, frequencyPenalty, presencePenalty, roles } = context.propsValue;
    opencodeVendor.checkInputs({
      checks: [
        { label: 'Temperature', value: temperature, min: 0, max: 2 },
        { label: 'Conversation Memory ID', value: memoryKey, maxLength: 128 },
      ],
    });
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
    return result.status === 'paused' ? {} : result.answer.answer;
  },
});
