import { createAction, Property } from '@activepieces/pieces-framework';
import { opencodeVendor } from '@iphi-flow/opencode-pieces-common';
import { identity } from '../identity';

export const askDeepseek = createAction({
  audience: 'both',
  name: 'ask_deepseek',
  classification: 'READ',
  displayName: 'Ask Deepseek',
  description: 'Ask Deepseek anything you want!',
  aiMetadata: {
    description:
      'Sends a question to a DeepSeek chat model through OpenCode and returns the generated text, with optional sampling controls and a text-or-JSON response format; it runs stateless by default, or continues one OpenCode session across runs and flows when a memory key is set. Requires a model, a question and a maximum token count; not idempotent: each call produces a fresh completion.',
    idempotent: false,
  },
  props: {
    model: opencodeVendor.modelDropdown({
      identity,
      displayName: 'Model',
      description: 'The model which will generate the completion.',
      required: true,
      defaultValue: 'deepseek-chat',
    }),
    prompt: Property.LongText({
      displayName: 'Question',
      required: true,
    }),
    frequencyPenalty: Property.Number({
      displayName: 'Frequency penalty',
      required: false,
      description:
        "Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim.",
      defaultValue: 0,
    }),
    maxTokens: Property.Number({
      displayName: 'Maximum Tokens',
      required: true,
      description: 'The maximum number of tokens to generate. Possible values are between 1 and 8192.',
      defaultValue: 4096,
    }),
    presencePenalty: Property.Number({
      displayName: 'Presence penalty',
      required: false,
      description:
        "Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the mode's likelihood to talk about new topics.",
      defaultValue: 0,
    }),
    responseFormat: Property.StaticDropdown({
      displayName: 'Response Format',
      description: 'The format of the response. IMPORTANT: When using JSON Output, you must also instruct the model to produce JSON yourself',
      required: true,
      defaultValue: 'text',
      options: {
        options: [
          { label: 'Text', value: 'text' },
          { label: 'JSON', value: 'json_object' },
        ],
      },
    }),
    temperature: Property.Number({
      displayName: 'Temperature',
      required: false,
      description:
        'Controls randomness: Lowering results in less random completions. As the temperature approaches zero, the model will become deterministic and repetitive. Between 0 and 2. We generally recommend altering this or top_p but not both.',
      defaultValue: 1,
    }),
    topP: Property.Number({
      displayName: 'Top P',
      required: false,
      description:
        'An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered. Values <=1. We generally recommend altering this or temperature but not both.',
      defaultValue: 1,
    }),
    memoryKey: Property.ShortText({
      displayName: 'Memory Key',
      description:
        'A memory key that will keep the chat history shared across runs and flows. Keep it empty to leave Deepseek without memory of previous messages.',
      required: false,
    }),
    roles: Property.Json({
      displayName: 'Roles',
      required: false,
      description: 'Array of roles to specify more accurate response',
      defaultValue: [{ role: 'system', content: 'You are a helpful assistant.' }],
    }),
  },
  async run(context) {
    const { model, prompt, frequencyPenalty, maxTokens, presencePenalty, responseFormat, temperature, topP, memoryKey, roles } = context.propsValue;
    opencodeVendor.checkInputs({
      checks: [
        { label: 'Temperature', value: temperature, min: 0, max: 2 },
        { label: 'Memory Key', value: memoryKey, maxLength: 128 },
      ],
    });
    const turns = opencodeVendor.rolesOf({ value: roles, allowed: ['system', 'user', 'assistant'] });
    const json = responseFormat === 'json_object';
    const result = await opencodeVendor.run({
      context,
      identity,
      memoryKey,
      buildRequest: async ({ continuing }) => ({
        model,
        prompt: opencodeVendor.promptOf({ question: prompt, before: continuing ? [] : turns }),
        system: opencodeVendor.systemOf({ texts: [], turns }),
        ...(json ? { outputSchema: { type: 'object' } } : {}),
        ...opencodeVendor.optionsOf({ options: { temperature, topP, frequencyPenalty, presencePenalty, maxOutputTokens: maxTokens } }),
      }),
    });
    if (result.status === 'paused') {
      return {};
    }
    return json ? JSON.stringify(result.answer.structured) : result.answer.answer;
  },
});
