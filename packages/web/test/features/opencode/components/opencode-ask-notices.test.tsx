/**
 * @vitest-environment jsdom
 */
import {
  OpencodeAskEvent,
  OpencodeAskKind,
  WebsocketClientEvent,
} from '@activepieces/shared';
import { render } from '@testing-library/react';
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { handlers, toast, navigate } = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown) => void>(),
  toast: Object.assign(vi.fn(), { dismiss: vi.fn() }),
  navigate: vi.fn(),
}));

vi.mock('i18next', () => ({ t: (key: string) => key }));
vi.mock('sonner', () => ({ toast }));
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('@/lib/authentication-session', () => ({
  authenticationSession: {
    appendProjectRoutePrefix: (path: string) => `/projects/p1${path}`,
  },
}));
vi.mock('@/components/providers/socket-provider', () => ({
  useSocket: () => ({
    on: (event: string, handler: (payload: unknown) => void) =>
      handlers.set(event, handler),
    off: (event: string) => handlers.delete(event),
  }),
}));

import { OpencodeAskNotices } from '@/features/opencode/components/opencode-ask-notices';

describe('OpencodeAskNotices', () => {
  beforeEach(() => {
    toast.mockReset();
    toast.dismiss.mockReset();
    navigate.mockReset();
    handlers.clear();
  });

  it('shows a notice for a new request that opens the run', () => {
    render(<OpencodeAskNotices />);

    handlers.get(WebsocketClientEvent.OPENCODE_ASK)?.(
      event({ state: 'opened' }),
    );
    const [title, options] = toast.mock.calls[0];
    options.action.onClick();

    expect(title).toBe('An agent is waiting for an answer');
    expect(options).toMatchObject({
      id: 'opencode-ask-ask_1',
      description: 'bash: rm -rf build',
    });
    expect(navigate).toHaveBeenCalledWith('/projects/p1/runs/run_1');
  });

  it('takes the notice away once the request is answered', () => {
    render(<OpencodeAskNotices />);

    handlers.get(WebsocketClientEvent.OPENCODE_ASK)?.(
      event({ state: 'closed' }),
    );

    expect(toast).not.toHaveBeenCalled();
    expect(toast.dismiss).toHaveBeenCalledWith('opencode-ask-ask_1');
  });
});

function event({
  state,
}: {
  state: OpencodeAskEvent['state'];
}): OpencodeAskEvent {
  return {
    askId: 'ask_1',
    flowId: 'flow_1',
    flowRunId: 'run_1',
    flowVersionId: 'version_1',
    stepName: 'step_1',
    kind: OpencodeAskKind.PERMISSION,
    state,
    title: 'bash: rm -rf build',
  };
}
