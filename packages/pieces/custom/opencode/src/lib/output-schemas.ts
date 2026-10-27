import { OutputSchema, OutputSchemaField } from '@activepieces/pieces-framework';

const sessionFields: OutputSchemaField[] = [
  { key: 'sessionId', label: 'Session Id' },
  { key: 'adminPanelUrl', label: 'Admin Panel Link', format: 'url' },
  { key: 'namespace', label: 'Namespace' },
  { key: 'project', label: 'Project' },
  { key: 'agent', label: 'Agent' },
  {
    key: 'model',
    label: 'Model',
    children: [
      { key: 'providerID', label: 'Provider' },
      { key: 'modelID', label: 'Model Id' },
    ],
  },
  {
    key: 'usage',
    label: 'Usage',
    children: [
      { key: 'input', label: 'Input Tokens', format: 'number' },
      { key: 'output', label: 'Output Tokens', format: 'number' },
      { key: 'reasoning', label: 'Reasoning Tokens', format: 'number' },
      { key: 'cost', label: 'Cost', format: 'currency', currency: 'USD' },
    ],
  },
  {
    key: 'files',
    label: 'Files',
    labelKey: 'name',
    listItems: [
      { key: 'name', label: 'Name' },
      { key: 'url', label: 'Link', format: 'url' },
      { key: 'size', label: 'Size', format: 'filesize' },
    ],
  },
  {
    key: 'skippedFiles',
    label: 'Skipped Files',
    labelKey: 'name',
    listItems: [
      { key: 'name', label: 'Name' },
      { key: 'reason', label: 'Reason' },
    ],
  },
];

const runAgent: OutputSchema = {
  fields: [{ key: 'answer', label: 'Answer' }, { key: 'structured', label: 'Structured Answer' }, ...sessionFields],
};

const runCommand: OutputSchema = {
  fields: [{ key: 'answer', label: 'Answer' }, ...sessionFields],
};

const continueSession: OutputSchema = runAgent;

const sendToInbox: OutputSchema = {
  fields: [
    { key: 'messageId', label: 'Message Id' },
    { key: 'correlationId', label: 'Correlation Id' },
    { key: 'status', label: 'Status' },
    { key: 'routedTo', label: 'Routed To' },
    { key: 'reply', label: 'Reply' },
    {
      key: 'replyFrom',
      label: 'Reply From',
      children: [
        { key: 'agent', label: 'Agent' },
        { key: 'sessionId', label: 'Session Id' },
        { key: 'adminPanelUrl', label: 'Admin Panel Link', format: 'url' },
      ],
    },
  ],
};

export const outputSchemas = {
  runAgent,
  runCommand,
  continueSession,
  sendToInbox,
};
