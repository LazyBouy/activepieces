function decode(text: unknown): Buffer | null {
  if (typeof text !== 'string') {
    return null;
  }
  const cleaned = text.replace(/\s+/g, '').toUpperCase().replace(/=+$/, '');
  if (cleaned === '' || !BASE32_TEXT.test(cleaned) || INVALID_REMAINDERS.includes(cleaned.length % 8)) {
    return null;
  }
  let buffered = 0;
  let bufferedBits = 0;
  const bytes: number[] = [];
  for (const character of cleaned) {
    buffered = ((buffered << 5) | ALPHABET.indexOf(character)) & 0xffff;
    bufferedBits += 5;
    if (bufferedBits >= 8) {
      bufferedBits -= 8;
      bytes.push((buffered >>> bufferedBits) & 0xff);
    }
  }
  return Buffer.from(bytes);
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const BASE32_TEXT = /^[A-Z2-7]+$/;

const INVALID_REMAINDERS = [1, 3, 6];

export const base32 = {
  decode,
};
