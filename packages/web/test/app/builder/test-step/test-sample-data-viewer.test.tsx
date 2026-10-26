/**
 * @vitest-environment jsdom
 */
import {
  AgentResult,
  AgentTaskStatus,
  ContentBlockType,
  FlowAction,
  FlowActionType,
} from '@activepieces/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('i18next', () => ({ t: (key: string) => key }));

vi.mock('@/app/builder/test-step/agent-test-step', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  AgentTestStep: ({ agentResult }: { agentResult?: AgentResult }) => (
    <div data-testid="agent-timeline">
      {agentResult?.steps.length ?? 0} steps, {agentResult?.status}
    </div>
  ),
}));

import { TestSampleDataViewer } from '@/app/builder/test-step/test-sample-data-viewer';

describe('TestSampleDataViewer while a step is being tested', () => {
  it("shows a Run Agent step's timeline as progress arrives, with the cancel button", () => {
    renderViewer({
      step: step({ actionName: 'run_agent' }),
      sampleData: {
        prompt: 'Tidy the repo',
        status: AgentTaskStatus.IN_PROGRESS,
        steps: [{ type: ContentBlockType.MARKDOWN, markdown: 'Reading files' }],
      },
    });

    const timeline = screen
      .getAllByTestId('agent-timeline')
      .map((element) => element.textContent);
    expect(timeline).toEqual([`1 steps, ${AgentTaskStatus.IN_PROGRESS}`]);
    expect(screen.getAllByText('Cancel Testing')).toHaveLength(1);
  });

  it('keeps other steps on the loading placeholder until the result is in', () => {
    renderViewer({
      step: step({ actionName: 'askAi' }),
      sampleData: { answer: 'partial' },
    });

    expect(screen.queryAllByTestId('agent-timeline')).toHaveLength(0);
    expect(screen.queryAllByText('partial')).toHaveLength(0);
    expect(screen.getAllByText('Cancel Testing')).toHaveLength(1);
  });
});

function renderViewer({
  step,
  sampleData,
}: {
  step: FlowAction;
  sampleData: unknown;
}) {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <TestSampleDataViewer
        currentStep={step}
        isTesting={true}
        sampleData={sampleData}
        errorMessage={null}
        lastTestDate={undefined}
        consoleLogs={null}
        onCancelTesting={() => undefined}
      />
    </QueryClientProvider>,
  );
}

function step({ actionName }: { actionName: string }): FlowAction {
  return {
    name: 'step_1',
    displayName: 'Step',
    valid: true,
    lastUpdatedDate: '2026-10-26T00:00:00.000Z',
    type: FlowActionType.PIECE,
    settings: {
      pieceName: '@activepieces/piece-ai',
      pieceVersion: '0.11.0',
      actionName,
      input: {},
      propertySettings: {},
    },
  };
}
