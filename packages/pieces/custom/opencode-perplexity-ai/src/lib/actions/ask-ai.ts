import { createAction, Property } from '@activepieces/pieces-framework';
import { opencodeVendor } from '@iphi-flow/opencode-pieces-common';
import { identity } from '../identity';

export const askAi = createAction({
  audience: 'both',
  name: 'ask-ai',
  classification: 'READ',
  displayName: 'Ask AI',
  description: 'Ask a question and get an answer sourced from the live web.',
  aiMetadata: {
    description:
      'Sends a question to a Perplexity Sonar model through OpenCode, which answers from a live web search, and returns the answer with the URLs it cites. Pick it when the reply must reflect current web content. Runs stateless: earlier turns go in the optional roles array. Requires a model and a question; not idempotent: each call runs a new search and produces a fresh completion.',
    idempotent: false,
  },
  props: {
    model: opencodeVendor.modelDropdown({
      identity,
      displayName: 'Model',
      description: 'Pro models dig deeper and Reasoning models think before answering.',
      required: true,
      defaultValue: 'sonar-pro',
    }),
    prompt: Property.LongText({
      displayName: 'Question',
      description: 'What you want the model to answer or do.',
      placeholder: "e.g. Summarize this week's news about electric cars",
      required: true,
    }),
    temperature: Property.Number({
      displayName: 'Temperature',
      required: false,
      advanced: true,
      description: 'From 0 to 2. Lower is more focused, higher is more varied.',
      defaultValue: 0.2,
    }),
    max_tokens: Property.Number({
      displayName: 'Maximum Tokens',
      required: false,
      description: 'Longest reply in tokens, about 4 characters each.',
    }),
    top_p: Property.Number({
      displayName: 'Top P',
      required: false,
      advanced: true,
      description: 'From 0 to 1. Adjust this or Temperature, not both.',
      defaultValue: 0.9,
    }),
    presence_penalty: Property.Number({
      displayName: 'Presence Penalty',
      required: false,
      advanced: true,
      description: 'Higher values push the model toward new topics.',
      defaultValue: 0,
    }),
    frequency_penalty: Property.Number({
      displayName: 'Frequency Penalty',
      required: false,
      advanced: true,
      description: 'Higher values make the model repeat itself less.',
      defaultValue: 1.0,
    }),
    roles: Property.Json({
      displayName: 'Roles',
      required: false,
      advanced: true,
      description: 'Messages sent before the question, such as a system instruction.',
      defaultValue: [{ role: 'system', content: 'You are a helpful assistant.' }],
    }),
  },
  async run(context) {
    const { model, prompt, temperature, max_tokens, top_p, presence_penalty, frequency_penalty, roles } = context.propsValue;
    opencodeVendor.checkInputs({
      checks: [
        { label: 'Temperature', value: temperature, min: 0, max: 2 },
        { label: 'Maximum Tokens', value: max_tokens, min: 1, integer: true },
      ],
    });
    const turns = opencodeVendor.rolesOf({ value: roles, allowed: ['system', 'user', 'assistant'] });
    const result = await opencodeVendor.run({
      context,
      identity,
      buildRequest: async () => ({
        model,
        prompt: opencodeVendor.promptOf({ question: prompt, before: turns }),
        system: opencodeVendor.systemOf({ texts: [], turns }),
        ...opencodeVendor.optionsOf({
          options: { temperature, topP: top_p, presencePenalty: presence_penalty, frequencyPenalty: frequency_penalty, maxOutputTokens: max_tokens },
        }),
      }),
    });
    if (result.status === 'paused') {
      return {};
    }
    return { result: result.answer.answer, citations: result.answer.sources.map((source) => source.url) };
  },
});
