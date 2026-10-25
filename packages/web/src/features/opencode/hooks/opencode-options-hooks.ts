import { isNil } from '@activepieces/core-utils';
import { useQuery } from '@tanstack/react-query';

import { opencodeOptionsApi } from '../api/opencode-options-api';

export const opencodeOptionsKeys = {
  options: ({ projectId }: { projectId: string }) =>
    ['opencode-options', projectId] as const,
  agents: ({
    projectId,
    namespace,
    project,
  }: {
    projectId: string;
    namespace?: string;
    project?: string;
  }) => ['opencode-options', projectId, 'agents', namespace, project] as const,
};

export const opencodeOptionsQueries = {
  useOptions: ({ projectId }: { projectId: string }) =>
    useQuery({
      queryKey: opencodeOptionsKeys.options({ projectId }),
      queryFn: () => opencodeOptionsApi.get({ projectId }),
      staleTime: OPTIONS_STALE_TIME_MS,
    }),
  useAgents: ({
    projectId,
    namespace,
    project,
    enabled,
  }: {
    projectId: string;
    namespace?: string;
    project?: string;
    enabled: boolean;
  }) =>
    useQuery({
      queryKey: opencodeOptionsKeys.agents({ projectId, namespace, project }),
      queryFn: () =>
        opencodeOptionsApi.agents({
          projectId,
          query: {
            ...(isNil(namespace) ? {} : { namespace }),
            ...(isNil(project) ? {} : { project }),
          },
        }),
      staleTime: OPTIONS_STALE_TIME_MS,
      enabled,
    }),
};

const OPTIONS_STALE_TIME_MS = 30_000;
