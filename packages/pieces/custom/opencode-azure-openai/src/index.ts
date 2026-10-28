import { createPiece, PieceAuth, PieceCategory } from '@activepieces/pieces-framework';
import { askGpt } from './lib/actions/ask-gpt';

export const azureOpenai = createPiece({
  displayName: 'Azure OpenAI (via OpenCode)',
  description: 'Ask models deployed on Azure OpenAI through OpenCode.',
  minimumSupportedRelease: '0.88.2',
  logoUrl: 'https://cdn.activepieces.com/pieces/azure-openai.png',
  auth: PieceAuth.None(),
  categories: [PieceCategory.ARTIFICIAL_INTELLIGENCE],
  actions: [askGpt],
  authors: ['LazyBouy'],
  triggers: [],
});
