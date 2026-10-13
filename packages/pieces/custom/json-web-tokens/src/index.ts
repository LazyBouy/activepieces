import { createPiece, PieceCategory } from '@activepieces/pieces-framework';
import { createTokenAction } from './lib/actions/create-token';
import { readTokenAction } from './lib/actions/read-token';
import { verifyTokenAction } from './lib/actions/verify-token';
import { jsonWebTokensAuth } from './lib/auth';
import { jsonWebTokensLogo } from './lib/logo';

export const jsonWebTokens = createPiece({
  displayName: 'JSON Web Tokens',
  description: 'Create, check and read signed JSON Web Tokens',
  minimumSupportedRelease: '0.30.0',
  logoUrl: jsonWebTokensLogo,
  auth: jsonWebTokensAuth,
  categories: [PieceCategory.CORE],
  actions: [createTokenAction, verifyTokenAction, readTokenAction],
  authors: ['LazyBouy'],
  triggers: [],
});
