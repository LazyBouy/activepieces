import { createPiece, PieceAuth, PieceCategory } from '@activepieces/pieces-framework';
import { compressFileAction } from './lib/actions/compress-file';
import { decompressFileAction } from './lib/actions/decompress-file';
import { gzipLogo } from './lib/logo';

export const gzip = createPiece({
  displayName: 'Gzip',
  description: 'Compress and decompress files with gzip',
  minimumSupportedRelease: '0.30.0',
  logoUrl: gzipLogo,
  auth: PieceAuth.None(),
  categories: [PieceCategory.CORE],
  actions: [compressFileAction, decompressFileAction],
  authors: ['LazyBouy'],
  triggers: [],
});
