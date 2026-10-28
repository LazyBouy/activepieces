import { OutputSchema } from '@activepieces/pieces-framework';

export const askAiOutputSchema: OutputSchema = {
  fields: [
    {
      key: 'answer',
      label: 'Answer',
      value: '',
      listItems: [{ key: 'Content', label: 'Content' }],
    },
  ],
};
