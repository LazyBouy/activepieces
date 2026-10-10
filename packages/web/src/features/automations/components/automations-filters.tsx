import { PieceMetadataModelSummary } from '@activepieces/pieces-framework';
import {
  AppConnectionWithoutSensitiveData,
  FlowStatus,
  FolderDto,
} from '@activepieces/shared';
import { t } from 'i18next';
import {
  Filter,
  FolderIcon,
  Link2,
  Search,
  ToggleLeft,
  User,
  X,
} from 'lucide-react';

import { LogoPlate } from '@/components/custom/logo-plate';
import { useEmbedding } from '@/components/providers/embed-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useOwnerOptions } from '@/features/automations/hooks/use-owner-options';
import { formatUtils } from '@/lib/format-utils';
import { cn, DASHBOARD_CONTENT_PADDING_X } from '@/lib/utils';

import { MultiSelectFilter } from './multi-select-filter';

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
  hasActiveFilters: boolean;
};

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
  hasActiveFilters,
}: AutomationsFiltersProps) => {
  const { embedState } = useEmbedding();
  const ownerOptions = useOwnerOptions();
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

  return (
    <div className={cn('overflow-x-auto mb-4', DASHBOARD_CONTENT_PADDING_X)}>
      <div className="flex items-center justify-between gap-4 min-w-max">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-11" />
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
              className="min-w-[300px] max-w-xs pl-8 pr-8 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            {searchTerm && (
              <button
                onClick={() => {
                  onSearchChange('');
                  onFilterChange?.();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center h-5 w-5 rounded-full bg-gray-3 hover:bg-gray-4 text-gray-11 hover:text-gray-12 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <MultiSelectFilter
            label={t('Type')}
            icon={<Filter className="h-4 w-4" />}
            options={typeOptions}
            selectedValues={typeFilter}
            onChange={(values) => {
              onTypeFilterChange(values);
              onFilterChange?.();
            }}
          />

          <MultiSelectFilter
            label={t('Status')}
            icon={<ToggleLeft className="h-4 w-4" />}
            options={statusOptions}
            selectedValues={statusFilter}
            onChange={(values) => {
              onStatusFilterChange(values);
              onFilterChange?.();
            }}
          />

          <MultiSelectFilter
            label={t('Connections')}
            icon={<Link2 className="h-4 w-4" />}
            options={connectionOptions}
            selectedValues={connectionFilter}
            onChange={(values) => {
              onConnectionFilterChange(values);
              onFilterChange?.();
            }}
            searchable
          />

          {!embedState.isEmbedded && (
            <MultiSelectFilter
              label={t('Owner')}
              icon={<User className="h-4 w-4" />}
              options={ownerOptions}
              selectedValues={ownerFilter}
              onChange={(values) => {
                onOwnerFilterChange(values);
                onFilterChange?.();
              }}
              searchable
            />
          )}

          {folderOptions.length > 0 && (
            <MultiSelectFilter
              label={t('Folder')}
              icon={<FolderIcon className="h-4 w-4" />}
              options={folderOptions}
              selectedValues={folderFilter}
              onChange={(values) => {
                onFolderFilterChange(values);
                onFilterChange?.();
              }}
              searchable
            />
          )}

          {hasActiveFilters && (
            <Button
              variant="link"
              size="sm"
              className="h-9 text-sm gap-1 text-gray-11 hover:text-gray-12"
              onClick={() => {
                onClearAllFilters();
                onFilterChange?.();
              }}
            >
              <X className="h-3.5 w-3.5" />
              {t('Clear all')}
            </Button>
          )}
        </div>
      </div>
    </div>
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
