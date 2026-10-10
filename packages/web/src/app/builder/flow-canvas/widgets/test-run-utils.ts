import { isNil } from '@activepieces/core-utils';
import {
  FlowRun,
  FlowRunStatus,
  isFlowRunStateTerminal,
  RunEnvironment,
} from '@activepieces/shared';

function getTestRunState({
  run,
  isStartingTestRun,
}: {
  run: Pick<FlowRun, 'status' | 'environment'> | null;
  isStartingTestRun: boolean;
}): TestRunState {
  const isTestRunInProgress =
    !isNil(run) &&
    run.environment === RunEnvironment.TESTING &&
    !isFlowRunStateTerminal({ status: run.status, ignoreInternalError: false });
  return {
    isRunning: isStartingTestRun || isTestRunInProgress,
    isCancellable:
      !isNil(run) &&
      isTestRunInProgress &&
      CANCELLABLE_STATUSES.includes(run.status),
  };
}

const CANCELLABLE_STATUSES: FlowRunStatus[] = [
  FlowRunStatus.QUEUED,
  FlowRunStatus.PAUSED,
];

export const testRunUtils = {
  getTestRunState,
};

type TestRunState = {
  isRunning: boolean;
  isCancellable: boolean;
};
