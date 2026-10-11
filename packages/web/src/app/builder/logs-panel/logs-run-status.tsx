import { isNil } from '@activepieces/core-utils';
import {
  ApFlagId,
  FlowRun,
  FlowRunStatus,
  isFailedState,
  isFlowRunStateTerminal,
} from '@activepieces/shared';
import { t } from 'i18next';
import { LucideIcon } from 'lucide-react';

import { StatusVariant } from '@/components/custom/status-icon-with-text';
import { flowRunUtils } from '@/features/flow-runs';
import { flagsHooks } from '@/hooks/flags-hooks';
import { formatUtils } from '@/lib/format-utils';

export function useRunStatusSummary(run: FlowRun): RunStatusSummary {
  const { data: timeoutSeconds } = flagsHooks.useFlag<number>(
    ApFlagId.FLOW_RUN_TIME_SECONDS,
  );
  const { data: memoryLimit } = flagsHooks.useFlag<number>(
    ApFlagId.FLOW_RUN_MEMORY_LIMIT_KB,
  );
  const { data: logSizeLimit } = flagsHooks.useFlag<number>(
    ApFlagId.FLOW_RUN_LOG_SIZE_LIMIT_MB,
  );
  const { Icon, variant } = flowRunUtils.getStatusIcon(run.status);
  const isTerminal = isFlowRunStateTerminal({
    status: run.status,
    ignoreInternalError: false,
  });
  return {
    text: getRunStatusText({
      status: run.status,
      timeout: timeoutSeconds ?? -1,
      memoryLimit: memoryLimit ?? -1,
      logSizeLimit: logSizeLimit ?? -1,
    }),
    isFailure:
      isFailedState(run.status) ||
      run.status === FlowRunStatus.LOG_SIZE_EXCEEDED,
    isTerminal,
    duration: isTerminal ? getRunDuration(run) : null,
    Icon,
    iconClassName: STATUS_ICON_CLASS_NAME[variant],
  };
}

function getRunDuration(run: FlowRun): string | null {
  if (isNil(run.startTime) || isNil(run.finishTime)) {
    return null;
  }
  return formatUtils.formatDuration(
    new Date(run.finishTime).getTime() - new Date(run.startTime).getTime(),
    true,
  );
}

function getRunStatusText({
  status,
  timeout,
  memoryLimit,
  logSizeLimit,
}: {
  status: FlowRunStatus;
  timeout: number;
  memoryLimit: number;
  logSizeLimit: number;
}): string {
  switch (status) {
    case FlowRunStatus.SUCCEEDED:
      return t('Run Succeeded');
    case FlowRunStatus.FAILED:
      return t('Run Failed');
    case FlowRunStatus.PAUSED:
      return t('Run Paused');
    case FlowRunStatus.QUOTA_EXCEEDED:
      return t(
        'This run stopped because your platform ran out of credits. It can be retried once credits are available.',
      );
    case FlowRunStatus.LOG_SIZE_EXCEEDED:
      return t(
        'Run failed due to output of steps exceeding the log size limit of {logSizeLimit} MB',
        { logSizeLimit },
      );
    case FlowRunStatus.MEMORY_LIMIT_EXCEEDED:
      return t(
        'Run failed due to exceeding the memory limit of {memoryLimit} MB',
        {
          memoryLimit: Math.floor(memoryLimit / 1024),
        },
      );
    case FlowRunStatus.QUEUED:
      return t('Queued');
    case FlowRunStatus.RUNNING:
      return t('Running');
    case FlowRunStatus.TIMEOUT:
      return t('Run exceeded {timeout} seconds, try to optimize your steps.', {
        timeout,
      });
    case FlowRunStatus.INTERNAL_ERROR:
      return t('Run failed with an internal error, contact support.');
    case FlowRunStatus.CANCELED:
      return t('Run Cancelled');
  }
}

const STATUS_ICON_CLASS_NAME: Record<StatusVariant, string> = {
  success: 'text-success-11',
  error: 'text-danger-11',
  warning: 'text-warning-11',
  primary: 'text-accent-11',
  neutral: 'text-gray-11',
  default: 'text-gray-11',
  secondary: 'text-gray-11',
};

export type RunStatusSummary = {
  text: string;
  isFailure: boolean;
  isTerminal: boolean;
  duration: string | null;
  Icon: LucideIcon;
  iconClassName: string;
};
