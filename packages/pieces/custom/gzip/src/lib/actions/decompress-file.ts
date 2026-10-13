import { createAction, Property } from '@activepieces/pieces-framework';
import { files } from '../common/files';
import { gzipFormat } from '../common/gzip-format';
import { names } from '../common/names';
import { outputSchemas } from '../output-schemas';

export const decompressFileAction = createAction({
  audience: 'both',
  name: 'decompress_file',
  classification: 'READ',
  displayName: 'Decompress File',
  description: 'Unpacks a gzip-compressed file. The file is recognized by its content, whatever its name.',
  aiMetadata: {
    description:
      'Unpacks a gzip-compressed (.gz) file back into the original file, named after the given name, the name stored inside the file, or the input name without .gz. Use it on .gz downloads or exports before reading them; it does not open zip or tar archives. Writes a new output file each time and leaves the input unchanged, so it is safe to retry.',
    idempotent: true,
  },
  props: {
    file: Property.File({
      displayName: 'File',
      description: 'The gzip-compressed file, from an earlier step or a file URL.',
      required: true,
    }),
    file_name: Property.ShortText({
      displayName: 'File name',
      description:
        'Name for the unpacked file. Leave empty to use the name stored in the file, or else the input name without .gz.',
      required: false,
    }),
  },
  outputSchema: outputSchemas.decompressFile,
  async run(context) {
    const input = files.readInputFile(context.propsValue.file);
    if (!gzipFormat.isGzip(input.data)) {
      throw new Error('This file is not gzip-compressed.');
    }
    const content = gzipFormat.decompress(input.data);
    const fileName = names.decompressedName({
      given: context.propsValue.file_name,
      storedName: gzipFormat.readStoredName(input.data),
      inputName: input.filename,
    });
    const file = await context.files.write({ fileName, data: content });
    return {
      file,
      fileName,
      size: content.length,
    };
  },
});
