import { cn, DASHBOARD_CONTENT_PADDING_X } from '@/lib/utils';

type DataTableToolbarProps = {
  children?: React.ReactNode;
  className?: string;
};

const DataTableToolbar = (params: DataTableToolbarProps) => {
  return (
    <div
      data-slot="data-table-toolbar"
      className={cn(
        'flex items-center justify-between pb-3',
        params.className ?? DASHBOARD_CONTENT_PADDING_X,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {params.children}
      </div>
    </div>
  );
};
DataTableToolbar.displayName = 'DataTableToolbar';

export { DataTableToolbar };
