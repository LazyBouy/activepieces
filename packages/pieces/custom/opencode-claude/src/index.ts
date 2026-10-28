import { createPiece, PieceAuth, PieceCategory } from '@activepieces/pieces-framework';
import { askClaude } from './lib/actions/ask-claude';
import { extractStructuredData } from './lib/actions/extract-structured-data';

export const claude = createPiece({
  displayName: 'Claude (via OpenCode)',
  description: 'Ask Anthropic Claude models through OpenCode: chat and structured data from text, images and PDFs.',
  minimumSupportedRelease: '0.88.2',
  logoUrl: 'https://cdn.activepieces.com/pieces/claude.png',
  auth: PieceAuth.None(),
  categories: [PieceCategory.ARTIFICIAL_INTELLIGENCE],
  actions: [askClaude, extractStructuredData],
  authors: ['LazyBouy'],
  triggers: [],
});
