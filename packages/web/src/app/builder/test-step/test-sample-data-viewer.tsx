import { isNil, tryParseFriendlyPieceError } from '@activepieces/core-utils';
import {
  AgentResult,
  AgentTaskStatus,
  FlowAction,
  FlowActionType,
  FlowTrigger,
} from '@activepieces/shared';
import { t } from 'i18next';
import { Loader2 } from 'lucide-react';
import React, { useMemo } from 'react';

import type { OutputSchema } from '@/components/custom/smart-output-viewer/types';
import { Button } from '@/components/ui/button';
import { formatUtils } from '@/lib/format-utils';

import { ErrorExplanationContext } from '../data-display/explanation-prompt';
import { FriendlyErrorView } from '../data-display/friendly-error-view';
import { friendlyTreeUtils } from '../data-selector/friendly-tree';
import { AiRouterRoutes } from '../run-details/ai-router-routes';
import {
  DataPane,
  DataPaneCountLine,
  DataPaneDataActions,
  DataPaneStatus,
  useIsPaneCompact,
} from '../step-modal/data-pane';
import { DataView } from '../step-modal/data-view';
import { schemaViewUtils } from '../step-modal/schema-view-utils';
import { useViewMode, ViewModeControl } from '../step-modal/view-mode-control';
import { viewModeUtils } from '../step-modal/view-mode-utils';

import { AgentTestStep, isRunAgent } from './agent-test-step';
import { JsonTreeSkeleton } from './json-tree-skeleton';

export const TestSampleDataViewer = React.memo(
  (props: TestSampleDataViewerProps) => {
    const {
      isTesting,
      sampleData,
      errorMessage,
      lastTestDate,
      currentStep,
      children,
      onCancelTesting,
      hideCancel,
      sampleDataInput,
      consoleLogs,
      explanationContext,
      pieceDisplayName,
      pieceSchema,
    } = props;
    const [viewMode, setViewMode] = useViewMode('output');
    const compact = useIsPaneCompact('output');
    const isFailed =
      !isNil(errorMessage) ||
      (isRunAgent(currentStep) &&
        getAgentResult(sampleData)?.status === AgentTaskStatus.FAILED);
    const outputData = errorMessage ?? sampleData;
    const showAgentView = isRunAgent(currentStep) && !errorMessage;
    const friendlyError =
      !isTesting && !showAgentView
        ? tryParseFriendlyPieceError(errorMessage)
        : null;
    const schemaNodes = useMemo(
      () =>
        schemaViewUtils.fromDataSelectorNodes({
          nodes: schemaViewUtils.rootChildren(
            friendlyTreeUtils.buildDataNode({
              stepName: currentStep?.name ?? 'output',
              displayName: t('Output'),
              data: outputData,
              schema: errorMessage ? null : pieceSchema ?? null,
            }),
          ),
        }),
      [outputData, pieceSchema, errorMessage, currentStep?.name],
    );
    const showData = !isTesting && !showAgentView;

    return (
      <DataPane
        title={t('Output')}
        testId="step-modal-output"
        titleAddon={
          !isTesting && (
            <DataPaneStatus
              status={isFailed ? 'failed' : 'success'}
              mode="test"
              detail={
                lastTestDate
                  ? formatUtils.formatDateWithTime(
                      new Date(lastTestDate),
                      false,
                    )
                  : null
              }
            />
          )
        }
        actions={
          showData && (
            <>
              <ViewModeControl
                value={viewMode}
                onChange={setViewMode}
                compact={compact}
              />
              <DataPaneDataActions
                data={outputData}
                fileName={`${currentStep?.name ?? 'output'}-output`}
              />
            </>
          )
        }
        subheader={
          showData && (
            <DataPaneCountLine count={viewModeUtils.getItemCount(outputData)} />
          )
        }
      >
        {isTesting ? (
          <div className="flex flex-col gap-3 px-3 py-2">
            <JsonTreeSkeleton />
            {!hideCancel && (
              <Button
                type="button"
                variant="outline"
                className="self-start"
                onClick={onCancelTesting}
              >
                <Loader2 className="animate-spin" />
                {t('Cancel Testing')}
              </Button>
            )}
          </div>
        ) : showAgentView ? (
          <div className="px-3 py-2">
            <AgentTestStep
              agentResult={getAgentResult(sampleData)}
              errorMessage={errorMessage}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-2 pb-3">
            {children}
            {friendlyError && (
              <div className="px-3 pt-2">
                <FriendlyErrorView
                  error={friendlyError}
                  explanationContext={explanationContext}
                  pieceDisplayName={pieceDisplayName}
                />
              </div>
            )}
            {!errorMessage &&
              currentStep?.type === FlowActionType.AI_ROUTER && (
                <div className="px-3 pt-2">
                  <AiRouterRoutes output={outputData} input={sampleDataInput} />
                </div>
              )}
            <DataView
              mode={viewMode}
              data={outputData}
              schemaNodes={schemaNodes}
              basePath={null}
            />
            {errorMessage && (
              <div className="px-3 text-xs text-gray-11">
                {t('Errors are not saved on refresh')}
              </div>
            )}
            {!isNil(consoleLogs) && consoleLogs !== '' && (
              <div className="flex flex-col gap-1 px-3 pt-2">
                <span className="text-xs font-semibold text-gray-11">
                  {t('Logs')}
                </span>
                <pre className="font-mono text-xs whitespace-pre-wrap break-all text-gray-12">
                  {consoleLogs}
                </pre>
              </div>
            )}
          </div>
        )}
      </DataPane>
    );
  },
);

TestSampleDataViewer.displayName = 'TestSampleDataViewer';

function getAgentResult(sampleData: unknown): AgentResult | undefined {
  return isAgentResult(sampleData) ? sampleData : undefined;
}

function isAgentResult(value: unknown): value is AgentResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    'steps' in value &&
    'prompt' in value
  );
}

type TestSampleDataViewerProps = {
  currentStep?: FlowAction | FlowTrigger;
  isTesting: boolean;
  sampleData?: unknown;
  sampleDataInput?: unknown | null;
  errorMessage: string | null;
  lastTestDate: string | undefined;
  children?: React.ReactNode;
  consoleLogs: string | null;
  explanationContext?: ErrorExplanationContext;
  pieceDisplayName?: string;
  pieceSchema?: OutputSchema | null;
} & (
  | {
      hideCancel: true;
      onCancelTesting?: undefined;
    }
  | {
      hideCancel?: false;
      onCancelTesting: () => void;
    }
);
