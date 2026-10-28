import { createAction, isNil, Property } from '@activepieces/pieces-framework';
import { opencodeVendor } from '@iphi-flow/opencode-pieces-common';
import { identity } from '../identity';
import { analyzeSentimentOutputSchema } from '../output-schemas';

export const analyzeSentiment = createAction({
  audience: 'both',
  name: 'analyze_sentiment',
  classification: 'READ',
  displayName: 'Analyze Text Sentiment',
  description: 'Label text as positive, negative or neutral.',
  aiMetadata: {
    description:
      'Judges the emotional tone of a block of text with an OpenAI model through OpenCode at temperature 0, returning a positive, negative or neutral label plus a confidence score and a short explanation. Pick it for tone or satisfaction scoring; extract-structured-data pulls named fields or custom labels out of prose. Not idempotent: each call is a fresh model completion and the label can shift between runs.',
    idempotent: false,
  },
  props: {
    model: opencodeVendor.modelDropdown({ identity, displayName: 'Model', description: 'The model that judges the sentiment.', required: true, defaultValue: 'gpt-4o-mini' }),
    text: Property.LongText({
      displayName: 'Text',
      description: 'A message, review or any other text.',
      required: true,
    }),
  },
  outputSchema: analyzeSentimentOutputSchema,
  async run(context) {
    const { model, text } = context.propsValue;
    const result = await opencodeVendor.run({
      context,
      identity,
      buildRequest: async () => ({
        model,
        prompt: `${SENTIMENT_INSTRUCTION}\n\n${text}`,
        outputSchema: SENTIMENT_SCHEMA,
        ...opencodeVendor.optionsOf({ options: { temperature: 0 } }),
      }),
    });
    if (result.status === 'paused') {
      return {};
    }
    return sentimentOf({ structured: result.answer.structured });
  },
});

function sentimentOf({ structured }: { structured: unknown }): Sentiment {
  const value = typeof structured === 'object' && !isNil(structured) ? structured : {};
  const label = 'sentiment' in value ? String(value.sentiment).toLowerCase() : '';
  const confidence = 'confidence' in value && typeof value.confidence === 'number' && value.confidence >= 0 && value.confidence <= 1 ? value.confidence : undefined;
  const explanation = 'explanation' in value && typeof value.explanation === 'string' ? value.explanation : undefined;
  return {
    sentiment: SENTIMENTS.find((sentiment) => sentiment === label) ?? 'neutral',
    confidence,
    explanation,
  };
}

const SENTIMENTS = ['positive', 'negative', 'neutral'] as const;

const SENTIMENT_INSTRUCTION =
  'Judge the sentiment of the text below as positive, negative or neutral. Give your confidence from 0 to 1 and a short explanation.';

const SENTIMENT_SCHEMA = {
  type: 'object',
  properties: {
    sentiment: { type: 'string', enum: [...SENTIMENTS] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    explanation: { type: 'string' },
  },
  required: ['sentiment', 'confidence', 'explanation'],
};

type Sentiment = {
  sentiment: (typeof SENTIMENTS)[number];
  confidence: number | undefined;
  explanation: string | undefined;
};
