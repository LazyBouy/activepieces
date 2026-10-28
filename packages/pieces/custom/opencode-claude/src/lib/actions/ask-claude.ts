import { createAction, DynamicPropsValue, PieceAuth, Property } from '@activepieces/pieces-framework';
import { opencodeStepRun, opencodeVendor } from '@iphi-flow/opencode-pieces-common';
import { identity } from '../identity';
import { askClaudeOutputSchema } from '../output-schemas';

export const askClaude = createAction({
  audience: 'both',
  name: 'ask_claude',
  classification: 'READ',
  displayName: 'Ask Claude',
  description: 'Send a question or instruction to Claude and get a text reply.',
  aiMetadata: {
    description:
      'Sends a free-form question or instruction to a Claude model through OpenCode and returns the reply as plain text, optionally with an image and with extra user/assistant turns after the question as Roles; Extended Thinking Mode uses the model\'s thinking variant. Prefer Extract Structured Data when the answer must be constrained to defined fields. Requires a model and a question, with temperature between 0 and 1; not idempotent, since each call is a fresh generation.',
    idempotent: false,
  },
  props: {
    model: opencodeVendor.modelDropdown({ identity, displayName: 'Model', description: 'The Claude model to use.', required: true }),
    prompt: Property.LongText({
      displayName: 'Question',
      description: 'What you want Claude to answer or do.',
      required: true,
    }),
    systemPrompt: Property.LongText({
      displayName: 'System Prompt',
      description: 'Standing instructions, such as a role or tone, for Claude to follow.',
      required: false,
      defaultValue: "You're a helpful assistant.",
    }),
    image: Property.File({
      displayName: 'Image',
      required: false,
      description: 'An image for Claude to look at along with your question.',
    }),
    maxTokens: Property.Number({
      displayName: 'Maximum Tokens',
      required: false,
      description: 'Longest reply in tokens, about 4 characters each. Empty: 1,000.',
    }),
    temperature: Property.Number({
      displayName: 'Temperature',
      required: false,
      advanced: true,
      description: 'From 0 to 1. Lower is more focused, higher is more varied.',
    }),
    roles: Property.Json({
      displayName: 'Roles',
      required: false,
      advanced: true,
      defaultValue: [],
      description: 'Extra messages sent after the question, as user or assistant turns.',
    }),
    thinkingMode: Property.Checkbox({
      displayName: 'Extended Thinking Mode',
      required: false,
      advanced: true,
      defaultValue: false,
      description: 'Lets Claude reason first, with the chosen model\'s thinking variant in OpenCode.',
    }),
    thinkingModeParams: Property.DynamicProperties({
      auth: PieceAuth.None(),
      displayName: '',
      refreshers: ['thinkingMode'],
      required: false,
      advanced: true,
      props: async ({ thinkingMode }) => {
        if (!thinkingMode) {
          return {};
        }
        const props: DynamicPropsValue = {
          budgetTokens: Property.Number({
            displayName: 'Budget Tokens',
            required: true,
            defaultValue: DEFAULT_THINKING_BUDGET,
            description: 'Tokens Claude may spend reasoning. Up to 16,000 uses the high variant, more the max variant.',
          }),
        };
        return props;
      },
    }),
  },
  outputSchema: askClaudeOutputSchema,
  async run(context) {
    const { model, prompt, systemPrompt, image, maxTokens, temperature, roles, thinkingMode, thinkingModeParams } = context.propsValue;
    opencodeVendor.checkInputs({ checks: [{ label: 'Temperature', value: temperature, min: 0, max: 1 }] });
    const turns = opencodeVendor.rolesOf({ value: roles, allowed: ['user', 'assistant'] });
    const budget = thinkingModeParams?.['budgetTokens'];
    const result = await opencodeVendor.run({
      context,
      identity,
      buildRequest: async () => ({
        model,
        prompt: opencodeVendor.promptOf({ question: prompt, after: turns }),
        system: opencodeVendor.systemOf({ texts: [systemPrompt || DEFAULT_SYSTEM_PROMPT] }),
        ...(image ? { files: [await opencodeStepRun.uploadFile({ context, file: image })] } : {}),
        ...opencodeVendor.optionsOf({
          options: { maxOutputTokens: maxTokens ?? DEFAULT_MAX_TOKENS, temperature: thinkingMode ? undefined : temperature },
        }),
        ...(thinkingMode ? { variant: opencodeVendor.thinkingVariantOf({ budget: typeof budget === 'number' ? budget : undefined }) } : {}),
      }),
    });
    return result.status === 'paused' ? {} : result.answer.answer;
  },
});

const DEFAULT_THINKING_BUDGET = 1024;

const DEFAULT_MAX_TOKENS = 1000;

const DEFAULT_SYSTEM_PROMPT = 'You are a helpful assistant.';
