/// <reference types="vitest/globals" />

import { ApFile } from '@activepieces/pieces-framework';
import { agentChannelAction } from '../src/lib/actions/agent-channel';
import { continueSessionAction } from '../src/lib/actions/continue-session';
import { runAgentAction } from '../src/lib/actions/run-agent';
import { runCommandAction } from '../src/lib/actions/run-command';
import { sendToInboxAction } from '../src/lib/actions/send-to-inbox';
import { testUtils } from './test-utils';

const { mockServer, contextOf, httpError, resumeWith } = testUtils;

afterEach(() => {
  vi.restoreAllMocks();
});

const AGENT_OUTPUT = {
  answer: 'Done: 42',
  sessionId: 'ses_1',
  adminPanelUrl: 'http://127.0.0.1:4444/x/session/ses_1',
  namespace: 'iphi-flow',
  project: 'p0001',
  agent: 'flow',
  model: { providerID: 'openrouter', modelID: 'qwen/qwen3-coder' },
  usage: { input: 10, output: 2, reasoning: 0, cost: 0.001 },
  files: [],
  skippedFiles: [],
};

describe('Run an Agent', () => {
  test('pauses on a webhook waitpoint and sends the prompt, location, files, schema, model and session', async () => {
    const requests = mockServer({ answer: () => ({ requestId: 'req_1' }) });
    const { context, waitpoints, waited, uploads } = contextOf({
      propsValue: {
        namespace: 'crew',
        project: 'c0001',
        agent: 'triage',
        prompt: 'Sort the tickets',
        files: [{ file: new ApFile('notes.txt', Buffer.from('a note')) }],
        outputSchema: { type: 'object', properties: { count: { type: 'number' } } },
        model: { providerID: 'openrouter', modelID: 'qwen/qwen3-coder' },
        session: 'RUN',
        sessionId: undefined,
      },
    });
    const before = Date.now();

    const result = await runAgentAction.run(context as never);

    expect(result).toEqual({});
    expect(waitpoints).toHaveLength(1);
    expect(waitpoints[0].type).toBe('WEBHOOK');
    const resumeAt = new Date(waitpoints[0].resumeDateTime ?? '').getTime();
    expect(resumeAt).toBeGreaterThanOrEqual(before + 60 * 60 * 1000 - 1000);
    expect(waited).toEqual(['test-waitpoint-id']);
    expect(uploads).toEqual(['notes.txt']);
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe('http://localhost:3000v1/opencode/steps');
    expect(requests[0].authentication).toEqual({ type: 'BEARER_TOKEN', token: 'test-token' });
    expect(requests[0].body).toEqual({
      flowId: 'test-flow-id',
      flowRunId: 'test-run-id',
      stepName: 'test-step',
      waitpointId: 'test-waitpoint-id',
      request: {
        action: 'OPENCODE_RUN_AGENT',
        namespace: 'crew',
        project: 'c0001',
        agent: 'triage',
        prompt: 'Sort the tickets',
        files: [{ fileId: 'file_1', filename: 'notes.txt' }],
        outputSchema: { type: 'object', properties: { count: { type: 'number' } } },
        model: { providerID: 'openrouter', modelID: 'qwen/qwen3-coder' },
        session: { kind: 'RUN' },
      },
    });
  });

  test('returns the output on resume and fails with the reason OpenCode gave', async () => {
    const done = contextOf({ propsValue: { prompt: 'x', session: 'NEW' }, resumePayload: resumeWith({ body: { output: AGENT_OUTPUT } }) });
    const failed = contextOf({ propsValue: { prompt: 'x', session: 'NEW' }, resumePayload: resumeWith({ body: { failure: 'OpenCode stopped with an error: rate limited.' } }) });
    const empty = contextOf({ propsValue: { prompt: 'x', session: 'NEW' }, resumePayload: resumeWith({ body: undefined }) });

    expect(await runAgentAction.run(done.context as never)).toEqual(AGENT_OUTPUT);
    await expect(runAgentAction.run(failed.context as never)).rejects.toThrow('OpenCode stopped with an error: rate limited.');
    await expect(runAgentAction.run(empty.context as never)).rejects.toThrow('OpenCode did not answer before the step timed out.');
  });

  test('answers in the same request when the step cannot pause, and leaves the default location to the server', async () => {
    const requests = mockServer({ answer: () => ({ requestId: 'req_1', output: AGENT_OUTPUT }) });
    const { context, waitpoints } = contextOf({ propsValue: { prompt: 'Hello', session: 'EXISTING', sessionId: ' ses_9 ' }, canPause: false });

    const result = await runAgentAction.run(context as never);

    expect(result).toEqual(AGENT_OUTPUT);
    expect(waitpoints).toEqual([]);
    expect(requests[0].body).toEqual({
      flowId: 'test-flow-id',
      flowRunId: 'test-run-id',
      stepName: 'test-step',
      request: { action: 'OPENCODE_RUN_AGENT', prompt: 'Hello', session: { kind: 'EXISTING', sessionId: 'ses_9' } },
    });
  });

  test('stops with a plain message when the server refuses at once', async () => {
    mockServer({ answer: () => ({ requestId: 'req_1', failure: 'Run AI on OpenCode is off. Turn it on in Platform → AI → OpenCode.' }) });
    const { context, waited } = contextOf({ propsValue: { prompt: 'x', session: 'NEW' } });

    await expect(runAgentAction.run(context as never)).rejects.toThrow('Run AI on OpenCode is off. Turn it on in Platform → AI → OpenCode.');
    expect(waited).toEqual([]);
  });

  test('shows the API message of a refused request instead of the raw HTTP error', async () => {
    mockServer({ answer: () => httpError({ status: 409, body: { code: 'VALIDATION', params: { message: 'The flow run was not found' } } }) });
    const { context } = contextOf({ propsValue: { prompt: 'x', session: 'NEW' } });

    await expect(runAgentAction.run(context as never)).rejects.toThrow('The flow run was not found');
  });

  test('checks its fields before sending anything', async () => {
    const requests = mockServer({ answer: () => ({ requestId: 'req_1' }) });
    const halfLocation = contextOf({ propsValue: { namespace: 'crew', prompt: 'x', session: 'NEW' } });
    const noSessionId = contextOf({ propsValue: { prompt: 'x', session: 'EXISTING', sessionId: '  ' } });
    const badSchema = contextOf({ propsValue: { prompt: 'x', session: 'NEW', outputSchema: '[1, 2]' } });

    await expect(runAgentAction.run(halfLocation.context as never)).rejects.toThrow('Pick both a namespace and a project, or leave both empty to use this project\'s own OpenCode project.');
    await expect(runAgentAction.run(noSessionId.context as never)).rejects.toThrow('Session is "A session id", so enter the session id to continue.');
    await expect(runAgentAction.run(badSchema.context as never)).rejects.toThrow('The Output schema must be a JSON schema object');
    expect(requests).toEqual([]);
  });
});

