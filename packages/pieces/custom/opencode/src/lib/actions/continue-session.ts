import { createAction, isNil, Property } from '@activepieces/pieces-framework';
import { opencodeLocations } from '../common/locations';
import { opencodeProps } from '../common/props';
import { opencodeStepRun } from '../common/step-run';
import { outputSchemas } from '../output-schemas';

export const continueSessionAction = createAction({
  audience: 'both',
  name: 'continue_session',
  classification: 'WRITE',
  displayName: 'Continue a Session',
  description: 'Sends a new prompt into an existing OpenCode session, with its agent and history, and returns the answer.',
  aiMetadata: {
    description:
      'Continues an existing OpenCode session (for example one an earlier Run an Agent step started) with a new prompt, using the session\'s own agent, model and history, and returns the answer (or a structured answer that follows the given JSON schema), the model, token usage, cost and the files written. The session must belong to an allowlisted OpenCode project. Not idempotent: each run adds a turn to the session.',
    idempotent: false,
  },
  props: {
    sessionId: Property.ShortText({
      displayName: 'Session id',
      description: 'The OpenCode session to continue, for example the Session id from an earlier OpenCode step.',
      required: true,
    }),
    prompt: Property.LongText({
      displayName: 'Prompt',
      description: 'The next message for the session.',
      required: true,
    }),
    files: opencodeProps.files,
    outputSchema: opencodeProps.outputSchema,
    channel: opencodeProps.channel,
  },
  outputSchema: outputSchemas.continueSession,
  async run(context) {
    const result = await opencodeStepRun.run({
      context,
      timeoutMs: opencodeStepRun.STEP_TIMEOUT_MS,
      noAnswer: opencodeStepRun.NO_ANSWER,
      buildRequest: async () => {
        const { sessionId, prompt, files, outputSchema, channel } = context.propsValue;
        const id = sessionId.trim();
        if (id.length === 0) {
          throw new Error('Enter the id of the OpenCode session to continue.');
        }
        const schema = opencodeLocations.schemaOf({ value: outputSchema });
        const uploaded = await opencodeStepRun.uploadFiles({ context, value: files });
        return {
          action: 'OPENCODE_CONTINUE_SESSION',
          sessionId: id,
          prompt,
          ...(uploaded.length === 0 ? {} : { files: uploaded }),
          ...(isNil(schema) ? {} : { outputSchema: schema }),
          ...opencodeLocations.channelOf({ value: channel }),
        };
      },
    });
    return result.status === 'paused' ? {} : result.output;
  },
});
