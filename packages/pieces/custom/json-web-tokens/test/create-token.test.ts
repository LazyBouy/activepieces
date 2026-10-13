/// <reference types="vitest/globals" />

import jwt from 'jsonwebtoken';
import { clock } from '../src/lib/common/clock';
import { testUtils } from './test-utils';

const NOW = testUtils.FIXED_NOW;
const auth = testUtils.secretAuth({ secret: 'top-secret' });
const rsa = testUtils.rsaKeys();

beforeEach(() => {
  vi.spyOn(clock, 'now').mockReturnValue(testUtils.FIXED_NOW_MS);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Create Token', () => {
  test('signs with HS256 by default, sets iat to now and exp one hour later', async () => {
    const out = await testUtils.createToken({ auth, propsValue: { expires_in: 3600 } });
    expect(out.header).toEqual({ alg: 'HS256', typ: 'JWT' });
    expect(out.payload).toEqual({ iat: NOW, exp: NOW + 3600 });
    expect(out.expiresAt).toBe(testUtils.toIso(NOW + 3600));
    expect(out.token.split('.')).toHaveLength(3);
    expect(jwt.verify(out.token, 'top-secret', { algorithms: ['HS256'], clockTimestamp: NOW })).toEqual(out.payload);
  });

  test('times are whole seconds since 1970', async () => {
    const out = await testUtils.createToken({ auth, propsValue: { expires_in: 60, valid_from: 30 } });
    expect(out.payload).toEqual({ iat: NOW, exp: NOW + 60, nbf: NOW + 30 });
    [out.payload['iat'], out.payload['exp'], out.payload['nbf']].forEach((value) => expect(Number.isInteger(value)).toBe(true));
  });

  test('writes the standard fields under their standard names', async () => {
    const out = await testUtils.createToken({
      auth,
      propsValue: { subject: 'user-1', audience: 'https://api.example.com', issuer: 'flows', token_id: 'abc-123' },
    });
    expect(out.payload).toEqual({
      sub: 'user-1',
      aud: 'https://api.example.com',
      iss: 'flows',
      jti: 'abc-123',
      iat: NOW,
    });
  });

  test('custom claims are kept and filled-in standard fields win over the same names', async () => {
    const out = await testUtils.createToken({
      auth,
      propsValue: {
        claims: { role: 'admin', sub: 'from-claims', aud: ['a', 'b'], iat: 1, exp: 2, nested: { team: 7 } },
        subject: 'user-1',
        expires_in: 120,
      },
    });
    expect(out.payload).toEqual({
      role: 'admin',
      sub: 'user-1',
      aud: ['a', 'b'],
      iat: NOW,
      exp: NOW + 120,
      nested: { team: 7 },
    });
  });

  test('an empty Expires in gives a token with no expiry', async () => {
    const out = await testUtils.createToken({ auth, propsValue: { expires_in: undefined } });
    expect(out.payload).toEqual({ iat: NOW });
    expect(out.expiresAt).toBeNull();
    const cleared = await testUtils.createToken({ auth, propsValue: { expires_in: '' } });
    expect(cleared.payload['exp']).toBeUndefined();
  });

  test('an exp from Claims stays when Expires in is empty, and must be a number', async () => {
    const out = await testUtils.createToken({ auth, propsValue: { claims: { exp: NOW + 10 } } });
    expect(out.payload['exp']).toBe(NOW + 10);
    expect(out.expiresAt).toBe(testUtils.toIso(NOW + 10));
    await expect(testUtils.createToken({ auth, propsValue: { claims: { exp: 'tomorrow' } } })).rejects.toThrow(
      'The exp claim in Claims must be a number of seconds since 1970.',
    );
    await expect(testUtils.createToken({ auth, propsValue: { claims: { nbf: null } } })).rejects.toThrow(
      'The nbf claim in Claims must be a number of seconds since 1970.',
    );
  });

  test('Claims and Extra header fields accept JSON text and refuse anything that is not an object', async () => {
    const out = await testUtils.createToken({
      auth,
      propsValue: { claims: '{"role":"viewer"}', extra_header_fields: '{"cty":"note"}' },
    });
    expect(out.payload['role']).toBe('viewer');
    expect(out.header['cty']).toBe('note');
    await expect(testUtils.createToken({ auth, propsValue: { claims: ['a'] } })).rejects.toThrow(
      'Claims must be a JSON object, for example {"role": "admin"}.',
    );
    await expect(testUtils.createToken({ auth, propsValue: { extra_header_fields: 'not json' } })).rejects.toThrow(
      'Extra header fields must be a JSON object, for example {"role": "admin"}.',
    );
  });

  test('Extra header fields are merged, alg cannot be changed, and Key ID becomes kid', async () => {
    const out = await testUtils.createToken({
      auth,
      propsValue: {
        extra_header_fields: { alg: 'none', typ: 'at+jwt', kid: 'from-extra', x5t: 'thumb' },
        key_id: 'key-2026',
      },
    });
    expect(out.header).toEqual({ alg: 'HS256', typ: 'at+jwt', kid: 'key-2026', x5t: 'thumb' });
    expect(jwt.decode(out.token, { complete: true })?.header).toEqual(out.header);
    expect(jwt.verify(out.token, 'top-secret', { algorithms: ['HS256'], clockTimestamp: NOW })).toBeTruthy();
  });

  test('uses the connection algorithm', async () => {
    const out = await testUtils.createToken({ auth: testUtils.secretAuth({ secret: 'top-secret', algorithm: 'HS512' }), propsValue: {} });
    expect(out.header['alg']).toBe('HS512');
    const pair = await testUtils.createToken({ auth: testUtils.keyPairAuth({ privateKey: rsa.privateKey, algorithm: 'PS384' }), propsValue: {} });
    expect(pair.header['alg']).toBe('PS384');
    expect(jwt.verify(pair.token, rsa.publicKey, { algorithms: ['PS384'], clockTimestamp: NOW })).toBeTruthy();
  });

  test('a connection with only a public key cannot create tokens', async () => {
    await expect(
      testUtils.createToken({ auth: testUtils.keyPairAuth({ publicKey: rsa.publicKey }), propsValue: {} }),
    ).rejects.toThrow(
      'This connection has only a public key, so it can check tokens but not create them. Add the private key to the connection to create tokens.',
    );
  });

  test('Expires in and Valid from must be whole numbers', async () => {
    for (const expires_in of [0, -5, 1.5, 'soon']) {
      await expect(testUtils.createToken({ auth, propsValue: { expires_in } })).rejects.toThrow(
        'Expires in (seconds) must be a whole number of 1 or more.',
      );
    }
    await expect(testUtils.createToken({ auth, propsValue: { valid_from: -1 } })).rejects.toThrow(
      'Valid from (seconds from now) must be a whole number of 0 or more.',
    );
    const fromText = await testUtils.createToken({ auth, propsValue: { expires_in: ' 90 ' } });
    expect(fromText.payload['exp']).toBe(NOW + 90);
  });
});
