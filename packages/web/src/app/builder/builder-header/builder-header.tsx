import {
  ApFlagId,
  FlowOperationType,
  FlowVersionState,
  supportUrl,
  UncategorizedFolderId,
} from '@activepieces/shared';
import { useQueryClient } from '@tanstack/react-query';
import { t } from 'i18next';
import { CircleHelp, Ellipsis } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  createSearchParams,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';

import { useBuilderStateContext } from '@/app/builder/builder-hooks';
import { RightSideBarType } from '@/app/builder/types';
import { ActiveUsersWidget } from '@/components/custom/active-users-widget';
import EditableText from '@/components/custom/editable-text';
import { HomeButton } from '@/components/custom/home-button';
import { useEmbedding } from '@/components/providers/embed-provider';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { flowHooks } from '@/features/flows';
import { FlowCreatedByBadge } from '@/features/flows/components/flow-created-by-badge';
import { foldersHooks } from '@/features/folders';
import { getProjectName, projectCollectionUtils } from '@/features/projects';
import { flagsHooks } from '@/hooks/flags-hooks';
import { authenticationSession } from '@/lib/authentication-session';
import { useNewWindow } from '@/lib/navigation-utils';
import { NEW_FLOW_QUERY_PARAM } from '@/lib/route-utils';
import { cn } from '@/lib/utils';

import FlowActionMenu from '../../components/flow-actions-menu';
import { flowCanvasConsts } from '../flow-canvas/utils/consts';

import { EditorRunsControl } from './editor-runs-control';
import { BuilderFlowStatusSection } from './flow-status';
import { PublishButton } from './publish-button';

export const BuilderHeader = ({
  isLockedByAnotherEditor,
}: BuilderHeaderProps) => {
  const [queryParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const openNewWindow = useNewWindow();
  const { data: showSupport } = flagsHooks.useFlag<boolean>(
    ApFlagId.SHOW_COMMUNITY,
  );
  const [
    flow,
    flowVersion,
    moveToFolderClientSide,
    applyOperation,
    setRightSidebar,
  ] = useBuilderStateContext((state) => [
    state.flow,
    state.flowVersion,
    state.moveToFolderClientSide,
    state.applyOperation,
    state.setRightSidebar,
  ]);

  const { embedState } = useEmbedding();
  const { project } = projectCollectionUtils.useCurrentProject();

  const { data: folderData } = foldersHooks.useFolder(
    flow.folderId ?? UncategorizedFolderId,
  );

  const isLatestVersion =
    flowVersion.state === FlowVersionState.DRAFT ||
    flowVersion.id === flow.publishedVersionId;
  const [isEditingFlowName, setIsEditingFlowName] = useState(false);
  useEffect(() => {
    setIsEditingFlowName(queryParams.get(NEW_FLOW_QUERY_PARAM) === 'true');
  }, []);

  const goToFlowsPage = () => {
    navigate({
      pathname: authenticationSession.appendProjectRoutePrefix('/automations'),
      search: createSearchParams({
        folderId: folderData?.id ?? UncategorizedFolderId,
      }).toString(),
    });
  };

  return (
    <header
      data-builder-header
      className="relative z-40 box-content shrink-0 border-b border-gray-6 bg-panel select-none"
      style={{ height: flowCanvasConsts.BUILDER_HEADER_HEIGHT }}
    >
      <div className="flex h-full items-center justify-between gap-5 px-5 py-3">
        <div className="flex min-w-0 flex-1 items-center">
          {embedState.isEmbedded && <HomeButton />}
          <Breadcrumb className="min-w-0">
            <BreadcrumbList className="flex-nowrap gap-0 sm:gap-0">
              {!embedState.disableNavigationInBuilder && (
                <>
                  <BreadcrumbItem className="shrink-0">
                    <BreadcrumbLink asChild>
                      <button
                        type="button"
                        onClick={goToFlowsPage}
                        className="cursor-pointer text-sm font-normal text-gray-11 hover:text-gray-12"
                      >
                        {getProjectName(project)}
                      </button>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="px-1 pt-1.5 pb-1 text-xl leading-none font-normal text-gray-7">
                    /
                  </BreadcrumbSeparator>
                </>
              )}
              {!embedState.hideFlowNameInBuilder && (
                <BreadcrumbItem className="min-w-0">
                  <EditableText
                    className="max-w-[500px] rounded-sm text-sm font-normal text-gray-12"
                    viewClassName={cn('px-1 pt-1.5 pb-1', {
                      'hover:cursor-text hover:inset-ring hover:inset-ring-gray-6':
                        isLatestVersion,
                    })}
                    editingClassName="flex h-7 min-w-24 items-center whitespace-nowrap bg-panel px-2 inset-ring inset-ring-focus outline-2 outline-solid outline-focus-halo focus:outline-solid"
                    value={flowVersion.displayName}
                    readonly={!isLatestVersion}
                    onValueChange={(value) => {
                      applyOperation(
                        {
                          type: FlowOperationType.CHANGE_NAME,
                          request: {
                            displayName: value,
                          },
                        },
                        () => {
                          flowHooks.invalidateFlowsQuery(queryClient);
                        },
                      );
                    }}
                    isEditing={isEditingFlowName}
                    setIsEditing={setIsEditingFlowName}
                    tooltipContent=""
                  />
                </BreadcrumbItem>
              )}
            </BreadcrumbList>
          </Breadcrumb>
          {!embedState.hideFlowNameInBuilder && (
            <>
              <FlowCreatedByBadge createdBy={flow.createdBy} className="ml-2" />
              <FlowActionMenu
                onVersionsListClick={() => {
                  setRightSidebar(RightSideBarType.VERSIONS);
                }}
                insideBuilder={true}
                flow={flow}
                flowVersion={flowVersion}
                readonly={!isLatestVersion}
                onDelete={goToFlowsPage}
                onRename={() => {
                  setIsEditingFlowName(true);
                }}
                onMoveTo={(folderId) => moveToFolderClientSide(folderId)}
                onDuplicate={() => {}}
                contentAlign="start"
              >
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('More')}
                  className="ml-1 shrink-0"
                >
                  <Ellipsis className="size-4 text-gray-11" />
                </Button>
              </FlowActionMenu>
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {showSupport && (
            <Button
              variant="ghost"
              className="gap-2 text-gray-11"
              onClick={() => openNewWindow(supportUrl)}
            >
              <CircleHelp className="size-4" />
              {t('Support')}
            </Button>
          )}
          {!embedState.hideActiveUsers && (
            <ActiveUsersWidget resourceId={flow.id} appearance="stacked" />
          )}
          <PublishButton isLockedByAnotherEditor={isLockedByAnotherEditor} />
          <BuilderFlowStatusSection />
        </div>
      </div>
      <EditorRunsControl className="absolute top-full left-1/2 z-10 -translate-x-1/2 -translate-y-1/2" />
    </header>
  );
};

type BuilderHeaderProps = {
  isLockedByAnotherEditor: boolean;
};
