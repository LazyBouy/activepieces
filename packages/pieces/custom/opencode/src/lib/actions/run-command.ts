import { createAction, Property } from '@activepieces/pieces-framework';
import { opencodeLocations } from '../common/locations';
import { opencodeProps } from '../common/props';
import { opencodeStepRun } from '../common/step-run';
import { outputSchemas } from '../output-schemas';

export const runCommandAction = createAction({
  audience: 'both',
  name: 'run_command',
  classification: 'WRITE',
  displayName: 'Run a Command',
  description: 'Runs one of the OpenCode project\'s commands or skills and returns the answer.',
  aiMetadata: {
    description:
      'Runs a saved OpenCode command or skill (picked from the project\'s list) with the given arguments in an OpenCode session, and returns the answer, the session id and admin-panel link, the model, token usage and cost, and the files the agent wrote. The command\'s own template, agent and model apply as set in OpenCode. Not idempotent: each run sends the command again and it may change files.',
    idempotent: false,
  },
  props: {
    namespace: opencodeProps.namespace,
    project: opencodeProps.project,
    agent: opencodeProps.agent,
    command: opencodeProps.command,
    arguments: Property.LongText({
      displayName: 'Arguments',
      description: 'The text the command gets as its arguments.',
      required: false,
    }),
    session: opencodeProps.session,
    sessionId: opencodeProps.sessionId,
  },
  outputSchema: outputSchemas.runCommand,
  async run(context) {
    const result = await opencodeStepRun.run({
      context,
      timeoutMs: opencodeStepRun.STEP_TIMEOUT_MS,
      noAnswer: opencodeStepRun.NO_ANSWER,
      buildRequest: async () => {
        const { namespace, project, agent, command, session, sessionId } = context.propsValue;
        return {
          action: 'OPENCODE_RUN_COMMAND',
          ...opencodeLocations.locationOf({ namespace, project, agent }),
          command,
          arguments: context.propsValue.arguments ?? '',
          session: opencodeLocations.sessionOf({ session, sessionId }),
        };
      },
    });
    return result.status === 'paused' ? {} : result.output;
  },
});
