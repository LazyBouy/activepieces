import { createAction, Property } from '@activepieces/pieces-framework';
import { jsonWebTokensAuth } from '../auth';
import { clock } from '../common/clock';
import { tokens } from '../common/tokens';
import { values } from '../common/values';
import { outputSchemas } from '../output-schemas';

export const readTokenAction = createAction({
  auth: jsonWebTokensAuth,
  requireAuth: false,
  audience: 'both',
  name: 'read_token',
  classification: 'READ',
  displayName: 'Read Token',
  description:
    'Shows the header and claims inside a token without checking its signature. The result is not verified, so do not trust it on its own; use Verify Token for that.',
  aiMetadata: {
    description:
      'Decodes a JSON Web Token and returns its header, claims, expiry time and whether it has expired, without checking the signature and without a connection. Use it to look inside a token, for example to read its kid or issuer before choosing how to check it; use Verify Token before trusting anything in it. Read-only and safe to retry.',
    idempotent: true,
  },
  props: {
    token: Property.ShortText({
      displayName: 'Token',
      description: 'The JSON Web Token to read: three parts joined by dots.',
      required: true,
    }),
  },
  outputSchema: outputSchemas.readToken,
  async run(context) {
    const decoded = tokens.decode(context.propsValue.token);
    const expiry = decoded.payload['exp'];
    return {
      header: decoded.header,
      payload: decoded.payload,
      expiresAt: values.secondsToIso(expiry),
      isExpired: typeof expiry === 'number' && clock.nowInSeconds() >= expiry,
    };
  },
});
