import { createAction, isNil, PieceAuth, Property } from '@activepieces/pieces-framework';
import { opencodeStepRun, opencodeVendor } from '@iphi-flow/opencode-pieces-common';
import { identity } from '../identity';
import { extractStructuredDataOutputSchema } from '../output-schemas';

export const extractStructuredData = createAction({
  audience: 'both',
  name: 'extract-structured-data',
  classification: 'READ',
  displayName: 'Extract Structured Data',
  description: 'Pull the fields you define out of text, an image or a PDF.',
  aiMetadata: {
    description:
      'Runs a Claude model through OpenCode over supplied text, an image or a PDF and returns only the fields you defined, as a structured answer that follows your schema. The Field Definition prop switches between Field List mode (named fields with types and required flags) and JSON Schema mode; prefer Ask Claude for free-form prose. Requires a model, the field definitions, and Text or an Image or PDF; not idempotent, since each call re-runs the model.',
    idempotent: false,
  },
  props: {
    model: opencodeVendor.modelDropdown({ identity, displayName: 'Model', description: 'The Claude model to use.', required: true }),
    text: Property.LongText({
      displayName: 'Text',
      description: 'Text to pull the fields from.',
      required: false,
    }),
    image: Property.File({
      displayName: 'Image or PDF',
      description: 'An image or PDF to pull the fields from.',
      required: false,
    }),
    mode: Property.StaticDropdown<'simple' | 'advanced'>({
      displayName: 'Field Definition',
      required: true,
      defaultValue: 'simple',
      display: 'cards',
      options: {
        disabled: false,
        options: [
          { label: 'Field List', value: 'simple', description: 'One row per field', icon: 'type' },
          { label: 'JSON Schema', value: 'advanced', description: 'Nested or complex', icon: 'code' },
        ],
      },
    }),
    schema: Property.DynamicProperties({
      auth: PieceAuth.None(),
      displayName: 'Fields',
      required: true,
      refreshers: ['mode'],
      props: async (propsValue) => {
        if (propsValue['mode'] === 'advanced') {
          return {
            fields: Property.Json({
              displayName: 'JSON Schema',
              description: 'Describes the fields to return, in JSON Schema format.',
              required: true,
              defaultValue: {
                type: 'object',
                properties: { name: { type: 'string' }, age: { type: 'number' } },
                required: ['name'],
              },
            }),
          };
        }
        return {
          fields: Property.Array({
            displayName: 'Fields to Extract',
            required: true,
            properties: {
              name: Property.ShortText({
                displayName: 'Name',
                description: 'A short, unique name for the value.',
                placeholder: 'invoice_number',
                required: true,
              }),
              description: Property.LongText({
                displayName: 'Description',
                description: 'What the value looks like, so Claude can find it.',
                required: false,
              }),
              type: Property.StaticDropdown({
                displayName: 'Data Type',
                required: true,
                defaultValue: 'string',
                options: { disabled: false, options: DATA_TYPE_OPTIONS },
              }),
              isRequired: Property.Checkbox({
                displayName: 'Always Return',
                description: 'Claude must return this field every time.',
                required: true,
                defaultValue: false,
              }),
            },
          }),
        };
      },
    }),
    maxTokens: Property.Number({
      displayName: 'Maximum Tokens',
      required: false,
      description: 'Longest reply in tokens, about 4 characters each. Empty: 2,000.',
    }),
    prompt: Property.LongText({
      displayName: 'Instructions',
      description: 'Tells Claude what to extract. The default suits most cases.',
      defaultValue: 'Extract the following data from the provided data.',
      required: false,
      advanced: true,
    }),
  },
  outputSchema: extractStructuredDataOutputSchema,
  async run(context) {
    const { model, text, image, mode, schema, maxTokens, prompt } = context.propsValue;
    if (!text && !image) {
      throw new Error('Please provide text or image/PDF to extract data from.');
    }
    const outputSchema = mode === 'advanced' ? advancedSchemaOf({ value: schema['fields'] }) : simpleSchemaOf({ value: schema['fields'] });
    const instruction = prompt && prompt.length > 0 ? prompt : DEFAULT_INSTRUCTION;
    const result = await opencodeVendor.run({
      context,
      identity,
      buildRequest: async () => ({
        model,
        prompt: isNil(text) || text === '' ? instruction : `${instruction}\n\n${text}`,
        outputSchema,
        ...(image ? { files: [await opencodeStepRun.uploadFile({ context, file: image })] } : {}),
        ...opencodeVendor.optionsOf({ options: { maxOutputTokens: maxTokens ?? DEFAULT_MAX_TOKENS } }),
      }),
    });
    return result.status === 'paused' ? {} : result.answer.structured;
  },
});

function advancedSchemaOf({ value }: { value: unknown }): Record<string, unknown> {
  const parsed = typeof value === 'string' ? parseJson({ text: value }) : value;
  if (typeof parsed !== 'object' || isNil(parsed) || Array.isArray(parsed)) {
    throw new Error(JSON.stringify({ message: 'Invalid JSON schema' }));
  }
  return Object.fromEntries(Object.entries(parsed));
}

function parseJson({ text }: { text: string }): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(JSON.stringify({ message: 'Invalid JSON schema' }));
  }
}

function simpleSchemaOf({ value }: { value: unknown }): Record<string, unknown> {
  const fields = (Array.isArray(value) ? value : []).flatMap((field: unknown) => fieldOf({ value: field }));
  return {
    type: 'object',
    properties: Object.fromEntries(fields.map((field) => [field.name, isNil(field.description) ? { type: field.type } : { type: field.type, description: field.description }])),
    required: fields.filter((field) => field.isRequired).map((field) => field.name),
  };
}

function fieldOf({ value }: { value: unknown }): Field[] {
  if (typeof value !== 'object' || isNil(value)) {
    return [];
  }
  const name = 'name' in value && typeof value.name === 'string' ? value.name : '';
  if (name.length === 0) {
    return [];
  }
  return [{
    name,
    description: 'description' in value && typeof value.description === 'string' && value.description.length > 0 ? value.description : undefined,
    type: 'type' in value && typeof value.type === 'string' ? value.type : 'string',
    isRequired: 'isRequired' in value && value.isRequired === true,
  }];
}

const DATA_TYPES = [
  ['string', 'Text'],
  ['number', 'Number'],
  ['boolean', 'Boolean'],
] as const;

const DATA_TYPE_OPTIONS = DATA_TYPES.map(([value, label]) => ({ label, value }));

const DEFAULT_INSTRUCTION = 'Extract the following data from the provided data.';

const DEFAULT_MAX_TOKENS = 2000;

type Field = {
  name: string;
  description: string | undefined;
  type: string;
  isRequired: boolean;
};
