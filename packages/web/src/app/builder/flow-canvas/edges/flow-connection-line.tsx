import { ConnectionLineComponentProps } from '@xyflow/react';

import { edgePathUtils } from '../utils/edge-path-utils';

const FlowConnectionLine = ({
  fromX,
  fromY,
  toX,
  toY,
}: ConnectionLineComponentProps) => {
  const geometry = edgePathUtils.buildEdgeGeometry({
    sourceX: fromX,
    sourceY: fromY,
    targetX: toX,
    targetY: toY,
  });
  const lastSegment = geometry.segments.length - 1;
  return (
    <g data-connection-line className="canvas-connection-line">
      <defs>
        <marker
          id={MARKER_ID}
          viewBox="0 0 7 10"
          markerWidth={7}
          markerHeight={10}
          refX={7}
          refY={5}
          orient="auto"
          markerUnits="userSpaceOnUse"
          overflow="visible"
        >
          <path
            d="M 0.5 0.5 L 6.5 5 L 0.5 9.5 Z"
            strokeWidth={1}
            strokeLinejoin="round"
            className="fill-canvas-placeholder-ink stroke-canvas-placeholder-ink"
          />
        </marker>
      </defs>
      {geometry.segments.map((segment, index) => (
        <path
          key={segment}
          d={segment}
          fill="none"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-canvas-placeholder-ink"
          markerEnd={index === lastSegment ? `url(#${MARKER_ID})` : undefined}
        />
      ))}
    </g>
  );
};

const MARKER_ID = 'canvas-connection-line-arrow';

export { FlowConnectionLine };
