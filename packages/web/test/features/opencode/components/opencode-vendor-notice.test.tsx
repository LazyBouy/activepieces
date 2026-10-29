/**
 * @vitest-environment jsdom
 */
import { FlowAction, FlowActionType } from '@activepieces/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OpencodeVendorNotice } from '@/features/opencode/components/opencode-vendor-notice';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  options: vi.fn(),
}));

vi.mock('i18next', () => ({
  t: (key: string, values?: Record<string, string>) =>
    key.replace(/\{(\w+)\}/g, (match, name: string) => values?.[name] ?? match),
}));

vi.mock('@/features/opencode/api/opencode-options-api', () => ({
  opencodeOptionsApi: {
    get: mocks.options,
  },
}));

let container: HTMLDivElement | null = null;
let root: Root | null = null;

describe('notice on an official vendor chat step (OCI-31)', () => {
  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
    vi.clearAllMocks();
  });

  it('tells the user the step calls the vendor directly while AI runs on OpenCode', async () => {
    mocks.options.mockResolvedValue({ enabled: true });
    await renderNotice({ step: pieceStep({ pieceName: '@activepieces/piece-openai', actionName: 'ask_chatgpt' }) });
    expect(container?.textContent).toBe(
      'This step calls OpenAI directly. Use OpenAI (via OpenCode) to run it on OpenCode.',
    );
  });

  it('shows nothing for the vendor\'s other actions, the fork pieces, or with routing off', async () => {
    mocks.options.mockResolvedValue({ enabled: true });
    await renderNotice({ step: pieceStep({ pieceName: '@activepieces/piece-openai', actionName: 'generate_image' }) });
    expect(container?.textContent).toBe('');
    act(() => root?.unmount());

    await renderNotice({ step: pieceStep({ pieceName: '@iphi-flow/piece-opencode-openai', actionName: 'ask_chatgpt' }) });
    expect(container?.textContent).toBe('');
    act(() => root?.unmount());

    mocks.options.mockResolvedValue({ enabled: false });
    await renderNotice({ step: pieceStep({ pieceName: '@activepieces/piece-claude', actionName: 'ask_claude' }) });
    expect(container?.textContent).toBe('');
  });

  it('shows nothing while the replacement piece is not installed (OCD-02)', async () => {
    mocks.options.mockResolvedValue({ enabled: true });
    await renderNotice({
      step: pieceStep({ pieceName: '@activepieces/piece-openai', actionName: 'ask_chatgpt' }),
      installedPieceNames: ['@activepieces/piece-openai', '@iphi-flow/piece-opencode-claude'],
    });
    expect(container?.textContent).toBe('');
  });
});

async function renderNotice({
  step,
  installedPieceNames = ['@iphi-flow/piece-opencode-openai', '@iphi-flow/piece-opencode-claude'],
}: {
  step: FlowAction;
  installedPieceNames?: string[];
}): Promise<void> {
  container?.remove();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  await act(async () => {
    root!.render(
      <QueryClientProvider client={queryClient}>
        <OpencodeVendorNotice step={step} projectId="proj_1" installedPieceNames={installedPieceNames} />
      </QueryClientProvider>,
    );
  });
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

function pieceStep({
  pieceName,
  actionName,
}: {
  pieceName: string;
  actionName: string;
}): FlowAction {
  return {
    name: 'step_1',
    displayName: 'Step 1',
    type: FlowActionType.PIECE,
    valid: true,
    lastUpdatedDate: new Date().toISOString(),
    settings: {
      pieceName,
      pieceVersion: '0.1.0',
      actionName,
      input: {},
      propertySettings: {},
    },
  } as FlowAction;
}
