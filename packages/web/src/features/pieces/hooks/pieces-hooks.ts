import { LocalesEnum } from '@activepieces/core-utils';
import {
  PieceMetadataModel,
  PieceMetadataModelSummary,
  PropertyType,
  ExecutePropsResult,
} from '@activepieces/pieces-framework';
import {
  AddPieceRequestBody,
  ApEdition,
  FlowActionType,
  flowPieceUtil,
  PieceOptionRequest,
  FlowTriggerType,
  ApFlagId,
  PieceSyncMode,
  SuggestionType,
  TelemetryEventName,
} from '@activepieces/shared';
import {
  QueryClient,
  QueryKey,
  useMutation,
  usePrefetchQuery,
  useQueries,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from '@tanstack/react-query';
import { t } from 'i18next';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import semver from 'semver';

import { useTelemetry } from '@/components/providers/telemetry-provider';
import { appConnectionsApi } from '@/features/connections/api/app-connections';
import { opencodeOptionsQueries } from '@/features/opencode/hooks/opencode-options-hooks';
import {
  StepMetadataWithSuggestions,
  CategorizedStepMetadataWithSuggestions,
  PieceSelectorItem,
  PieceSelectorSection,
  PieceSelectorTriggerListKind,
  PieceSelectorTriggerOption,
} from '@/features/pieces/types';
import { flagsHooks } from '@/hooks/flags-hooks';
import { platformHooks } from '@/hooks/platform-hooks';
import { api } from '@/lib/api';
import { authenticationSession } from '@/lib/authentication-session';

import { piecesApi } from '../api/pieces-api';
import {
  PieceSelectorCategoryType,
  PieceSelectorTabType,
} from '../stores/piece-selector-tabs-provider';
import { pieceSearchUtils } from '../utils/piece-search-utils';
import { pieceSelectorCustomization } from '../utils/piece-selector-customization';

import { stepsHooks } from './steps-hooks';

type UsePieceModelForStepSettings = {
  name: string;
  version: string | undefined;
  enabled?: boolean;
};

type UsePieceProps = {
  name: string;
  version?: string;
  enabled?: boolean;
  projectId?: string;
};

type UseMultiplePiecesProps = {
  names: string[];
};

type UsePiecesProps = {
  projectId?: string;
  searchQuery?: string;
  includeHidden?: boolean;
  isTableQuery?: boolean;
  skipProjectFilter?: boolean;
  suggestionType?: SuggestionType;
  enabled?: boolean;
  keepPreviousResults?: boolean;
};
type UsePrefetchPiecesProps = {
  skipProjectFilter?: boolean;
};
type UsePiecesSearchProps = {
  searchQuery: string;
  enabled?: boolean;
  type: 'action' | 'trigger';
  shouldCaptureEvent: boolean;
  tab:
    | { type: PieceSelectorTabType.CUSTOM; customTabId: string | null }
    | { type: PieceSelectorTabType.NONE };
};

export const piecesHooks = {
  usePiece: ({ name, version, enabled = true, projectId }: UsePieceProps) => {
    const { i18n } = useTranslation();
    const query = useQuery<PieceMetadataModel, Error>({
      queryKey: ['piece', name, version, i18n.language, projectId],
      queryFn: () =>
        piecesApi.get({
          name,
          version,
          locale: i18n.language as LocalesEnum,
          projectId,
        }),
      staleTime: Infinity,
      enabled,
      retry: (failureCount, error) => {
        if (isPieceNotFoundError(error)) {
          return false;
        }
        return failureCount < 3;
      },
    });
    return {
      pieceModel: query.data,
      isLoading: query.isLoading,
      isSuccess: query.isSuccess,
      isError: query.isError,
      isNotFound: query.isError && isPieceNotFoundError(query.error),
      refetch: query.refetch,
    };
  },
  usePieceModelForStepSettings: ({
    name,
    version,
    enabled = true,
  }: UsePieceModelForStepSettings) => {
    const exactVersion = version
      ? flowPieceUtil.getExactVersion(version)
      : undefined;
    const pieceQuery = piecesHooks.usePiece({
      name,
      version: exactVersion,
      enabled,
    });
    return {
      pieceModel: pieceQuery.pieceModel,
      isLoading: pieceQuery.isLoading,
      isSuccess: pieceQuery.isSuccess,
      isNotFound: pieceQuery.isNotFound,
      refetch: pieceQuery.refetch,
    };
  },
  useMultiplePieces: ({ names }: UseMultiplePiecesProps) => {
    const { i18n } = useTranslation();
    return useQueries({
      queries: names.map((name) =>
        latestPieceQueryOptions({ name, language: i18n.language }),
      ),
    });
  },
  usePiecesByName: ({ names }: UseMultiplePiecesProps) => {
    const { i18n } = useTranslation();
    return useQueries({
      queries: names.map((name) =>
        latestPieceQueryOptions({ name, language: i18n.language }),
      ),
      combine: piecesByNameFromResults,
    });
  },
  usePieceSummariesByNames: ({ names }: UseMultiplePiecesProps) => {
    const { pieces, isLoading } = piecesHooks.usePieces({});
    const summaries = useMemo(() => {
      if (!pieces) return [];
      const byName = new Map(pieces.map((p) => [p.name, p]));
      return names
        .map((name) => byName.get(name))
        .filter((p): p is PieceMetadataModelSummary => !!p);
    }, [pieces, names]);
    return { summaries, isLoading };
  },
  usePieceSummary: ({ name }: { name: string }) => {
    const { pieces, isLoading } = piecesHooks.usePieces({});
    const summary = useMemo(
      () => pieces?.find((p) => p.name === name),
      [pieces, name],
    );
    return { summary, isLoading };
  },
  usePieces: ({
    projectId,
    searchQuery,
    includeHidden = false,
    isTableQuery = false,
    skipProjectFilter = false,
    suggestionType,
    enabled = true,
    keepPreviousResults = false,
  }: UsePiecesProps) => {
    const { i18n } = useTranslation();
    const query = useQuery<PieceMetadataModelSummary[], Error>({
      ...piecesQueryOptions({
        projectId,
        searchQuery,
        includeHidden,
        isTableQuery,
        skipProjectFilter,
        suggestionType,
        locale: i18n.language as LocalesEnum,
        keepPreviousResults,
      }),
      enabled,
    });
    return {
      pieces: query.data,
      isLoading: query.isLoading,
      isError: query.isError,
      error: query.error,
      refetch: query.refetch,
    };
  },
  usePrefetchPieces: ({
    skipProjectFilter = false,
  }: UsePrefetchPiecesProps) => {
    const { i18n } = useTranslation();
    usePrefetchQuery(
      piecesQueryOptions({
        includeHidden: false,
        isTableQuery: false,
        skipProjectFilter,
        locale: i18n.language as LocalesEnum,
      }),
    );
  },
  usePiecesSearch: (
    props: UsePiecesSearchProps,
  ): {
    isLoading: boolean;
    data: CategorizedStepMetadataWithSuggestions[];
  } => {
    const { capture } = useTelemetry();
    const { steps, isLoading } = useSelectorSteps({
      searchQuery: props.searchQuery,
      type: props.type,
      enabled: props.enabled,
    });
    const { platform } = platformHooks.useCurrentPlatform();
    if (isLoading) {
      return {
        isLoading: true,
        data: [],
      };
    }
    switch (props.tab.type) {
      case PieceSelectorTabType.CUSTOM: {
        const customTab = pieceSelectorCustomization.getCustomTab({
          config: platform.pieceSelectorConfig,
          customTabId: props.tab.customTabId,
        });
        const flatPieces = pieceSearchUtils.getPinnedPieces({
          steps,
          pinnedPieceNames: customTab?.pieceNames ?? [],
        });
        const sectionCategories = (customTab?.sections ?? []).map(
          (section) => ({
            title: section.title,
            metadata: pieceSearchUtils.getPinnedPieces({
              steps,
              pinnedPieceNames: section.pieceNames,
            }),
          }),
        );
        return {
          isLoading: false,
          data: [
            {
              title: customTab?.title ?? t('All'),
              metadata: flatPieces,
            },
            ...sectionCategories,
          ].filter((category) => category.metadata.length > 0),
        };
      }
      case PieceSelectorTabType.NONE: {
        if (props.shouldCaptureEvent && props.searchQuery.length > 3) {
          capture({
            name: TelemetryEventName.PIECE_SELECTOR_SEARCH,
            payload: {
              search: props.searchQuery,
              isTrigger: props.type === 'trigger',
              selectedActionOrTriggerName: null,
            },
          });
        }
        return {
          isLoading: false,
          data: steps.length > 0 ? [{ title: t('All'), metadata: steps }] : [],
        };
      }
    }
  },
  usePieceCategorySections: ({
    category,
    type,
    aiPieceItems,
  }: {
    category: PieceSelectorCategoryType;
    type: 'action' | 'trigger';
    aiPieceItems: PieceSelectorItem[];
  }): { isLoading: boolean; sections: PieceSelectorSection[] } => {
    const { steps, isLoading } = useSelectorSteps({ searchQuery: '', type });
    const { platform } = platformHooks.useCurrentPlatform();
    return {
      isLoading,
      sections: isLoading
        ? []
        : pieceSearchUtils.getCategorySections({
            category,
            steps,
            pinnedPieceNames: platform.pinnedPieces ?? [],
            aiPieceItems,
          }),
    };
  },
  useTriggerListSections: ({
    list,
  }: {
    list: PieceSelectorTriggerListKind;
  }): { isLoading: boolean; sections: PieceSelectorSection[] } => {
    const { steps, isLoading } = useSelectorSteps({
      searchQuery: '',
      type: 'trigger',
    });
    const { platform } = platformHooks.useCurrentPlatform();
    return {
      isLoading,
      sections: isLoading
        ? []
        : pieceSearchUtils.getTriggerListSections({
            list,
            steps,
            pinnedPieceNames: platform.pinnedPieces ?? [],
          }),
    };
  },
  useTriggerOptions: ({
    enabled,
  }: {
    enabled: boolean;
  }): { isLoading: boolean; options: PieceSelectorTriggerOption[] } => {
    const { steps, isLoading } = useSelectorSteps({
      searchQuery: '',
      type: 'trigger',
      enabled,
    });
    const { platform } = platformHooks.useCurrentPlatform();
    if (!enabled) {
      return { isLoading: false, options: [] };
    }
    return {
      isLoading,
      options: isLoading
        ? []
        : pieceSearchUtils.getTriggerOptions({
            steps,
            pinnedPieceNames: platform.pinnedPieces ?? [],
          }),
    };
  },
  usePieceOptions: <
    T extends
      | PropertyType.DYNAMIC
      | PropertyType.DROPDOWN
      | PropertyType.MULTI_SELECT_DROPDOWN,
  >({
    onSuccess,
    onError,
    onMutate,
  }: {
    onSuccess: (data: ExecutePropsResult<T>) => void;
    onError: (error: Error) => void;
    onMutate: () => void;
  }) => {
    return useMutation<
      ExecutePropsResult<T>,
      Error,
      { request: PieceOptionRequest; propertyType: T }
    >({
      mutationFn: async ({ request, propertyType }) => {
        onMutate();
        return piecesApi.options(request, propertyType);
      },
      onSuccess,
      onError,
      retry: 1,
      retryDelay: 1000,
    });
  },
  usePieceVersions: (pieceName: string) => {
    const { data: release } = flagsHooks.useFlag<string>(
      ApFlagId.CURRENT_VERSION,
    );
    const { data: edition } = flagsHooks.useFlag<ApEdition>(ApFlagId.EDITION);
    const query = useQuery({
      queryKey: ['pieces-registry', release, edition],
      queryFn: () => piecesApi.registry(release!, edition!),
      staleTime: Infinity,
      enabled: !!pieceName && !!release && !!edition,
      select: (registry) =>
        registry
          .filter((entry) => entry.name === pieceName)
          .map((entry) => ({ version: entry.version }))
          .sort((a, b) => semver.rcompare(a.version, b.version)),
    });
    return {
      pieceVersions: query.data,
      isLoading: query.isLoading,
    };
  },
  useIsPieceCatalogAvailable: () => {
    const { data: syncMode } = flagsHooks.useFlag<string>(
      ApFlagId.PIECES_SYNC_MODE,
    );
    return syncMode === PieceSyncMode.OFFICIAL_SELECTED;
  },
  useOpencodeRoutingOn,
  usePieceCatalog: () => {
    const { i18n } = useTranslation();
    const isAvailable = piecesHooks.useIsPieceCatalogAvailable();
    const query = useQuery<PieceMetadataModelSummary[], Error>({
      queryKey: [PIECE_CATALOG_QUERY_KEY, i18n.language],
      queryFn: () => piecesApi.catalog({ locale: i18n.language }),
      staleTime: CATALOG_STALE_TIME_MS,
      enabled: isAvailable,
    });
    const routingOn = useOpencodeRoutingOn();
    return {
      pieces: routingOn
        ? query.data?.filter(
            (piece) => !pieceSearchUtils.isHiddenCatalogPiece({ piece }),
          )
        : query.data,
      isLoading: query.isLoading,
      isError: query.isError,
      refetch: query.refetch,
    };
  },
  usePieceForEmbeddingConnection: ({
    pieceName,
    connectionExternalId,
  }: {
    pieceName: string;
    connectionExternalId: string;
  }) => {
    return useQuery<PieceMetadataModel, Error>({
      queryKey: ['piece', pieceName, connectionExternalId],
      queryFn: async () => {
        const appConnection = (
          await appConnectionsApi.list({
            pieceName,
            limit: 1,
            projectId: authenticationSession.getProjectId()!,
          })
        ).data.find(
          (connection) => connection.externalId === connectionExternalId,
        );
        if (!appConnection) {
          return piecesApi.get({ name: pieceName });
        }
        return piecesApi.get({
          name: appConnection.pieceName,
          version: appConnection.pieceVersion,
        });
      },
      staleTime: Infinity,
    });
  },
};

export const piecesMutations = {
  useInstallPiece: ({
    onSuccess,
    onError,
  }: {
    onSuccess: () => void;
    onError: (error: unknown) => void;
  }) => {
    return useMutation({
      mutationFn: (data: AddPieceRequestBody) => piecesApi.install(data),
      onSuccess,
      onError,
    });
  },
  useDownloadCatalogPiece: () => {
    const queryClient = useQueryClient();
    const { i18n } = useTranslation();
    return useMutation<PieceMetadataModel, Error, { pieceName: string }>({
      mutationFn: async ({ pieceName }) => {
        await piecesApi.downloadFromCatalog({ pieceName });
        return queryClient.fetchQuery(
          latestPieceQueryOptions({ name: pieceName, language: i18n.language }),
        );
      },
      onSuccess: (_piece, { pieceName }) => {
        queryClient.setQueriesData<PieceMetadataModelSummary[]>(
          { queryKey: [PIECE_CATALOG_QUERY_KEY] },
          (pieces) => pieces?.filter((piece) => piece.name !== pieceName),
        );
        return invalidatePieceCaches(queryClient);
      },
      onError: () => undefined,
    });
  },
};

function useSelectorSteps({
  searchQuery,
  type,
  enabled,
}: {
  searchQuery: string;
  type: 'action' | 'trigger';
  enabled?: boolean;
}): { steps: StepMetadataWithSuggestions[]; isLoading: boolean } {
  const { metadata, isLoading } = stepsHooks.useAllStepsMetadata({
    searchQuery,
    type,
    enabled,
  });
  const routingOn = useOpencodeRoutingOn();
  if (!metadata || isLoading) {
    return { steps: [], isLoading: true };
  }
  const visible = routingOn
    ? pieceSearchUtils.withoutOfficialVendorChatActions({ steps: metadata })
    : metadata;
  return {
    steps: filterOutPiecesWithNoSuggestions(visible),
    isLoading: false,
  };
}

function useOpencodeRoutingOn(): boolean {
  const projectId = authenticationSession.getProjectId() ?? '';
  const { data: options } = opencodeOptionsQueries.useOptions({ projectId });
  return options?.enabled === true;
}

const isPieceNotFoundError = (error: unknown) =>
  api.isError(error) && error.response?.status === 404;

const filterOutPiecesWithNoSuggestions = (
  stepsMetadata: StepMetadataWithSuggestions[],
) => {
  return stepsMetadata.filter((metadata) => {
    const isActionWithSuggestions =
      metadata.type === FlowActionType.PIECE &&
      metadata.suggestedActions &&
      metadata.suggestedActions.length > 0;

    const isTriggerWithSuggestions =
      metadata.type === FlowTriggerType.PIECE &&
      metadata.suggestedTriggers &&
      metadata.suggestedTriggers.length > 0;

    const isNotPieceType =
      metadata.type !== FlowActionType.PIECE &&
      metadata.type !== FlowTriggerType.PIECE;
    return (
      isActionWithSuggestions || isTriggerWithSuggestions || isNotPieceType
    );
  });
};

function latestPieceQueryOptions({
  name,
  language,
}: {
  name: string;
  language: string;
}) {
  return {
    queryKey: ['piece', name, undefined, language],
    queryFn: () =>
      piecesApi.get({
        name,
        version: undefined,
        locale: Object.values(LocalesEnum).find(
          (locale) => locale === language,
        ),
      }),
    staleTime: Infinity,
  };
}

function piecesByNameFromResults(
  results: UseQueryResult<PieceMetadataModel>[],
): Map<string, PieceMetadataModel> {
  return new Map(
    results
      .map((result) => result.data)
      .filter((piece) => piece !== undefined)
      .map((piece) => [piece.name, piece]),
  );
}

function invalidatePieceCaches(queryClient: QueryClient): Promise<void[]> {
  const pieceDerivedQueryKeys = [
    ['pieces'],
    ['pieces-table'],
    ['pieces-metadata'],
    ['piece'],
  ];
  return Promise.all(
    pieceDerivedQueryKeys.map((queryKey) =>
      queryClient.invalidateQueries({ queryKey }),
    ),
  );
}

export const pieceCacheUtils = { invalidatePieceCaches };

function piecesQueryOptions({
  projectId,
  searchQuery,
  includeHidden,
  isTableQuery,
  skipProjectFilter,
  suggestionType,
  locale,
  keepPreviousResults = false,
}: {
  projectId?: string;
  searchQuery?: string;
  includeHidden: boolean;
  isTableQuery: boolean;
  skipProjectFilter: boolean;
  suggestionType?: SuggestionType;
  locale: LocalesEnum;
  keepPreviousResults?: boolean;
}) {
  const queriedProjectId = skipProjectFilter
    ? undefined
    : projectId ?? authenticationSession.getProjectId() ?? undefined;
  return {
    queryKey: [
      isTableQuery ? 'pieces-table' : 'pieces',
      queriedProjectId,
      searchQuery,
      includeHidden,
      skipProjectFilter,
      suggestionType,
      locale,
    ],
    queryFn: () =>
      piecesApi.list({
        projectId: queriedProjectId,
        searchQuery,
        includeHidden,
        suggestionType,
        locale,
      }),
    staleTime: searchQuery ? SEARCH_RESULTS_STALE_TIME_MS : Infinity,
    ...(keepPreviousResults
      ? {
          placeholderData: (
            previousPieces: PieceMetadataModelSummary[] | undefined,
            previousQuery: { queryKey: QueryKey } | undefined,
          ) =>
            previousQuery?.queryKey[PROJECT_ID_KEY_INDEX] === queriedProjectId
              ? previousPieces
              : undefined,
        }
      : {}),
  };
}

const SEARCH_RESULTS_STALE_TIME_MS = 5 * 60 * 1000;
const CATALOG_STALE_TIME_MS = 5 * 60 * 1000;
const PIECE_CATALOG_QUERY_KEY = 'pieces-catalog';
const PROJECT_ID_KEY_INDEX = 1;

export const pieceQueryOptions = { latest: latestPieceQueryOptions };
