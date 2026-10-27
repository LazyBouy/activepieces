/**
 * @vitest-environment jsdom
 */
import { OpencodeChannelView } from '@activepieces/shared';
import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('i18next', () => ({
  default: { language: 'en' },
  t: (key: string, values?: Record<string, string>) =>
    key.replace(/\{(\w+)\}/g, (match, name: string) => values?.[name] ?? match),
}));

vi.mock('@/features/opencode/hooks/opencode-views-hooks', () => ({
  opencodeViewsQueries: { useStepChannels: () => ({ data: [] }) },
}));

import { OpencodeChannelPanel } from '@/features/opencode/components/opencode-step-channel';

describe('OpencodeChannelPanel', () => {
  it('shows a closed channel with what ended it, its participants with admin panel links, and the messages in order', () => {
    render(<OpencodeChannelPanel channel={CHANNEL} />);

    expect(screen.getAllByText('Closed')).toHaveLength(1);
    expect(screen.getAllByText('iphiflow_ch_1')).toHaveLength(1);
    expect(
      screen.getAllByText(
        'Ended when the finishing agent called finish_channel.',
      ),
    ).toHaveLength(1);
    expect(screen.getAllByText('Sales · writer')).toHaveLength(1);
    expect(screen.getAllByText('Legal · critic')).toHaveLength(1);
    expect(
      screen
        .getAllByRole('link', { name: 'Open in admin panel' })
        .map((link) => link.getAttribute('href')),
    ).toEqual(['http://oc/ses_1']);
    expect(screen.getAllByText('Messages (2)')).toHaveLength(1);
    const texts = screen
      .getAllByText(/^(Draft ready|Looks good)$/)
      .map((node) => node.textContent);
    expect(texts).toEqual(['Draft ready', 'Looks good']);
    expect(screen.getAllByText('p0001.writer to p0002.critic')).toHaveLength(
      1,
    );
  });

  it('shows an open channel waiting for messages and an unreadable conversation', () => {
    render(
      <OpencodeChannelPanel
        channel={{
          ...CHANNEL,
          status: 'OPEN',
          finishedBy: null,
          closedAt: null,
          messages: [],
          error: 'OpenCode is not reachable',
        }}
      />,
    );

    expect(screen.getAllByText('Open')).toHaveLength(1);
    expect(screen.getAllByText('No messages yet.')).toHaveLength(1);
    expect(
      screen.getAllByText(
        'Could not read the conversation from OpenCode: OpenCode is not reachable',
      ),
    ).toHaveLength(1);
    expect(screen.queryAllByText(/^Ended/)).toHaveLength(0);
  });

  it('names each way a channel can close', () => {
    const reasons = {
      'max messages': 'Ended at the message limit.',
      timeout: 'Ended at the timeout.',
      'run ended': 'Closed when the run ended.',
      'step failed': 'Closed because the step failed.',
      'something new': 'Ended: something new',
    };
    Object.entries(reasons).forEach(([finishedBy, label]) => {
      const { unmount } = render(
        <OpencodeChannelPanel channel={{ ...CHANNEL, finishedBy }} />,
      );
      expect(screen.getAllByText(label)).toHaveLength(1);
      unmount();
    });
  });
});

const CHANNEL: OpencodeChannelView = {
  id: 'channel_1',
  stepName: 'step_1',
  correlationId: 'iphiflow_ch_1',
  mode: 'FINISH_RULE',
  status: 'CLOSED',
  finishedBy: 'done',
  created: '2026-10-27T10:00:00.000Z',
  closedAt: '2026-10-27T10:05:00.000Z',
  participants: [
    {
      key: 'iphi-flow/p0001/writer',
      namespace: 'iphi-flow',
      project: 'p0001',
      projectName: 'Sales',
      agent: 'writer',
      sessionId: 'ses_1',
      adminPanelUrl: 'http://oc/ses_1',
    },
    {
      key: 'iphi-flow/p0002/critic',
      namespace: 'iphi-flow',
      project: 'p0002',
      projectName: 'Legal',
      agent: 'critic',
      sessionId: null,
      adminPanelUrl: null,
    },
  ],
  messages: [
    {
      id: 'msg_1',
      from: 'p0001.writer',
      to: 'p0002.critic',
      text: 'Draft ready',
      at: '2026-10-27T10:01:00.000Z',
      status: 'delivered',
    },
    {
      id: 'msg_2',
      from: 'p0002.critic',
      to: 'p0001.writer',
      text: 'Looks good',
      at: '2026-10-27T10:02:00.000Z',
      status: 'delivered',
    },
  ],
};
