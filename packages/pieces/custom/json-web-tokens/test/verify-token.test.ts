/// <reference types="vitest/globals" />

import { JwtAlgorithm } from '../src/lib/common/algorithms';
import { clock } from '../src/lib/common/clock';
import { JwtAuthProps, testUtils } from './test-utils';

const NOW = testUtils.FIXED_NOW;
const SECRET = 'top-secret';
const auth = testUtils.secretAuth({ secret: SECRET });
const rsa = testUtils.rsaKeys();
const p256 = testUtils.ecKeys('P-256');
const p384 = testUtils.ecKeys('P-384');
const p521 = testUtils.ecKeys('P-521');

const SIGNATURE_MESSAGE = "The token's signature does not match this connection's key.";
const NOT_VALID_MESSAGE = 'This is not a valid JSON Web Token.';

const FAMILIES: { algorithm: JwtAlgorithm; auth: JwtAuthProps }[] = [
  { algorithm: 'HS256', auth: testUtils.secretAuth({ secret: SECRET, algorithm: 'HS256' }) },
  { algorithm: 'HS384', auth: testUtils.secretAuth({ secret: SECRET, algorithm: 'HS384' }) },
  { algorithm: 'HS512', auth: testUtils.secretAuth({ secret: SECRET, algorithm: 'HS512' }) },
  { algorithm: 'RS256', auth: testUtils.keyPairAuth({ ...rsa, algorithm: 'RS256' }) },
  { algorithm: 'RS384', auth: testUtils.keyPairAuth({ ...rsa, algorithm: 'RS384' }) },
  { algorithm: 'RS512', auth: testUtils.keyPairAuth({ ...rsa, algorithm: 'RS512' }) },
  { algorithm: 'PS256', auth: testUtils.keyPairAuth({ ...rsa, algorithm: 'PS256' }) },
  { algorithm: 'PS384', auth: testUtils.keyPairAuth({ ...rsa, algorithm: 'PS384' }) },
  { algorithm: 'PS512', auth: testUtils.keyPairAuth({ ...rsa, algorithm: 'PS512' }) },
  { algorithm: 'ES256', auth: testUtils.keyPairAuth({ ...p256, algorithm: 'ES256' }) },
  { algorithm: 'ES384', auth: testUtils.keyPairAuth({ ...p384, algorithm: 'ES384' }) },
  { algorithm: 'ES512', auth: testUtils.keyPairAuth({ ...p521, algorithm: 'ES512' }) },
];

