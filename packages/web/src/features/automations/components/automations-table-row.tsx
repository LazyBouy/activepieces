import {
  AgentSummary,
  FolderDto,
  PopulatedFlow,
  Table,
} from '@activepieces/shared';
import { t } from 'i18next';
import {
  ArrowDown,
  Bot,
  ChevronRight,
  Copy,
  CornerUpLeft,
  Download,
  Folder,
  Link,
  MoreHorizontal,
  Pencil,
  Plus,
  Share2,
  Star,
  Table2,
  Trash2,
  Workflow,
} from 'lucide-react';
import { Fragment, useState } from 'react';
import { toast } from 'sonner';

import { ApAvatar } from '@/components/custom/ap-avatar';
import { ConfirmationDeleteDialog } from '@/components/custom/delete-dialog';
import { LoadingSpinner } from '@/components/custom/spinner';
import { TextWithTooltip } from '@/components/custom/text-with-tooltip';
import { useEmbedding } from '@/components/providers/embed-provider';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AgentToolStack } from '@/features/agents/agent-tool-stack';
import { DeleteAgentDialog } from '@/features/agents/delete-agent-dialog';
import { MoveToFolderDialog } from '@/features/automations/components/move-to-folder-dialog';
import { FlowCreatedByBadge } from '@/features/flows/components/flow-created-by-badge';
import { FlowStatusToggle } from '@/features/flows/components/flow-status-toggle';
import { ShareTemplateDialog } from '@/features/flows/components/share-template-dialog';
import { PieceIconList } from '@/features/pieces/components/piece-icon-list';
import { formatUtils } from '@/lib/format-utils';
import { cn } from '@/lib/utils';

import { TreeItem } from '../lib/types';

import { CreateNewMenu, CreateInFolderKind } from './create-new-menu';

