// @vitest-environment jsdom
import {
  PieceMetadataModel,
  PieceMetadataModelSummary,
} from '@activepieces/pieces-framework';
import { PackageType, PieceType } from '@activepieces/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('i18next', () => ({ t: (key: string) => key }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: 'en' } }),
}));
vi.mock('@/components/providers/telemetry-provider', () => ({
  useTelemetry: () => ({ capture: vi.fn() }),
}));
const flagState = vi.hoisted(() => ({ syncMode: 'OFFICIAL_SELECTED' }));
vi.mock('@/hooks/flags-hooks', () => ({
  flagsHooks: { useFlag: () => ({ data: flagState.syncMode }) },
}));
vi.mock('@/hooks/platform-hooks', () => ({
  platformHooks: { useCurrentPlatform: () => ({ platform: { plan: {} } }) },
}));
vi.mock('@/lib/authentication-session', () => ({
  authenticationSession: { getProjectId: () => 'project_a' },
}));
vi.mock('@/features/pieces/stores/piece-selector-tabs-provider', () => ({
  PieceSelectorTabType: {},
  usePieceSelectorTabs: () => ({
    selectedTab: undefined,
    selectedCustomTabId: undefined,
  }),
}));

const catalog = vi.fn();
const downloadFromCatalog = vi.fn();
const get = vi.fn();
vi.mock('@/features/pieces/api/pieces-api', () => ({
  piecesApi: {
    catalog: (request: { locale?: string }) => catalog(request),
    downloadFromCatalog: (request: { pieceName: string }) =>
      downloadFromCatalog(request),
    get: (request: { name: string }) => get(request),
  },
}));

import {
  piecesHooks,
  piecesMutations,
} from '@/features/pieces/hooks/pieces-hooks';

describe('piece catalog hooks', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    catalog.mockReset();
    downloadFromCatalog.mockReset();
    get.mockReset();
    flagState.syncMode = 'OFFICIAL_SELECTED';
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('is available only when the instance downloads pieces selectively', () => {
    expect(renderInClient(() => piecesHooks.useIsPieceCatalogAvailable())).toBe(
      true,
    );
    flagState.syncMode = 'OFFICIAL_AUTO';
    expect(renderInClient(() => piecesHooks.useIsPieceCatalogAvailable())).toBe(
      false,
    );
  });

  it('loads the catalog for the current language', async () => {
    catalog.mockResolvedValue([ASANA, ZENDESK]);

    const { result } = renderHook(() => piecesHooks.usePieceCatalog(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.pieces).toHaveLength(2));
    expect(catalog).toHaveBeenCalledWith({ locale: 'en' });
  });

  it('does not request the catalog outside the selective mode', () => {
    flagState.syncMode = 'OFFICIAL_AUTO';

    const { result } = renderHook(() => piecesHooks.usePieceCatalog(), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.isLoading).toBe(false);
    expect(catalog).not.toHaveBeenCalled();
  });

  it('downloads a piece, drops it from the catalog and refreshes the piece lists', async () => {
    catalog.mockResolvedValue([ASANA, ZENDESK]);
    downloadFromCatalog.mockResolvedValue(undefined);
    get.mockResolvedValue(ASANA_MODEL);
    const { result } = renderHook(
      () => ({
        catalog: piecesHooks.usePieceCatalog(),
        download: piecesMutations.useDownloadCatalogPiece(),
      }),
      { wrapper: createWrapper(queryClient) },
    );
    await waitFor(() => expect(result.current.catalog.pieces).toHaveLength(2));
    queryClient.setQueryData(['pieces-metadata', '', 'action'], []);
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    let downloaded: PieceMetadataModel | undefined;
    await act(async () => {
      downloaded = await result.current.download.mutateAsync({
        pieceName: ASANA.name,
      });
    });

    expect(downloadFromCatalog).toHaveBeenCalledWith({ pieceName: ASANA.name });
    expect(get).toHaveBeenCalledWith(
      expect.objectContaining({ name: ASANA.name }),
    );
    expect(downloaded).toBe(ASANA_MODEL);
    expect(
      queryClient
        .getQueryData<PieceMetadataModelSummary[]>(['pieces-catalog', 'en'])
        ?.map((piece) => piece.name),
    ).toEqual([ZENDESK.name]);
    await waitFor(() =>
      expect(result.current.catalog.pieces?.map((piece) => piece.name)).toEqual(
        [ZENDESK.name],
      ),
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['pieces-metadata'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['pieces'] });
    expect(
      queryClient.getQueryState(['pieces-metadata', '', 'action'])
        ?.isInvalidated,
    ).toBe(true);
  });

  it('keeps the piece in the catalog when the download fails', async () => {
    catalog.mockResolvedValue([ASANA]);
    downloadFromCatalog.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(
      () => ({
        catalog: piecesHooks.usePieceCatalog(),
        download: piecesMutations.useDownloadCatalogPiece(),
      }),
      { wrapper: createWrapper(queryClient) },
    );
    await waitFor(() => expect(result.current.catalog.pieces).toHaveLength(1));

    await act(async () => {
      await expect(
        result.current.download.mutateAsync({ pieceName: ASANA.name }),
      ).rejects.toThrow('offline');
    });

    expect(get).not.toHaveBeenCalled();
    expect(result.current.catalog.pieces).toEqual([ASANA]);
  });

  function renderInClient<T>(hook: () => T): T {
    return renderHook(hook, { wrapper: createWrapper(queryClient) }).result
      .current;
  }
});

function createWrapper(queryClient: QueryClient) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return Wrapper;
}

function summary(name: string, displayName: string): PieceMetadataModelSummary {
  return {
    name,
    displayName,
    description: `${displayName} description`,
    logoUrl: `https://example.test/${displayName}.svg`,
    version: '0.1.0',
    authors: [],
    categories: [],
    actions: 2,
    triggers: 1,
    contextInfo: undefined,
    projectUsage: 0,
    pieceType: PieceType.OFFICIAL,
    packageType: PackageType.REGISTRY,
  };
}

const ASANA = summary('@activepieces/piece-asana', 'Asana');
const ZENDESK = summary('@activepieces/piece-zendesk', 'Zendesk');
const ASANA_MODEL: PieceMetadataModel = {
  ...ASANA,
  actions: {},
  triggers: {},
};
