import { t } from 'i18next';
import { Braces, ListTree, LucideIcon, Table2 } from 'lucide-react';
import { useCallback, useState } from 'react';

import { SegmentedControl } from '@/components/ui/segmented-control';

import { DataPaneKind, ViewMode, viewModeUtils } from './view-mode-utils';

const ViewModeControl = ({
  value,
  onChange,
  compact,
}: ViewModeControlProps) => (
  <SegmentedControl
    aria-label={t('View')}
    size={compact ? 'sm' : 'default'}
    value={value}
    onValueChange={(next) => {
      if (viewModeUtils.isViewMode(next)) {
        onChange(next);
      }
    }}
    items={VIEW_MODE_OPTIONS.map(({ value: mode, getLabel, Icon }) => ({
      value: mode,
      label: getLabel(),
      icon: compact ? <Icon className="size-3.5" /> : undefined,
      iconOnly: compact,
      tooltip: compact ? getLabel() : undefined,
    }))}
  />
);

function useViewMode(pane: DataPaneKind): [ViewMode, (mode: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>(() =>
    viewModeUtils.readViewMode({ pane }),
  );
  const changeMode = useCallback(
    (next: ViewMode) => {
      setMode(next);
      viewModeUtils.saveViewMode({ pane, mode: next });
    },
    [pane],
  );
  return [mode, changeMode];
}

const VIEW_MODE_OPTIONS: ViewModeOption[] = [
  { value: 'schema', getLabel: () => t('Schema'), Icon: ListTree },
  { value: 'table', getLabel: () => t('Table'), Icon: Table2 },
  { value: 'json', getLabel: () => t('JSON'), Icon: Braces },
];

export { ViewModeControl, useViewMode };

type ViewModeControlProps = {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  compact: boolean;
};

type ViewModeOption = {
  value: ViewMode;
  getLabel: () => string;
  Icon: LucideIcon;
};
