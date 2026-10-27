import {
  ListOpencodeAgentsQuery,
  ListOpencodeChannelsQuery,
  ListOpencodeStepSessionsQuery,
  OpencodeAgentCardResult,
  OpencodeChannelView,
  OpencodeProjectViewResult,
  OpencodeServerOverview,
  OpencodeStepSessionView,
} from '@activepieces/shared';

import { api } from '@/lib/api';

export const opencodeViewsApi = {
  agentCard({
    projectId,
    name,
    query,
  }: {
    projectId: string;
    name: string;
    query: ListOpencodeAgentsQuery;
  }) {
    return api.get<OpencodeAgentCardResult>(
      `/v1/projects/${projectId}/opencode/agents/${encodeURIComponent(name)}`,
      query,
    );
  },
  projectView({
    projectId,
    query,
  }: {
    projectId: string;
    query: ListOpencodeAgentsQuery;
  }) {
    return api.get<OpencodeProjectViewResult>(
      `/v1/projects/${projectId}/opencode/view`,
      query,
    );
  },
  stepSessions({
    projectId,
    query,
  }: {
    projectId: string;
    query: ListOpencodeStepSessionsQuery;
  }) {
    return api.get<OpencodeStepSessionView[]>('/v1/opencode/step-sessions', {
      projectId,
      ...query,
    });
  },
  stepChannels({
    projectId,
    query,
  }: {
    projectId: string;
    query: ListOpencodeChannelsQuery;
  }) {
    return api.get<OpencodeChannelView[]>('/v1/opencode/channels', {
      projectId,
      ...query,
    });
  },
  serverOverview() {
    return api.get<OpencodeServerOverview>('/v1/opencode/connection/overview');
  },
};
