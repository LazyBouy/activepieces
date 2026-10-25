import {
  BranchExecutionType,
  CodeAction,
  FlowAction,
  FlowActionType,
  FlowOperationRequest,
  FlowOperationStatus,
  FlowStatus,
  FlowTrigger,
  FlowTriggerType,
  FlowVersionState,
  PopulatedFlow,
  RouterAction,
  RouterExecutionType,
  StepPositions,
} from '@activepieces/shared';
import { QueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { Mock } from 'vitest';

import { BuilderStore, createBuilderStore } from '@/app/builder/builder-hooks';

export function createTestBuilderStore({
  trigger,
  stepPositions = {},
  readonly = false,
}: {
  trigger: FlowTrigger;
  stepPositions?: StepPositions;
  readonly?: boolean;
}): BuilderStore {
  const flow = buildFlow({ trigger, stepPositions });
  return createBuilderStore({
    flow,
    flowVersion: flow.version,
    readonly,
    hideTestWidget: false,
    run: null,
    outputSampleData: {},
    inputSampleData: {},
    socket: io('http://localhost', { autoConnect: false }),
    queryClient: new QueryClient(),
  });
}

export function sentOperations(update: Mock): FlowOperationRequest[] {
  return update.mock.calls.map((call) => call[1]);
}

export async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

export function code({
  name,
  next,
}: {
  name: string;
  next?: FlowAction;
}): CodeAction {
  return {
    name,
    valid: true,
    displayName: name,
    lastUpdatedDate: NOW,
    type: FlowActionType.CODE,
    settings: {
      sourceCode: {
        code: 'export const code = async () => true;',
        packageJson: '{}',
      },
      input: {},
      errorHandlingOptions: {
        continueOnFailure: { value: false },
        retryOnFailure: { value: false },
      },
    },
    nextAction: next,
  };
}

export function router({
  name,
  branches,
  next,
}: {
  name: string;
  branches: (FlowAction | null)[];
  next?: FlowAction;
}): RouterAction {
  return {
    name,
    valid: true,
    displayName: name,
    lastUpdatedDate: NOW,
    type: FlowActionType.ROUTER,
    settings: {
      executionType: RouterExecutionType.EXECUTE_FIRST_MATCH,
      branches: branches.map((_, index) =>
        index === branches.length - 1
          ? {
              branchType: BranchExecutionType.FALLBACK,
              branchName: 'Otherwise',
            }
          : {
              branchType: BranchExecutionType.CONDITION,
              branchName: `Branch ${index + 1}`,
              conditions: [[]],
            },
      ),
    },
    children: branches,
    nextAction: next,
  };
}

export function pieceTrigger(nextAction?: FlowAction): FlowTrigger {
  return {
    name: 'trigger',
    valid: true,
    displayName: 'Catch Webhook',
    type: FlowTriggerType.PIECE,
    settings: {
      pieceName: '@activepieces/piece-webhook',
      pieceVersion: '0.1.42',
      triggerName: 'catch_webhook',
      input: {},
      propertySettings: {},
    },
    lastUpdatedDate: NOW,
    nextAction,
  };
}

function buildFlow({
  trigger,
  stepPositions,
}: {
  trigger: FlowTrigger;
  stepPositions: StepPositions;
}): PopulatedFlow {
  return {
    id: 'flow-1',
    created: NOW,
    updated: NOW,
    projectId: 'project-1',
    externalId: 'flow-1',
    ownerId: null,
    folderId: null,
    status: FlowStatus.DISABLED,
    publishedVersionId: null,
    metadata: null,
    operationStatus: FlowOperationStatus.NONE,
    timeSavedPerRun: null,
    templateId: null,
    createdBy: null,
    version: {
      id: 'version-1',
      created: NOW,
      updated: NOW,
      flowId: 'flow-1',
      displayName: 'Test flow',
      updatedBy: null,
      valid: true,
      schemaVersion: null,
      agentIds: [],
      state: FlowVersionState.DRAFT,
      connectionIds: [],
      backupFiles: null,
      notes: [],
      stepPositions,
      opencodeDefaults: {},
      trigger,
    },
  };
}

export const SERVER_VERSION = {
  id: 'version-1',
  state: FlowVersionState.DRAFT,
};

const NOW = '2026-01-01T00:00:00.000Z';
