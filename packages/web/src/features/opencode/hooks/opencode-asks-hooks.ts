import {
  AnswerOpencodeAskRequest,
  ListOpencodeAsksQuery,
  OpencodeAskEvent,
  WebsocketClientEvent,
} from '@activepieces/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useSocket } from '@/components/providers/socket-provider';
import { authenticationSession } from '@/lib/authentication-session';

import { opencodeAsksApi } from '../api/opencode-asks-api';

export const opencodeAsksKeys = {
  all: ['opencode-asks'] as const,
  list: ({
    projectId,
    query,
  }: {
    projectId: string;
    query: ListOpencodeAsksQuery;
  }) => ['opencode-asks', projectId, query] as const,
};

export const opencodeAsksQueries = {
  useAsks: ({
    flowRunId,
    flowVersionId,
    stepName,
    enabled,
  }: ListOpencodeAsksQuery & { enabled: boolean }) => {
    const projectId = authenticationSession.getProjectId() ?? '';
    const queryClient = useQueryClient();
    const socket = useSocket();
    useEffect(() => {
      if (!enabled) {
        return;
      }
      const refresh = (event: OpencodeAskEvent) => {
        if (matches({ event, query: { flowRunId, flowVersionId, stepName } })) {
          queryClient
            .invalidateQueries({ queryKey: opencodeAsksKeys.all })
            .catch(() => undefined);
        }
      };
      socket.on(WebsocketClientEvent.OPENCODE_ASK, refresh);
      return () => {
        socket.off(WebsocketClientEvent.OPENCODE_ASK, refresh);
      };
    }, [enabled, flowRunId, flowVersionId, stepName, queryClient, socket]);
    const query = { flowRunId, flowVersionId, stepName };
    return useQuery({
      queryKey: opencodeAsksKeys.list({ projectId, query }),
      queryFn: () => opencodeAsksApi.list({ projectId, query }),
      enabled: enabled && projectId.length > 0,
    });
  },
};

export const opencodeAsksMutations = {
  useAnswer: () => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: ({
        id,
        request,
      }: {
        id: string;
        request: AnswerOpencodeAskRequest;
      }) => opencodeAsksApi.answer({ id, request }),
      onSettled: () =>
        queryClient.invalidateQueries({ queryKey: opencodeAsksKeys.all }),
    });
  },
  useLink: () =>
    useMutation({
      mutationFn: ({ id }: { id: string }) => opencodeAsksApi.link({ id }),
    }),
};

function matches({
  event,
  query,
}: {
  event: OpencodeAskEvent;
  query: ListOpencodeAsksQuery;
}): boolean {
  if (query.flowRunId !== undefined && query.flowRunId !== event.flowRunId) {
    return false;
  }
  if (
    query.flowVersionId !== undefined &&
    query.flowVersionId !== event.flowVersionId
  ) {
    return false;
  }
  return query.stepName === undefined || query.stepName === event.stepName;
}
