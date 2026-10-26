/**
 * @vitest-environment jsdom
 */
import { OpencodeAgentCard as OpencodeAgentCardData } from '@activepieces/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { useAgentCard } = vi.hoisted(() => ({ useAgentCard: vi.fn() }));

vi.mock('i18next', () => ({
  default: { language: 'en' },
  t: (key: string, values?: Record<string, string>) =>
    key.replace(/\{(\w+)\}/g, (match, name: string) => values?.[name] ?? match),
}));

vi.mock('@/features/opencode/hooks/opencode-views-hooks', () => ({
  opencodeViewsQueries: { useAgentCard },
}));

import {
  OpencodeAgentCard,
  OpencodeAgentCardBody,
} from '@/features/opencode/components/opencode-agent-card';

describe('OpencodeAgentCard', () => {
  beforeEach(() => {
    useAgentCard.mockReset();
    useAgentCard.mockReturnValue({
      data: { card: CARD },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it('reads the agent from OpenCode only once its details are opened', () => {
    render(
      <OpencodeAgentCard
        projectId="p1"
        name="writer"
        namespace="crew"
        project="c0001"
      />,
    );

    expect(useAgentCard).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: 'writer', enabled: false }),
    );
    fireEvent.click(screen.getByText('Agent details'));

    expect(useAgentCard).toHaveBeenLastCalledWith({
      projectId: 'p1',
      name: 'writer',
      namespace: 'crew',
      project: 'c0001',
      enabled: true,
    });
    expect(screen.getAllByTestId('opencode-agent-card')).toHaveLength(1);
  });

  it('shows the agent read-only, with what it may use and a link to edit each part in the admin panel', () => {
    render(<OpencodeAgentCardBody card={CARD} />);

    expect(screen.getAllByText('openrouter/qwen3')).toHaveLength(1);
    expect(screen.getAllByText('from namespace · mode primary')).toHaveLength(
      1,
    );
    expect(screen.getAllByText('github_issue (github)')).toHaveLength(1);
    expect(
      screen.getAllByText('Not available: question (permission)'),
    ).toHaveLength(1);
    expect(screen.getAllByText('pdf · allowed')).toHaveLength(1);
    expect(screen.getAllByText('reviewer · denied')).toHaveLength(1);
    expect(screen.getAllByText('Tone')).toHaveLength(1);
    expect(screen.getAllByText('No hooks')).toHaveLength(1);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(
      screen
        .getAllByRole('link', { name: 'Edit in admin panel' })
        .map((link) => link.getAttribute('href')),
    ).toEqual([
      'http://oc/agent',
      'http://oc/tools',
      'http://oc/tools',
      'http://oc/tools',
      'http://oc/tools',
      'http://oc/memory',
      'http://oc/permissions',
      'http://oc/hooks',
    ]);
  });
});

const CARD: OpencodeAgentCardData = {
  name: 'writer',
  mode: 'primary',
  model: 'openrouter/qwen3',
  modelFrom: 'namespace',
  steps: null,
  tools: [
    { name: 'bash', source: 'builtin' },
    { name: 'github_issue', source: 'mcp:github' },
  ],
  hiddenTools: [{ name: 'question', reason: 'permission' }],
  skills: [{ name: 'pdf', origin: 'global', access: 'allow' }],
  subagents: [{ name: 'reviewer', access: 'deny' }],
  mcpServers: [{ name: 'github', status: 'connected' }],
  memory: [
    {
      level: 'agent',
      folder: '/x',
      entries: [{ title: 'Tone', description: 'Short' }],
    },
  ],
  permissions: [
    { permission: '*', pattern: '*', action: 'allow', level: 'opencode' },
  ],
  hooks: [],
  links: {
    agent: 'http://oc/agent',
    tools: 'http://oc/tools',
    permissions: 'http://oc/permissions',
    hooks: 'http://oc/hooks',
    memory: 'http://oc/memory',
  },
};
