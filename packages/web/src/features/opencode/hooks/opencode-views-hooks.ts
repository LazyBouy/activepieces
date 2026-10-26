import { isNil } from '@activepieces/core-utils';
import { ListOpencodeStepSessionsQuery } from '@activepieces/shared';
import { useQuery } from '@tanstack/react-query';

import { authenticationSession } from '@/lib/authentication-session';

import { opencodeViewsApi } from '../api/opencode-views-api';

export const opencodeViewsKeys = {
  all: ['opencode-views'] as const,
  agentCard: ({ projectId, name, namespace, project }: AgentCardKeyParams) =>
    ['opencode-views', projectId, 'agent', name, namespace, project] as const,
  projectView: ({
    projectId,
    namespace,
    project,
  }: {
    projectId: string;
    namespace?: string;
    project?: string;
  }) => ['opencode-views', projectId, 'project', namespace, project] as const,
  stepSessions: ({
    projectId,
    query,
  }: {
    projectId: string;
    query: ListOpencodeStepSessionsQuery;
  }) => ['opencode-views', projectId, 'step-sessions', query] as const,
  serverOverview: ({ allowlist }: { allowlist: string[] }) =>
    ['opencode-views', 'server-overview', allowlist] as const,
};

export const opencodeViewsQueries = {
  useAgentCard: ({
    projectId,
    name,
    namespace,
    project,
    enabled,
  }: AgentCardKeyParams & { enabled: boolean }) =>
    useQuery({
      queryKey: opencodeViewsKeys.agentCard({
        projectId,
        name,
        namespace,
        project,
      }),
      queryFn: () =>
        opencodeViewsApi.agentCard({
          projectId,
          name,
          query: locationQuery({ namespace, project }),
        }),
      enabled,
    }),
  useProjectView: ({
    projectId,
    namespace,
    project,
  }: {
    projectId: string;
    namespace?: string;
    project?: string;
  }) =>
    useQuery({
      queryKey: opencodeViewsKeys.projectView({
        projectId,
        namespace,
        project,
      }),
      queryFn: () =>
        opencodeViewsApi.projectView({
          projectId,
          query: locationQuery({ namespace, project }),
        }),
    }),
  useStepSessions: ({
    flowRunId,
    flowVersionId,
    stepName,
    enabled,
  }: ListOpencodeStepSessionsQuery & { enabled: boolean }) => {
    const projectId = authenticationSession.getProjectId() ?? '';
    const query = {
      stepName,
      ...(isNil(flowRunId) ? {} : { flowRunId }),
      ...(isNil(flowVersionId) ? {} : { flowVersionId }),
    };
    return useQuery({
      queryKey: opencodeViewsKeys.stepSessions({ projectId, query }),
      queryFn: () => opencodeViewsApi.stepSessions({ projectId, query }),
      enabled: enabled && projectId.length > 0,
      refetchInterval: (state) =>
        (state.state.data ?? []).some((session) =>
          RUNNING_STATUSES.includes(session.status),
        )
          ? RUNNING_REFRESH_MS
          : false,
    });
  },
  useServerOverview: ({ allowlist }: { allowlist: string[] }) =>
    useQuery({
      queryKey: opencodeViewsKeys.serverOverview({ allowlist }),
      queryFn: () => opencodeViewsApi.serverOverview(),
    }),
};

function locationQuery({
  namespace,
  project,
}: {
  namespace?: string;
  project?: string;
}): { namespace?: string; project?: string } {
  return {
    ...(isNil(namespace) ? {} : { namespace }),
    ...(isNil(project) ? {} : { project }),
  };
}

const RUNNING_STATUSES = ['PENDING', 'QUEUED', 'DISPATCHED', 'COMPLETING'];

const RUNNING_REFRESH_MS = 5_000;

type AgentCardKeyParams = {
  projectId: string;
  name: string;
  namespace?: string;
  project?: string;
};
