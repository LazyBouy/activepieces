import { createPiece, PieceAuth, PieceCategory } from '@activepieces/pieces-framework';
import { askAi } from './lib/actions/ask-ai';

export const perplexityAi = createPiece({
  displayName: 'Perplexity AI (via OpenCode)',
  description: 'Ask Perplexity\'s web-search models through OpenCode.',
  minimumSupportedRelease: '0.88.2',
  logoUrl: 'https://cdn.activepieces.com/pieces/perplexity-ai.png',
  auth: PieceAuth.None(),
  categories: [PieceCategory.ARTIFICIAL_INTELLIGENCE],
  actions: [askAi],
  authors: ['LazyBouy'],
  triggers: [],
});
