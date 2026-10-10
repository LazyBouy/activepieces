import { t } from 'i18next';
import { CheckIcon, ListFilterIcon } from 'lucide-react';

import { LogoPlate } from '@/components/custom/logo-plate';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

import { DataTableFilterTrigger } from './data-table-filter-trigger';

type DataTableSelectPopoverProps = {
  title?: string;
  selectedValues: Set<string>;
  options: readonly {
    label: string;
    value: string;
    icon?: React.ComponentType<{ className?: string }> | string;
  }[];
  facets?: Map<any, number>;
  handleFilterChange: (filterValue: string[]) => void;
};

const DataTableSelectPopover = ({
  title,
  selectedValues,
  options,
  handleFilterChange,
  facets,
}: DataTableSelectPopoverProps) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <DataTableFilterTrigger
          icon={ListFilterIcon}
          label={title}
          value={selectedSummary({ selectedValues, options })}
        />
      </PopoverTrigger>
      <PopoverContent
        className="min-w-[200px] max-w-[250px] break-all p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder={title} />
          <CommandList>
            <CommandEmpty>{t('No results found')}</CommandEmpty>

            <CommandGroup>
              <ScrollArea viewPortClassName="max-h-[200px]">
                {options.map((option, index) => {
                  const isSelected = selectedValues.has(option.value);
                  return (
                    <CommandItem
                      key={option.value}
                      onSelect={() => {
                        if (isSelected) {
                          selectedValues.delete(option.value);
                        } else {
                          selectedValues.add(option.value);
                        }
                        const filterValues = Array.from(selectedValues);
                        handleFilterChange(filterValues);
                      }}
                    >
                      <div
                        className={cn(
                          'mr-2 flex size-4 shrink-0 items-center justify-center rounded-sm border',
                          isSelected
                            ? 'border-accent-9 bg-accent-9 text-on-accent'
                            : 'border-gray-6 bg-panel [&_svg]:invisible',
                        )}
                      >
                        <CheckIcon className="size-3" />
                      </div>
                      {typeof option.icon === 'string' ? (
                        <LogoPlate
                          src={option.icon}
                          alt={option.label}
                          size="xxs"
                          className="mr-2"
                        />
                      ) : (
                        option.icon && (
                          <option.icon className="mr-2 size-4 text-gray-11" />
                        )
                      )}
                      <div>
                        <span>{option.label}</span>
                        <span className="hidden">{index}</span>
                      </div>
                      {facets?.get(option.value) && (
                        <span className="ml-auto flex size-4 items-center justify-center font-mono text-xs">
                          {facets.get(option.value)}
                        </span>
                      )}
                    </CommandItem>
                  );
                })}
              </ScrollArea>
            </CommandGroup>
            {selectedValues.size > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => handleFilterChange([])}
                    className="justify-center text-center"
                  >
                    {t('Clear filters')}
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

function selectedSummary({
  selectedValues,
  options,
}: {
  selectedValues: Set<string>;
  options: DataTableSelectPopoverProps['options'];
}): string | undefined {
  if (selectedValues.size === 0) {
    return undefined;
  }
  if (selectedValues.size === 1) {
    const [only] = selectedValues;
    return options.find((option) => option.value === only)?.label ?? only;
  }
  return t('{count} selected', { count: selectedValues.size });
}

export { DataTableSelectPopover };
