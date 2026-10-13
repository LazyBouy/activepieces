import { createPiece, PieceCategory } from '@activepieces/pieces-framework';
import { generateCodeAction } from './lib/actions/generate-code';
import { oneTimePasswordsAuth } from './lib/auth';
import { oneTimePasswordsLogo } from './lib/logo';

export const oneTimePasswords = createPiece({
  displayName: 'One-Time Passwords',
  description: 'Generate time-based one-time codes (TOTP)',
  minimumSupportedRelease: '0.30.0',
  logoUrl: oneTimePasswordsLogo,
  auth: oneTimePasswordsAuth,
  categories: [PieceCategory.CORE],
  actions: [generateCodeAction],
  authors: ['LazyBouy'],
  triggers: [],
});
