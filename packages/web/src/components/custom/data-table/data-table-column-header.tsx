import { Column } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DataTableColumnHeaderProps<TData, TValue>
  extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>;
  title: string;
  icon?: LucideIcon;
  sortable?: boolean;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
  icon: Icon,
  sortable = false,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (sortable) {
    const sortDirection = column.getIsSorted();
    const SortIcon =
      sortDirection === 'desc'
        ? ArrowDown
        : sortDirection === 'asc'
        ? ArrowUp
        : ArrowUpDown;

    return (
      <Button
        variant="ghost"
        onClick={(e) => {
          e.stopPropagation();
          if (sortDirection === false) {
            column.toggleSorting(false, false);
          } else if (sortDirection === 'asc') {
            column.toggleSorting(true, false);
          } else {
            column.clearSorting();
          }
        }}
        className={cn(
          'h-auto p-0 text-xs font-semibold text-gray-12/87 hover:bg-transparent hover:text-gray-12 pressed:bg-transparent',
          className,
        )}
      >
        {Icon && <Icon className="size-3.5 shrink-0 text-gray-10" />}
        {title}
        <SortIcon className="size-3.5 text-gray-10" />
      </Button>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center justify-start gap-1.5 whitespace-nowrap',
        className,
      )}
    >
      {Icon && <Icon className="size-3.5 shrink-0 text-gray-10" />}
      <div className="text-xs font-semibold text-gray-12/87">{title}</div>
    </div>
  );
}
