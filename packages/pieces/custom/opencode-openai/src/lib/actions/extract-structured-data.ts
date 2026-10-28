import { createAction, isNil, Property } from '@activepieces/pieces-framework';
import { opencodeVendor } from '@iphi-flow/opencode-pieces-common';
import { identity } from '../identity';

const DATA_TYPES = [
  ['string', 'Text'],
  ['number', 'Number'],
  ['boolean', 'Boolean'],
] as const;

const DATA_TYPE_OPTIONS = DATA_TYPES.map(([value, label]) => ({ label, value }));

export const extractStructuredData = createAction({
  audience: 'both',
  name: 'extract-structured-data',
  classification: 'READ',
  displayName: 'Extract Structured Data',
  description: 'Pull the fields you define out of a block of text.',
  aiMetadata: {
    description:
      'Pulls a caller-defined set of named fields out of one block of text with an OpenAI model through OpenCode and returns them as a flat object, each field declared as text, number or boolean and optionally marked required. Use it to turn prose, emails or documents into machine-readable values; the step fails when the model returns no structured answer. Not idempotent: each call is a fresh model completion.',
    idempotent: false,
  },
  props: {
    model: opencodeVendor.modelDropdown({ identity, displayName: 'Model', description: 'The OpenAI model that reads the text.', required: true }),
    text: Property.LongText({
      displayName: 'Text',
      description: 'The text to pull the fields from.',
      required: true,
    }),
    params: Property.Array({
      displayName: 'Fields',
      description: 'One row per value you want back.',
      required: true,
      properties: {
        propName: Property.ShortText({
          displayName: 'Name',
          description: 'Short, unique name for this value in the output.',
          placeholder: 'e.g. invoice_total',
          required: true,
        }),
        propDescription: Property.LongText({
          displayName: 'Description',
          description: 'Tells the AI what to look for.',
          placeholder: 'e.g. Total due, including tax',
          required: false,
        }),
        propDataType: Property.StaticDropdown({
          displayName: 'Data Type',
          description: 'Data type of the extracted value.',
          required: true,
          defaultValue: 'string',
          options: { disabled: false, options: DATA_TYPE_OPTIONS },
        }),
        propIsRequired: Property.Checkbox({
          displayName: 'Required',
          description: 'Asks the AI to always fill this field. The step does not check it.',
          required: true,
          defaultValue: false,
        }),
      },
    }),
  },
  async run(context) {
    const { model, text, params } = context.propsValue;
    const fields = (params ?? []).flatMap((param) => fieldOf({ value: param }));
    const result = await opencodeVendor.run({
      context,
      identity,
      buildRequest: async () => ({
        model,
        prompt: `${EXTRACT_INSTRUCTION}\n\n${text}`,
        outputSchema: {
          type: 'object',
          properties: Object.fromEntries(fields.map((field) => [field.name, { type: field.type, description: field.description ?? field.name }])),
          required: fields.filter((field) => field.required).map((field) => field.name),
        },
      }),
    });
    return result.status === 'paused' ? {} : result.answer.structured;
  },
});

function fieldOf({ value }: { value: unknown }): Field[] {
  if (typeof value !== 'object' || isNil(value)) {
    return [];
  }
  const name = 'propName' in value && typeof value.propName === 'string' ? value.propName : '';
  if (name.length === 0) {
    return [];
  }
  const description = 'propDescription' in value && typeof value.propDescription === 'string' && value.propDescription.length > 0 ? value.propDescription : undefined;
  const type = 'propDataType' in value && typeof value.propDataType === 'string' ? value.propDataType : 'string';
  const required = 'propIsRequired' in value && value.propIsRequired === true;
  return [{ name, description, type, required }];
}

const EXTRACT_INSTRUCTION = 'Extract the following data from the provided text.';

type Field = {
  name: string;
  description: string | undefined;
  type: string;
  required: boolean;
};