export const AutomationsTableRow = ({
  item,
  isSelected,
  isExpanded,
  isPinned,
  folders,
  onOpen,
  onToggleSelection,
  onTogglePin,
  onRename,
  onDelete,
  onDuplicate,
  onMoveTo,
  onExportFlow,
  onExportTable,
  onCreateInFolder,
  userHasPermissionToWriteFlow = true,
  userHasPermissionToWriteTable = true,
  userHasPermissionToWriteAgent,
  agentsVisible = false,
  isCreatingFlow,
  isCreatingTable,
  isCreatingAgent,
  isMoving,
  isDuplicating,
}: AutomationsTableRowProps) => {
  const { embedState } = useEmbedding();
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [moveFolderId, setMoveFolderId] = useState('');
  const [isCreateTooltipOpen, setIsCreateTooltipOpen] = useState(false);
  const [isDeleteAgentOpen, setIsDeleteAgentOpen] = useState(false);
  const isFolder = item.type === 'folder';

  return (
    <div
      tabIndex={0}
      data-slot="automation-card"
      data-selected={isSelected || undefined}
      aria-expanded={isFolder ? isExpanded : undefined}
      onClick={(e) => onOpen(e.ctrlKey || e.metaKey)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target === e.currentTarget) {
          e.preventDefault();
          onOpen(e.ctrlKey || e.metaKey);
        }
      }}
      className={cn(
        'group/card flex w-full min-w-0 cursor-pointer items-center rounded-lg border border-gray-6 bg-panel text-sm text-gray-12 transition-shadow duration-300 ease-standard outline-hidden hover:shadow-lift focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-solid focus-visible:outline-focus-halo motion-reduce:transition-none',
        isSelected && 'border-gray-7 bg-gray-3',
      )}
    >
      <div className="flex shrink-0 items-center gap-3 pr-2 pl-4">
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggleSelection}
          onClick={(e) => e.stopPropagation()}
          aria-label={item.name}
        />
        <div className="flex size-4 items-center justify-center">
          {item.depth === 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTogglePin();
                  }}
                  aria-label={
                    isPinned
                      ? t('Remove from favorites')
                      : t('Add to favorites')
                  }
                  aria-pressed={isPinned}
                  className={cn(
                    'flex size-4 items-center justify-center rounded-sm outline-hidden transition-opacity focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-focus-halo',
                    !isPinned &&
                      'opacity-0 group-hover/card:opacity-100 group-focus-within/card:opacity-100',
                  )}
                >
                  <Star
                    className={cn(
                      'size-4',
                      isPinned
                        ? 'fill-warning-9 text-warning-9'
                        : 'text-gray-10 hover:text-gray-11',
                    )}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {isPinned ? t('Remove from favorites') : t('Add to favorites')}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col pt-4">
        <div className="flex min-w-0 items-center gap-2">
          {isFolder && (
            <ChevronRight
              aria-hidden
              className={cn(
                'size-4 shrink-0 text-gray-10 transition-transform duration-150 motion-reduce:transition-none',
                isExpanded && 'rotate-90',
              )}
            />
          )}
          <span className="flex shrink-0">
            <RowItemIcon item={item} />
          </span>
          <div className="flex min-w-0 items-center gap-1.5">
            <TextWithTooltip tooltipMessage={item.name}>
              <span className="block truncate font-medium text-gray-12">
                {item.name}
              </span>
            </TextWithTooltip>
            {isFlowItem(item) && (
              <FlowCreatedByBadge createdBy={item.data.createdBy} />
            )}
          </div>
        </div>
        <RowItemMeta item={item} />
      </div>

      <div
        className="flex shrink-0 cursor-default items-center gap-2 pr-4 pl-4"
        onClick={(e) => e.stopPropagation()}
      >
        {!embedState.isEmbedded && <RowItemOwner item={item} />}
        {isFlowItem(item) && <FlowStatusToggle flow={item.data} />}
        {isAgentItem(item) && (
          <AgentStatusPill isPublished={item.data.isPublished} />
        )}
        {isFolder && onCreateInFolder && (
          <Tooltip
            open={isCreateTooltipOpen}
            onOpenChange={setIsCreateTooltipOpen}
          >
            <CreateNewMenu
              scope="folder"
              align="end"
              userHasPermissionToWriteFlow={userHasPermissionToWriteFlow}
              userHasPermissionToWriteTable={userHasPermissionToWriteTable}
              userHasPermissionToWriteFolder={false}
              userHasPermissionToWriteAgent={userHasPermissionToWriteAgent}
              isCreatingFlow={isCreatingFlow}
              isCreatingTable={isCreatingTable}
              isCreatingAgent={isCreatingAgent}
              onCreateFlow={() => onCreateInFolder(item.id, 'flow')}
              onCreateTable={() => onCreateInFolder(item.id, 'table')}
              onCreateAgent={
                agentsVisible
                  ? () => onCreateInFolder(item.id, 'agent')
                  : undefined
              }
              onImportFlow={() => onCreateInFolder(item.id, 'import-flow')}
              onImportTable={() => onCreateInFolder(item.id, 'import-table')}
              onOpenChange={(open) => {
                if (open) setIsCreateTooltipOpen(false);
              }}
            >
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-gray-11 opacity-0 transition-opacity duration-150 group-hover/card:opacity-100 group-focus-within/card:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                  aria-label={t('Create inside folder')}
                >
                  <Plus className="size-4" />
                </Button>
              </TooltipTrigger>
            </CreateNewMenu>
            <TooltipContent side="top">
              {t('Create inside folder')}
            </TooltipContent>
          </Tooltip>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-gray-11"
              aria-label={t('More')}
              disabled={isAgentItem(item) && !userHasPermissionToWriteAgent}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isFolder && (
              <DropdownMenuItem
                onClick={() => {
                  const url = new URL(window.location.href);
                  url.searchParams.set('folder', item.id);
                  navigator.clipboard.writeText(url.toString());
                  toast.success(t('URL copied to clipboard'));
                }}
              >
                <Link className="size-4" />
                {t('Copy URL')}
              </DropdownMenuItem>
            )}

            <DropdownMenuItem onClick={onRename}>
              <Pencil className="size-4" />
              {t('Rename')}
            </DropdownMenuItem>

            {isFlowItem(item) && !embedState.hideDuplicateFlow && (
              <DropdownMenuItem
                onClick={() => onDuplicate(item.data)}
                disabled={isDuplicating}
              >
                {isDuplicating ? (
                  <LoadingSpinner className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
                {isDuplicating ? t('Duplicating...') : t('Duplicate')}
              </DropdownMenuItem>
            )}

            {!isFolder && !embedState.hideFolders && (
              <DropdownMenuItem
                onClick={() => {
                  setMoveFolderId('');
                  setIsMoveOpen(true);
                }}
              >
                <CornerUpLeft className="size-4" />
                {t('Move To')}
              </DropdownMenuItem>
            )}

            {isFlowItem(item) && !embedState.hideExportAndImportFlow && (
              <DropdownMenuItem onClick={() => onExportFlow(item.data)}>
                <Download className="size-4" />
                {t('Export')}
              </DropdownMenuItem>
            )}

            {isTableItem(item) && (
              <DropdownMenuItem onClick={() => onExportTable(item.data)}>
                <Download className="size-4" />
                {t('Export')}
              </DropdownMenuItem>
            )}

            {isFlowItem(item) && !embedState.isEmbedded && (
              <ShareTemplateDialog
                flowId={item.id}
                flowVersionId={item.data.version.id}
              >
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <Share2 className="size-4" />
                  {t('Share')}
                </DropdownMenuItem>
              </ShareTemplateDialog>
            )}

            <DropdownMenuSeparator />
            {isAgentItem(item) ? (
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setIsDeleteAgentOpen(true)}
              >
                <Trash2 className="size-4" />
                {t('Delete')}
              </DropdownMenuItem>
            ) : (
              <ConfirmationDeleteDialog
                title={t('Delete {type}', { type: item.type })}
                message={t('Deleting "{name}" cannot be undone.', {
                  name: item.name,
                })}
                mutationFn={async () => onDelete()}
                entityName={item.type}
                buttonText={t('Delete')}
              >
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={(e) => e.preventDefault()}
                >
                  <Trash2 className="size-4" />
                  {t('Delete')}
                </DropdownMenuItem>
              </ConfirmationDeleteDialog>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {isAgentItem(item) && (
          <DeleteAgentDialog
            agent={item.data}
            open={isDeleteAgentOpen}
            onOpenChange={setIsDeleteAgentOpen}
          />
        )}

        <MoveToFolderDialog
          open={isMoveOpen}
          onOpenChange={setIsMoveOpen}
          folders={folders}
          selectedFolderId={moveFolderId}
          onFolderChange={setMoveFolderId}
          onConfirm={() => {
            onMoveTo(item, moveFolderId);
            setIsMoveOpen(false);
          }}
          isMoving={isMoving}
        />
      </div>
    </div>
  );
};

export const AutomationsLoadMoreButton = ({
  count,
  onLoadMore,
}: {
  count: number;
  onLoadMore: () => void;
}) => {
  return (
    <Button
      variant="link"
      className="h-8 self-start hover:text-accent-9"
      onClick={(e) => {
        e.stopPropagation();
        onLoadMore();
      }}
    >
      <ArrowDown className="size-4" />
      {t('Load {count} more items...', { count })}
    </Button>
  );
};

export const AutomationsSkeletonCard = () => {
  return (
    <div
      aria-hidden
      className="flex h-[69px] w-full flex-col gap-2 rounded-lg border border-gray-6 bg-panel p-4"
    >
      <Skeleton className="h-3.5 w-40 rounded-sm" />
      <Skeleton className="h-2.5 w-60 rounded-sm" />
    </div>
  );
};

const AgentStatusPill = ({ isPublished }: { isPublished: boolean }) => {
  return (
    <span className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border border-gray-6 px-2 text-xs font-medium text-gray-11">
      <span
        aria-hidden
        className={cn(
          'size-2 rounded-full',
          isPublished ? 'bg-success-9' : 'bg-gray-8',
        )}
      />
      {isPublished ? t('Live') : t('Draft')}
    </span>
  );
};

const RowItemIcon = ({ item }: { item: TreeItem }) => {
  switch (item.type) {
    case 'folder':
      return <Folder className="size-4 fill-gray-10 text-gray-10" />;
    case 'flow':
      return <Workflow className="size-4 text-accent-11" />;
    case 'agent':
      return <Bot className="size-4 text-swatch-6-mark" />;
    default:
      return <Table2 className="size-4 text-swatch-8-mark" />;
  }
};

const RowItemMeta = ({ item }: { item: TreeItem }) => {
  const parts = metaParts(item);
  return (
    <div className="flex min-h-8 min-w-0 items-center gap-2 pb-4 text-xs text-gray-10">
      {parts.map((part, index) => (
        <Fragment key={part.key}>
          {index > 0 && <span aria-hidden>|</span>}
          {part.node}
        </Fragment>
      ))}
    </div>
  );
};

const RowItemOwner = ({ item }: { item: TreeItem }) => {
  if ((isFlowItem(item) || isAgentItem(item)) && item.data.ownerId) {
    return (
      <ApAvatar
        id={item.data.ownerId}
        includeAvatar={true}
        includeName={true}
        size="xsmall"
        appearance="pill"
      />
    );
  }
  return null;
};

function metaParts(item: TreeItem): { key: string; node: React.ReactNode }[] {
  if (item.type === 'folder') {
    return [
      {
        key: 'files',
        node: (
          <span>
            {item.childCount} {item.childCount === 1 ? t('file') : t('files')}
          </span>
        ),
      },
    ];
  }
  if (!item.data) {
    return [];
  }
  const dates = [
    {
      key: 'updated',
      node: (
        <span className="whitespace-nowrap">
          {t('Updated {time}', {
            time: formatUtils.formatDate(new Date(item.data.updated)),
          })}
        </span>
      ),
    },
    {
      key: 'created',
      node: (
        <span className="whitespace-nowrap">
          {t('Created {date}', {
            date: formatUtils.formatDateOnly(new Date(item.data.created)),
          })}
        </span>
      ),
    },
  ];
  if (isFlowItem(item)) {
    return [
      ...dates,
      {
        key: 'pieces',
        node: (
          <PieceIconList
            trigger={item.data.version.trigger}
            maxNumberOfIconsToShow={3}
            size="xxs"
            className="flex items-center gap-1"
          />
        ),
      },
    ];
  }
  if (isAgentItem(item)) {
    return [
      ...dates,
      {
        key: 'tools',
        node: (
          <AgentToolStack
            toolCount={item.data.toolCount}
            toolPieceNames={item.data.toolPieceNames}
            toolTypes={item.data.toolTypes}
            size="compact"
          />
        ),
      },
    ];
  }
  return dates;
}

function isFlowItem(
  item: TreeItem,
): item is Omit<TreeItem, 'data'> & { data: PopulatedFlow } {
  return item.type === 'flow';
}

function isTableItem(
  item: TreeItem,
): item is Omit<TreeItem, 'data'> & { data: Table } {
  return item.type === 'table';
}

function isAgentItem(
  item: TreeItem,
): item is Omit<TreeItem, 'data'> & { data: AgentSummary } {
  return item.type === 'agent';
}

type AutomationsTableRowProps = {
  item: TreeItem;
  isSelected: boolean;
  isExpanded: boolean;
  isPinned: boolean;
  folders: FolderDto[];
  onOpen: (newTab: boolean) => void;
  onToggleSelection: () => void;
  onTogglePin: () => void;
  onRename: () => void;
  onDelete: () => void;
  onDuplicate: (flow: PopulatedFlow) => void;
  onMoveTo: (item: TreeItem, folderId: string) => void;
  onExportFlow: (flow: PopulatedFlow) => void;
  onExportTable: (table: Table) => void;
  onCreateInFolder?: (folderId: string, kind: CreateInFolderKind) => void;
  userHasPermissionToWriteFlow?: boolean;
  userHasPermissionToWriteTable?: boolean;
  userHasPermissionToWriteAgent: boolean;
  agentsVisible?: boolean;
  isCreatingFlow?: boolean;
  isCreatingTable?: boolean;
  isCreatingAgent?: boolean;
  isMoving: boolean;
  isDuplicating: boolean;
};
