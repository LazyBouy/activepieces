import { createPiece, PieceAuth, PieceCategory } from '@activepieces/pieces-framework';
import { createChatCompletion } from './lib/actions/create-chat-completion';
import { generateChatCompletion } from './lib/actions/generate-chat-completion';

export const mistralAi = createPiece({
  displayName: 'Mistral AI (via OpenCode)',
  description: 'Ask Mistral AI models through OpenCode.',
  minimumSupportedRelease: '0.88.2',
  logoUrl: 'https://cdn.activepieces.com/pieces/mistral-ai.png',
  auth: PieceAuth.None(),
  categories: [PieceCategory.ARTIFICIAL_INTELLIGENCE],
  actions: [createChatCompletion, generateChatCompletion],
  authors: ['LazyBouy'],
  triggers: [],
});
