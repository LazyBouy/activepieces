import { InputPropertyMap, PieceAuth, Property, StoreScope } from '@activepieces/pieces-framework';

function shownFor({
  displayName,
  refresher,
  build,
}: {
  displayName: string;
  refresher: string;
  build: (refresherValue: unknown) => InputPropertyMap;
}) {
  return Property.DynamicProperties({
    displayName,
    required: false,
    auth: PieceAuth.None(),
    refreshers: [refresher],
    props: async (propsValue) => build(propsValue[refresher]),
  });
}

function list({ displayName, description }: { displayName: string; description: string }) {
  return Property.Json({
    displayName,
    description,
    required: true,
  });
}

function caseSensitive({ defaultValue, description }: { defaultValue: boolean; description: string }) {
  return Property.Checkbox({
    displayName: 'Case sensitive',
    description,
    required: false,
    defaultValue,
  });
}

function matchOn() {
  return Property.Array({
    displayName: 'Match on',
    description: 'Pairs of fields that must hold the same value. All rows must match.',
    required: false,
    defaultValue: [{ field_in_first: '', field_in_second: '' }],
    properties: {
      field_in_first: Property.ShortText({
        displayName: 'Field in first list',
        description: 'A field name, or names joined by dots for nested fields.',
        required: false,
      }),
      field_in_second: Property.ShortText({
        displayName: 'Field in second list',
        description: 'A field name, or names joined by dots for nested fields.',
        required: false,
      }),
    },
  });
}

function numbersAsText() {
  return Property.Checkbox({
    displayName: 'Treat numbers and numeric text as equal',
    description: 'On: 7 and "7" count as the same value.',
    required: false,
    defaultValue: false,
  });
}

function rememberFor() {
  return Property.StaticDropdown<RememberFor, false>({
    displayName: 'Remember for',
    description: 'Where the memory is kept.',
    required: false,
    defaultValue: 'flow',
    options: {
      options: [
        { label: 'This flow', value: 'flow' },
        { label: 'All flows in this project', value: 'project' },
      ],
    },
  });
}

function memoryName() {
  return Property.ShortText({
    displayName: 'Memory name',
    description: 'Separates independent memories in the same place.',
    required: false,
    defaultValue: 'seen-items',
  });
}

function toStoreScope(rememberFor: RememberFor): StoreScope {
  return rememberFor === 'project' ? StoreScope.PROJECT : StoreScope.FLOW;
}

const REMEMBER_FOR_VALUES: readonly RememberFor[] = ['flow', 'project'];

export const listProps = {
  shownFor,
  list,
  caseSensitive,
  matchOn,
  numbersAsText,
  rememberFor,
  memoryName,
  toStoreScope,
  REMEMBER_FOR_VALUES,
};

export type RememberFor = 'flow' | 'project';
