import { createAction, isNil } from '@activepieces/pieces-framework';
import { opencodeOptions, opencodeProps } from '../common/props';
import { opencodeStepRun } from '../common/step-run';
import { outputSchemas } from '../output-schemas';

const MIN_PARTICIPANTS = 2;

const DEFAULT_MAX_MESSAGES = 50;

const MAX_MESSAGES = 1000;

const DEFAULT_TIMEOUT_MINUTES = 30;

const MAX_TIMEOUT_MINUTES = 1440;

const RESUME_MARGIN_MINUTES = 5;

const MS_PER_MINUTE = 60 * 1000;

export const agentChannelAction = createAction({
  audience: 'both',
  name: 'agent_channel',
  classification: 'WRITE',
  displayName: 'Agent Channel',
  description: 'Lets OpenCode agents in different projects message each other for this run, and returns their conversation.',
  aiMetadata: {
    description:
      'Opens a run-scoped channel in which the chosen OpenCode agents (in projects of one namespace) may message each other with the ping tool, and no one else. With a finish rule it sends the kickoff task, waits until the "Done when" agent calls its finish_channel tool, Max messages is reached or the timeout passes, and returns the messages, each agent\'s last answer, what ended it and the result; with None it opens the channel and returns its correlation id at once so later AI steps can join. Not idempotent: each run opens a new channel.',
    idempotent: false,
  },
  props: {
    participants: opencodeProps.participants,
    waitFor: opencodeProps.waitFor,
    kickoff: opencodeProps.kickoff,
    startWith: opencodeProps.startWith,
    doneWhen: opencodeProps.doneWhen,
    maxMessages: opencodeProps.maxMessages,
    timeoutMinutes: opencodeProps.channelTimeout,
  },
  outputSchema: outputSchemas.agentChannel,
  async run(context) {
    const { participants, waitFor, kickoff, startWith, doneWhen, maxMessages, timeoutMinutes } = context.propsValue;
    const picked = opencodeOptions.participantsOf({ value: participants });
    if (picked.length < MIN_PARTICIPANTS) {
      throw new Error('Pick at least two participants.');
    }
    if (waitFor === 'OPEN') {
      const result = await opencodeStepRun.now({
        context,
        request: { action: 'OPENCODE_AGENT_CHANNEL', participants: picked, waitFor },
        noAnswer: opencodeStepRun.NO_ANSWER,
      });
      return result.status === 'paused' ? {} : result.output;
    }
    const task = kickoff?.trim() ?? '';
    if (task.length === 0) {
      throw new Error('Write the kickoff message: with a finish rule, it is what starts the conversation.');
    }
    const minutes = wholeNumberOf({ value: timeoutMinutes, fallback: DEFAULT_TIMEOUT_MINUTES, max: MAX_TIMEOUT_MINUTES, label: 'The timeout' });
    const limit = wholeNumberOf({ value: maxMessages, fallback: DEFAULT_MAX_MESSAGES, max: MAX_MESSAGES, label: 'Max messages' });
    const result = await opencodeStepRun.run({
      context,
      timeoutMs: (minutes + RESUME_MARGIN_MINUTES) * MS_PER_MINUTE,
      noAnswer: opencodeStepRun.NO_ANSWER,
      buildRequest: async () => ({
        action: 'OPENCODE_AGENT_CHANNEL',
        participants: picked,
        waitFor,
        kickoff: task,
        startWith: isNil(startWith) || startWith.length === 0 ? opencodeOptions.START_ALL : startWith,
        ...(isNil(doneWhen) || doneWhen.length === 0 ? {} : { doneBy: doneWhen }),
        maxMessages: limit,
        timeoutMinutes: minutes,
      }),
    });
    return result.status === 'paused' ? {} : result.output;
  },
});

function wholeNumberOf({ value, fallback, max, label }: { value: number | undefined; fallback: number; max: number; label: string }): number {
  if (isNil(value)) {
    return fallback;
  }
  if (!Number.isInteger(value) || value < 1 || value > max) {
    throw new Error(`${label} must be a whole number from 1 to ${max}.`);
  }
  return value;
}
