import {
  Agent,
  PopulatedFlow,
  Table,
  UncategorizedFolderId,
} from '@activepieces/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { t } from 'i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { agentsApi } from '@/features/agents/api/agents';
import { blankAgentUtils } from '@/features/agents/lib/blank-agent';
import { flowsApi } from '@/features/flows/api/flows-api';
import { tableHooks } from '@/features/tables/hooks/table-hooks';
import { authenticationSession } from '@/lib/authentication-session';
import { NEW_FLOW_QUERY_PARAM, NEW_TABLE_QUERY_PARAM } from '@/lib/route-utils';

import { toFolderId } from '../lib/utils';

export function useAutomationsCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const projectId = authenticationSession.getProjectId() ?? '';

  const invalidateRoot = () => {
    queryClient.invalidateQueries({ queryKey: ['root-flows'] });
    queryClient.invalidateQueries({ queryKey: ['root-tables'] });
    queryClient.invalidateQueries({ queryKey: ['agents'] });
  };

  const { mutate: startFromScratch, isPending: isCreateFlowPending } =
    useMutation<PopulatedFlow, Error, string | undefined>({
      mutationFn: async (folderId) => {
        return flowsApi.create({
          projectId,
          displayName: t('Untitled'),
          folderId:
            !folderId || folderId === UncategorizedFolderId
              ? undefined
              : folderId,
        });
      },
      onSuccess: (flow) => {
        invalidateRoot();
        navigate(`/flows/${flow.id}?${NEW_FLOW_QUERY_PARAM}=true`);
      },
    });

  const { mutate: createTableMutation, isPending: isCreatingTable } =
    useMutation<Table, Error, { name: string; folderId?: string }>({
      mutationFn: async ({ name, folderId }) => {
        return tableHooks.createTableWithDefaults({
          name,
          folderId,
          projectId,
        });
      },
      onSuccess: (table) => {
        queryClient.invalidateQueries({ queryKey: ['tables'] });
        invalidateRoot();
        navigate(
          `/projects/${projectId}/tables/${table.id}?${NEW_TABLE_QUERY_PARAM}=true`,
        );
      },
    });

  const { mutate: createAgentMutation, isPending: isCreatingAgent } =
    useMutation<Agent, Error, string | undefined>({
      mutationFn: async (folderId) =>
        agentsApi.create(
          blankAgentUtils.request({
            projectId,
            folderId: toFolderId(folderId),
          }),
        ),
      onSuccess: (agent) => {
        invalidateRoot();
        navigate(`/projects/${agent.projectId}/agents/${agent.id}`, {
          state: { backTo: `${location.pathname}${location.search}` },
        });
      },
      onError: () => toast.error(t('Failed to create agent')),
    });

  return {
    createFlow: (folderId?: string) => startFromScratch(folderId),
    createTable: (name: string, folderId?: string) =>
      createTableMutation({ name, folderId }),
    createAgent: (folderId?: string) => createAgentMutation(folderId),
    isCreateFlowPending,
    isCreatingTable,
    isCreatingAgent,
  };
}
