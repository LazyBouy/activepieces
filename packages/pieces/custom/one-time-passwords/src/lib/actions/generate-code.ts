import { createAction, Property } from '@activepieces/pieces-framework';
import { oneTimePasswordsAuth } from '../auth';
import { base32 } from '../common/base32';
import { clock } from '../common/clock';
import { totp, TotpAlgorithm } from '../common/totp';
import { values } from '../common/values';
import { outputSchemas } from '../output-schemas';

export const generateCodeAction = createAction({
  auth: oneTimePasswordsAuth,
  audience: 'both',
  name: 'generate_code',
  classification: 'READ',
  displayName: 'Generate Code',
  description: "Generates the current one-time code for the connection's secret, like an authenticator app.",
  aiMetadata: {
    description:
      "Computes the current time-based one-time code (TOTP, RFC 6238) from the connection's secret, as an authenticator app would, and says how long it stays valid. Use it to finish a two-step sign-in in an automated login. Calls inside the same time window return the same code; read-only and safe to retry.",
    idempotent: true,
  },
  props: {
    algorithm: Property.StaticDropdown<TotpAlgorithm, false>({
      displayName: 'Algorithm',
      description: 'The hash the service uses. Most services use SHA-1.',
      required: false,
      defaultValue: 'SHA1',
      options: {
        options: [
          { label: 'SHA-1', value: 'SHA1' },
          { label: 'SHA-256', value: 'SHA256' },
          { label: 'SHA-512', value: 'SHA512' },
        ],
      },
    }),
    digits: Property.StaticDropdown<number, false>({
      displayName: 'Digits',
      description: 'How long the code is. Most services use 6 digits.',
      required: false,
      defaultValue: 6,
      options: {
        options: [
          { label: '6 digits', value: 6 },
          { label: '7 digits', value: 7 },
          { label: '8 digits', value: 8 },
        ],
      },
    }),
    period: Property.Number({
      displayName: 'Period (seconds)',
      description: 'How long each code lasts. Most services use 30 seconds.',
      required: false,
      defaultValue: 30,
    }),
  },
  outputSchema: outputSchemas.generateCode,
  async run(context) {
    const algorithm = values.chooseOption({
      value: context.propsValue.algorithm,
      allowed: totp.ALGORITHMS,
      fallback: 'SHA1',
      message: 'Choose SHA-1, SHA-256 or SHA-512 for Algorithm.',
    });
    const digits = values.chooseOption({
      value: context.propsValue.digits,
      allowed: totp.DIGITS,
      fallback: 6,
      message: 'Choose 6, 7 or 8 for Digits.',
    });
    const period = values.readWholeNumber({
      value: context.propsValue.period,
      fallback: 30,
      min: 1,
      message: 'Period (seconds) must be a whole number of 1 or more.',
    });
    const key = base32.decode(context.auth.secret_text);
    if (key === null) {
      throw new Error("The connection's secret is not valid base32.");
    }
    return totp.generate({ key, timeMs: clock.now(), period, digits, algorithm });
  },
});