describe('Run a Command', () => {
  test('sends the command, its arguments and the session choice', async () => {
    const requests = mockServer({ answer: () => ({ requestId: 'req_1' }) });
    const { context, waitpoints } = contextOf({ propsValue: { command: 'review', arguments: 'src/', session: 'NEW' } });

    expect(await runCommandAction.run(context as never)).toEqual({});

    expect(waitpoints).toHaveLength(1);
    expect(requests[0].body).toMatchObject({
      waitpointId: 'test-waitpoint-id',
      request: { action: 'OPENCODE_RUN_COMMAND', command: 'review', arguments: 'src/', session: { kind: 'NEW' } },
    });
  });
});

describe('Continue a Session', () => {
  test('sends the prompt to the named session and needs a session id', async () => {
    const requests = mockServer({ answer: () => ({ requestId: 'req_1' }) });
    const { context } = contextOf({ propsValue: { sessionId: 'ses_7', prompt: 'And now the summary' } });
    const blank = contextOf({ propsValue: { sessionId: ' ', prompt: 'x' } });

    expect(await continueSessionAction.run(context as never)).toEqual({});
    await expect(continueSessionAction.run(blank.context as never)).rejects.toThrow('Enter the id of the OpenCode session to continue.');

    expect(requests).toHaveLength(1);
    expect(requests[0].body).toMatchObject({ request: { action: 'OPENCODE_CONTINUE_SESSION', sessionId: 'ses_7', prompt: 'And now the summary' } });
  });
});

describe('Channel field', () => {
  test('Run an Agent, Run a Command and Continue a Session send a trimmed channel and leave out a blank one', async () => {
    const requests = mockServer({ answer: () => ({ requestId: 'req_1' }) });
    const agent = contextOf({ propsValue: { prompt: 'x', session: 'NEW', channel: ' iphiflow_ch_1 ' } });
    const command = contextOf({ propsValue: { command: 'review', session: 'NEW', channel: 'iphiflow_ch_1' } });
    const next = contextOf({ propsValue: { sessionId: 'ses_7', prompt: 'x', channel: 'iphiflow_ch_1' } });
    const blank = contextOf({ propsValue: { prompt: 'x', session: 'NEW', channel: '  ' } });

    await runAgentAction.run(agent.context as never);
    await runCommandAction.run(command.context as never);
    await continueSessionAction.run(next.context as never);
    await runAgentAction.run(blank.context as never);

    expect(requests.map((request) => request.body)).toMatchObject([
      { request: { action: 'OPENCODE_RUN_AGENT', channel: 'iphiflow_ch_1' } },
      { request: { action: 'OPENCODE_RUN_COMMAND', channel: 'iphiflow_ch_1' } },
      { request: { action: 'OPENCODE_CONTINUE_SESSION', channel: 'iphiflow_ch_1' } },
      { request: { action: 'OPENCODE_RUN_AGENT' } },
    ]);
    expect(requests[3].body).not.toHaveProperty('request.channel');
  });
});

