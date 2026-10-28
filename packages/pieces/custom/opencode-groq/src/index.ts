import { createPiece, PieceAuth, PieceCategory } from '@activepieces/pieces-framework';
import { askAi } from './lib/actions/ask-ai';

export const groq = createPiece({
  displayName: 'Groq (via OpenCode)',
  description: 'Ask Groq-hosted models through OpenCode.',
  minimumSupportedRelease: '0.88.2',
  logoUrl: 'https://cdn.activepieces.com/pieces/groq.png',
  auth: PieceAuth.None(),
  categories: [PieceCategory.ARTIFICIAL_INTELLIGENCE],
  actions: [askAi],
  authors: ['LazyBouy'],
  triggers: [],
});
