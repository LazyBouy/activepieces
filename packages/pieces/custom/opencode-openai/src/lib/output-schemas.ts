import { OutputSchema } from '@activepieces/pieces-framework';

export const analyzeSentimentOutputSchema: OutputSchema = {
  fields: [
    { key: 'sentiment', label: 'Sentiment' },
    { key: 'confidence', label: 'Confidence', format: 'number' },
    { key: 'explanation', label: 'Explanation' },
  ],
};
