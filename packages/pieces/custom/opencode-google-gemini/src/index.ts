import { createPiece, PieceAuth, PieceCategory } from '@activepieces/pieces-framework';
import { chatGemini } from './lib/actions/chat-gemini';
import { generateContent } from './lib/actions/generate-content';
import { generateContentFromImage } from './lib/actions/generate-content-from-image';

export const googleGemini = createPiece({
  displayName: 'Google Gemini (via OpenCode)',
  description: 'Generate text with Google Gemini models through OpenCode, from prompts, images and chats.',
  minimumSupportedRelease: '0.88.2',
  logoUrl: 'https://cdn.activepieces.com/pieces/google-gemini.png',
  auth: PieceAuth.None(),
  categories: [PieceCategory.ARTIFICIAL_INTELLIGENCE],
  actions: [generateContent, generateContentFromImage, chatGemini],
  authors: ['LazyBouy'],
  triggers: [],
});
