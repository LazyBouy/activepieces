import { createAction, Property } from '@activepieces/pieces-framework';
import { opencodeVendor } from '@iphi-flow/opencode-pieces-common';
import { identity } from '../identity';
import { chatGeminiOutputSchema } from '../output-schemas';

export const chatGemini = createAction({
  audience: 'both',
  name: 'chat_gemini',
  classification: 'READ',
  displayName: 'Chat with Gemini',
  description: 'Chat with Gemini, optionally remembering earlier messages.',
  aiMetadata: {
    description:
      'Sends a prompt as one turn of a Gemini chat on OpenCode and returns the reply with the conversation so far. With a memory key (max 128 characters), runs that share the key continue one OpenCode session, so later runs remember earlier turns; leave it empty for a single turn. Pick it over generate_content when the exchange spans multiple runs. Not idempotent: each call produces a new reply and, with a memory key, extends the session.',
    idempotent: false,
  },
  props: {
    prompt: Property.LongText({
      displayName: 'Prompt',
      required: true,
      description: 'Your next message in the conversation.',
    }),
    model: opencodeVendor.modelDropdown({ identity, displayName: 'Model', description: 'Gemini model that writes the response.', required: true }),
    memoryKey: Property.ShortText({
      displayName: 'Memory Key',
      description: 'Reuse a key to continue its conversation. Empty: no memory.',
      required: false,
    }),
  },
  outputSchema: chatGeminiOutputSchema,
  async run(context) {
    const { prompt, model, memoryKey } = context.propsValue;
    opencodeVendor.checkInputs({ checks: [{ label: 'Memory Key', value: memoryKey, maxLength: 128 }] });
    const result = await opencodeVendor.run({
      context,
      identity,
      memoryKey,
      buildRequest: async () => ({ model, prompt, withHistory: true }),
    });
    if (result.status === 'paused') {
      return {};
    }
    return {
      response: result.answer.answer,
      history: result.answer.history.map((turn) => ({ role: turn.role === 'assistant' ? 'model' : 'user', parts: [{ text: turn.text }] })),
    };
  },
});
