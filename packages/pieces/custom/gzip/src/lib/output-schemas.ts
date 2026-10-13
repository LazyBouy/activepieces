import { OutputSchema } from '@activepieces/pieces-framework';

const compressFile: OutputSchema = {
  fields: [
    { key: 'file', label: 'File', format: 'url' },
    { key: 'fileName', label: 'File Name' },
    { key: 'originalSize', label: 'Original Size', format: 'filesize' },
    { key: 'compressedSize', label: 'Compressed Size', format: 'filesize' },
  ],
};

const decompressFile: OutputSchema = {
  fields: [
    { key: 'file', label: 'File', format: 'url' },
    { key: 'fileName', label: 'File Name' },
    { key: 'size', label: 'Size', format: 'filesize' },
  ],
};

export const outputSchemas = {
  compressFile,
  decompressFile,
};
