import { createAction, isNil, Property } from '@activepieces/pieces-framework';
import { opencodeVendor, Turn } from '@iphi-flow/opencode-pieces-common';
import { identity } from '../identity';
import { generateChatCompletionOutputSchema } from '../output-schemas';

export const generateChatCompletion = createAction({
  name: 'generate_chat_completion',
  classification: 'READ',
  displayName: 'Generate Chat Completion',
  description: 'Generate a reply from a Mistral chat model given a system prompt and a list of messages.',
  audience: 'ai',
  aiMetadata: {
    description:
      'Generates one assistant reply from a Mistral chat model on OpenCode for a multi-turn message list, with an optional system prompt and JSON output mode, and returns the reply text plus finish reason and token usage. Pick this for stateless text generation where you supply the whole history. Not idempotent: each call is a new completion and the wording varies unless a random seed is set.',
    idempotent: false,
  },
  outputSchema: generateChatCompletionOutputSchema,
  props: {
    model: opencodeVendor.modelDropdown({
      identity,
      displayName: 'Model',
      description: 'Chat model id, e.g. mistral-large-latest or mistral-small-latest, as OpenCode lists them.',
      required: true,
      defaultValue: 'mistral-small-latest',
    }),
    system_prompt: Property.LongText({
      displayName: 'System Prompt',
      description: 'Optional instructions that set the model behaviour for the whole reply.',
      required: false,
    }),
    messages: Property.Array({
      displayName: 'Messages',
      description: 'The conversation so far, oldest first. The last message is usually from the user.',
      required: true,
      properties: {
        role: Property.StaticDropdown({
          displayName: 'Role',
          required: true,
          defaultValue: 'user',
          options: {
            options: [
              { label: 'User', value: 'user' },
              { label: 'Assistant', value: 'assistant' },
            ],
          },
        }),
        content: Property.LongText({ displayName: 'Content', required: true }),
      },
    }),
    response_format: Property.StaticDropdown({
      displayName: 'Response Format',
      description: 'Choose JSON to force the model to return a valid JSON object. Also ask for JSON in the prompt.',
      required: false,
      defaultValue: 'text',
      options: {
        options: [
          { label: 'Text', value: 'text' },
          { label: 'JSON object', value: 'json_object' },
        ],
      },
    }),
    temperature: Property.Number({
      displayName: 'Temperature',
      description: 'Sampling temperature between 0 and 1.5. Mistral recommends 0 to 0.7.',
      required: false,
    }),
    max_tokens: Property.Number({
      displayName: 'Max Tokens',
      description: 'Maximum number of tokens to generate.',
      required: false,
    }),
    random_seed: Property.Number({
      displayName: 'Random Seed',
      description: 'Set a seed to make repeated calls return the same output.',
      required: false,
    }),
  },
  async run(context) {
    const { model, system_prompt, messages, response_format, temperature, max_tokens, random_seed } = context.propsValue;
    const conversation = (messages ?? []).flatMap((message) => turnOf({ value: message }));
    const last = conversation[conversation.length - 1];
    if (isNil(last)) {
      throw new Error('Provide at least one message.');
    }
    const json = response_format === 'json_object';
    const asked = last.role === 'user' ? { question: last.content, before: conversation.slice(0, -1) } : { question: CONTINUE, before: conversation };
    const result = await opencodeVendor.run({
      context,
      identity,
      buildRequest: async () => ({
        model,
        prompt: opencodeVendor.promptOf(asked),
        system: opencodeVendor.systemOf({ texts: [system_prompt] }),
        ...(json ? { outputSchema: { type: 'object' } } : {}),
        ...opencodeVendor.optionsOf({ options: { temperature, maxOutputTokens: max_tokens, seed: random_seed } }),
      }),
    });
    if (result.status === 'paused') {
      return {};
    }
    const { answer } = result;
    return {
      id: answer.messageId ?? '',
      model: answer.model?.modelID ?? model,
      content: json ? JSON.stringify(answer.structured) : answer.answer,
      finish_reason: answer.finish,
      prompt_tokens: answer.usage.input,
      completion_tokens: answer.usage.output,
      total_tokens: answer.usage.input + answer.usage.output,
    };
  },
});

function turnOf({ value }: { value: unknown }): Turn[] {
  if (typeof value !== 'object' || isNil(value)) {
    return [];
  }
  const content = 'content' in value && !isNil(value.content) ? String(value.content) : '';
  return [{ role: 'role' in value && value.role === 'assistant' ? 'assistant' : 'user', content }];
}

const CONTINUE = 'Continue the conversation with the next assistant reply.';
