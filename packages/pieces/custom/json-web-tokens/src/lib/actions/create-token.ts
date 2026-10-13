import { createAction, Property } from '@activepieces/pieces-framework';
import { jsonWebTokensAuth } from '../auth';
import { clock } from '../common/clock';
import { keys } from '../common/keys';
import { tokens } from '../common/tokens';
import { values } from '../common/values';
import { outputSchemas } from '../output-schemas';

export const createTokenAction = createAction({
  auth: jsonWebTokensAuth,
  audience: 'both',
  name: 'create_token',
  classification: 'READ',
  displayName: 'Create Token',
  description: "Creates a JSON Web Token signed with the connection's key.",
  aiMetadata: {
    description:
      "Builds a signed JSON Web Token from custom claims plus subject, audience, issuer, token ID and an expiry, using the connection's key and algorithm. Use it to call an API that expects a bearer token you sign yourself; use Verify Token to check a token you received. It changes nothing outside the flow and is safe to retry, but each call gets a fresh issued-at time.",
    idempotent: true,
  },
  props: {
    claims: Property.Json({
      displayName: 'Claims',
      description:
        'Custom claims as a JSON object, for example {"role": "admin"}. Fields filled in below replace claims with the same name, and iat is always the time the token is created.',
      required: false,
      defaultValue: {},
    }),
    subject: Property.ShortText({
      displayName: 'Subject',
      description: 'Who the token is about, such as a user ID. Written as sub.',
      required: false,
    }),
    audience: Property.ShortText({
      displayName: 'Audience',
      description: 'Who the token is meant for, such as an API address. Written as aud.',
      required: false,
    }),
    issuer: Property.ShortText({
      displayName: 'Issuer',
      description: 'Who created the token. Written as iss.',
      required: false,
    }),
    token_id: Property.ShortText({
      displayName: 'Token ID',
      description: 'A unique ID for this token. Written as jti.',
      required: false,
    }),
    expires_in: Property.Number({
      displayName: 'Expires in (seconds)',
      description: 'How long the token stays valid, counted from now. Written as exp. Leave empty for a token that never expires.',
      required: false,
      defaultValue: 3600,
    }),
    valid_from: Property.Number({
      displayName: 'Valid from (seconds from now)',
      description: 'How long to wait before the token can be used. Written as nbf. Leave empty for a token that is valid at once.',
      required: false,
    }),
    extra_header_fields: Property.Json({
      displayName: 'Extra header fields',
      description:
        "More fields for the token header, as a JSON object. The algorithm (alg) always comes from the connection and cannot be changed here.",
      required: false,
      defaultValue: {},
    }),
    key_id: Property.ShortText({
      displayName: 'Key ID',
      description: 'Tells the receiver which key signed the token. Written to the header as kid.',
      required: false,
    }),
  },
  outputSchema: outputSchemas.createToken,
  async run(context) {
    const connection = keys.readConnection(context.auth.props);
    const claims = values.readJsonObject({ value: context.propsValue.claims, label: 'Claims' });
    const extraFields = values.readJsonObject({
      value: context.propsValue.extra_header_fields,
      label: 'Extra header fields',
    });
    const expiresIn = values.readWholeNumber({
      value: context.propsValue.expires_in,
      label: 'Expires in (seconds)',
      min: 1,
    });
    const validFrom = values.readWholeNumber({
      value: context.propsValue.valid_from,
      label: 'Valid from (seconds from now)',
      min: 0,
    });
    const now = clock.nowInSeconds();
    const payload: Record<string, unknown> = {
      ...claims,
      ...textClaim({ name: 'sub', value: context.propsValue.subject }),
      ...textClaim({ name: 'aud', value: context.propsValue.audience }),
      ...textClaim({ name: 'iss', value: context.propsValue.issuer }),
      ...textClaim({ name: 'jti', value: context.propsValue.token_id }),
      iat: now,
      ...(expiresIn === null ? {} : { exp: now + expiresIn }),
      ...(validFrom === null ? {} : { nbf: now + validFrom }),
    };
    TIME_CLAIMS_FROM_CLAIMS.forEach((name) => checkTimeClaim({ payload, name }));
    const token = tokens.sign({
      connection,
      payload,
      header: tokens.buildHeader({
        algorithm: connection.algorithm,
        extraFields,
        keyId: values.readText(context.propsValue.key_id),
      }),
    });
    const decoded = tokens.decode(token);
    return {
      token,
      header: decoded.header,
      payload: decoded.payload,
      expiresAt: values.secondsToIso(decoded.payload['exp']),
    };
  },
});

function textClaim({ name, value }: { name: string; value: unknown }): Record<string, string> {
  const text = values.readText(value);
  return text === '' ? {} : { [name]: text };
}

function checkTimeClaim({ payload, name }: { payload: Record<string, unknown>; name: string }): void {
  const value = payload[name];
  if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value))) {
    throw new Error(`The ${name} claim in Claims must be a number of seconds since 1970.`);
  }
}

const TIME_CLAIMS_FROM_CLAIMS = ['exp', 'nbf'];
