import { t } from 'i18next';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DataTableBulkActionsProps<TData> {
  selectedRows: TData[];
  actions: Array<{
    render: (
      selectedRows: TData[],
      resetSelection: () => void,
    ) => React.ReactNode;
  }>;
  resetSelection: () => void;
}

export function DataTableBulkActions<TData>({
  selectedRows,
  actions,
  resetSelection,
}: DataTableBulkActionsProps<TData>) {
  return (
    <SelectionBar
      selectedCount={selectedRows.length}
      onClearSelection={resetSelection}
    >
      {actions.map((action, index) => (
        <React.Fragment key={index}>
          {action.render(selectedRows, resetSelection)}
        </React.Fragment>
      ))}
    </SelectionBar>
  );
}

export function SelectionBar({
  selectedCount,
  onClearSelection,
  children,
  className,
}: SelectionBarProps) {
  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
        >
          <div
            data-slot="selection-bar"
            className={cn(
              'flex items-center gap-3 rounded-lg bg-panel p-2 text-gray-12 shadow-float',
              className,
            )}
          >
            {children}
            <div aria-hidden className="h-6 w-px shrink-0 bg-gray-6" />
            <span className="text-sm whitespace-nowrap text-gray-10">
              {t('{count} selected', { count: selectedCount })}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t('Clear selection')}
              onClick={onClearSelection}
            >
              <X className="size-4" />
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

type SelectionBarProps = {
  selectedCount: number;
  onClearSelection: () => void;
  children: React.ReactNode;
  className?: string;
};
