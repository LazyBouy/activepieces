// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { DataSelectorTreeNode } from '@/app/builder/data-selector/type';
import { loopIterationUtils } from '@/app/builder/run-details/loop-iteration-input';
import { neighbourUtils } from '@/app/builder/step-modal/neighbour-chips';
import { schemaViewUtils } from '@/app/builder/step-modal/schema-view-utils';

import { code, pieceTrigger, router } from '../state/builder-store-fixtures';

describe('neighbourUtils.getNeighbours', () => {
  it('returns the previous step and every branch start of a router', () => {
    const trigger = pieceTrigger(
      code({
        name: 'step_1',
        next: router({
          name: 'step_2',
          branches: [code({ name: 'step_3' }), null],
          next: code({ name: 'step_4' }),
        }),
      }),
    );
    const neighbours = neighbourUtils.getNeighbours({
      trigger,
      stepName: 'step_2',
    });
    expect(neighbours.previous.map((step) => step.name)).toEqual(['step_1']);
    expect(neighbours.next.map((step) => step.name)).toEqual([
      'step_3',
      'step_4',
    ]);
  });

  it('has no previous step for the trigger', () => {
    const trigger = pieceTrigger(code({ name: 'step_1' }));
    const neighbours = neighbourUtils.getNeighbours({
      trigger,
      stepName: 'trigger',
    });
    expect(neighbours.previous).toEqual([]);
    expect(neighbours.next.map((step) => step.name)).toEqual(['step_1']);
  });
});

describe('loopIterationUtils.findIterationLoop', () => {
  it('finds no loop for a step outside any loop', () => {
    const trigger = pieceTrigger(code({ name: 'step_1' }));
    expect(
      loopIterationUtils.findIterationLoop({ stepName: 'step_1', trigger }),
    ).toBeNull();
  });
});

describe('schemaViewUtils', () => {
  const nodes: DataSelectorTreeNode[] = [
    {
      key: "step_1['output']['user']",
      data: {
        type: 'value',
        value: { name: 'Ada' },
        displayName: 'user',
        propertyPath: "step_1['output']['user']",
        insertable: true,
      },
      children: [
        {
          key: "step_1['output']['user']['name']",
          data: {
            type: 'value',
            value: 'Ada',
            displayName: 'name',
            propertyPath: "step_1['output']['user']['name']",
            insertable: true,
          },
        },
      ],
    },
    {
      key: 'step_1_on_failure',
      data: {
        type: 'chunk',
        displayName: 'On failure',
        displayNameClassName: 'text-danger-11',
      },
    },
    {
      key: 'test_step_1',
      data: { type: 'test', stepName: 'step_1', parentDisplayName: '2. Code' },
    },
  ];

  it('keeps the data selector paths and drops test placeholders', () => {
    const schemaNodes = schemaViewUtils.fromDataSelectorNodes({ nodes });
    expect(schemaNodes).toHaveLength(2);
    expect(schemaNodes[0].path).toBe("step_1['output']['user']");
    expect(schemaNodes[0].children[0].path).toBe(
      "step_1['output']['user']['name']",
    );
    expect(schemaNodes[1]).toMatchObject({
      kind: 'group',
      tone: 'danger',
      path: null,
    });
  });

  it('expands the first level by default and honours overrides', () => {
    const schemaNodes = schemaViewUtils.fromDataSelectorNodes({ nodes });
    const rows = schemaViewUtils.flattenRows({
      nodes: schemaNodes,
      overrides: new Map(),
      defaultExpandedDepth: 1,
    });
    expect(rows.map((row) => row.node.label)).toEqual([
      'user',
      'name',
      'On failure',
    ]);
    const collapsed = schemaViewUtils.flattenRows({
      nodes: schemaNodes,
      overrides: new Map([[schemaNodes[0].id, false]]),
      defaultExpandedDepth: 1,
    });
    expect(collapsed.map((row) => row.node.label)).toEqual([
      'user',
      'On failure',
    ]);
  });
});
