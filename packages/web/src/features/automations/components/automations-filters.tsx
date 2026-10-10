import { PieceMetadataModelSummary } from '@activepieces/pieces-framework';
import {
  AppConnectionWithoutSensitiveData,
  FlowStatus,
  FolderDto,
} from '@activepieces/shared';
import { t } from 'i18next';
import { Funnel, Search, X } from 'lucide-react';
import { useId, useState } from 'react';

import { LogoPlate } from '@/components/custom/logo-plate';
import { useEmbedding } from '@/components/providers/embed-provider';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
import { useOwnerOptions } from '@/features/automations/hooks/use-owner-options';
import { formatUtils } from '@/lib/format-utils';

import { AutomationsSort } from '../lib/types';
import {
  countActiveCriteria,
  countActiveFilters,
  parseAutomationsSort,
} from '../lib/utils';

import { MultiSelectFilter } from './multi-select-filter';

export const AutomationsFilters = ({
  searchTerm,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  statusFilter,
  onStatusFilterChange,
  connectionFilter,
  onConnectionFilterChange,
  ownerFilter,
  onOwnerFilterChange,
  folderFilter,
  onFolderFilterChange,
  onFilterChange,
  folders,
  connections,
  pieces,
  agentsVisible,
  onClearAllFilters,
  sort,
  onSortChange,
  selectedCount,
  selectableCount,
  onToggleAllSelection,
}: AutomationsFiltersProps) => {
  const { embedState } = useEmbedding();
  const ownerOptions = useOwnerOptions();
  const selectAllId = useId();

  const typeOptions = [
    { value: 'flow', label: t('Flows') },
    ...(embedState.hideTables ? [] : [{ value: 'table', label: t('Tables') }]),
    ...(agentsVisible ? [{ value: 'agent', label: t('Agents') }] : []),
  ];

  const statusOptions = Object.values(FlowStatus).map((status) => ({
    value: status,
    label: formatUtils.convertEnumToHumanReadable(status),
  }));

  const folderOptions = folders.map((folder) => ({
    value: folder.id,
    label: folder.displayName,
  }));

  const connectionOptions = (connections || []).map((connection) => {
    const pieceIcon = pieces?.find(
      (p) => p.name === connection.pieceName,
    )?.logoUrl;
    return {
      value: connection.externalId,
      label: connection.displayName,
      icon: pieceIcon ? (
        <LogoPlate src={pieceIcon} alt="" className="size-4 rounded-sm p-px" />
      ) : undefined,
    };
  });

  const sortOptions: { value: AutomationsSort; label: string }[] = [
    { value: 'default', label: t('Last modified') },
    { value: 'name-asc', label: t('Sort by name A to Z') },
    { value: 'name-desc', label: t('Sort by name Z to A') },
  ];

  const filterCount = countActiveFilters({
    typeFilter,
    statusFilter,
    connectionFilter,
    ownerFilter,
    folderFilter,
  });
  const criteriaCount = countActiveCriteria({
    searchTerm,
    typeFilter,
    statusFilter,
    connectionFilter,
    ownerFilter,
    folderFilter,
  });

  const clearAll = () => {
    onClearAllFilters();
    onFilterChange?.();
  };

  const filterFields: FilterField[] = [
    {
      key: 'type',
      label: t('Type'),
      options: typeOptions,
      selectedValues: typeFilter,
      onChange: onTypeFilterChange,
      searchable: false,
      show: true,
    },
    {
      key: 'status',
      label: t('Status'),
      options: statusOptions,
      selectedValues: statusFilter,
      onChange: onStatusFilterChange,
      searchable: false,
      show: true,
    },
    {
      key: 'connections',
      label: t('Connections'),
      options: connectionOptions,
      selectedValues: connectionFilter,
      onChange: onConnectionFilterChange,
      searchable: true,
      show: true,
    },
    {
      key: 'owner',
      label: t('Owner'),
      options: ownerOptions,
      selectedValues: ownerFilter,
      onChange: onOwnerFilterChange,
      searchable: true,
      show: !embedState.isEmbedded,
    },
    {
      key: 'folder',
      label: t('Folder'),
      options: folderOptions,
      selectedValues: folderFilter,
      onChange: onFolderFilterChange,
      searchable: true,
      show: folderOptions.length > 0,
    },
  ];

  const allSelected = selectableCount > 0 && selectedCount === selectableCount;
  const someSelected = selectedCount > 0 && !allSelected;

  return (
    <div className="mb-3 flex flex-col gap-2">
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id={selectAllId}
            checked={
              allSelected ? true : someSelected ? 'indeterminate' : false
            }
            disabled={selectableCount === 0}
            onCheckedChange={onToggleAllSelection}
          />
          <Label
            htmlFor={selectAllId}
            className="cursor-pointer text-sm font-normal text-gray-11"
          >
            {t('Select all')}
          </Label>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1">
          <div className="relative w-60">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-10" />
            <Input
              placeholder={searchPlaceholder({
                hideTables: embedState.hideTables,
                agentsVisible,
              })}
              value={searchTerm}
              onChange={(e) => {
                onSearchChange(e.target.value);
                onFilterChange?.();
              }}
              className="h-8 rounded-sm pl-9 pr-8 text-ellipsis placeholder:text-gray-10 md:text-sm"
            />
            {searchTerm && (
              <button
                type="button"
                aria-label={t('Clear search')}
                onClick={() => {
                  onSearchChange('');
                  onFilterChange?.();
                }}
                className="absolute right-1.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full bg-gray-3 text-gray-11 transition-colors hover:bg-gray-4 hover:text-gray-12"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          <Select
            value={sort}
            onValueChange={(value) => onSortChange(parseAutomationsSort(value))}
          >
            <SelectTrigger size="sm" className="w-49" aria-label={t('Sort')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <AutomationsFilterPopover
            fields={filterFields.filter((field) => field.show)}
            filterCount={filterCount}
            onFilterChange={onFilterChange}
            onClearAll={clearAll}
          />
        </div>
      </div>

      {criteriaCount > 0 && (
        <div className="flex h-5 items-center justify-end gap-2 text-xs text-gray-10">
          <span>{t('filtersActiveCount', { count: criteriaCount })}</span>
          <span aria-hidden>·</span>
          <button
            type="button"
            onClick={clearAll}
            className="font-medium text-accent-9 hover:underline"
          >
            {t('Clear all')}
          </button>
        </div>
      )}
    </div>
  );
};

export const AutomationsFilterPopover = ({
  fields,
  filterCount,
  onFilterChange,
  onClearAll,
}: AutomationsFilterPopoverProps) => {
  const [open, setOpen] = useState(false);
  const idPrefix = useId();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              aria-label={t('Filters')}
              className="relative"
            >
              <Funnel className="size-4" />
              {filterCount > 0 && (
                <span
                  data-slot="filter-count"
                  className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-9 px-1 text-xss font-semibold leading-none text-on-accent"
                >
                  {filterCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{t('Filters')}</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-80 p-3">
        <div className="flex flex-col gap-3">
          {fields.map((field) => {
            const fieldId = `${idPrefix}-${field.key}`;
            return (
              <div key={field.key} className="flex flex-col gap-1">
                <Label
                  htmlFor={fieldId}
                  className="text-xs font-medium text-gray-11"
                >
                  {field.label}
                </Label>
                <MultiSelectFilter
                  id={fieldId}
                  variant="field"
                  label={field.label}
                  icon={null}
                  options={field.options}
                  selectedValues={field.selectedValues}
                  searchable={field.searchable}
                  onChange={(values) => {
                    field.onChange(values);
                    onFilterChange?.();
                  }}
                />
              </div>
            );
          })}
        </div>
        {filterCount > 0 && (
          <div className="mt-3 flex justify-end">
            <Button variant="link" className="h-auto" onClick={onClearAll}>
              {t('Clear all')}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

function searchPlaceholder({
  hideTables,
  agentsVisible,
}: {
  hideTables: boolean;
  agentsVisible: boolean;
}): string {
  if (hideTables) {
    return t('Search flows...');
  }
  return agentsVisible
    ? t('Search flows, tables and agents...')
    : t('Search flows and tables...');
}

type FilterField = {
  key: string;
  label: string;
  options: { value: string; label: string; icon?: React.ReactNode }[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  searchable: boolean;
  show: boolean;
};

type AutomationsFilterPopoverProps = {
  fields: FilterField[];
  filterCount: number;
  onFilterChange?: () => void;
  onClearAll: () => void;
};

type AutomationsFiltersProps = {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  typeFilter: string[];
  onTypeFilterChange: (value: string[]) => void;
  statusFilter: string[];
  onStatusFilterChange: (value: string[]) => void;
  connectionFilter: string[];
  onConnectionFilterChange: (value: string[]) => void;
  ownerFilter: string[];
  onOwnerFilterChange: (value: string[]) => void;
  folderFilter: string[];
  onFolderFilterChange: (value: string[]) => void;
  onFilterChange?: () => void;
  folders: FolderDto[];
  connections: AppConnectionWithoutSensitiveData[] | undefined;
  pieces: PieceMetadataModelSummary[] | undefined;
  agentsVisible: boolean;
  onClearAllFilters: () => void;
  sort: AutomationsSort;
  onSortChange: (sort: AutomationsSort) => void;
  selectedCount: number;
  selectableCount: number;
  onToggleAllSelection: () => void;
};
