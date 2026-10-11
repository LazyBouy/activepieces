import { isNil } from '@activepieces/core-utils';
import { t } from 'i18next';
import { CircleCheck, CircleX, Copy, Download, Info } from 'lucide-react';
import React, { createContext, useContext } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { downloadFile } from '@/lib/dom-utils';
import { cn } from '@/lib/utils';

import { viewModeUtils } from './view-mode-utils';

const PaneWidthContext = createContext<PaneWidths>({
  input: null,
  output: null,
});

const DataPane = ({
  title,
  titleAddon,
  actions,
  subheader,
  children,
  testId,
}: DataPaneProps) => (
  <section
    data-testid={testId}
    aria-label={title}
    className="flex size-full min-w-0 flex-col bg-canvas-data-pane"
  >
    <div className="flex h-10.5 shrink-0 items-center gap-2 border-b border-gray-6 pr-1 pl-4">
      <h3 className="shrink-0 text-xsm font-semibold tracking-widest text-gray-11 uppercase">
        {title}
      </h3>
      {titleAddon}
      <div className="ml-auto flex shrink-0 items-center gap-1">{actions}</div>
    </div>
    {subheader}
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="h-full min-w-70">{children}</div>
    </div>
  </section>
);

const DataPaneCountLine = ({ count }: { count: number | null }) => {
  if (isNil(count)) {
    return null;
  }
  return (
    <div className="shrink-0 px-3 py-2 text-xs text-gray-11">
      {t('{count, plural, =1 {1 item} other {# items}}', { count })}
    </div>
  );
};

const DataPaneStatus = ({ status, detail, mode }: DataPaneStatusProps) => {
  const label =
    status === 'success'
      ? mode === 'run'
        ? t('Success')
        : t('Tested Successfully')
      : mode === 'run'
      ? t('Failed')
      : t('Test Failed');
  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="img"
            aria-label={label}
            data-output-status={status}
            className="flex size-5 items-center justify-center"
          >
            {status === 'success' ? (
              <CircleCheck className="size-4 text-success-9" />
            ) : (
              <CircleX className="size-4 text-danger-9" />
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
      {detail && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              role="img"
              aria-label={detail}
              className="flex size-5 items-center justify-center"
            >
              <Info className="size-4 text-gray-11" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">{detail}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
};

const DataPaneDataActions = ({ data, fileName }: DataPaneDataActionsProps) => {
  if (data === undefined) {
    return null;
  }
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return (
    <>
      <DataPaneIconButton
        label={t('Copy to clipboard')}
        onClick={() => {
          navigator.clipboard.writeText(text);
          toast.success(t('Copied to clipboard'), { duration: 1000 });
        }}
      >
        <Copy className="size-4" />
      </DataPaneIconButton>
      <DataPaneIconButton
        label={t('Download JSON')}
        onClick={() =>
          downloadFile({
            obj: text,
            fileName,
            extension: typeof data === 'string' ? 'txt' : 'json',
          })
        }
      >
        <Download className="size-4" />
      </DataPaneIconButton>
    </>
  );
};

const DataPaneIconButton = ({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={label}
        onClick={onClick}
      >
        {children}
      </Button>
    </TooltipTrigger>
    <TooltipContent side="bottom">{label}</TooltipContent>
  </Tooltip>
);

const DataPaneMessage = ({
  title,
  description,
  icon,
  action,
  className,
}: DataPaneMessageProps) => (
  <div
    className={cn(
      'flex h-full min-h-40 items-center justify-center px-4 py-8',
      className,
    )}
  >
    <div className="flex max-w-70 flex-col items-center text-center">
      {icon}
      <span
        className={cn('text-base font-semibold text-gray-12', {
          'mt-4': !isNil(icon),
        })}
      >
        {title}
      </span>
      {description && (
        <span className="mt-2 text-xsm text-gray-11">{description}</span>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  </div>
);

function useIsPaneCompact(pane: keyof PaneWidths): boolean {
  const widths = useContext(PaneWidthContext);
  const width = widths[pane];
  return !isNil(width) && width > 0 && width < viewModeUtils.COMPACT_PANE_WIDTH;
}

export {
  DataPane,
  DataPaneCountLine,
  DataPaneStatus,
  DataPaneDataActions,
  DataPaneMessage,
  PaneWidthContext,
  useIsPaneCompact,
};

export type PaneWidths = {
  input: number | null;
  output: number | null;
};

type DataPaneProps = {
  title: string;
  titleAddon?: React.ReactNode;
  actions?: React.ReactNode;
  subheader?: React.ReactNode;
  children: React.ReactNode;
  testId?: string;
};

type DataPaneStatusProps = {
  status: 'success' | 'failed';
  detail?: string | null;
  mode: 'test' | 'run';
};

type DataPaneDataActionsProps = {
  data: unknown;
  fileName: string;
};

type DataPaneMessageProps = {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
};
