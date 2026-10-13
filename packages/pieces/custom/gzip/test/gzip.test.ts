/// <reference types="vitest/globals" />

import { randomBytes } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';
import { gzipFormat } from '../src/lib/common/gzip-format';
import { testUtils } from './test-utils';

const TEXT = Array.from({ length: 400 }, (_, index) => `line ${index}: the quick brown fox jumps over the lazy dog ${index % 7}`).join('\n');
const MB = 1024 * 1024;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Compress File', () => {
  test('compresses text into a standard .gz file that keeps the original name', async () => {
    const store = testUtils.createFileStore();
    const { out, written } = await testUtils.compress({
      store,
      propsValue: { file: testUtils.file({ name: 'report.txt', data: TEXT }) },
    });
    expect(out).toEqual({
      file: 'https://files.example.test/1/report.txt.gz',
      fileName: 'report.txt.gz',
      originalSize: Buffer.byteLength(TEXT),
      compressedSize: written.data.length,
    });
    expect(written.fileName).toBe('report.txt.gz');
    expect(out.compressedSize).toBeLessThan(out.originalSize);
    expect(gunzipSync(written.data).toString('utf8')).toBe(TEXT);
    expect(written.data[3]).toBe(0x08);
    expect(testUtils.storedNameBytes(written.data).toString('latin1')).toBe('report.txt');
    expect(gzipFormat.readStoredName(written.data)).toBe('report.txt');
  });

  test('a given name gets .gz added once', async () => {
    const store = testUtils.createFileStore();
    const input = testUtils.file({ name: 'report.txt', data: TEXT });
    expect((await testUtils.compress({ store, propsValue: { file: input, file_name: 'backup' } })).out.fileName).toBe('backup.gz');
    expect((await testUtils.compress({ store, propsValue: { file: input, file_name: 'backup.gz' } })).out.fileName).toBe('backup.gz');
    expect((await testUtils.compress({ store, propsValue: { file: input, file_name: 'Backup.GZ' } })).out.fileName).toBe('Backup.GZ');
    expect((await testUtils.compress({ store, propsValue: { file: input, file_name: '  ' } })).out.fileName).toBe('report.txt.gz');
  });

  test('the stored name is always the input name, even when the output gets another name', async () => {
    const store = testUtils.createFileStore();
    const { written } = await testUtils.compress({
      store,
      propsValue: { file: testUtils.file({ name: 'report.txt', data: TEXT }), file_name: 'backup' },
    });
    expect(gzipFormat.readStoredName(written.data)).toBe('report.txt');
  });

  test('a file without a name becomes file.gz and stores no name', async () => {
    const store = testUtils.createFileStore();
    const { out, written } = await testUtils.compress({ store, propsValue: { file: testUtils.file({ name: '', data: TEXT }) } });
    expect(out.fileName).toBe('file.gz');
    expect(written.data[3]).toBe(0);
    expect(gzipFormat.readStoredName(written.data)).toBeNull();
  });

  test('uses zlib level 1, 6 and 9 for Fastest, Balanced and Smallest, Balanced by default', async () => {
    const store = testUtils.createFileStore();
    const input = testUtils.file({ name: 'r.txt', data: TEXT });
    const sizes = await Promise.all(
      [
        { compression_level: 'fastest', level: 1 },
        { compression_level: 'balanced', level: 6 },
        { compression_level: 'smallest', level: 9 },
        { compression_level: undefined, level: 6 },
      ].map(async ({ compression_level, level }) => {
        const { written } = await testUtils.compress({ store: testUtils.createFileStore(), propsValue: { file: input, compression_level } });
        expect(testUtils.withoutStoredName(written.data)).toEqual(gzipSync(Buffer.from(TEXT), { level }));
        return written.data.length;
      }),
    );
    expect(sizes[0]).toBeGreaterThanOrEqual(sizes[2]);
    await expect(testUtils.compress({ store, propsValue: { file: input, compression_level: 'ultra' } })).rejects.toThrow(
      'Choose Fastest, Balanced or Smallest for Compression level.',
    );
  });

  test('a missing file stops the step', async () => {
    await expect(testUtils.compress({ store: testUtils.createFileStore(), propsValue: { file: undefined } })).rejects.toThrow(
      'Choose a file from an earlier step, or paste a file URL.',
    );
  });
});

