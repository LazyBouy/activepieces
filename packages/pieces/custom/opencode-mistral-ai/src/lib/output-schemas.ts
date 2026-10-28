import { OutputSchema } from '@activepieces/pieces-framework';

export const generateChatCompletionOutputSchema: OutputSchema = {
  fields: [
    { key: 'id', label: 'Completion ID' },
    { key: 'model', label: 'Model' },
    { key: 'content', label: 'Reply' },
    { key: 'finish_reason', label: 'Finish Reason' },
    { key: 'prompt_tokens', label: 'Prompt Tokens', format: 'number' },
    { key: 'completion_tokens', label: 'Completion Tokens', format: 'number' },
    { key: 'total_tokens', label: 'Total Tokens', format: 'number' },
  ],
};
