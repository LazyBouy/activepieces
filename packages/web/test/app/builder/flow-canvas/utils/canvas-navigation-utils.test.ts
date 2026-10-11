// @vitest-environment jsdom
import {
  CodeAction,
  FlowAction,
  FlowActionType,
  LoopOnItemsAction,
} from '@activepieces/shared';
import { describe, expect, it } from 'vitest';

import {
  CanvasNavigationDirection,
  canvasNavigationUtils,
} from '@/app/builder/flow-canvas/utils/canvas-navigation-utils';

import { code, pieceTrigger, router } from '../../state/builder-store-fixtures';

describe('canvasNavigationUtils.getNeighbourStep on a router', () => {
  const trigger = pieceTrigger(
    code({
      name: 'step_1',
      next: router({
        name: 'step_2',
        branches: [
          code({ name: 'step_3', next: code({ name: 'step_4' }) }),
          null,
          code({ name: 'step_5' }),
        ],
        next: code({ name: 'step_6' }),
      }),
    }),
  );
  const move = (stepName: string, direction: CanvasNavigationDirection) =>
    canvasNavigationUtils.getNeighbourStep({ trigger, stepName, direction });

  it('follows the chain left and right', () => {
    expect(move('trigger', 'right')).toBe('step_1');
    expect(move('step_1', 'right')).toBe('step_2');
    expect(move('step_1', 'left')).toBe('trigger');
    expect(move('trigger', 'left')).toBeNull();
  });

  it('enters the first branch and leaves a branch through the join', () => {
    expect(move('step_2', 'right')).toBe('step_3');
    expect(move('step_3', 'left')).toBe('step_2');
    expect(move('step_4', 'right')).toBe('step_6');
    expect(move('step_6', 'left')).toBe('step_2');
    expect(move('step_6', 'right')).toBeNull();
  });

  it('moves between branches up and down, skipping empty ones and keeping depth', () => {
    expect(move('step_3', 'down')).toBe('step_5');
    expect(move('step_5', 'up')).toBe('step_3');
    expect(move('step_4', 'down')).toBe('step_5');
    expect(move('step_3', 'up')).toBeNull();
    expect(move('step_1', 'down')).toBeNull();
  });
});

describe('canvasNavigationUtils.getNeighbourStep on a loop', () => {
  const trigger = pieceTrigger(
    loop({
      name: 'step_1',
      body: code({ name: 'step_2', next: code({ name: 'step_3' }) }),
      next: code({ name: 'step_4', next: code({ name: 'step_5' }) }),
    }),
  );
  const move = (stepName: string, direction: CanvasNavigationDirection) =>
    canvasNavigationUtils.getNeighbourStep({ trigger, stepName, direction });

  it('continues past the loop to the right and starts the body below', () => {
    expect(move('step_1', 'right')).toBe('step_4');
    expect(move('step_4', 'down')).toBe('step_2');
    expect(move('step_5', 'down')).toBe('step_3');
    expect(move('step_2', 'up')).toBe('step_4');
  });

  it('goes back to the loop from the body and stops at the end of the body', () => {
    expect(move('step_2', 'left')).toBe('step_1');
    expect(move('step_3', 'right')).toBeNull();
  });

  it('enters the body when nothing follows the loop', () => {
    const lonelyLoop = pieceTrigger(
      loop({ name: 'step_1', body: code({ name: 'step_2' }) }),
    );
    expect(
      canvasNavigationUtils.getNeighbourStep({
        trigger: lonelyLoop,
        stepName: 'step_1',
        direction: 'right',
      }),
    ).toBe('step_2');
  });
});

describe('canvasNavigationUtils.getNeighbourStep with continue on failure', () => {
  it('treats the success and failure branches as siblings', () => {
    const trigger = pieceTrigger(
      continueOnFailure({
        name: 'step_1',
        onSuccess: code({ name: 'step_2' }),
        onFailure: code({ name: 'step_3' }),
        next: code({ name: 'step_4' }),
      }),
    );
    const move = (stepName: string, direction: CanvasNavigationDirection) =>
      canvasNavigationUtils.getNeighbourStep({ trigger, stepName, direction });

    expect(move('step_1', 'right')).toBe('step_2');
    expect(move('step_2', 'down')).toBe('step_3');
    expect(move('step_3', 'up')).toBe('step_2');
    expect(move('step_3', 'right')).toBe('step_4');
  });
});

function loop({
  name,
  body,
  next,
}: {
  name: string;
  body?: FlowAction;
  next?: FlowAction;
}): LoopOnItemsAction {
  return {
    name,
    valid: true,
    displayName: name,
    lastUpdatedDate: '2026-01-01T00:00:00.000Z',
    type: FlowActionType.LOOP_ON_ITEMS,
    settings: { items: '{{trigger}}' },
    firstLoopAction: body,
    nextAction: next,
  };
}

function continueOnFailure({
  name,
  onSuccess,
  onFailure,
  next,
}: {
  name: string;
  onSuccess: FlowAction;
  onFailure: FlowAction;
  next?: FlowAction;
}): CodeAction {
  const base = code({ name, next });
  return {
    ...base,
    settings: {
      ...base.settings,
      errorHandlingOptions: {
        continueOnFailure: { value: true },
        retryOnFailure: { value: false },
      },
    },
    continueOnFailureBranches: { onSuccess, onFailure },
  };
}
