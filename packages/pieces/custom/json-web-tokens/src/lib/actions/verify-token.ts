import { createAction, Property } from '@activepieces/pieces-framework';
import { jsonWebTokensAuth } from '../auth';
import { clock } from '../common/clock';
import { keys } from '../common/keys';
import { tokens } from '../common/tokens';
import { values } from '../common/values';
import { outputSchemas } from '../output-schemas';

export const verifyTokenAction = createAction({
  auth: jsonWebTokensAuth,
  audience: 'both',
  name: 'verify_token',
  classification: 'READ',
  displayName: 'Verify Token',
  description:
    "Checks a token's signature with the connection's key, then its times, audience and issuer. Stops the step when a check fails.",
  aiMetadata: {
    description:
      "Checks that a JSON Web Token was signed with the connection's key and algorithm, is inside its valid time window and, when given, has the expected audience and issuer; returns the header and claims only when every check passes. Use it before trusting a token from a request; use Read Token to just look inside a token without checking it. Read-only and safe to retry.",
    idempotent: true,
  },
  props: {
    token: Property.ShortText({
      displayName: 'Token',
      description: 'The JSON Web Token to check: three parts joined by dots.',
      required: true,
    }),
    expected_audience: Property.ShortText({
      displayName: 'Expected audience',
      description: 'When filled in, the token must name this audience in aud.',
      required: false,
    }),
    expected_issuer: Property.ShortText({
      displayName: 'Expected issuer',
      description: 'When filled in, the token must name this issuer in iss.',
      required: false,
    }),
    allow_expired: Property.Checkbox({
      displayName: 'Allow expired tokens',
      description: 'On: a token past its expiry time still passes.',
      required: false,
      defaultValue: false,
    }),
    allow_not_yet_valid: Property.Checkbox({
      displayName: 'Allow tokens not yet valid',
      description: 'On: a token whose start time (nbf) is still ahead passes.',
      required: false,
      defaultValue: false,
    }),
    clock_tolerance: Property.Number({
      displayName: 'Clock tolerance (seconds)',
      description: 'Extra seconds allowed around the expiry and start times, to cover clocks that differ slightly.',
      required: false,
      defaultValue: 0,
    }),
  },
  outputSchema: outputSchemas.verifyToken,
  async run(context) {
    const connection = keys.readConnection(context.auth.props);
    const clockTolerance = values.readSeconds({
      value: context.propsValue.clock_tolerance,
      label: 'Clock tolerance (seconds)',
    });
    const decoded = tokens.decode(context.propsValue.token);
    tokens.verify({
      connection,
      token: decoded.token,
      options: {
        audience: values.readText(context.propsValue.expected_audience),
        issuer: values.readText(context.propsValue.expected_issuer),
        ignoreExpiration: values.readFlag(context.propsValue.allow_expired),
        ignoreNotBefore: values.readFlag(context.propsValue.allow_not_yet_valid),
        clockTolerance,
        clockTimestamp: clock.nowInSeconds(),
      },
    });
    return {
      valid: true,
      header: decoded.header,
      payload: decoded.payload,
    };
  },
});
