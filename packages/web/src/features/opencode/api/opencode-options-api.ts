import {
  ListOpencodeAgentsQuery,
  OpencodeAgentList,
  OpencodeProjectOptions,
} from '@activepieces/shared';

import { api } from '@/lib/api';

export const opencodeOptionsApi = {
  get({ projectId }: { projectId: string }) {
    return api.get<OpencodeProjectOptions>(
      `/v1/projects/${projectId}/opencode`,
    );
  },
  agents({
    projectId,
    query,
  }: {
    projectId: string;
    query: ListOpencodeAgentsQuery;
  }) {
    return api.get<OpencodeAgentList>(
      `/v1/projects/${projectId}/opencode/agents`,
      query,
    );
  },
};
