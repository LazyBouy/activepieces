import { PieceAuth, Property } from '@activepieces/pieces-framework';
import { algorithms, JwtAlgorithm, KeyType } from './common/algorithms';
import { keys } from './common/keys';
import { tokens } from './common/tokens';

export const jsonWebTokensAuth = PieceAuth.CustomAuth({
  description:
    'Choose how tokens are signed. A shared secret is one secret text known to both sides. A key pair uses a private key to create tokens and the matching public key to check them.',
  required: true,
  props: {
    key_type: Property.StaticDropdown<KeyType, true>({
      displayName: 'Key type',
      description: 'Shared secret for HS algorithms, Key pair for RS, PS and ES algorithms.',
      required: true,
      defaultValue: 'secret',
      options: {
        options: [
          { label: 'Shared secret', value: 'secret' },
          { label: 'Key pair', value: 'key_pair' },
        ],
      },
    }),
    secret: PieceAuth.SecretText({
      displayName: 'Secret',
      description: 'For Shared secret: the secret text both sides use, exactly as it is typed.',
      required: false,
    }),
    private_key: PieceAuth.SecretText({
      displayName: 'Private key',
      description:
        'For Key pair: the private key in PEM format, starting with -----BEGIN PRIVATE KEY-----. Needed to create tokens.',
      required: false,
    }),
    public_key: Property.LongText({
      displayName: 'Public key',
      description:
        'For Key pair: the public key or certificate in PEM format, starting with -----BEGIN PUBLIC KEY-----. Needed to check tokens. Leave empty to work it out from the private key.',
      required: false,
    }),
    algorithm: Property.StaticDropdown<JwtAlgorithm, false>({
      displayName: 'Algorithm',
      description: 'How tokens are signed. Leave empty to use HS256 for a shared secret or RS256 for a key pair.',
      required: false,
      options: {
        options: algorithms.OPTIONS,
      },
    }),
  },
  validate: async ({ auth }) => {
    try {
      tokens.checkConnection(keys.readConnection(auth));
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : String(error) };
    }
  },
});
