import { createPiece, PieceAuth, PieceCategory } from '@activepieces/pieces-framework';
import { askDeepseek } from './lib/actions/ask-deepseek';

export const deepseek = createPiece({
  displayName: 'DeepSeek (via OpenCode)',
  description: 'Ask DeepSeek models through OpenCode.',
  minimumSupportedRelease: '0.88.2',
  logoUrl: 'https://cdn.activepieces.com/pieces/deepseek.png',
  auth: PieceAuth.None(),
  categories: [PieceCategory.ARTIFICIAL_INTELLIGENCE],
  actions: [askDeepseek],
  authors: ['LazyBouy'],
  triggers: [],
});
