import { flowLayoutUtil } from '@activepieces/shared';
import { Position, getBezierPath } from '@xyflow/react';

function isBackEdge({
  sourceX,
  targetX,
}: Pick<EdgeEndpoints, 'sourceX' | 'targetX'>): boolean {
  return targetX < sourceX - BACK_EDGE_THRESHOLD;
}

function buildBackEdgePath({
  sourceX,
  sourceY,
  targetX,
  targetY,
}: EdgeEndpoints): BackEdgePath {
  const bottomY = Math.max(sourceY, targetY) + BACK_EDGE_DROP;
  const rightX = sourceX + CLEARANCE;
  const leftX = targetX - CLEARANCE;
  const middleX = (sourceX + targetX) / 2;
  const toMiddle = [
    `H ${rightX - RADIUS}`,
    arc({ x: rightX, y: sourceY + RADIUS }),
    `V ${bottomY - RADIUS}`,
    arc({ x: rightX - RADIUS, y: bottomY }),
    `H ${middleX}`,
  ];
  const toTarget = [
    `H ${leftX + RADIUS}`,
    arc({ x: leftX, y: bottomY - RADIUS }),
    `V ${targetY + RADIUS}`,
    arc({ x: leftX + RADIUS, y: targetY }),
    `H ${targetX}`,
  ];
  const start = `M ${sourceX} ${sourceY}`;
  const middle = `M ${middleX} ${bottomY}`;
  const hoverEndY = Math.min(targetY + HOVER_WIDTH, bottomY - RADIUS);
  const toHoverEnd = [
    `H ${leftX + RADIUS}`,
    arc({ x: leftX, y: bottomY - RADIUS }),
    `V ${hoverEndY}`,
  ];
  return {
    path: [start, ...toMiddle, ...toTarget].join(' '),
    hoverPath: [start, ...toMiddle, ...toHoverEnd].join(' '),
    firstHalf: [start, ...toMiddle].join(' '),
    secondHalf: [middle, ...toTarget].join(' '),
    labelX: middleX,
    labelY: bottomY,
  };
}

function buildEdgeGeometry(endpoints: EdgeEndpoints): EdgeGeometry {
  if (isBackEdge(endpoints)) {
    const backEdge = buildBackEdgePath(endpoints);
    return {
      isBackEdge: true,
      isStraight: false,
      path: backEdge.path,
      hoverPath: backEdge.hoverPath,
      segments: [backEdge.firstHalf, backEdge.secondHalf],
      labelX: backEdge.labelX,
      labelY: backEdge.labelY,
    };
  }
  const [path, labelX, labelY] = getBezierPath({
    sourceX: endpoints.sourceX,
    sourceY: endpoints.sourceY,
    sourcePosition: Position.Right,
    targetX: endpoints.targetX,
    targetY: endpoints.targetY,
    targetPosition: Position.Left,
  });
  return {
    isBackEdge: false,
    isStraight: endpoints.sourceY === endpoints.targetY,
    path,
    hoverPath: path,
    segments: [path],
    labelX,
    labelY,
  };
}

function arc({ x, y }: { x: number; y: number }): string {
  return `A ${RADIUS} ${RADIUS} 0 0 1 ${x} ${y}`;
}

const { BACK_EDGE_DROP, BACK_EDGE_THRESHOLD, CLEARANCE, RADIUS } =
  flowLayoutUtil.constants;
const HOVER_WIDTH = 40;

export const edgePathUtils = {
  isBackEdge,
  buildBackEdgePath,
  buildEdgeGeometry,
  HOVER_WIDTH,
};

export type EdgeEndpoints = {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
};

export type BackEdgePath = {
  path: string;
  hoverPath: string;
  firstHalf: string;
  secondHalf: string;
  labelX: number;
  labelY: number;
};

export type EdgeGeometry = {
  isBackEdge: boolean;
  isStraight: boolean;
  path: string;
  hoverPath: string;
  segments: string[];
  labelX: number;
  labelY: number;
};
