import { createPiece, PieceAuth, PieceCategory } from '@activepieces/pieces-framework';
import { analyzeSentiment } from './lib/actions/analyze-sentiment';
import { askChatGpt } from './lib/actions/ask-chatgpt';
import { extractStructuredData } from './lib/actions/extract-structured-data';
import { visionPrompt } from './lib/actions/vision-prompt';

export const openai = createPiece({
  displayName: 'OpenAI (via OpenCode)',
  description: 'Ask OpenAI models through OpenCode: chat, images, structured data and sentiment.',
  minimumSupportedRelease: '0.88.2',
  logoUrl: 'https://cdn.activepieces.com/pieces/openai.png',
  auth: PieceAuth.None(),
  categories: [PieceCategory.ARTIFICIAL_INTELLIGENCE],
  actions: [askChatGpt, visionPrompt, extractStructuredData, analyzeSentiment],
  authors: ['LazyBouy'],
  triggers: [],
});
