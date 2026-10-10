import { t } from 'i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

function DataTablePagination({
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
  canPrevious,
  canNext,
  onPrevious,
  onNext,
  note,
  className,
}: DataTablePaginationProps) {
  return (
    <div
      data-slot="pagination"
      className={cn(
        'flex flex-wrap items-center justify-end gap-2 text-sm',
        className,
      )}
    >
      {note && <span className="text-xs text-gray-10">{note}</span>}
      <span className="text-gray-10">{t('Rows per page')}</span>
      <Select
        value={String(pageSize)}
        onValueChange={(value) => onPageSizeChange(Number(value))}
      >
        <SelectTrigger size="sm" className="w-[72px]">
          <SelectValue placeholder={pageSize} />
        </SelectTrigger>
        <SelectContent side="top">
          {pageSizeOptions.map((size) => (
            <SelectItem key={size} value={String(size)}>
              {size}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <PageButton
        label={t('Previous')}
        disabled={!canPrevious}
        onClick={onPrevious}
      >
        <ChevronLeft className="size-4" />
      </PageButton>
      <PageButton label={t('Next')} disabled={!canNext} onClick={onNext}>
        <ChevronRight className="size-4" />
      </PageButton>
    </div>
  );
}

function PageButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn('inline-flex', disabled && 'cursor-not-allowed')}>
          <Button
            variant="ghost"
            size="icon"
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
          >
            {children}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export { DataTablePagination };

type DataTablePaginationProps = {
  pageSize: number;
  pageSizeOptions: number[];
  onPageSizeChange: (size: number) => void;
  canPrevious: boolean;
  canNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  note?: React.ReactNode;
  className?: string;
};
