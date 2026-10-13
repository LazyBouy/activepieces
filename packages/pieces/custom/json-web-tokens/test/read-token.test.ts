/// <reference types="vitest/globals" />

import { clock } from '../src/lib/common/clock';
import { testUtils } from './test-utils';

const NOW = testUtils.FIXED_NOW;

beforeEach(() => {
  vi.spyOn(clock, 'now').mockReturnValue(testUtils.FIXED_NOW_MS);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Read Token', () => {
  test('returns the header, claims, expiry time and whether it has expired', async () => {
    const token = testUtils.signWithHmac({
      header: { alg: 'HS256', typ: 'JWT', kid: 'k1' },
      payload: { sub: 'user-1', exp: NOW + 60 },
      secret: 's',
    });
    expect(await testUtils.readToken({ propsValue: { token } })).toEqual({
      header: { alg: 'HS256', typ: 'JWT', kid: 'k1' },
      payload: { sub: 'user-1', exp: NOW + 60 },
      expiresAt: testUtils.toIso(NOW + 60),
      isExpired: false,
    });
  });

  test('a token past its exp is expired, from the second of exp', async () => {
    const atExp = testUtils.signWithHmac({ header: { alg: 'HS256' }, payload: { exp: NOW }, secret: 's' });
    const before = testUtils.signWithHmac({ header: { alg: 'HS256' }, payload: { exp: NOW - 3600 }, secret: 's' });
    expect((await testUtils.readToken({ propsValue: { token: atExp } })).isExpired).toBe(true);
    expect(await testUtils.readToken({ propsValue: { token: before } })).toMatchObject({
      expiresAt: testUtils.toIso(NOW - 3600),
      isExpired: true,
    });
  });

  test('a token without exp never expires', async () => {
    const token = testUtils.signWithHmac({ header: { alg: 'HS256' }, payload: { sub: 'x' }, secret: 's' });
    expect(await testUtils.readToken({ propsValue: { token } })).toMatchObject({ expiresAt: null, isExpired: false });
  });

  test('does not check the signature and needs no connection', async () => {
    const [header, payload] = testUtils
      .signWithHmac({ header: { alg: 'RS256' }, payload: { role: 'admin' }, secret: 's' })
      .split('.');
    const out = await testUtils.readToken({ propsValue: { token: `${header}.${payload}.forged-signature` } });
    expect(out.payload).toEqual({ role: 'admin' });
    expect((await testUtils.readToken({ propsValue: { token: testUtils.unsignedToken({ a: 1 }) } })).header).toEqual({
      alg: 'none',
      typ: 'JWT',
    });
  });

  test('text that is not a JSON Web Token fails', async () => {
    for (const token of ['', 'abc.def', 'a.b.c', 42]) {
      await expect(testUtils.readToken({ propsValue: { token } })).rejects.toThrow('This is not a valid JSON Web Token.');
    }
  });
});
