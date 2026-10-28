import { createAction, Property } from '@activepieces/pieces-framework';
import { opencodeStepRun, opencodeVendor } from '@iphi-flow/opencode-pieces-common';
import { identity } from '../identity';

export const visionPrompt = createAction({
  audience: 'both',
  name: 'vision_prompt',
  classification: 'READ',
  displayName: 'Vision Prompt',
  description: 'Ask a question about an image and get a text reply.',
  aiMetadata: {
    description:
      'Answers a question about an image by sending the picture with the prompt to an OpenAI model through OpenCode (gpt-4o unless another connected model is picked), covering captioning, reading text off an image and visual question answering. Pick it over ask_chatgpt whenever a picture is part of the question. Not idempotent: each call produces a fresh completion.',
    idempotent: false,
  },
  props: {
    model: opencodeVendor.modelDropdown({ identity, displayName: 'Model', description: 'The OpenAI model that looks at the image.', required: true, defaultValue: 'gpt-4o' }),
    image: Property.File({
      displayName: 'Image',
      description: 'The picture to ask about.',
      required: true,
    }),
    prompt: Property.LongText({
      displayName: 'Question',
      description: 'What you want to know about the image.',
      placeholder: 'e.g. What is the total on this receipt?',
      required: true,
    }),
    maxTokens: Property.Number({
      displayName: 'Maximum Tokens',
      required: false,
      description: 'Longest reply in tokens, about 4 characters each.',
      defaultValue: 2048,
    }),
    detail: Property.StaticDropdown({
      displayName: 'Detail',
      required: false,
      description: 'Low is faster and cheaper. High reads small details better. OpenCode sends the image as it is, so this has no effect.',
      defaultValue: 'auto',
      advanced: true,
      options: {
        options: [
          { label: 'Auto', value: 'auto' },
          { label: 'Low', value: 'low' },
          { label: 'High', value: 'high' },
        ],
      },
    }),
    temperature: Property.Number({
      displayName: 'Temperature',
      required: false,
      description: 'From 0 to 2. Lower is more focused, higher is more varied.',
      defaultValue: 0.9,
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
      defaultValue: 0.6,
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
    const { model, image, prompt, maxTokens, temperature, topP, frequencyPenalty, presencePenalty, roles } = context.propsValue;
    opencodeVendor.checkInputs({ checks: [{ label: 'Temperature', value: temperature, min: 0, max: 2 }] });
    const turns = opencodeVendor.rolesOf({ value: roles, allowed: ['system', 'user', 'assistant'] });
    const result = await opencodeVendor.run({
      context,
      identity,
      buildRequest: async () => ({
        model,
        prompt: opencodeVendor.promptOf({ question: prompt, before: turns }),
        system: opencodeVendor.systemOf({ texts: [], turns }),
        files: [await opencodeStepRun.uploadFile({ context, file: image })],
        ...opencodeVendor.optionsOf({ options: { temperature, topP, frequencyPenalty, presencePenalty, maxOutputTokens: maxTokens } }),
      }),
    });
    return result.status === 'paused' ? {} : result.answer.answer;
  },
});
