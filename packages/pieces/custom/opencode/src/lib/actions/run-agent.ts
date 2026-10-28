import { createAction, isNil, Property } from '@activepieces/pieces-framework';
import { opencodeLocations } from '../common/locations';
import { opencodeProps } from '../common/props';
import { opencodeStepRun } from '@iphi-flow/opencode-pieces-common';
import { outputSchemas } from '../output-schemas';

export const runAgentAction = createAction({
  audience: 'both',
  name: 'run_agent',
  classification: 'WRITE',
  displayName: 'Run an Agent',
  description: 'Gives a task to an OpenCode agent and returns its answer, the session and the files it wrote.',
  aiMetadata: {
    description:
      'Runs a prompt as an OpenCode agent session, in this Activepieces project\'s own OpenCode project or another allowlisted one, and returns the answer (or a structured answer that follows the given JSON schema), the session id and admin-panel link, the model, token usage and cost, and the files the agent wrote. The agent uses its own tools and permissions as set in the OpenCode admin panel. Not idempotent: each run starts or continues a session and the agent may change files.',
    idempotent: false,
  },
  props: {
    namespace: opencodeProps.namespace,
    project: opencodeProps.project,
    agent: opencodeProps.agent,
    prompt: Property.LongText({
      displayName: 'Prompt',
      description: 'What the agent should do.',
      required: true,
    }),
    files: opencodeProps.files,
    outputSchema: opencodeProps.outputSchema,
    model: opencodeProps.model,
    session: opencodeProps.session,
    sessionId: opencodeProps.sessionId,
    channel: opencodeProps.channel,
  },
  outputSchema: outputSchemas.runAgent,
  async run(context) {
    const result = await opencodeStepRun.run({
      context,
      timeoutMs: opencodeStepRun.STEP_TIMEOUT_MS,
      noAnswer: opencodeStepRun.NO_ANSWER,
      buildRequest: async () => {
        const { namespace, project, agent, prompt, files, outputSchema, model, session, sessionId, channel } = context.propsValue;
        const location = opencodeLocations.locationOf({ namespace, project, agent });
        const schema = opencodeLocations.schemaOf({ value: outputSchema });
        const uploaded = await opencodeStepRun.uploadFiles({ context, value: files });
        return {
          action: 'OPENCODE_RUN_AGENT',
          ...location,
          prompt,
          ...(uploaded.length === 0 ? {} : { files: uploaded }),
          ...(isNil(schema) ? {} : { outputSchema: schema }),
          ...(isNil(model) ? {} : { model }),
          session: opencodeLocations.sessionOf({ session, sessionId }),
          ...opencodeLocations.channelOf({ value: channel }),
        };
      },
    });
    return result.status === 'paused' ? {} : result.output;
  },
});
