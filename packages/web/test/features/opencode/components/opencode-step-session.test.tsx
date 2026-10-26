/**
 * @vitest-environment jsdom
 */
import { OpencodeStepSessionView } from '@activepieces/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('i18next', () => ({
  default: { language: 'en' },
  t: (key: string, values?: Record<string, string>) =>
    key.replace(/\{(\w+)\}/g, (match, name: string) => values?.[name] ?? match),
}));

vi.mock('@/features/opencode/hooks/opencode-views-hooks', () => ({
  opencodeViewsQueries: { useStepSessions: () => ({ data: [] }) },
}));

import { OpencodeSessionPanel } from '@/features/opencode/components/opencode-step-session';

describe('OpencodeSessionPanel', () => {
  it('shows the model, usage, files and the admin panel link of a direct step, with its transcript behind a toggle', () => {
    render(<OpencodeSessionPanel session={SESSION} />);

    expect(screen.getAllByText('Finished')).toHaveLength(1);
    expect(
      screen.getAllByText('openrouter/qwen3 · agent flow · iphi-flow/p0001'),
    ).toHaveLength(1);
    expect(
      screen
        .getByRole('link', { name: 'Open in admin panel' })
        .getAttribute('href'),
    ).toBe('http://oc/session');
    expect(
      screen.getByRole('link', { name: /report\.md/ }).getAttribute('href'),
    ).toBe('http://ap/files/1');
    expect(
      screen.getAllByText('huge.bin was not saved: larger than 25 MB'),
    ).toHaveLength(1);
    expect(screen.queryAllByText('Here is the answer')).toHaveLength(0);

    fireEvent.click(screen.getByText('Transcript (2)'));

    expect(screen.getAllByText('Here is the answer')).toHaveLength(1);
    expect(screen.getAllByText('read')).toHaveLength(1);
  });

  it("leaves Run Agent's transcript to its timeline and says when the session was removed", () => {
    render(
      <OpencodeSessionPanel
        session={{ ...SESSION, action: 'RUN_AGENT', sessionGone: true }}
      />,
    );

    expect(
      screen.getAllByText(
        'This session was removed in the OpenCode admin panel.',
      ),
    ).toHaveLength(1);
    expect(screen.queryAllByText('Transcript (2)')).toHaveLength(0);
    expect(screen.queryAllByText('Open in admin panel')).toHaveLength(0);
  });
});

const SESSION: OpencodeStepSessionView = {
  stepId: 'step_1',
  stepName: 'ask_1',
  action: 'ASK_AI',
  status: 'COMPLETED',
  created: '2026-10-26T10:00:00.000Z',
  sessionId: 'ses_1',
  adminPanelUrl: 'http://oc/session',
  namespace: 'iphi-flow',
  project: 'p0001',
  agent: 'flow',
  model: 'openrouter/qwen3',
  usage: { input: 1200, output: 30, reasoning: 0, cost: 0.0012 },
  durationMs: 4200,
  failure: null,
  files: [{ name: 'report.md', url: 'http://ap/files/1', size: 120 }],
  skippedFiles: [{ name: 'huge.bin', reason: 'larger than 25 MB' }],
  transcript: [
    {
      type: 'tool',
      tool: 'read',
      status: 'completed',
      input: { filePath: 'a.md' },
      output: 'text',
    },
    { type: 'text', text: 'Here is the answer' },
  ],
  sessionGone: false,
};