describe('Agent Channel', () => {
  const PARTICIPANTS = [
    { namespace: 'iphi-flow', project: 'p0001', agent: 'writer' },
    { namespace: 'iphi-flow', project: 'p0002', agent: 'critic' },
  ];
  const CHANNEL_OUTPUT = {
    correlationId: 'iphiflow_ch_1',
    messages: [{ from: 'p0001.writer', to: 'p0002.critic', text: 'Draft ready', at: '2026-10-27T10:00:00.000Z' }],
    results: { 'p0001.writer': 'Sent', 'p0002.critic': 'Looks good' },
    finishedBy: 'done',
    result: { verdict: 'ok' },
  };

  test('with a finish rule, pauses until the timeout plus a margin and sends the participants and the rule', async () => {
    const requests = mockServer({ answer: () => ({ requestId: 'req_1' }) });
    const { context, waitpoints, waited } = contextOf({
      propsValue: {
        participants: PARTICIPANTS,
        waitFor: 'FINISH_RULE',
        kickoff: ' Write a haiku and get it reviewed ',
        startWith: 'iphi-flow/p0001/writer',
        doneWhen: 'iphi-flow/p0002/critic',
        maxMessages: 20,
        timeoutMinutes: 10,
      },
    });
    const before = Date.now();

    expect(await agentChannelAction.run(context as never)).toEqual({});

    const resumeAt = new Date(waitpoints[0].resumeDateTime ?? '').getTime();
    expect(resumeAt).toBeGreaterThanOrEqual(before + 15 * 60 * 1000 - 1000);
    expect(resumeAt).toBeLessThanOrEqual(Date.now() + 15 * 60 * 1000 + 1000);
    expect(waited).toEqual(['test-waitpoint-id']);
    expect(requests[0].body).toEqual({
      flowId: 'test-flow-id',
      flowRunId: 'test-run-id',
      stepName: 'test-step',
      waitpointId: 'test-waitpoint-id',
      request: {
        action: 'OPENCODE_AGENT_CHANNEL',
        participants: PARTICIPANTS,
        waitFor: 'FINISH_RULE',
        kickoff: 'Write a haiku and get it reviewed',
        startWith: 'iphi-flow/p0001/writer',
        doneBy: 'iphi-flow/p0002/critic',
        maxMessages: 20,
        timeoutMinutes: 10,
      },
    });
  });

  test('defaults to all participants, 50 messages and 30 minutes, and returns the conversation on resume', async () => {
    const requests = mockServer({ answer: () => ({ requestId: 'req_1' }) });
    const { context } = contextOf({ propsValue: { participants: PARTICIPANTS, waitFor: 'FINISH_RULE', kickoff: 'Go' } });
    const done = contextOf({ propsValue: { participants: PARTICIPANTS, waitFor: 'FINISH_RULE', kickoff: 'Go' }, resumePayload: resumeWith({ body: { output: CHANNEL_OUTPUT } }) });

    await agentChannelAction.run(context as never);

    expect(requests[0].body).toMatchObject({ request: { startWith: 'ALL', maxMessages: 50, timeoutMinutes: 30 } });
    expect(requests[0].body).not.toHaveProperty('request.doneBy');
    expect(await agentChannelAction.run(done.context as never)).toEqual(CHANNEL_OUTPUT);
  });

  test('with None, opens the channel in one request and returns its correlation id without pausing', async () => {
    const opened = { correlationId: 'iphiflow_ch_2', participants: [] };
    const requests = mockServer({ answer: () => ({ requestId: 'req_1', output: opened }) });
    const { context, waitpoints } = contextOf({ propsValue: { participants: PARTICIPANTS, waitFor: 'OPEN' } });

    expect(await agentChannelAction.run(context as never)).toEqual(opened);

    expect(waitpoints).toEqual([]);
    expect(requests[0].body).toEqual({
      flowId: 'test-flow-id',
      flowRunId: 'test-run-id',
      stepName: 'test-step',
      request: { action: 'OPENCODE_AGENT_CHANNEL', participants: PARTICIPANTS, waitFor: 'OPEN' },
    });
  });

  test('checks the participants, kickoff and limits before sending anything', async () => {
    const requests = mockServer({ answer: () => ({ requestId: 'req_1' }) });
    const one = contextOf({ propsValue: { participants: [PARTICIPANTS[0]], waitFor: 'OPEN' } });
    const noKickoff = contextOf({ propsValue: { participants: PARTICIPANTS, waitFor: 'FINISH_RULE', kickoff: ' ' } });
    const tooMany = contextOf({ propsValue: { participants: PARTICIPANTS, waitFor: 'FINISH_RULE', kickoff: 'Go', maxMessages: 1001 } });
    const tooLong = contextOf({ propsValue: { participants: PARTICIPANTS, waitFor: 'FINISH_RULE', kickoff: 'Go', timeoutMinutes: 2.5 } });

    await expect(agentChannelAction.run(one.context as never)).rejects.toThrow('Pick at least two participants.');
    await expect(agentChannelAction.run(noKickoff.context as never)).rejects.toThrow('Write the kickoff message: with a finish rule, it is what starts the conversation.');
    await expect(agentChannelAction.run(tooMany.context as never)).rejects.toThrow('Max messages must be a whole number from 1 to 1000.');
    await expect(agentChannelAction.run(tooLong.context as never)).rejects.toThrow('The timeout must be a whole number from 1 to 1440.');
    expect(requests).toEqual([]);
  });
});

