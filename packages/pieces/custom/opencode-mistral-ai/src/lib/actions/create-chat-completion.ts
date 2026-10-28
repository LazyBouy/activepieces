import { createAction, Property } from '@activepieces/pieces-framework';
import { opencodeVendor } from '@iphi-flow/opencode-pieces-common';
import { identity } from '../identity';

export const createChatCompletion = createAction({
  audience: 'human',
  name: 'create_chat_completion',
  classification: 'READ',
  displayName: 'Ask Mistral',
  description: 'Ask Mistral anything you want!',
  aiMetadata: {
    description:
      'Sends one user prompt to a Mistral chat model through OpenCode and returns only the reply text, with optional temperature, top-p, max-token and random-seed controls; it is stateless, with no conversation memory or system message. The model list shows the Mistral models connected in OpenCode. Not idempotent: each call is a fresh completion and the wording varies unless a random seed is pinned.',
    idempotent: false,
  },
  props: {
    model: opencodeVendor.modelDropdown({ identity, displayName: 'Model', description: 'Select a Mistral model, as OpenCode lists them.', required: true }),
    prompt: Property.LongText({
      displayName: 'Question',
      required: true,
    }),
    temperature: Property.Number({
      displayName: 'Temperature',
      required: false,
      defaultValue: 1,
      description:
        'Controls randomness: Lowering results in less random completions. As the temperature approaches zero, the model will become deterministic and repetitive.',
    }),
    top_p: Property.Number({
      displayName: 'Top P',
      required: false,
      defaultValue: 1,
      description:
        'An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered.',
    }),
    max_tokens: Property.Number({ displayName: 'Max Tokens', required: false }),
    random_seed: Property.Number({ displayName: 'Random Seed', required: false }),
    timeout: Property.Number({
      displayName: 'Timeout (ms)',
      required: false,
      defaultValue: 30000,
      description: 'Has no effect when the step runs on OpenCode; OpenCode\'s own request timeout applies.',
    }),
  },
  async run(context) {
    const { model, prompt, temperature, top_p, max_tokens, random_seed } = context.propsValue;
    const result = await opencodeVendor.run({
      context,
      identity,
      buildRequest: async () => ({
        model,
        prompt,
        ...opencodeVendor.optionsOf({ options: { temperature, topP: top_p, maxOutputTokens: max_tokens, seed: random_seed } }),
      }),
    });
    return result.status === 'paused' ? {} : result.answer.answer;
  },
});
