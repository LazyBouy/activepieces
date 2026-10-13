import { PieceAuth } from '@activepieces/pieces-framework';
import { base32 } from './common/base32';

export const oneTimePasswordsAuth = PieceAuth.SecretText({
  displayName: 'Secret',
  description:
    'The secret key shown when two-step sign-in is set up, often under "enter this code manually" next to the QR code. It uses the letters A to Z and the digits 2 to 7; spaces and lower case are fine.',
  required: true,
  validate: async ({ auth }) => {
    if (base32.decode(auth) === null) {
      return {
        valid: false,
        error: 'The secret is not valid base32. Copy the key shown when two-step sign-in is set up; it uses only the letters A to Z and the digits 2 to 7.',
      };
    }
    return { valid: true };
  },
});
