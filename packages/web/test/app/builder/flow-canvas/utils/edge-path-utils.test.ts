import { describe, expect, it } from 'vitest';

import { edgePathUtils } from '@/app/builder/flow-canvas/utils/edge-path-utils';

describe('edgePathUtils.isBackEdge', () => {
  it('treats a target up to 20px left of the source as a forward edge', () => {
    expect(edgePathUtils.isBackEdge({ sourceX: 500, targetX: 600 })).toBe(
      false,
    );
    expect(edgePathUtils.isBackEdge({ sourceX: 500, targetX: 500 })).toBe(
      false,
    );
    expect(edgePathUtils.isBackEdge({ sourceX: 500, targetX: 480 })).toBe(
      false,
    );
  });

  it('treats a target more than 20px left of the source as a back-edge', () => {
    expect(edgePathUtils.isBackEdge({ sourceX: 500, targetX: 479 })).toBe(true);
    expect(edgePathUtils.isBackEdge({ sourceX: 728, targetX: 392 })).toBe(true);
  });
});

describe('edgePathUtils.buildBackEdgePath', () => {
  const endpoints = { sourceX: 728, sourceY: 432, targetX: 392, targetY: 288 };

  it('drops 130px below the lower endpoint with 40px clearance and 16px corners', () => {
    const backEdge = edgePathUtils.buildBackEdgePath(endpoints);

    expect(backEdge.path).toBe(
      [
        'M 728 432',
        'H 752',
        'A 16 16 0 0 1 768 448',
        'V 546',
        'A 16 16 0 0 1 752 562',
        'H 560',
        'H 368',
        'A 16 16 0 0 1 352 546',
        'V 304',
        'A 16 16 0 0 1 368 288',
        'H 392',
      ].join(' '),
    );
  });

  it('anchors the label and toolbar at the middle of the bottom line', () => {
    const backEdge = edgePathUtils.buildBackEdgePath(endpoints);

    expect({ x: backEdge.labelX, y: backEdge.labelY }).toEqual({
      x: 560,
      y: 562,
    });
  });

  it('splits the route at the bottom midpoint so both halves end in an arrowhead', () => {
    const backEdge = edgePathUtils.buildBackEdgePath(endpoints);

    expect(backEdge.firstHalf.startsWith('M 728 432')).toBe(true);
    expect(backEdge.firstHalf.endsWith('H 560')).toBe(true);
    expect(backEdge.secondHalf.startsWith('M 560 562')).toBe(true);
    expect(backEdge.secondHalf.endsWith('H 392')).toBe(true);
  });

  it('uses the higher of the two endpoints when the target sits lower', () => {
    const backEdge = edgePathUtils.buildBackEdgePath({
      sourceX: 600,
      sourceY: 100,
      targetX: 200,
      targetY: 300,
    });

    expect(backEdge.labelY).toBe(430);
    expect(backEdge.path).toContain('V 414');
  });
});

describe('edgePathUtils.buildEdgeGeometry', () => {
  it('draws a single bezier forward edge leaving right and entering left', () => {
    const geometry = edgePathUtils.buildEdgeGeometry({
      sourceX: 280,
      sourceY: 288,
      targetX: 392,
      targetY: 192,
    });

    expect(geometry.isBackEdge).toBe(false);
    expect(geometry.isStraight).toBe(false);
    expect(geometry.segments).toEqual([geometry.path]);
    expect(geometry.path.startsWith('M280,288 C')).toBe(true);
    expect(geometry.path.endsWith('392,192')).toBe(true);
    expect(geometry.labelX).toBe(336);
    expect(geometry.labelY).toBe(240);
  });

  it('flags a forward edge between steps on one row as straight', () => {
    const geometry = edgePathUtils.buildEdgeGeometry({
      sourceX: 280,
      sourceY: 288,
      targetX: 392,
      targetY: 288,
    });

    expect(geometry.isStraight).toBe(true);
    expect(geometry.labelX).toBe(336);
    expect(geometry.labelY).toBe(288);
  });

  it('switches to the back-edge route and its two segments past the threshold', () => {
    const geometry = edgePathUtils.buildEdgeGeometry({
      sourceX: 728,
      sourceY: 432,
      targetX: 392,
      targetY: 288,
    });

    expect(geometry.isBackEdge).toBe(true);
    expect(geometry.segments).toHaveLength(2);
    expect(geometry.labelX).toBe(560);
    expect(geometry.labelY).toBe(562);
  });
});
