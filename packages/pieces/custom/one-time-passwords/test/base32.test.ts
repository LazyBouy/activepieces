/// <reference types="vitest/globals" />

import { base32 } from '../src/lib/common/base32';
import { testUtils } from './test-utils';

describe('base32 decoding', () => {
  test('decodes the RFC 4648 test vectors, padded and unpadded', () => {
    const vectors: [string, string][] = [
      ['MY======', 'f'],
      ['MZXQ====', 'fo'],
      ['MZXW6===', 'foo'],
      ['MZXW6YQ=', 'foob'],
      ['MZXW6YTB', 'fooba'],
      ['MZXW6YTBOI======', 'foobar'],
      ['MZXW6YTBOI', 'foobar'],
    ];
    vectors.forEach(([encoded, plain]) => expect(base32.decode(encoded)?.toString('ascii'), encoded).toBe(plain));
  });

  test('accepts spaces, line breaks and lower case', () => {
    expect(base32.decode('mzxw 6ytb\noi')?.toString('ascii')).toBe('foobar');
    expect(base32.decode('  GEZD GNBV GY3T QOJQ GEZD GNBV GY3T QOJQ  ')?.toString('ascii')).toBe('12345678901234567890');
  });

  test('round-trips random bytes of every length', () => {
    Array.from({ length: 40 }, (_, length) => Buffer.from(Array.from({ length }, (__, index) => (index * 37 + length) % 256)))
      .filter((bytes) => bytes.length > 0)
      .forEach((bytes) => expect(base32.decode(testUtils.encodeBase32(bytes))).toEqual(bytes));
  });

  test('refuses text that is not base32', () => {
    ['', '   ', '====', 'ABC1', 'ABCD!', 'MZ=XW6YTB', 'A', 'ABC', 'ABCDEF', 'ÄBCD'].forEach((text) =>
      expect(base32.decode(text), text).toBeNull(),
    );
    expect(base32.decode(undefined)).toBeNull();
    expect(base32.decode(12345)).toBeNull();
  });
});
