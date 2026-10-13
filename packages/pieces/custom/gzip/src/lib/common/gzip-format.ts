import { TextDecoder } from 'node:util';
import { gunzipSync, gzipSync } from 'node:zlib';

function isGzip(data: Buffer): boolean {
  return data.length >= 2 && data[0] === MAGIC_FIRST && data[1] === MAGIC_SECOND;
}

function compress({ data, level, storedName }: { data: Buffer; level: number; storedName: string }): Buffer {
  const compressed = gzipSync(data, { level });
  const nameBytes = encodeName(storedName);
  if (nameBytes.length === 0 || compressed[FLAGS_OFFSET] !== 0) {
    return compressed;
  }
  const header = Buffer.from(compressed.subarray(0, HEADER_LENGTH));
  header[FLAGS_OFFSET] = FLAG_NAME;
  return Buffer.concat([header, nameBytes, Buffer.from([0]), compressed.subarray(HEADER_LENGTH)]);
}

function readStoredName(data: Buffer): string | null {
  if (!isGzip(data) || data.length < HEADER_LENGTH) {
    return null;
  }
  const flags = data[FLAGS_OFFSET];
  if ((flags & FLAG_NAME) === 0) {
    return null;
  }
  const start = (flags & FLAG_EXTRA) === 0 ? HEADER_LENGTH : extraEnd(data);
  if (start === null) {
    return null;
  }
  const end = data.indexOf(0, start);
  return end < 0 ? null : decodeName(data.subarray(start, end));
}

function decompress(data: Buffer): Buffer {
  const maxBytes = gzipFormat.maxDecompressedBytes();
  try {
    return gunzipSync(data, { maxOutputLength: maxBytes });
  } catch (error) {
    if (isTooLarge(error)) {
      throw new Error(
        `The decompressed file would be larger than ${formatMegabytes(maxBytes)}, the most this action can unpack.`,
      );
    }
    throw new Error('This file is gzip-compressed, but its content is damaged or incomplete.');
  }
}

function maxDecompressedBytes(): number {
  return MAX_DECOMPRESSED_BYTES;
}

function encodeName(name: string): Buffer {
  const clean = name.split('\u0000').join('');
  if (clean === '') {
    return Buffer.alloc(0);
  }
  const fitsLatin1 = [...clean].every((character) => character.charCodeAt(0) <= 0xff);
  return Buffer.from(clean, fitsLatin1 ? 'latin1' : 'utf8');
}

function decodeName(bytes: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return bytes.toString('latin1');
  }
}

function extraEnd(data: Buffer): number | null {
  if (data.length < HEADER_LENGTH + 2) {
    return null;
  }
  const end = HEADER_LENGTH + 2 + data.readUInt16LE(HEADER_LENGTH);
  return end > data.length ? null : end;
}

function isTooLarge(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ERR_BUFFER_TOO_LARGE';
}

function formatMegabytes(bytes: number): string {
  return `${Number((bytes / BYTES_PER_MB).toFixed(2))} MB`;
}

const MAGIC_FIRST = 0x1f;

const MAGIC_SECOND = 0x8b;

const HEADER_LENGTH = 10;

const FLAGS_OFFSET = 3;

const FLAG_EXTRA = 0x04;

const FLAG_NAME = 0x08;

const BYTES_PER_MB = 1024 * 1024;

const MAX_DECOMPRESSED_BYTES = 256 * BYTES_PER_MB;

export const gzipFormat = {
  isGzip,
  compress,
  readStoredName,
  decompress,
  maxDecompressedBytes,
};
