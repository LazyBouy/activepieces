import { OutputSchema } from '@activepieces/pieces-framework';

const createToken: OutputSchema = {
  fields: [
    { key: 'token', label: 'Token' },
    { key: 'header', label: 'Header' },
    { key: 'payload', label: 'Claims' },
    { key: 'expiresAt', label: 'Expires At', format: 'datetime' },
  ],
};

const verifyToken: OutputSchema = {
  fields: [
    { key: 'valid', label: 'Valid', format: 'boolean' },
    { key: 'header', label: 'Header' },
    { key: 'payload', label: 'Claims' },
  ],
};

const readToken: OutputSchema = {
  fields: [
    { key: 'header', label: 'Header' },
    { key: 'payload', label: 'Claims' },
    { key: 'expiresAt', label: 'Expires At', format: 'datetime' },
    { key: 'isExpired', label: 'Is Expired', format: 'boolean' },
  ],
};

export const outputSchemas = {
  createToken,
  verifyToken,
  readToken,
};
