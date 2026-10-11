import { FlowRun } from '@activepieces/shared';
import { t } from 'i18next';

import { cn } from '@/lib/utils';

import { useBuilderStateContext } from '../builder-hooks';

import { useRunStatusSummary } from './logs-run-status';
import { LogsToggleButton } from './logs-toggle-button';

const LogsPanelBar = () => {
  const [run, setLogsPanelOpen] = useBuilderStateContext((state) => [
    state.run,
    state.setLogsPanelOpen,
  ]);
  return (
    <div
      data-logs-bar
      className="flex h-full min-w-0 cursor-pointer items-center gap-3 bg-canvas-logs pr-1.5 pl-2"
      onClick={() => setLogsPanelOpen(true)}
    >
      <span className="shrink-0 text-xs font-semibold text-gray-12">
        {t('Logs')}
      </span>
      {run && <LogsBarRunStatus run={run} />}
      <LogsToggleButton className="ml-auto" />
    </div>
  );
};

const LogsBarRunStatus = ({ run }: { run: FlowRun }) => {
  const { text, duration, Icon, iconClassName } = useRunStatusSummary(run);
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-xs text-gray-11">
      <Icon className={cn('size-3.5 shrink-0', iconClassName)} />
      <span className="truncate">{text}</span>
      {duration && <span className="shrink-0">· {duration}</span>}
    </span>
  );
};

LogsPanelBar.displayName = 'LogsPanelBar';
export { LogsPanelBar };
