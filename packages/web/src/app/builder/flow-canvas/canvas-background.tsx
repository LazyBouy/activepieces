import { Background, BackgroundVariant, useStore } from '@xyflow/react';
import { useId } from 'react';

import { flowCanvasConsts } from './utils/consts';

const CanvasBackground = ({ readonly }: { readonly: boolean }) => {
  if (readonly) {
    return <ReadonlyStripes />;
  }
  return (
    <Background
      gap={flowCanvasConsts.BACKGROUND_GAP}
      size={1}
      variant={BackgroundVariant.Dots}
      bgColor="var(--gray-2)"
      color="var(--canvas-dot)"
    />
  );
};

const ReadonlyStripes = () => {
  const [x, y, zoom] = useStore((state) => state.transform);
  const patternId = `readonly-stripes-${useId().replace(/[^\w-]/g, '')}`;
  const tile = flowCanvasConsts.READONLY_STRIPE_TILE * zoom;
  return (
    <svg
      className="react-flow__background pointer-events-none absolute inset-0 size-full bg-gray-2"
      data-testid="rf__background"
    >
      <pattern
        id={patternId}
        width={tile}
        height={tile}
        patternUnits="userSpaceOnUse"
        patternTransform={`translate(${x} ${y}) rotate(135)`}
      >
        <rect
          width={tile / 2}
          height={tile}
          fill="var(--canvas-readonly-stripe)"
        />
      </pattern>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
};

export { CanvasBackground };