describe('Decompress File', () => {
  test('round-trips text and binary content with the original name', async () => {
    const binary = randomBytes(20000);
    for (const [name, data] of [
      ['notes.txt', Buffer.from(TEXT)],
      ['photo.bin', binary],
    ] as const) {
      const store = testUtils.createFileStore();
      const compressed = await testUtils.compress({ store, propsValue: { file: testUtils.file({ name, data }) } });
      const { out, written } = await testUtils.decompress({
        store,
        propsValue: { file: testUtils.file({ name: compressed.out.fileName, data: compressed.written.data }) },
      });
      expect(out).toEqual({ file: `https://files.example.test/2/${name}`, fileName: name, size: data.length });
      expect(written.data.equals(data)).toBe(true);
    }
  });

  test('round-trips an empty file', async () => {
    const store = testUtils.createFileStore();
    const compressed = await testUtils.compress({ store, propsValue: { file: testUtils.file({ name: 'empty.txt', data: '' }) } });
    expect(compressed.out.originalSize).toBe(0);
    const { out, written } = await testUtils.decompress({
      store,
      propsValue: { file: testUtils.file({ name: 'empty.txt.gz', data: compressed.written.data }) },
    });
    expect(out.fileName).toBe('empty.txt');
    expect(out.size).toBe(0);
    expect(written.data.length).toBe(0);
  });

  test('names the output: given name, then stored name, then input name without .gz, then file', async () => {
    const store = testUtils.createFileStore();
    const named = gzipFormat.compress({ data: Buffer.from(TEXT), level: 6, storedName: 'stored.csv' });
    const unnamed = gzipSync(Buffer.from(TEXT));
    const run = async ({ name, data, given }: { name: string; data: Buffer; given?: string }) =>
      (await testUtils.decompress({ store, propsValue: { file: testUtils.file({ name, data }), file_name: given } })).out
        .fileName;
    expect(await run({ name: 'input.csv.gz', data: named, given: 'chosen.csv' })).toBe('chosen.csv');
    expect(await run({ name: 'input.csv.gz', data: named })).toBe('stored.csv');
    expect(await run({ name: 'input.csv.gz', data: unnamed })).toBe('input.csv');
    expect(await run({ name: 'INPUT.CSV.GZ', data: unnamed })).toBe('INPUT.CSV');
    expect(await run({ name: 'download.bin', data: unnamed })).toBe('download.bin');
    expect(await run({ name: '.gz', data: unnamed })).toBe('file');
    expect(await run({ name: '', data: unnamed })).toBe('file');
  });

  test('stores and reads back names outside plain ASCII', async () => {
    const store = testUtils.createFileStore();
    for (const name of ['résumé.txt', '日本語のメモ.txt', 'Ünïcödé 😀.txt']) {
      const { written } = await testUtils.compress({ store, propsValue: { file: testUtils.file({ name, data: TEXT }) } });
      const { out } = await testUtils.decompress({ store, propsValue: { file: testUtils.file({ name: 'x.gz', data: written.data }) } });
      expect(out.fileName).toBe(name);
    }
    const latin = gzipFormat.compress({ data: Buffer.from('a'), level: 6, storedName: 'résumé.txt' });
    expect(testUtils.storedNameBytes(latin)).toEqual(Buffer.from('résumé.txt', 'latin1'));
    const wide = gzipFormat.compress({ data: Buffer.from('a'), level: 6, storedName: '日本.txt' });
    expect(testUtils.storedNameBytes(wide)).toEqual(Buffer.from('日本.txt', 'utf8'));
  });

  test('reads a stored name that follows an extra field, from files made by other tools', async () => {
    const store = testUtils.createFileStore();
    const withExtra = testUtils.withHeaderFields({
      gzip: gzipSync(Buffer.from(TEXT)),
      extra: Buffer.from([0x41, 0x50, 0x02, 0x00, 0x01, 0x02]),
      name: Buffer.from('café.txt', 'latin1'),
    });
    expect(gunzipSync(withExtra).toString('utf8')).toBe(TEXT);
    const { out, written } = await testUtils.decompress({ store, propsValue: { file: testUtils.file({ name: 'x.gz', data: withExtra }) } });
    expect(out.fileName).toBe('café.txt');
    expect(written.data.toString('utf8')).toBe(TEXT);
  });

  test('detects gzip by its content, not by the file name', async () => {
    const store = testUtils.createFileStore();
    const { out } = await testUtils.decompress({
      store,
      propsValue: { file: testUtils.file({ name: 'looks-like-text.txt', data: gzipSync(Buffer.from('hidden')) }) },
    });
    expect(out.size).toBe(6);
    for (const data of [Buffer.from('plain text, not compressed'), Buffer.alloc(0), Buffer.from([0x1f])]) {
      await expect(
        testUtils.decompress({ store, propsValue: { file: testUtils.file({ name: 'archive.gz', data }) } }),
      ).rejects.toThrow('This file is not gzip-compressed.');
    }
  });

  test('a damaged or cut-off gzip file stops the step', async () => {
    const store = testUtils.createFileStore();
    const whole = gzipSync(Buffer.from(TEXT));
    const cut = whole.subarray(0, Math.floor(whole.length / 2));
    const damaged = Buffer.concat([whole.subarray(0, 10), Buffer.alloc(40, 0xff)]);
    for (const data of [cut, damaged]) {
      await expect(
        testUtils.decompress({ store, propsValue: { file: testUtils.file({ name: 'x.gz', data }) } }),
      ).rejects.toThrow('This file is gzip-compressed, but its content is damaged or incomplete.');
    }
  });

  test('refuses to unpack more than the size bound, which is 256 MB', async () => {
    expect(gzipFormat.maxDecompressedBytes()).toBe(256 * MB);
    vi.spyOn(gzipFormat, 'maxDecompressedBytes').mockReturnValue(2 * MB);
    const store = testUtils.createFileStore();
    const atBound = gzipSync(Buffer.alloc(2 * MB));
    const overBound = gzipSync(Buffer.alloc(3 * MB));
    expect((await testUtils.decompress({ store, propsValue: { file: testUtils.file({ name: 'a.gz', data: atBound }) } })).out.size).toBe(2 * MB);
    await expect(
      testUtils.decompress({ store, propsValue: { file: testUtils.file({ name: 'b.gz', data: overBound }) } }),
    ).rejects.toThrow('The decompressed file would be larger than 2 MB, the most this action can unpack.');
  });

  test('a missing file stops the step', async () => {
    await expect(testUtils.decompress({ store: testUtils.createFileStore(), propsValue: { file: null } })).rejects.toThrow(
      'Choose a file from an earlier step, or paste a file URL.',
    );
  });
});
