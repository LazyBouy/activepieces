/**
 * @vitest-environment jsdom
 */
import {
  OpencodeProjectOptions,
  OpencodeProjectView,
} from '@activepieces/shared';
import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { useOptions, useProjectView } = vi.hoisted(() => ({
  useOptions: vi.fn(),
  useProjectView: vi.fn(),
}));

vi.mock('i18next', () => ({
  default: { language: 'en' },
  t: (key: string, values?: Record<string, string>) =>
    key.replace(/\{(\w+)\}/g, (match, name: string) => values?.[name] ?? match),
}));

vi.mock('@/features/opencode/hooks/opencode-options-hooks', () => ({
  opencodeOptionsQueries: {
    useOptions,
    useAgents: () => ({ data: undefined }),
  },
  opencodeOptionsKeys: {},
}));

vi.mock('@/features/opencode/hooks/opencode-views-hooks', () => ({
  opencodeViewsQueries: {
    useProjectView,
    useAgentCard: () => ({ data: undefined, isLoading: false, isError: false }),
  },
  opencodeViewsKeys: {},
}));

vi.mock('@/lib/authentication-session', () => ({
  authenticationSession: {
    getProjectId: () => 'p1',
    appendProjectRoutePrefix: (path: string) => `/projects/p1${path}`,
  },
}));

import { OpencodePage } from '@/app/routes/opencode';

describe('OpencodePage', () => {
  beforeEach(() => {
    useOptions.mockReset();
    useProjectView.mockReset();
  });

  it('says when AI does not run on OpenCode', () => {
    useOptions.mockReturnValue({
      data: { ...OPTIONS, enabled: false },
      isLoading: false,
      isError: false,
    });

    renderPage();

    expect(
      screen.getAllByText(
        'Run AI on OpenCode is off. A platform admin can turn it on in Platform → AI → OpenCode.',
      ),
    ).toHaveLength(1);
    expect(useProjectView).not.toHaveBeenCalled();
  });

  it("shows the project's agents, capabilities, models and its sessions linked to their runs", () => {
    useOptions.mockReturnValue({
      data: OPTIONS,
      isLoading: false,
      isError: false,
    });
    useProjectView.mockReturnValue({
      data: { view: VIEW },
      isLoading: false,
      isError: false,
    });

    renderPage();

    expect(useProjectView).toHaveBeenCalledWith({ projectId: 'p1' });
    expect(screen.getAllByText('flow')).toHaveLength(1);
    expect(screen.getAllByText('pdf')).toHaveLength(1);
    expect(screen.getAllByText('Default: openrouter/qwen3')).toHaveLength(1);
    expect(screen.getAllByText('OpenRouter: 2 models')).toHaveLength(1);
    expect(
      screen.getByRole('link', { name: 'View run' }).getAttribute('href'),
    ).toBe('/projects/p1/runs/run_1');
    expect(screen.getAllByText('iphi-flow/p0001 · /home/p0001')).toHaveLength(
      1,
    );
  });
});

function renderPage() {
  render(
    <MemoryRouter>
      <OpencodePage />
    </MemoryRouter>,
  );
}

const OPTIONS: OpencodeProjectOptions = {
  enabled: true,
  adminPanelUrl: 'http://oc',
  namespaces: [
    {
      id: 'iphi-flow',
      name: 'iphi-flow',
      folder: '/home',
      projects: [{ id: 'p0001', name: 'p0001', folder: '/home/p0001' }],
    },
  ],
  defaultLocation: { namespace: 'iphi-flow', project: 'p0001', agent: 'flow' },
};

const VIEW: OpencodeProjectView = {
  namespace: 'iphi-flow',
  project: 'p0001',
  name: 'p0001',
  folder: '/home/p0001',
  agents: [{ name: 'flow', mode: 'primary', origin: 'project' }],
  tools: [{ name: 'bash', origin: 'opencode' }],
  skills: [{ name: 'pdf', origin: 'global' }],
  commands: [],
  mcpServers: [],
  memory: [],
  defaultModel: 'openrouter/qwen3',
  defaultModelFrom: null,
  providers: [
    {
      id: 'openrouter',
      name: 'OpenRouter',
      defaultModel: null,
      models: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
    },
  ],
  sessions: [
    {
      id: 'ses_1',
      title: 'Flow · run run_1 · step_1',
      agent: 'flow',
      model: 'openrouter/qwen3',
      cost: 0.001,
      created: '2026-10-26T10:00:00.000Z',
      updated: '2026-10-26T10:00:00.000Z',
      flowId: 'f1',
      flowRunId: 'run_1',
      stepName: 'step_1',
      adminPanelUrl: 'http://oc/session',
    },
  ],
  links: {
    agents: 'http://oc/agents',
    capabilities: 'http://oc/capabilities',
    memory: 'http://oc/memory',
    models: 'http://oc/models',
    sessions: 'http://oc/sessions',
  },
};
