import { OpencodeCatalog } from '@activepieces/shared';
import { t } from 'i18next';
import { useMemo, useState } from 'react';
import { Control } from 'react-hook-form';

import {
  MultiSelect,
  MultiSelectContent,
  MultiSelectEmpty,
  MultiSelectItem,
  MultiSelectList,
  MultiSelectSearch,
  MultiSelectTrigger,
  MultiSelectValue,
} from '@/components/custom/multi-select';
import {
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { opencodeConnectionQueries } from '@/features/opencode';

import { OpencodeFormValues } from './opencode-form';

export function AllowlistField({ control, disabled }: AllowlistFieldProps) {
  const { data: catalog, isLoading } = opencodeConnectionQueries.useCatalog();
  const [search, setSearch] = useState('');

  return (
    <FormField
      control={control}
      name="allowlist"
      render={({ field }) => (
        <AllowlistSelect
          catalog={catalog}
          isLoading={isLoading}
          value={field.value}
          onChange={field.onChange}
          search={search}
          onSearch={setSearch}
          disabled={disabled}
        />
      )}
    />
  );
}

function AllowlistSelect({
  catalog,
  isLoading,
  value,
  onChange,
  search,
  onSearch,
  disabled,
}: AllowlistSelectProps) {
  const options = useMemo(
    () => toOptions({ catalog, selected: value }),
    [catalog, value],
  );
  const visible = options.filter((option) =>
    option.label.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <FormItem>
      <FormLabel>{t('Namespaces and projects')}</FormLabel>
      <MultiSelect
        modal={true}
        value={value}
        onValueChange={(next) => onChange(next)}
        items={options}
        onSearch={(keyword) => onSearch(keyword ?? '')}
        disabled={disabled || isLoading}
      >
        <MultiSelectTrigger>
          <MultiSelectValue placeholder={t('Choose namespaces or projects')} />
        </MultiSelectTrigger>
        <MultiSelectContent>
          <MultiSelectSearch
            placeholder={t('Search namespaces and projects')}
          />
          <MultiSelectList>
            {visible.map((option) => (
              <MultiSelectItem key={option.value} value={option.value}>
                <span className="truncate min-w-0">{option.label}</span>
              </MultiSelectItem>
            ))}
            {visible.length === 0 && (
              <MultiSelectEmpty>{t('No results found.')}</MultiSelectEmpty>
            )}
          </MultiSelectList>
        </MultiSelectContent>
      </MultiSelect>
      <FormDescription>
        {catalog?.error
          ? t('Could not load namespaces from OpenCode: {reason}', {
              reason: catalog.error,
            })
          : t(
              'Only these OpenCode namespaces and projects appear anywhere in the app. A whole namespace includes its projects.',
            )}
      </FormDescription>
      <FormMessage />
    </FormItem>
  );
}

function toOptions({
  catalog,
  selected,
}: {
  catalog: OpencodeCatalog | undefined;
  selected: string[];
}): AllowlistOption[] {
  const fromCatalog = (catalog?.namespaces ?? []).flatMap((namespace) => [
    {
      value: namespace.id,
      label: t('{namespace} (whole namespace)', {
        namespace: namespace.name,
      }),
    },
    ...namespace.projects.map((project) => ({
      value: `${namespace.id}/${project.id}`,
      label: `${namespace.name} / ${project.name}`,
    })),
  ]);
  const known = new Set(fromCatalog.map((option) => option.value));
  const unknown = selected
    .filter((entry) => !known.has(entry))
    .map((entry) => ({ value: entry, label: entry }));
  return [...fromCatalog, ...unknown];
}

type AllowlistOption = {
  value: string;
  label: string;
};

type AllowlistFieldProps = {
  control: Control<OpencodeFormValues>;
  disabled: boolean;
};

type AllowlistSelectProps = {
  catalog: OpencodeCatalog | undefined;
  isLoading: boolean;
  value: string[];
  onChange: (value: string[]) => void;
  search: string;
  onSearch: (value: string) => void;
  disabled: boolean;
};
