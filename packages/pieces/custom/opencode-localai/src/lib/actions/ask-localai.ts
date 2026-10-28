import { createAction, Property } from '@activepieces/pieces-framework';
import { opencodeVendor } from '@iphi-flow/opencode-pieces-common';
import { identity } from '../identity';

export const askLocalAi = createAction({
  audience: 'both',
  name: 'ask_localai',
  classification: 'READ',
  displayName: 'Ask LocalAI',
  description: 'Ask LocalAI anything you want!',
  aiMetadata: {
    description:
      'Sends a prompt to a chat model on your own LocalAI server through OpenCode, via the OpenAI-compatible provider with the id localai set up in the OpenCode admin panel, with optional sampling controls and a roles array for system or assistant priming, and returns the reply as plain text. It keeps no conversation memory. Not idempotent: each call produces a fresh completion.',
    idempotent: false,
  },
  props: {
    model: opencodeVendor.modelDropdown({
      identity,
      displayName: 'Model',
      description: 'The chat model on your LocalAI server that will write the answer, as OpenCode\'s localai provider lists it.',
      required: true,
    }),
    prompt: Property.LongText({
      displayName: 'Question',
      required: true,
    }),
    temperature: Property.Number({
      displayName: 'Temperature',
      required: false,
      description: 'Higher is more random, lower is more focused. Defaults to 0.9.',
    }),
    maxTokens: Property.Number({
      displayName: 'Maximum Tokens',
      required: false,
      description: 'Longest answer to generate, in tokens. Defaults to 2048.',
    }),
    topP: Property.Number({
      displayName: 'Top P',
      required: false,
      description: 'Nucleus sampling, from 0 to 1. Defaults to 1.',
    }),
    frequencyPenalty: Property.Number({
      displayName: 'Frequency penalty',
      required: false,
      description: 'From -2 to 2. Higher repeats lines less. Defaults to 0.',
    }),
    presencePenalty: Property.Number({
      displayName: 'Presence penalty',
      required: false,
      description: 'From -2 to 2. Higher moves to new topics. Defaults to 0.6.',
    }),
    roles: Property.Json({
      displayName: 'Roles',
      required: false,
      description: 'Messages sent before the question, each with a role and content.',
      defaultValue: [{ role: 'system', content: 'You are a helpful assistant.' }],
    }),
  },
  async run(context) {
    const { model, prompt, temperature, maxTokens, topP, frequencyPenalty, presencePenalty, roles } = context.propsValue;
    const turns = opencodeVendor.rolesOf({ value: roles, allowed: ['system', 'user', 'assistant'] });
    const result = await opencodeVendor.run({
      context,
      identity,
      buildRequest: async () => ({
        model,
        prompt: opencodeVendor.promptOf({ question: prompt, before: turns }),
        system: opencodeVendor.systemOf({ texts: [], turns }),
        ...opencodeVendor.optionsOf({
          options: {
            temperature: temperature ?? 0.9,
            maxOutputTokens: maxTokens ?? 2048,
            topP: topP ?? 1,
            frequencyPenalty: frequencyPenalty ?? 0,
            presencePenalty: presencePenalty ?? 0.6,
          },
        }),
      }),
    });
    return result.status === 'paused' ? {} : result.answer.answer.trim();
  },
});
