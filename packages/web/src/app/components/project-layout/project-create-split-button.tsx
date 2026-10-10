import { Permission } from '@activepieces/core-utils';
import { t } from 'i18next';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useEmbedding } from '@/components/providers/embed-provider';
import { Button } from '@/components/ui/button';
import { useAgentsNavVisible } from '@/features/agents';
import { CreateNewMenu } from '@/features/automations/components/create-new-menu';
import { useAutomationsCreate } from '@/features/automations/hooks/use-automations-create';
import { useAutomationsPageCreateActions } from '@/features/automations/lib/page-create-actions';
import { TemplatesBrowseDialog } from '@/features/templates';
import { useAuthorization } from '@/hooks/authorization-hooks';
import { cn } from '@/lib/utils';

export const ProjectCreateSplitButton = () => {
  const navigate = useNavigate();
  const { embedState } = useEmbedding();
  const { checkAccess } = useAuthorization();
  const agentsVisible = useAgentsNavVisible() && !embedState.isEmbedded;
  const pageActions = useAutomationsPageCreateActions((state) => state.actions);
  const creation = useAutomationsCreate();
  const [isTemplatesDialogOpen, setIsTemplatesDialogOpen] = useState(false);

  const canWriteFlow = checkAccess(Permission.WRITE_FLOW);
  const canWriteTable = checkAccess(Permission.WRITE_TABLE);
  const canWriteFolder = checkAccess(Permission.WRITE_FOLDER);
  const canWriteAgent = checkAccess(Permission.WRITE_AGENT);
  const hasPermittedItem =
    canWriteFlow ||
    (!embedState.hideTables && canWriteTable) ||
    (agentsVisible && canWriteAgent) ||
    (pageActions !== null && !embedState.hideFolders && canWriteFolder);

  if (!hasPermittedItem) {
    return null;
  }

  return (
    <div className="flex shrink-0 items-center">
      {canWriteFlow && (
        <Button
          className="rounded-r-none"
          loading={creation.isCreateFlowPending}
          onClick={() => creation.createFlow()}
        >
          {t('New Flow')}
        </Button>
      )}
      <CreateNewMenu
        scope="root"
        align="end"
        sideOffset={4}
        contentClassName="w-auto min-w-50"
        userHasPermissionToWriteFlow={canWriteFlow}
        userHasPermissionToWriteTable={canWriteTable}
        userHasPermissionToWriteFolder={canWriteFolder}
        userHasPermissionToWriteAgent={canWriteAgent}
        isCreatingFlow={creation.isCreateFlowPending}
        isCreatingTable={creation.isCreatingTable}
        isCreatingAgent={creation.isCreatingAgent}
        onCreateFlow={() => creation.createFlow()}
        onCreateTable={() => creation.createTable(t('New Table'))}
        onCreateAgent={agentsVisible ? () => creation.createAgent() : undefined}
        onCreateFolder={pageActions?.createFolder}
        onImportFlow={pageActions?.importFlow}
        onImportTable={pageActions?.importTable}
        onSelectTemplate={() => {
          if (embedState.isEmbedded) {
            setIsTemplatesDialogOpen(true);
          } else {
            navigate('/templates');
          }
        }}
      >
        <Button
          size="icon"
          className={cn(
            canWriteFlow &&
              'rounded-l-none before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-black/10',
          )}
        >
          <ChevronDown className="size-4" />
          <span className="sr-only">{t('Create New')}</span>
        </Button>
      </CreateNewMenu>
      <TemplatesBrowseDialog
        open={isTemplatesDialogOpen}
        onOpenChange={setIsTemplatesDialogOpen}
      />
    </div>
  );
};
