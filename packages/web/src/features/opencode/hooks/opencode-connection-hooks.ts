import {
  OpencodeConnection,
  UpdateOpencodeConnectionRequest,
} from '@activepieces/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { opencodeConnectionApi } from '../api/opencode-connection-api';

export const opencodeConnectionKeys = {
  connection: ['opencode-connection'] as const,
  catalog: ['opencode-connection', 'catalog'] as const,
};

export const opencodeConnectionQueries = {
  useConnection: () =>
    useQuery({
      queryKey: opencodeConnectionKeys.connection,
      queryFn: () => opencodeConnectionApi.get(),
    }),
  useCatalog: () =>
    useQuery({
      queryKey: opencodeConnectionKeys.catalog,
      queryFn: () => opencodeConnectionApi.catalog(),
    }),
};

export const opencodeConnectionMutations = {
  useUpdate: ({ onSuccess, onError }: MutationOptions) => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: (request: UpdateOpencodeConnectionRequest) =>
        opencodeConnectionApi.update(request),
      onSuccess: async (saved) => {
        queryClient.setQueryData(opencodeConnectionKeys.connection, saved);
        await queryClient.invalidateQueries({
          queryKey: opencodeConnectionKeys.catalog,
        });
        onSuccess(saved);
      },
      onError,
    });
  },
  useTest: () => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: () => opencodeConnectionApi.test(),
      onSettled: async () => {
        await queryClient.invalidateQueries({
          queryKey: opencodeConnectionKeys.connection,
        });
      },
    });
  },
};

type MutationOptions = {
  onSuccess: (saved: OpencodeConnection) => void;
  onError: (error: unknown) => void;
};
