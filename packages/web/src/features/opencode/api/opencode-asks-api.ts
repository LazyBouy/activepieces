import {
  AnswerOpencodeAskRequest,
  ListOpencodeAsksQuery,
  OpencodeAsk,
  OpencodeAskLink,
} from '@activepieces/shared';

import { api } from '@/lib/api';

export const opencodeAsksApi = {
  list({
    projectId,
    query,
  }: {
    projectId: string;
    query: ListOpencodeAsksQuery;
  }) {
    return api.get<OpencodeAsk[]>('/v1/opencode/asks', {
      projectId,
      ...query,
    });
  },
  answer({ id, request }: { id: string; request: AnswerOpencodeAskRequest }) {
    return api.post<OpencodeAsk>(`/v1/opencode/asks/${id}/answer`, request);
  },
  link({ id }: { id: string }) {
    return api.post<OpencodeAskLink>(`/v1/opencode/asks/${id}/link`, {});
  },
};
