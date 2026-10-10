import { CheckIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

import { DataTableFilterTrigger } from './data-table-filter-trigger';

type DataTableCheckboxProps = {
  label: string;
  checked: boolean;
  handleCheckedChange: (checked: boolean) => void;
};

export function DataTableInputCheckbox({
  label,
  checked,
  handleCheckedChange,
}: DataTableCheckboxProps) {
  return (
    <DataTableFilterTrigger
      role="checkbox"
      aria-checked={checked}
      data-active={checked || undefined}
      onClick={() => handleCheckedChange(!checked)}
    >
      <span
        aria-hidden
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded-sm border',
          checked
            ? 'border-accent-9 bg-accent-9 text-on-accent'
            : 'border-gray-6 bg-panel',
        )}
      >
        {checked && <CheckIcon className="size-3" />}
      </span>
      <span className="select-none">{label}</span>
    </DataTableFilterTrigger>
  );
}
