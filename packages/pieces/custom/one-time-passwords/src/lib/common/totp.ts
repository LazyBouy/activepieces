import { createHmac } from 'node:crypto';

function generate({
  key,
  timeMs,
  period,
  digits,
  algorithm,
}: {
  key: Buffer;
  timeMs: number;
  period: number;
  digits: number;
  algorithm: TotpAlgorithm;
}): TotpCode {
  const nowSeconds = Math.floor(timeMs / 1000);
  const counter = Math.floor(nowSeconds / period);
  const validUntilSeconds = (counter + 1) * period;
  return {
    code: hotp({ key, counter, digits, algorithm }),
    secondsRemaining: validUntilSeconds - nowSeconds,
    validUntil: new Date(validUntilSeconds * 1000).toISOString(),
  };
}

function hotp({
  key,
  counter,
  digits,
  algorithm,
}: {
  key: Buffer;
  counter: number;
  digits: number;
  algorithm: TotpAlgorithm;
}): string {
  const message = Buffer.alloc(8);
  message.writeUInt32BE(Math.floor(counter / TWO_TO_32), 0);
  message.writeUInt32BE(counter % TWO_TO_32, 4);
  const digest = createHmac(HASH_NAMES[algorithm], key).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    (digest[offset + 1] << 16) |
    (digest[offset + 2] << 8) |
    digest[offset + 3];
  return String(binary % Math.pow(10, digits)).padStart(digits, '0');
}

const TWO_TO_32 = 4294967296;

const HASH_NAMES: Record<TotpAlgorithm, string> = {
  SHA1: 'sha1',
  SHA256: 'sha256',
  SHA512: 'sha512',
};

const ALGORITHMS: readonly TotpAlgorithm[] = ['SHA1', 'SHA256', 'SHA512'];

const DIGITS: readonly number[] = [6, 7, 8];

export const totp = {
  generate,
  hotp,
  ALGORITHMS,
  DIGITS,
};

export type TotpAlgorithm = 'SHA1' | 'SHA256' | 'SHA512';

export type TotpCode = {
  code: string;
  secondsRemaining: number;
  validUntil: string;
};
