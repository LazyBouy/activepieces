import { createAction, Property } from '@activepieces/pieces-framework';
import { opencodeVendor } from '@iphi-flow/opencode-pieces-common';
import { identity } from '../identity';

export const askGpt = createAction({
  audience: 'both',
  name: 'ask_gpt',
  classification: 'READ',
  displayName: 'Ask GPT',
  description: 'Ask ChatGPT anything you want!',
  aiMetadata: {
    description:
      'Sends a prompt to a chat model deployed on Azure OpenAI through OpenCode and returns the answer text; leave the memory key empty for a one-off question, or set one so runs that share it continue one OpenCode session. The deployment list shows the Azure models connected in OpenCode. Not idempotent: every call is a fresh completion.',
    idempotent: false,
  },
  props: {
    deploymentId: opencodeVendor.modelDropdown({ identity, displayName: 'Deployment Name', description: 'The name of your model deployment, as OpenCode\'s Azure provider lists it.', required: true }),
    prompt: Property.LongText({
      displayName: 'Question',
      required: true,
    }),
    temperature: Property.Number({
      displayName: 'Temperature',
      required: false,
      description:
        'Controls randomness: Lowering results in less random completions. As the temperature approaches zero, the model will become deterministic and repetitive.',
      defaultValue: 0.9,
    }),
    maxTokens: Property.Number({
      displayName: 'Maximum Tokens',
      required: true,
      description:
        "The maximum number of tokens to generate. Requests can use up to 2,048 or 4,096 tokens shared between prompt and completion depending on the model. Don't set the value to maximum and leave some tokens for the input. (One token is roughly 4 characters for normal English text)",
      defaultValue: 2048,
    }),
    topP: Property.Number({
      displayName: 'Top P',
      required: false,
      description:
        'An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered.',
      defaultValue: 1,
    }),
    frequencyPenalty: Property.Number({
      displayName: 'Frequency penalty',
      required: false,
      description:
        "Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim.",
      defaultValue: 0,
    }),
    presencePenalty: Property.Number({
      displayName: 'Presence penalty',
      required: false,
      description:
        "Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the mode's likelihood to talk about new topics.",
      defaultValue: 0.6,
    }),
    memoryKey: Property.ShortText({
      displayName: 'Memory Key',
      description:
        'A memory key that will keep the chat history shared across runs and flows. Keep it empty to leave ChatGPT without memory of previous messages.',
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
    const { deploymentId, prompt, temperature, maxTokens, topP, frequencyPenalty, presencePenalty, memoryKey, roles } = context.propsValue;
    opencodeVendor.checkInputs({
      checks: [
        { label: 'Temperature', value: temperature, min: 0, max: 1 },
        { label: 'Frequency penalty', value: frequencyPenalty, min: -2, max: 2 },
        { label: 'Presence penalty', value: presencePenalty, min: -2, max: 2 },
      ],
    });
    const turns = opencodeVendor.rolesOf({ value: roles, allowed: ['system', 'user', 'assistant'] });
    const result = await opencodeVendor.run({
      context,
      identity,
      memoryKey,
      buildRequest: async ({ continuing }) => ({
        model: deploymentId,
        prompt: opencodeVendor.promptOf({ question: prompt, before: continuing ? [] : turns }),
        system: opencodeVendor.systemOf({ texts: [], turns }),
        ...opencodeVendor.optionsOf({ options: { temperature, topP, frequencyPenalty, presencePenalty, maxOutputTokens: maxTokens } }),
      }),
    });
    return result.status === 'paused' ? {} : result.answer.answer;
  },
});
