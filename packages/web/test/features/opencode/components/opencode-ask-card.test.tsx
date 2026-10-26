/**
 * @vitest-environment jsdom
 */
import {
  OpencodeAsk,
  OpencodeAskKind,
  OpencodeAskStatus,
} from '@activepieces/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }));

vi.mock('i18next', () => ({
  default: { language: 'en' },
  t: (key: string, values?: Record<string, string>) =>
    key.replace(/\{(\w+)\}/g, (match, name: string) => values?.[name] ?? match),
}));

vi.mock('@/features/opencode/hooks/opencode-asks-hooks', () => ({
  opencodeAsksMutations: {
    useAnswer: () => ({ mutate, isPending: false }),
    useLink: () => ({ mutate: vi.fn(), isPending: false }),
  },
  opencodeAsksQueries: {
    useAsks: () => ({ data: [] }),
  },
}));

import { OpencodeAskCard } from '@/features/opencode/components/opencode-ask-card';

describe('OpencodeAskCard', () => {
  beforeEach(() => {
    mutate.mockReset();
  });

  it('shows what the agent wants to do and sends the chosen decision', () => {
    render(<OpencodeAskCard ask={PERMISSION_ASK} />);

    expect(screen.getAllByText('rm -rf build')).toHaveLength(1);
    expect(screen.getAllByText(/^Asked by flow at /)).toHaveLength(1);
    fireEvent.click(screen.getByText('Allow for this run'));

    expect(mutate).toHaveBeenCalledWith(
      {
        id: 'ask_1',
        request: { type: 'permission', decision: 'allow-session' },
      },
      expect.anything(),
    );
  });

  it('sends the reason with a denial', () => {
    render(<OpencodeAskCard ask={PERMISSION_ASK} />);

    fireEvent.change(
      screen.getByLabelText('Reason (sent to the agent if you deny)'),
      { target: { value: 'Not on production ' } },
    );
    fireEvent.click(screen.getByText('Deny'));

    expect(mutate).toHaveBeenCalledWith(
      {
        id: 'ask_1',
        request: {
          type: 'permission',
          decision: 'deny',
          note: 'Not on production',
        },
      },
      expect.anything(),
    );
  });

  it('answers a question with the typed answer, or dismisses it', () => {
    render(<OpencodeAskCard ask={QUESTION_ASK} />);

    fireEvent.change(screen.getByLabelText('Or type your own answer'), {
      target: { value: 'Both' },
    });
    fireEvent.click(screen.getByText('Answer'));
    fireEvent.click(screen.getByText('Dismiss'));

    expect(mutate.mock.calls.map((call) => call[0])).toEqual([
      { id: 'ask_2', request: { type: 'question', answers: [['Both']] } },
      { id: 'ask_2', request: { type: 'dismiss' } },
    ]);
  });
});

const BASE: OpencodeAsk = {
  id: 'ask_1',
  created: '2026-10-26T10:00:00.000Z',
  flowId: 'flow_1',
  flowRunId: 'run_1',
  flowVersionId: 'version_1',
  stepName: 'step_1',
  kind: OpencodeAskKind.PERMISSION,
  status: OpencodeAskStatus.OPEN,
  agent: 'flow',
  permission: null,
  questions: null,
  deadline: '2026-10-27T10:00:00.000Z',
  answer: null,
  answeredVia: null,
  answeredAt: null,
  adminPanelUrl: 'http://127.0.0.1:4444/x/session/ses_1',
};

const PERMISSION_ASK: OpencodeAsk = {
  ...BASE,
  permission: {
    permission: 'bash',
    patterns: ['rm -rf build'],
    metadata: {},
  },
};

const QUESTION_ASK: OpencodeAsk = {
  ...BASE,
  id: 'ask_2',
  kind: OpencodeAskKind.QUESTION,
  questions: [
    {
      question: 'Where should I deploy?',
      header: 'Target',
      options: [{ label: 'Staging', description: 'The test system' }],
    },
  ],
};
