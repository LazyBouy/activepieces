import { createAction, isNil, Property } from '@activepieces/pieces-framework';
import { opencodeOptions, opencodeProps } from '../common/props';
import { opencodeStepRun } from '@iphi-flow/opencode-pieces-common';
import { outputSchemas } from '../output-schemas';

const DEFAULT_TIMEOUT_MINUTES = 10;

const MAX_TIMEOUT_MINUTES = 30;

const RESUME_MARGIN_MINUTES = 5;

const MS_PER_MINUTE = 60 * 1000;

const TO_LABELS: Record<string, string> = {
  agent: 'An agent',
  group: 'A group',
  session: 'A session',
};

export const sendToInboxAction = createAction({
  audience: 'both',
  name: 'send_to_inbox',
  classification: 'WRITE',
  displayName: 'Send to Project Inbox',
  description: 'Puts a message into an OpenCode project\'s inbox and, if asked, waits for the agent\'s reply.',
  aiMetadata: {
    description:
      'Sends a message from outside into an allowlisted OpenCode project\'s inbox, addressed to an agent, a group or a session, or left to the inbox rules and the project manager. Returns the message id, correlation id, status and where it was routed; with Wait for the reply, it pauses until the receiving agent finishes answering (the first to finish, for a group) or until the timeout, and returns the reply and who sent it. Not idempotent: each run sends a new message.',
    idempotent: false,
  },
  props: {
    project: opencodeProps.inboxProject,
    message: Property.LongText({
      displayName: 'Message',
      description: 'The text of the message.',
      required: true,
    }),
    to: opencodeProps.inboxTo,
    recipient: opencodeProps.inboxRecipient,
    wait: Property.Checkbox({
      displayName: 'Wait for the reply',
      description: 'Pause the flow until the receiving agent has answered.',
      required: false,
      defaultValue: false,
    }),
    timeoutMinutes: Property.Number({
      displayName: 'Timeout (minutes)',
      description: 'How long to wait for the reply: 1 to 30 minutes. 10 when empty.',
      required: false,
      defaultValue: DEFAULT_TIMEOUT_MINUTES,
    }),
  },
  outputSchema: outputSchemas.sendToInbox,
  async run(context) {
    const { project, message, to, recipient, wait, timeoutMinutes } = context.propsValue;
    const location = opencodeOptions.inboxLocation({ value: project });
    if (isNil(location)) {
      throw new Error('Pick the OpenCode project whose inbox gets the message.');
    }
    const minutes = timeoutOf({ value: timeoutMinutes });
    const request = {
      action: 'OPENCODE_SEND_TO_INBOX',
      namespace: location.namespace,
      project: location.project,
      message,
      ...targetOf({ to, recipient }),
      wait: wait === true,
      timeoutMinutes: minutes,
    };
    const noAnswer = `No reply arrived within ${minutes} min.`;
    if (wait !== true) {
      const result = await opencodeStepRun.now({ context, request, noAnswer });
      return result.status === 'paused' ? {} : result.output;
    }
    const result = await opencodeStepRun.run({
      context,
      timeoutMs: (minutes + RESUME_MARGIN_MINUTES) * MS_PER_MINUTE,
      noAnswer,
      buildRequest: async () => request,
    });
    return result.status === 'paused' ? {} : result.output;
  },
});

function targetOf({ to, recipient }: { to: string | undefined; recipient: unknown }): { to?: { type: string; id: string } } {
  if (isNil(to)) {
    return {};
  }
  const id = typeof recipient === 'object' && !isNil(recipient) && 'id' in recipient && typeof recipient.id === 'string' ? recipient.id.trim() : '';
  if (id.length === 0) {
    throw new Error(`To is "${TO_LABELS[to] ?? to}", so pick the recipient.`);
  }
  return { to: { type: to, id } };
}

function timeoutOf({ value }: { value: number | undefined }): number {
  if (isNil(value)) {
    return DEFAULT_TIMEOUT_MINUTES;
  }
  if (!Number.isInteger(value) || value < 1 || value > MAX_TIMEOUT_MINUTES) {
    throw new Error(`The timeout must be a whole number of minutes from 1 to ${MAX_TIMEOUT_MINUTES}.`);
  }
  return value;
}
