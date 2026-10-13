import { ApFile, createMockActionContext, FilesService } from '@activepieces/pieces-framework';
import { compressFileAction } from '../src/lib/actions/compress-file';
import { decompressFileAction } from '../src/lib/actions/decompress-file';

function createFileStore(): FileStore {
  const written: WrittenFile[] = [];
  const files: FilesService = {
    async write({ fileName, data }) {
      if (!Buffer.isBuffer(data)) {
        throw new Error('The test file store only takes buffers.');
      }
      written.push({ fileName, data });
      return `https://files.example.test/${written.length}/${encodeURIComponent(fileName)}`;
    },
    async upload({ fileName, data }) {
      const url = await files.write({ fileName, data });
      return { id: String(written.length), url };
    },
  };
  return { files, written };
}

async function compress({ store, propsValue }: { store: FileStore; propsValue: Record<string, unknown> }) {
  const out = await compressFileAction.run({ ...createMockActionContext({ propsValue }), files: store.files });
  return { out, written: lastWritten(store) };
}

async function decompress({ store, propsValue }: { store: FileStore; propsValue: Record<string, unknown> }) {
  const out = await decompressFileAction.run({ ...createMockActionContext({ propsValue }), files: store.files });
  return { out, written: lastWritten(store) };
}

function lastWritten(store: FileStore): WrittenFile {
  const last = store.written[store.written.length - 1];
  if (last === undefined) {
    throw new Error('Nothing was written.');
  }
  return last;
}

function file({ name, data }: { name: string; data: Buffer | string }): ApFile {
  const buffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
  const extension = name.includes('.') ? name.split('.').pop() : undefined;
  return new ApFile(name, buffer, extension);
}

function storedNameBytes(gzip: Buffer): Buffer {
  const end = gzip.indexOf(0, 10);
  return gzip.subarray(10, end);
}

function withoutStoredName(gzip: Buffer): Buffer {
  const header = Buffer.from(gzip.subarray(0, 10));
  header[3] = 0;
  return Buffer.concat([header, gzip.subarray(gzip.indexOf(0, 10) + 1)]);
}

function withHeaderFields({
  gzip,
  extra,
  name,
}: {
  gzip: Buffer;
  extra: Buffer;
  name: Buffer;
}): Buffer {
  const header = Buffer.from(gzip.subarray(0, 10));
  header[3] = 0x04 | 0x08;
  const extraLength = Buffer.alloc(2);
  extraLength.writeUInt16LE(extra.length, 0);
  return Buffer.concat([header, extraLength, extra, name, Buffer.from([0]), gzip.subarray(10)]);
}

export const testUtils = {
  createFileStore,
  compress,
  decompress,
  file,
  storedNameBytes,
  withoutStoredName,
  withHeaderFields,
};

export type WrittenFile = {
  fileName: string;
  data: Buffer;
};

export type FileStore = {
  files: FilesService;
  written: WrittenFile[];
};