beforeEach(() => {
  vi.spyOn(clock, 'now').mockReturnValue(testUtils.FIXED_NOW_MS);
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function makeToken({
  connection = auth,
  propsValue = {},
}: {
  connection?: JwtAuthProps;
  propsValue?: Record<string, unknown>;
} = {}): Promise<string> {
  return (await testUtils.createToken({ auth: connection, propsValue })).token;
}

describe('Verify Token', () => {
  test.each(FAMILIES)('signs and verifies with $algorithm', async ({ algorithm, auth: connection }) => {
    const created = await testUtils.createToken({ auth: connection, propsValue: { subject: 'user-1', expires_in: 60 } });
    expect(created.header['alg']).toBe(algorithm);
    const out = await testUtils.verifyToken({ auth: connection, propsValue: { token: created.token } });
    expect(out).toEqual({ valid: true, header: created.header, payload: created.payload });
  });

  test('a connection with only the public key verifies, and one with only the private key works it out', async () => {
    const token = await makeToken({ connection: testUtils.keyPairAuth({ privateKey: p256.privateKey, algorithm: 'ES256' }) });
    const publicOnly = testUtils.keyPairAuth({ publicKey: p256.publicKey, algorithm: 'ES256' });
    const privateOnly = testUtils.keyPairAuth({ privateKey: p256.privateKey, algorithm: 'ES256' });
    expect((await testUtils.verifyToken({ auth: publicOnly, propsValue: { token } })).valid).toBe(true);
    expect((await testUtils.verifyToken({ auth: privateOnly, propsValue: { token } })).valid).toBe(true);
  });

  test('a token signed with another key fails the signature check', async () => {
    const token = await makeToken({ connection: testUtils.secretAuth({ secret: 'other-secret' }) });
    await expect(testUtils.verifyToken({ auth, propsValue: { token } })).rejects.toThrow(SIGNATURE_MESSAGE);
    const otherPair = testUtils.rsaKeys();
    const rsaToken = await makeToken({ connection: testUtils.keyPairAuth({ privateKey: otherPair.privateKey }) });
    await expect(
      testUtils.verifyToken({ auth: testUtils.keyPairAuth({ publicKey: rsa.publicKey }), propsValue: { token: rsaToken } }),
    ).rejects.toThrow(SIGNATURE_MESSAGE);
  });

  test('a token signed with another algorithm fails, even with the same key', async () => {
    const token = await makeToken({ connection: testUtils.secretAuth({ secret: SECRET, algorithm: 'HS512' }) });
    await expect(testUtils.verifyToken({ auth, propsValue: { token } })).rejects.toThrow(SIGNATURE_MESSAGE);
    const rsToken = await makeToken({ connection: testUtils.keyPairAuth({ ...rsa, algorithm: 'RS256' }) });
    await expect(
      testUtils.verifyToken({ auth: testUtils.keyPairAuth({ ...rsa, algorithm: 'PS256' }), propsValue: { token: rsToken } }),
    ).rejects.toThrow(SIGNATURE_MESSAGE);
  });

  test('an unsigned token and a changed payload fail the signature check', async () => {
    await expect(testUtils.verifyToken({ auth, propsValue: { token: testUtils.unsignedToken({ sub: 'x' }) } })).rejects.toThrow(
      SIGNATURE_MESSAGE,
    );
    const [header, , signature] = (await makeToken()).split('.');
    const tampered = `${header}.${testUtils.encodeSegment({ sub: 'admin', iat: NOW })}.${signature}`;
    await expect(testUtils.verifyToken({ auth, propsValue: { token: tampered } })).rejects.toThrow(SIGNATURE_MESSAGE);
  });

  test('an expired token fails with its expiry time unless expired tokens are allowed', async () => {
    const token = testUtils.signWithHmac({ header: { alg: 'HS256', typ: 'JWT' }, payload: { exp: NOW - 10 }, secret: SECRET });
    await expect(testUtils.verifyToken({ auth, propsValue: { token } })).rejects.toThrow(
      `The token expired at ${testUtils.toIso(NOW - 10)}.`,
    );
    expect((await testUtils.verifyToken({ auth, propsValue: { token, allow_expired: true } })).valid).toBe(true);
  });

  test('a token is expired from the second of its exp', async () => {
    const token = testUtils.signWithHmac({ header: { alg: 'HS256' }, payload: { exp: NOW }, secret: SECRET });
    await expect(testUtils.verifyToken({ auth, propsValue: { token } })).rejects.toThrow(
      `The token expired at ${testUtils.toIso(NOW)}.`,
    );
    const later = testUtils.signWithHmac({ header: { alg: 'HS256' }, payload: { exp: NOW + 1 }, secret: SECRET });
    expect((await testUtils.verifyToken({ auth, propsValue: { token: later } })).valid).toBe(true);
  });

  test('a token not yet valid fails with its start time unless such tokens are allowed', async () => {
    const token = testUtils.signWithHmac({ header: { alg: 'HS256' }, payload: { nbf: NOW + 100 }, secret: SECRET });
    await expect(testUtils.verifyToken({ auth, propsValue: { token } })).rejects.toThrow(
      `The token is not valid until ${testUtils.toIso(NOW + 100)}.`,
    );
    expect((await testUtils.verifyToken({ auth, propsValue: { token, allow_not_yet_valid: true } })).valid).toBe(true);
  });

  test('the clock tolerance widens both time checks', async () => {
    const expired = testUtils.signWithHmac({ header: { alg: 'HS256' }, payload: { exp: NOW - 10 }, secret: SECRET });
    const early = testUtils.signWithHmac({ header: { alg: 'HS256' }, payload: { nbf: NOW + 10 }, secret: SECRET });
    expect((await testUtils.verifyToken({ auth, propsValue: { token: expired, clock_tolerance: 20 } })).valid).toBe(true);
    expect((await testUtils.verifyToken({ auth, propsValue: { token: early, clock_tolerance: 20 } })).valid).toBe(true);
    await expect(testUtils.verifyToken({ auth, propsValue: { token: expired, clock_tolerance: 5 } })).rejects.toThrow(
      `The token expired at ${testUtils.toIso(NOW - 10)}.`,
    );
    await expect(testUtils.verifyToken({ auth, propsValue: { token: expired, clock_tolerance: -1 } })).rejects.toThrow(
      'Clock tolerance (seconds) must be a number of 0 or more.',
    );
  });

  test('the expected audience must be in aud', async () => {
    const single = await makeToken({ propsValue: { audience: 'api' } });
    const several = await makeToken({ propsValue: { claims: { aud: ['web', 'api'] } } });
    const none = await makeToken();
    expect((await testUtils.verifyToken({ auth, propsValue: { token: single, expected_audience: 'api' } })).valid).toBe(true);
    expect((await testUtils.verifyToken({ auth, propsValue: { token: several, expected_audience: 'api' } })).valid).toBe(true);
    for (const token of [single, none]) {
      await expect(testUtils.verifyToken({ auth, propsValue: { token, expected_audience: 'billing' } })).rejects.toThrow(
        "The token's audience does not match.",
      );
    }
    expect((await testUtils.verifyToken({ auth, propsValue: { token: none, expected_audience: '' } })).valid).toBe(true);
  });

  test('the expected issuer must equal iss', async () => {
    const token = await makeToken({ propsValue: { issuer: 'flows' } });
    expect((await testUtils.verifyToken({ auth, propsValue: { token, expected_issuer: 'flows' } })).valid).toBe(true);
    await expect(testUtils.verifyToken({ auth, propsValue: { token, expected_issuer: 'other' } })).rejects.toThrow(
      "The token's issuer does not match.",
    );
  });

  test('checks the signature first, then the times, then the audience and issuer', async () => {
    const expiredWrongKey = testUtils.signWithHmac({ header: { alg: 'HS256' }, payload: { exp: NOW - 10 }, secret: 'other' });
    await expect(testUtils.verifyToken({ auth, propsValue: { token: expiredWrongKey } })).rejects.toThrow(SIGNATURE_MESSAGE);
    const expiredWrongAudience = testUtils.signWithHmac({
      header: { alg: 'HS256' },
      payload: { exp: NOW - 10, aud: 'web' },
      secret: SECRET,
    });
    await expect(
      testUtils.verifyToken({ auth, propsValue: { token: expiredWrongAudience, expected_audience: 'api' } }),
    ).rejects.toThrow(`The token expired at ${testUtils.toIso(NOW - 10)}.`);
  });

  test('text that is not a JSON Web Token fails', async () => {
    const notTokens = [
      '',
      'abc',
      'a.b',
      'a.b.c.d',
      'not!base64.e30.sig',
      `${testUtils.encodeSegment({ alg: 'HS256' })}.${Buffer.from('plain text').toString('base64url')}.sig`,
      `${testUtils.encodeSegment({ alg: 'HS256' })}.${testUtils.encodeSegment([1, 2])}.sig`,
      `${testUtils.encodeSegment({ typ: 'JWT' })}.${testUtils.encodeSegment({})}.sig`,
    ];
    for (const token of notTokens) {
      await expect(testUtils.verifyToken({ auth, propsValue: { token } }), token).rejects.toThrow(NOT_VALID_MESSAGE);
    }
  });

  test('a signed token whose exp is not a number is not a valid token', async () => {
    const token = testUtils.signWithHmac({ header: { alg: 'HS256' }, payload: { exp: 'soon' }, secret: SECRET });
    await expect(testUtils.verifyToken({ auth, propsValue: { token } })).rejects.toThrow(NOT_VALID_MESSAGE);
  });

  test('spaces around the token are ignored', async () => {
    const token = await makeToken();
    expect((await testUtils.verifyToken({ auth, propsValue: { token: `  ${token}\n` } })).valid).toBe(true);
  });
});
