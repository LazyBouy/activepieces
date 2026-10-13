function readInputFile(value: unknown): InputFile {
  if (typeof value === 'object' && value !== null && 'data' in value && Buffer.isBuffer(value.data)) {
    const filename = 'filename' in value && typeof value.filename === 'string' ? value.filename : '';
    return { filename, data: value.data };
  }
  throw new Error('Choose a file from an earlier step, or paste a file URL.');
}

export const files = {
  readInputFile,
};

export type InputFile = {
  filename: string;
  data: Buffer;
};
