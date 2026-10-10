import { FlowRunStatus, RunEnvironment } from '@activepieces/shared';
import { describe, expect, it } from 'vitest';

import { testRunUtils } from '@/app/builder/flow-canvas/widgets/test-run-utils';

describe('testRunUtils.getTestRunState', () => {
  it('is idle without a run', () => {
    expect(
      testRunUtils.getTestRunState({ run: null, isStartingTestRun: false }),
    ).toEqual({ isRunning: false, isCancellable: false });
  });

  it('is running while the test run is being started', () => {
    expect(
      testRunUtils.getTestRunState({ run: null, isStartingTestRun: true }),
    ).toEqual({ isRunning: true, isCancellable: false });
  });

  it.each([FlowRunStatus.QUEUED, FlowRunStatus.PAUSED])(
    'can stop a %s test run',
    (status) => {
      expect(
        testRunUtils.getTestRunState({
          run: { status, environment: RunEnvironment.TESTING },
          isStartingTestRun: false,
        }),
      ).toEqual({ isRunning: true, isCancellable: true });
    },
  );

  it('cannot stop a test run that is already running', () => {
    expect(
      testRunUtils.getTestRunState({
        run: {
          status: FlowRunStatus.RUNNING,
          environment: RunEnvironment.TESTING,
        },
        isStartingTestRun: false,
      }),
    ).toEqual({ isRunning: true, isCancellable: false });
  });

  it('is idle once the test run has finished', () => {
    expect(
      testRunUtils.getTestRunState({
        run: {
          status: FlowRunStatus.SUCCEEDED,
          environment: RunEnvironment.TESTING,
        },
        isStartingTestRun: false,
      }),
    ).toEqual({ isRunning: false, isCancellable: false });
  });

  it('ignores production runs opened in the builder', () => {
    expect(
      testRunUtils.getTestRunState({
        run: {
          status: FlowRunStatus.QUEUED,
          environment: RunEnvironment.PRODUCTION,
        },
        isStartingTestRun: false,
      }),
    ).toEqual({ isRunning: false, isCancellable: false });
  });
});
