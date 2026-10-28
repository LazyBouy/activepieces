import { createPiece, PieceAuth, PieceCategory } from '@activepieces/pieces-framework';
import { generateContent } from './lib/actions/generate-content';

export const googleVertexAi = createPiece({
  displayName: 'Google Vertex AI (via OpenCode)',
  description: 'Generate content with Gemini models on Google Vertex AI through OpenCode.',
  minimumSupportedRelease: '0.88.2',
  logoUrl: 'https://cdn.activepieces.com/pieces/google-vertexai.png',
  auth: PieceAuth.None(),
  categories: [PieceCategory.ARTIFICIAL_INTELLIGENCE],
  actions: [generateContent],
  authors: ['LazyBouy'],
  triggers: [],
});
