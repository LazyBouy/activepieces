import { t } from 'i18next';
import { Download, FolderInput, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { SelectionBar } from '@/components/custom/data-table/data-table-bulk-actions';
import { ConfirmationDeleteDialog } from '@/components/custom/delete-dialog';
import { LoadingSpinner } from '@/components/custom/spinner';
import { useEmbedding } from '@/components/providers/embed-provider';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

type AutomationsSelectionBarProps = {
  selectedCount: number;
  isDeleting: boolean;
  isMoving: boolean;
  isExporting: boolean;
  hasMovableItems: boolean;
  hasExportableItems: boolean;
  onMoveClick: () => void;
  onDeleteClick: () => void;
  onExportClick: () => void;
  onClearSelection: () => void;
};

export const AutomationsSelectionBar = ({
  selectedCount,
  isDeleting,
  isMoving,
  isExporting,
  hasMovableItems,
  hasExportableItems,
  onMoveClick,
  onDeleteClick,
  onExportClick,
  onClearSelection,
}: AutomationsSelectionBarProps) => {
  const { embedState } = useEmbedding();

  return (
    <SelectionBar
      selectedCount={selectedCount}
      onClearSelection={onClearSelection}
    >
      {!embedState.hideFolders && (
        <Button
          variant="ghost"
          onClick={onMoveClick}
          disabled={isMoving || !hasMovableItems}
        >
          <FolderInput className="size-4" />
          {t('Move to')}
        </Button>
      )}
      {!embedState.hideExportAndImportFlow && (
        <Button
          variant="ghost"
          onClick={onExportClick}
          disabled={isExporting || !hasExportableItems}
        >
          {isExporting ? (
            <LoadingSpinner className="size-4" />
          ) : (
            <Download className="size-4" />
          )}
          {isExporting ? t('Exporting') : t('Export')}
        </Button>
      )}
      <ConfirmationDeleteDialog
        title={t('Delete Selected Items')}
        message={t(
          'This will permanently delete {count} selected items. This action cannot be undone.',
          { count: selectedCount },
        )}
        mutationFn={async () => onDeleteClick()}
        onError={(error) =>
          toast.error(
            api.extractServerErrorMessage(error, t('Failed to delete items')),
          )
        }
        entityName={t('items')}
        buttonText={t('Delete')}
      >
        <Button
          variant="ghost"
          className="text-danger-11 hover:text-danger-11"
          disabled={isDeleting}
        >
          <Trash2 className="size-4" />
          {t('Delete')}
        </Button>
      </ConfirmationDeleteDialog>
    </SelectionBar>
  );
};
