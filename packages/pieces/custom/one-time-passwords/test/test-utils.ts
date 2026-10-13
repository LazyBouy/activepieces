import { AppConnectionType, createMockActionContext } from '@activepieces/pieces-framework';
import { generateCodeAction } from '../src/lib/actions/generate-code';
import { oneTimePasswordsAuth } from '../src/lib/auth';

function encodeBase32(data: Buffer): string {
  const bits = [...data].map((byte) => byte.toString(2).padStart(8, '0')).join('');
  const padded = bits.padEnd(Math.ceil(bits.length / 5) * 5, '0');
  const groups = padded.match(/.{5}/g) ?? [];
  return groups.map((group) => ALPHABET[parseInt(group, 2)]).join('');
}

function generateCode({ secret, propsValue }: { secret: string; propsValue: Record<string, unknown> }) {
  return generateCodeAction.run({
    ...createMockActionContext({ propsValue }),
    auth: { type: AppConnectionType.SECRET_TEXT, secret_text: secret },
  });
}

function validate(secret: string) {
  const validator = oneTimePasswordsAuth.validate;
  if (validator === undefined) {
    throw new Error('The connection has no validate function.');
  }
  return validator({
    auth: secret,
    server: {
      apiUrl: 'http://localhost:3000',
      publicUrl: 'http://localhost:4200',
      mintOidcToken: async () => 'test-oidc-token',
    },
  });
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export const testUtils = {
  encodeBase32,
  generateCode,
  validate,
};
