/// <reference types="vitest/globals" />

import { clock } from '../src/lib/common/clock';
import { totp, TotpAlgorithm } from '../src/lib/common/totp';
import { testUtils } from './test-utils';

const SEEDS: Record<TotpAlgorithm, string> = {
  SHA1: testUtils.encodeBase32(Buffer.from('12345678901234567890', 'ascii')),
  SHA256: testUtils.encodeBase32(Buffer.from('12345678901234567890123456789012', 'ascii')),
  SHA512: testUtils.encodeBase32(
    Buffer.from('1234567890123456789012345678901234567890123456789012345678901234', 'ascii'),
  ),
};

const RFC_6238_VECTORS: { time: number; algorithm: TotpAlgorithm; code: string }[] = [
  { time: 59, algorithm: 'SHA1', code: '94287082' },
  { time: 59, algorithm: 'SHA256', code: '46119246' },
  { time: 59, algorithm: 'SHA512', code: '90693936' },
  { time: 1111111109, algorithm: 'SHA1', code: '07081804' },
  { time: 1111111109, algorithm: 'SHA256', code: '68084774' },
  { time: 1111111109, algorithm: 'SHA512', code: '25091201' },
  { time: 1111111111, algorithm: 'SHA1', code: '14050471' },
  { time: 1111111111, algorithm: 'SHA256', code: '67062674' },
  { time: 1111111111, algorithm: 'SHA512', code: '99943326' },
  { time: 1234567890, algorithm: 'SHA1', code: '89005924' },
  { time: 1234567890, algorithm: 'SHA256', code: '91819424' },
  { time: 1234567890, algorithm: 'SHA512', code: '93441116' },
  { time: 2000000000, algorithm: 'SHA1', code: '69279037' },
  { time: 2000000000, algorithm: 'SHA256', code: '90698825' },
  { time: 2000000000, algorithm: 'SHA512', code: '38618901' },
  { time: 20000000000, algorithm: 'SHA1', code: '65353130' },
  { time: 20000000000, algorithm: 'SHA256', code: '77737706' },
  { time: 20000000000, algorithm: 'SHA512', code: '47863826' },
];

const RFC_4226_CODES = ['755224', '287082', '359152', '969429', '338314', '254676', '287922', '162583', '399871', '520489'];

afterEach(() => {
  vi.restoreAllMocks();
});

function atTime(ms: number): void {
  vi.spyOn(clock, 'now').mockReturnValue(ms);
}

describe('Generate Code', () => {
  test('the base32 form of the RFC 6238 SHA-1 seed is the well-known one', () => {
    expect(SEEDS.SHA1).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  });

  test.each(RFC_6238_VECTORS)('matches RFC 6238 at $time seconds with $algorithm', async ({ time, algorithm, code }) => {
    atTime(time * 1000);
    const out = await testUtils.generateCode({ secret: SEEDS[algorithm], propsValue: { algorithm, digits: 8, period: 30 } });
    expect(out.code).toBe(code);
  });

  test('matches the RFC 4226 counter values with 6 digits', () => {
    const key = Buffer.from('12345678901234567890', 'ascii');
    expect(RFC_4226_CODES.map((_, counter) => totp.hotp({ key, counter, digits: 6, algorithm: 'SHA1' }))).toEqual(RFC_4226_CODES);
  });

  test('defaults to SHA-1, 6 digits and 30 seconds', async () => {
    atTime(59 * 1000);
    const out = await testUtils.generateCode({ secret: SEEDS.SHA1, propsValue: {} });
    expect(out.code).toBe('287082');
  });

  test('keeps leading zeros, so the code is text of the chosen length', async () => {
    atTime(1111111109 * 1000);
    const eight = await testUtils.generateCode({ secret: SEEDS.SHA1, propsValue: { digits: 8 } });
    const seven = await testUtils.generateCode({ secret: SEEDS.SHA1, propsValue: { digits: 7 } });
    expect(eight.code).toBe('07081804');
    expect(seven.code).toBe('7081804');
    expect(typeof eight.code).toBe('string');
    const six = await testUtils.generateCode({ secret: SEEDS.SHA1, propsValue: { digits: '6' } });
    expect(six.code).toHaveLength(6);
  });

  test('reports the seconds left and when the code stops being valid', async () => {
    atTime(Date.UTC(2026, 0, 15, 12, 0, 10, 750));
    const out = await testUtils.generateCode({ secret: SEEDS.SHA1, propsValue: {} });
    expect(out.secondsRemaining).toBe(20);
    expect(out.validUntil).toBe('2026-01-15T12:00:30.000Z');
    atTime(Date.UTC(2026, 0, 15, 12, 0, 0, 0));
    const atStart = await testUtils.generateCode({ secret: SEEDS.SHA1, propsValue: { period: 60 } });
    expect(atStart.secondsRemaining).toBe(60);
    expect(atStart.validUntil).toBe('2026-01-15T12:01:00.000Z');
  });

  test('the same time window gives the same code and the next window a new one', async () => {
    atTime(1234567890 * 1000);
    const first = await testUtils.generateCode({ secret: SEEDS.SHA1, propsValue: {} });
    atTime((1234567890 + first.secondsRemaining - 1) * 1000);
    const sameWindow = await testUtils.generateCode({ secret: SEEDS.SHA1, propsValue: {} });
    atTime((1234567890 + first.secondsRemaining) * 1000);
    const nextWindow = await testUtils.generateCode({ secret: SEEDS.SHA1, propsValue: {} });
    expect(sameWindow.code).toBe(first.code);
    expect(nextWindow.code).not.toBe(first.code);
  });

  test('accepts the secret with spaces, lower case and padding', async () => {
    atTime(59 * 1000);
    const spaced = SEEDS.SHA1.toLowerCase().replace(/(.{4})/g, '$1 ');
    const out = await testUtils.generateCode({ secret: `${spaced}====`, propsValue: { digits: 8 } });
    expect(out.code).toBe('94287082');
  });

  test('an invalid secret stops the step', async () => {
    await expect(testUtils.generateCode({ secret: 'not base32!', propsValue: {} })).rejects.toThrow(
      "The connection's secret is not valid base32.",
    );
  });

  test('wrong options stop the step with a plain message', async () => {
    await expect(testUtils.generateCode({ secret: SEEDS.SHA1, propsValue: { period: 0 } })).rejects.toThrow(
      'Period (seconds) must be a whole number of 1 or more.',
    );
    await expect(testUtils.generateCode({ secret: SEEDS.SHA1, propsValue: { period: 2.5 } })).rejects.toThrow(
      'Period (seconds) must be a whole number of 1 or more.',
    );
    await expect(testUtils.generateCode({ secret: SEEDS.SHA1, propsValue: { digits: 9 } })).rejects.toThrow(
      'Choose 6, 7 or 8 for Digits.',
    );
    await expect(testUtils.generateCode({ secret: SEEDS.SHA1, propsValue: { algorithm: 'MD5' } })).rejects.toThrow(
      'Choose SHA-1, SHA-256 or SHA-512 for Algorithm.',
    );
  });
});
