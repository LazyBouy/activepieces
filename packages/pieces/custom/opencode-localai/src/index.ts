import { createPiece, PieceAuth, PieceCategory } from '@activepieces/pieces-framework';
import { askLocalAi } from './lib/actions/ask-localai';

export const localai = createPiece({
  displayName: 'LocalAI (via OpenCode)',
  description: 'Ask models on your own LocalAI server through OpenCode.',
  minimumSupportedRelease: '0.88.2',
  logoUrl: 'https://cdn.activepieces.com/pieces/localai.jpeg',
  auth: PieceAuth.None(),
  categories: [PieceCategory.ARTIFICIAL_INTELLIGENCE],
  actions: [askLocalAi],
  authors: ['LazyBouy'],
  triggers: [],
});
