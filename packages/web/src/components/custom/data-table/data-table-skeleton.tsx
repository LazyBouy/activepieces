import { Skeleton } from '@/components/ui/skeleton';

export function DataTableSkeleton({
  skeletonRowCount = 10,
}: {
  skeletonRowCount?: number;
}) {
  return (
    <div>
      {Array.from({ length: skeletonRowCount }).map((_, rowIndex) => (
        <TableRowSkeleton key={rowIndex} />
      ))}
    </div>
  );
}

function TableRowSkeleton() {
  return (
    <div
      id="table-loading"
      className="flex h-12 w-full items-center border-b border-gray-6 px-4 last:border-b-0"
      data-testid="header-cell"
    >
      <Skeleton className="h-4 w-full rounded-sm" />
    </div>
  );
}
