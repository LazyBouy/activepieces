/// <reference types="vitest/globals" />

import { PropertyContext } from '@activepieces/pieces-framework';
import { opencodeProps } from '../src/lib/common/props';
import { testUtils } from './test-utils';

const { mockServer } = testUtils;

afterEach(() => {
  vi.restoreAllMocks();
});

const ctx = {
  server: { apiUrl: 'http://api/', publicUrl: 'http://web/', token: 'engine-token' },
  project: { id: 'proj_1', externalId: async () => undefined },
  flows: {},
  connections: {},
} as unknown as PropertyContext;

const OPTIONS = {
  enabled: true,
  adminPanelUrl: 'http://127.0.0.1:4444',
  namespaces: [
    { id: 'iphi-flow', name: 'iphi-flow', folder: '/oc/iphi-flow', projects: [{ id: 'p0001', name: 'Sales', folder: '/oc/iphi-flow/a' }] },
    { id: 'crew', name: 'Crew', folder: '/oc/crew', projects: [{ id: 'c0001', name: 'Support', folder: '/oc/crew/s' }] },
  ],
  defaultLocation: { namespace: 'iphi-flow', project: 'p0001', agent: 'flow' },
};

function serve(): ReturnType<typeof mockServer> {
  return mockServer({
    answer: (request) => {
      const path = request.url.replace('http://api/v1/opencode/steps', '');
      switch (path) {
        case '/options':
          return OPTIONS;
        case '/agents':
          return { agents: [{ name: 'flow' }, { name: 'triage', description: 'Sorts tickets' }] };
        case '/commands':
          return { commands: [{ name: 'review', source: 'command' }, { name: 'pdf', source: 'skill' }] };
        case '/models':
          return { providers: [{ id: 'openrouter', name: 'OpenRouter', models: [{ id: 'qwen/qwen3-coder', name: 'Qwen3 Coder' }] }] };
        case '/groups':
          return { groups: [{ id: 'g1', name: 'Writers' }] };
        default:
          throw new Error(`unexpected ${path}`);
      }
    },
  });
}

describe('OpenCode piece dropdowns', () => {
  test('namespaces and projects come from the allowlisted options, with the engine token', async () => {
    const requests = serve();

    const namespaces = await opencodeProps.namespace.options({}, ctx);
    const noNamespace = await opencodeProps.project.options({}, ctx);
    const projects = await opencodeProps.project.options({ namespace: 'crew' }, ctx);

    expect(namespaces).toEqual({
      disabled: false,
      options: [{ label: 'iphi-flow', value: 'iphi-flow' }, { label: 'Crew', value: 'crew' }],
      placeholder: 'Leave empty for this project\'s own (iphi-flow)',
    });
    expect(noNamespace).toMatchObject({ disabled: true, options: [] });
    expect(projects).toMatchObject({ disabled: false, options: [{ label: 'Support', value: 'c0001' }] });
    expect(requests[0].authentication).toEqual({ type: 'BEARER_TOKEN', token: 'engine-token' });
  });

  test('says routing is off instead of listing anything', async () => {
    mockServer({ answer: () => ({ ...OPTIONS, enabled: false, namespaces: [] }) });

    expect(await opencodeProps.namespace.options({}, ctx)).toEqual({ disabled: true, options: [], placeholder: 'Run AI on OpenCode is off. Turn it on in Platform → AI → OpenCode.' });
    expect(await opencodeProps.inboxProject.options({}, ctx)).toMatchObject({ disabled: true, placeholder: 'Run AI on OpenCode is off. Turn it on in Platform → AI → OpenCode.' });
  });

  test('agents, commands and models are read for the picked project, with Agent default first', async () => {
    const requests = serve();

    const agents = await opencodeProps.agent.options({ namespace: 'crew', project: 'c0001' }, ctx);
    const commands = await opencodeProps.command.options({}, ctx);
    const models = await opencodeProps.model.options({}, ctx);

    expect(agents.options).toEqual([{ label: 'flow', value: 'flow' }, { label: 'triage (Sorts tickets)', value: 'triage' }]);
    expect(requests[0].queryParams).toEqual({ namespace: 'crew', project: 'c0001' });
    expect(commands.options).toEqual([{ label: 'review (command)', value: 'review' }, { label: 'pdf (skill)', value: 'pdf' }]);
    expect(requests[1].queryParams).toEqual({});
    expect(models.options).toEqual([
      { label: 'Agent default', value: null },
      { label: 'OpenRouter: Qwen3 Coder', value: { providerID: 'openrouter', modelID: 'qwen/qwen3-coder' } },
    ]);
  });

  test('the inbox project list spans the allowlisted namespaces and marks this project\'s own', async () => {
    serve();

    const projects = await opencodeProps.inboxProject.options({}, ctx);

    expect(projects.options).toEqual([
      { label: 'iphi-flow / Sales (this project\'s own)', value: { namespace: 'iphi-flow', project: 'p0001' } },
      { label: 'Crew / Support', value: { namespace: 'crew', project: 'c0001' } },
    ]);
  });

  test('the recipient field follows To: an agent or group list, or a session id', async () => {
    const requests = serve();
    const project = { namespace: 'crew', project: 'c0001' };

    const agent = await opencodeProps.inboxRecipient.props({ project, to: 'agent' }, ctx);
    const group = await opencodeProps.inboxRecipient.props({ project, to: 'group' }, ctx);
    const session = await opencodeProps.inboxRecipient.props({ project, to: 'session' }, ctx);
    const none = await opencodeProps.inboxRecipient.props({ project }, ctx);

    expect(agent['id']).toMatchObject({ displayName: 'Agent', options: { options: [{ label: 'flow', value: 'flow' }, { label: 'triage', value: 'triage' }] } });
    expect(group['id']).toMatchObject({ displayName: 'Group', options: { options: [{ label: 'Writers', value: 'g1' }] } });
    expect(session['id']).toMatchObject({ displayName: 'Session id' });
    expect(none).toEqual({});
    expect(requests.map((request) => request.queryParams)).toEqual([{ namespace: 'crew', project: 'c0001' }, { namespace: 'crew', project: 'c0001' }]);
  });
});
