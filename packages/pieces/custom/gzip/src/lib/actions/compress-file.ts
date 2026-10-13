import { createAction, Property } from '@activepieces/pieces-framework';
import { files } from '../common/files';
import { gzipFormat } from '../common/gzip-format';
import { names } from '../common/names';
import { outputSchemas } from '../output-schemas';

export const compressFileAction = createAction({
  audience: 'both',
  name: 'compress_file',
  classification: 'READ',
  displayName: 'Compress File',
  description: 'Compresses a file with gzip and keeps its original name inside the .gz file.',
  aiMetadata: {
    description:
      'Compresses one file into a .gz file with gzip, storing the original file name inside it, and reports the size before and after. Use it to shrink a file before sending or storing it; use the Files Helper zip action to bundle several files into one archive instead. Writes a new output file each time and leaves the input unchanged, so it is safe to retry.',
    idempotent: true,
  },
  props: {
    file: Property.File({
      displayName: 'File',
      description: 'The file to compress, from an earlier step or a file URL.',
      required: true,
    }),
    file_name: Property.ShortText({
      displayName: 'File name',
      description: 'Name for the compressed file. Leave empty to use the original name plus .gz; .gz is added when missing.',
      required: false,
    }),
    compression_level: Property.StaticDropdown<CompressionLevel, false>({
      displayName: 'Compression level',
      description: 'Fastest finishes quickest, Smallest makes the smallest file, Balanced sits between them.',
      required: false,
      defaultValue: 'balanced',
      options: {
        options: [
          { label: 'Fastest', value: 'fastest' },
          { label: 'Balanced', value: 'balanced' },
          { label: 'Smallest', value: 'smallest' },
        ],
      },
    }),
  },
  outputSchema: outputSchemas.compressFile,
  async run(context) {
    const input = files.readInputFile(context.propsValue.file);
    const level = readLevel(context.propsValue.compression_level);
    const compressed = gzipFormat.compress({
      data: input.data,
      level: ZLIB_LEVELS[level],
      storedName: names.baseName(input.filename),
    });
    const fileName = names.compressedName({ given: context.propsValue.file_name, inputName: input.filename });
    const file = await context.files.write({ fileName, data: compressed });
    return {
      file,
      fileName,
      originalSize: input.data.length,
      compressedSize: compressed.length,
    };
  },
});

function readLevel(value: unknown): CompressionLevel {
  if (value === undefined || value === null || value === '') {
    return 'balanced';
  }
  const found = LEVELS.find((level) => level === value);
  if (found === undefined) {
    throw new Error('Choose Fastest, Balanced or Smallest for Compression level.');
  }
  return found;
}

const LEVELS: readonly CompressionLevel[] = ['fastest', 'balanced', 'smallest'];

const ZLIB_LEVELS: Record<CompressionLevel, number> = {
  fastest: 1,
  balanced: 6,
  smallest: 9,
};

type CompressionLevel = 'fastest' | 'balanced' | 'smallest';