describe('Send to Project Inbox', () => {
  const INBOX_OUTPUT = { messageId: 'msg_1', correlationId: 'iphiflow_1', status: 'routed', routedTo: ['writer'] };

  test('without waiting, sends at once and returns where the message went', async () => {
    const requests = mockServer({ answer: () => ({ requestId: 'req_1', output: INBOX_OUTPUT }) });
    const { context, waitpoints } = contextOf({
      propsValue: { project: { namespace: 'iphi-flow', project: 'p0001' }, message: 'New order 7', to: 'agent', recipient: { id: 'writer' }, wait: false, timeoutMinutes: undefined },
    });

    expect(await sendToInboxAction.run(context as never)).toEqual(INBOX_OUTPUT);

    expect(waitpoints).toEqual([]);
    expect(requests[0].body).toEqual({
      flowId: 'test-flow-id',
      flowRunId: 'test-run-id',
      stepName: 'test-step',
      request: { action: 'OPENCODE_SEND_TO_INBOX', namespace: 'iphi-flow', project: 'p0001', message: 'New order 7', to: { type: 'agent', id: 'writer' }, wait: false, timeoutMinutes: 10 },
    });
  });

  test('waiting, pauses until the timeout plus a margin and reports a missing reply with the timeout', async () => {
    const requests = mockServer({ answer: () => ({ requestId: 'req_1' }) });
    const { context, waitpoints } = contextOf({ propsValue: { project: { namespace: 'iphi-flow', project: 'p0001' }, message: 'Status?', wait: true, timeoutMinutes: 3 } });
    const empty = contextOf({ propsValue: { project: { namespace: 'iphi-flow', project: 'p0001' }, message: 'Status?', wait: true, timeoutMinutes: 3 }, resumePayload: resumeWith({ body: undefined }) });
    const before = Date.now();

    expect(await sendToInboxAction.run(context as never)).toEqual({});
    await expect(sendToInboxAction.run(empty.context as never)).rejects.toThrow('No reply arrived within 3 min.');

    const resumeAt = new Date(waitpoints[0].resumeDateTime ?? '').getTime();
    expect(resumeAt).toBeGreaterThanOrEqual(before + 8 * 60 * 1000 - 1000);
    expect(resumeAt).toBeLessThanOrEqual(Date.now() + 8 * 60 * 1000 + 1000);
    expect(requests[0].body).toMatchObject({ waitpointId: 'test-waitpoint-id', request: { wait: true, timeoutMinutes: 3 } });
  });

  test('checks the project, recipient and timeout', async () => {
    mockServer({ answer: () => ({ requestId: 'req_1', output: INBOX_OUTPUT }) });
    const noProject = contextOf({ propsValue: { message: 'x' } });
    const noRecipient = contextOf({ propsValue: { project: { namespace: 'n', project: 'p' }, message: 'x', to: 'group', recipient: {} } });
    const tooLong = contextOf({ propsValue: { project: { namespace: 'n', project: 'p' }, message: 'x', wait: true, timeoutMinutes: 45 } });

    await expect(sendToInboxAction.run(noProject.context as never)).rejects.toThrow('Pick the OpenCode project whose inbox gets the message.');
    await expect(sendToInboxAction.run(noRecipient.context as never)).rejects.toThrow('To is "A group", so pick the recipient.');
    await expect(sendToInboxAction.run(tooLong.context as never)).rejects.toThrow('The timeout must be a whole number of minutes from 1 to 30.');
  });
});
