import { FolderDto, PopulatedFlow, Table } from '@activepieces/shared';
import * as AccordionPrimitive from '@radix-ui/react-accordion';

import { cn } from '@/lib/utils';

import { useDelayedFlag } from '../hooks/use-delayed-flag';
import { TreeItem } from '../lib/types';
import { groupTreeItemsByFolder } from '../lib/utils';

import {
  AutomationsLoadMoreButton,
  AutomationsSkeletonCard,
  AutomationsTableRow,
} from './automations-table-row';
import { CreateInFolderKind } from './create-new-menu';

export const AutomationsTable = ({
  items,
  isLoading,
  expandedFolders,
  folders,
  isPinned,
  onTogglePin,
  onToggleItemSelection,
  onRowClick,
  onRenameItem,
  onDeleteItem,
  onDuplicateFlow,
  onMoveItem,
  onExportFlow,
  onExportTable,
  onCreateInFolder,
  userHasPermissionToWriteFlow,
  userHasPermissionToWriteTable,
  userHasPermissionToWriteAgent,
  agentsVisible,
  isCreatingFlow,
  isCreatingTable,
  isCreatingAgent,
  isMoving,
  isDuplicating,
  onLoadMoreInFolder,
  isItemSelected,
}: AutomationsTableProps) => {
  const groups = groupTreeItemsByFolder(items);
  const showSkeleton = useDelayedFlag({
    value: isLoading,
    delayMs: SKELETON_DELAY_MS,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true">
        {showSkeleton &&
          Array.from({ length: SKELETON_COUNT }).map((_, index) => (
            <AutomationsSkeletonCard key={index} />
          ))}
      </div>
    );
  }

  const renderCard = (item: TreeItem) => (
    <AutomationsTableRow
      item={item}
      isSelected={isItemSelected(item)}
      isExpanded={expandedFolders.has(item.id)}
      isPinned={isPinned(item.id)}
      folders={folders}
      onOpen={(newTab) => onRowClick(item, newTab)}
      onToggleSelection={() => onToggleItemSelection(item)}
      onTogglePin={() => onTogglePin(item.id)}
      onRename={() => onRenameItem(item)}
      onDelete={() => onDeleteItem(item)}
      onDuplicate={onDuplicateFlow}
      onMoveTo={onMoveItem}
      onExportFlow={onExportFlow}
      onExportTable={onExportTable}
      onCreateInFolder={item.type === 'folder' ? onCreateInFolder : undefined}
      userHasPermissionToWriteFlow={userHasPermissionToWriteFlow}
      userHasPermissionToWriteTable={userHasPermissionToWriteTable}
      userHasPermissionToWriteAgent={userHasPermissionToWriteAgent}
      agentsVisible={agentsVisible}
      isCreatingFlow={isCreatingFlow}
      isCreatingTable={isCreatingTable}
      isCreatingAgent={isCreatingAgent}
      isMoving={isMoving}
      isDuplicating={isDuplicating}
    />
  );

  return (
    <AccordionPrimitive.Root
      type="multiple"
      value={Array.from(expandedFolders)}
      className="flex flex-col gap-2"
    >
      {groups.map((group) => {
        if (group.item.type !== 'folder') {
          return (
            <div key={`${group.item.type}-${group.item.id}`}>
              {renderCard(group.item)}
            </div>
          );
        }
        const cards = group.children.filter(
          (child) => child.type !== 'load-more-folder',
        );
        const loadMore = group.children.find(
          (child) => child.type === 'load-more-folder',
        );
        return (
          <AccordionPrimitive.Item
            key={`folder-${group.item.id}`}
            value={group.item.id}
          >
            {renderCard(group.item)}
            <AccordionPrimitive.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down motion-reduce:animate-none">
              <div className="flex flex-col">
                {cards.map((child, index) => (
                  <div
                    key={`${child.type}-${child.id}`}
                    className="relative pt-2 pl-6"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'absolute top-0 left-3 w-px bg-gray-6',
                        index === cards.length - 1
                          ? 'h-[calc(50%+4px)]'
                          : 'bottom-0',
                      )}
                    />
                    {renderCard(child)}
                  </div>
                ))}
                {loadMore && (
                  <div className="flex pt-2 pl-6">
                    <AutomationsLoadMoreButton
                      count={loadMore.loadMoreCount ?? 0}
                      onLoadMore={() => onLoadMoreInFolder(group.item.id)}
                    />
                  </div>
                )}
              </div>
            </AccordionPrimitive.Content>
          </AccordionPrimitive.Item>
        );
      })}
    </AccordionPrimitive.Root>
  );
};

const SKELETON_COUNT = 10;
const SKELETON_DELAY_MS = 300;

type AutomationsTableProps = {
  items: TreeItem[];
  isLoading: boolean;
  expandedFolders: Set<string>;
  folders: FolderDto[];
  isPinned: (itemId: string) => boolean;
  onTogglePin: (itemId: string) => void;
  onToggleItemSelection: (item: TreeItem) => void;
  onRowClick: (item: TreeItem, ctrlKey?: boolean) => void;
  onRenameItem: (item: TreeItem) => void;
  onDeleteItem: (item: TreeItem) => void;
  onDuplicateFlow: (flow: PopulatedFlow) => void;
  onMoveItem: (item: TreeItem, folderId: string) => void;
  onExportFlow: (flow: PopulatedFlow) => void;
  onExportTable: (table: Table) => void;
  onCreateInFolder?: (folderId: string, kind: CreateInFolderKind) => void;
  userHasPermissionToWriteFlow?: boolean;
  userHasPermissionToWriteTable?: boolean;
  userHasPermissionToWriteAgent: boolean;
  agentsVisible: boolean;
  isCreatingFlow?: boolean;
  isCreatingTable?: boolean;
  isCreatingAgent?: boolean;
  isMoving: boolean;
  isDuplicating: boolean;
  onLoadMoreInFolder: (folderId: string) => void;
  isItemSelected: (item: TreeItem) => boolean;
};
