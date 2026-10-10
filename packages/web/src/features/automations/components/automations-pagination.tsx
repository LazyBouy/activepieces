import { DataTablePagination } from '@/components/custom/data-table/data-table-pagination';
import { cn } from '@/lib/utils';

import { PAGE_SIZE_OPTIONS } from '../lib/utils';

type AutomationsPaginationProps = {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  note?: React.ReactNode;
  className?: string;
};

export const AutomationsPagination = ({
  currentPage,
  totalPages,
  pageSize,
  onPageSizeChange,
  onPrevPage,
  onNextPage,
  note,
  className,
}: AutomationsPaginationProps) => {
  const maxPages = Math.max(totalPages, 1);

  return (
    <DataTablePagination
      className={cn('mt-7 mb-6', className)}
      note={note}
      pageSize={pageSize}
      pageSizeOptions={PAGE_SIZE_OPTIONS}
      onPageSizeChange={onPageSizeChange}
      canPrevious={currentPage > 0}
      canNext={currentPage < maxPages - 1}
      onPrevious={onPrevPage}
      onNext={onNextPage}
    />
  );
};
