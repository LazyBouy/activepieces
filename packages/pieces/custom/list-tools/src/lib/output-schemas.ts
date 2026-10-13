import { OutputSchema } from '@activepieces/pieces-framework';

const itemsAndCountFields: OutputSchema['fields'] = [
  { key: 'items', label: 'Items' },
  { key: 'count', label: 'Count', format: 'number' },
];

const filterList: OutputSchema = {
  fields: [
    { key: 'kept', label: 'Kept Items' },
    { key: 'removed', label: 'Removed Items' },
    { key: 'keptCount', label: 'Kept Count', format: 'number' },
    { key: 'removedCount', label: 'Removed Count', format: 'number' },
  ],
};

const items: OutputSchema = {
  fields: itemsAndCountFields,
};

const itemsWithRemovedCount: OutputSchema = {
  fields: [...itemsAndCountFields, { key: 'removedCount', label: 'Removed Count', format: 'number' }],
};

const keepNewItems: OutputSchema = {
  fields: [
    ...itemsAndCountFields,
    { key: 'skipped', label: 'Skipped Items' },
    { key: 'skippedCount', label: 'Skipped Count', format: 'number' },
  ],
};

const forgetSeenItems: OutputSchema = {
  fields: [{ key: 'forgottenCount', label: 'Forgotten Keys', format: 'number' }],
};

const collectValues: OutputSchema = {
  fields: [{ key: 'values', label: 'Collected Values', value: '', dynamicKey: true }],
};

const groupAndSummarize: OutputSchema = {
  fields: [
    { key: 'groups', label: 'Groups' },
    { key: 'count', label: 'Group Count', format: 'number' },
  ],
};

const compareLists: OutputSchema = {
  fields: [
    { key: 'onlyInFirst', label: 'Only in First List' },
    { key: 'onlyInSecond', label: 'Only in Second List' },
    { key: 'same', label: 'Same in Both' },
    {
      key: 'different',
      label: 'Different',
      listItems: [
        { key: 'first', label: 'Entry in First List' },
        { key: 'second', label: 'Entry in Second List' },
        { key: 'changedFields', label: 'Changed Fields' },
      ],
    },
    {
      key: 'counts',
      label: 'Counts',
      children: [
        { key: 'onlyInFirst', label: 'Only in First List', format: 'number' },
        { key: 'onlyInSecond', label: 'Only in Second List', format: 'number' },
        { key: 'same', label: 'Same in Both', format: 'number' },
        { key: 'different', label: 'Different', format: 'number' },
      ],
    },
  ],
};

export const outputSchemas = {
  filterList,
  items,
  itemsWithRemovedCount,
  keepNewItems,
  forgetSeenItems,
  collectValues,
  groupAndSummarize,
  compareLists,
};
