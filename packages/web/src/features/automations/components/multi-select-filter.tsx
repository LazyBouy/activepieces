import { t } from 'i18next';
import { ChevronDown, Search } from 'lucide-react';
import { useState } from 'react';

import { DataTableFilterTrigger } from '@/components/custom/data-table/data-table-filter-trigger';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { selectTriggerClassName } from '@/components/ui/select';
import { cn } from '@/lib/utils';

import { SelectionSummary, summarizeSelection } from '../lib/utils';

type MultiSelectFilterProps = {
  label: string;
  icon: React.ReactNode;
  options: { value: string; label: string; icon?: React.ReactNode }[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  searchable?: boolean;
  variant?: 'chip' | 'field';
  id?: string;
};

export const MultiSelectFilter = ({
  label,
  icon,
  options,
  selectedValues,
  onChange,
  searchable = false,
  variant = 'chip',
  id,
}: MultiSelectFilterProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const toggleValue = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter((v) => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  const summary = summarizeSelection({ selectedValues, options });
  const summaryText = selectionSummaryText(summary);

  const filteredOptions =
    searchable && search
      ? options.filter((o) =>
          o.label.toLowerCase().includes(search.toLowerCase()),
        )
      : options;

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setSearch('');
      }}
    >
      <PopoverTrigger asChild>
        {variant === 'field' ? (
          <button
            id={id}
            type="button"
            data-size="sm"
            data-placeholder={summary.kind === 'none' ? '' : undefined}
            className={selectTriggerClassName}
          >
            <span className="flex min-w-0 items-center gap-2 truncate">
              {summaryText ?? t('All')}
            </span>
            <ChevronDown className="size-4 text-gray-11" />
          </button>
        ) : (
          <DataTableFilterTrigger
            id={id}
            leading={icon}
            label={label}
            value={summaryText}
          />
        )}
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          'p-0',
          variant === 'field'
            ? 'w-(--radix-popover-trigger-width) min-w-56'
            : 'w-56',
        )}
        align="start"
      >
        {searchable && (
          <div className="border-b px-2 pt-2 pb-1">
            <Input
              leadingIcon={<Search className="size-3.5" />}
              placeholder={t('Search...')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 border-none px-0 text-sm focus-within:ring-0"
            />
          </div>
        )}
        <ScrollArea className="max-h-[300px]">
          <div className="space-y-1 p-1">
            {filteredOptions.length === 0 ? (
              <div className="px-2 py-4 text-center text-sm text-gray-11">
                {t('No results')}
              </div>
            ) : (
              filteredOptions.map((option) => (
                <div
                  key={option.value}
                  className="flex min-h-8 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-gray-4"
                  onClick={() => toggleValue(option.value)}
                >
                  <Checkbox
                    checked={selectedValues.includes(option.value)}
                    onCheckedChange={() => toggleValue(option.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  {option.icon}
                  <span className="flex-1 truncate text-sm">
                    {option.label}
                  </span>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
        {selectedValues.length > 0 && (
          <div className="border-t p-1">
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => onChange([])}
            >
              {t('Clear all')}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

function selectionSummaryText(summary: SelectionSummary): string | undefined {
  switch (summary.kind) {
    case 'none':
      return undefined;
    case 'single':
      return summary.label;
    case 'multiple':
      return t('{count} selected', { count: summary.count });
  }
}
