import { OutputSchema } from '@activepieces/pieces-framework';

const generateCode: OutputSchema = {
  fields: [
    { key: 'code', label: 'Code' },
    { key: 'secondsRemaining', label: 'Seconds Remaining', format: 'number' },
    { key: 'validUntil', label: 'Valid Until', format: 'datetime' },
  ],
};

export const outputSchemas = {
  generateCode,
};
