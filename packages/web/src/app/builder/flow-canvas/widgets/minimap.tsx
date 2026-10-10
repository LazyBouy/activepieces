import { isNil } from '@activepieces/core-utils';
import { flowStructureUtil } from '@activepieces/shared';
import { MiniMap, MiniMapNodeProps } from '@xyflow/react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

import { useBuilderStateContext } from '../../builder-hooks';
import { flowCanvasConsts } from '../utils/consts';

const Minimap = ({
  visible,
  onPointerEnter,
  onPointerLeave,
}: {
  visible: boolean;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}) => {
  return (
    <div
      aria-hidden={!visible}
      className={cn(
        'absolute bottom-18 left-4 z-5 overflow-hidden rounded-sm border border-canvas-divider transition-opacity duration-300 ease-standard max-md:hidden',
        visible ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
      style={{
        width: flowCanvasConsts.MINIMAP_WIDTH,
        height: flowCanvasConsts.MINIMAP_HEIGHT,
      }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <MiniMap
        position="bottom-left"
        className="m-0!"
        style={{
          width: flowCanvasConsts.MINIMAP_WIDTH - MINIMAP_BORDER_WIDTH * 2,
          height: flowCanvasConsts.MINIMAP_HEIGHT - MINIMAP_BORDER_WIDTH * 2,
        }}
        zoomable
        pannable
        zoomStep={0.3}
        bgColor="var(--canvas-minimap)"
        nodeBorderRadius={flowCanvasConsts.MINIMAP_NODE_RADIUS}
        nodeComponent={MinimapNode}
      />
    </div>
  );
};

const MinimapNode = ({
  id,
  x,
  y,
  width,
  height,
  borderRadius,
}: MiniMapNodeProps) => {
  const [isStep, isNote] = useBuilderStateContext((state) => [
    !isNil(flowStructureUtil.getStep(id, state.flowVersion.trigger)),
    state.flowVersion.notes.some((note) => note.id === id),
  ]);
  if (!isStep && !isNote) {
    return null;
  }
  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      rx={borderRadius}
      ry={borderRadius}
      fill="var(--canvas-minimap-step)"
      className={cn({ 'opacity-20': isNote })}
    />
  );
};

const useMinimapVisibility = () => {
  const [visible, setVisible] = useState(false);
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHovered = useRef(false);

  const clearHideTimeout = useCallback(() => {
    if (hideTimeout.current) {
      clearTimeout(hideTimeout.current);
      hideTimeout.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimeout();
    hideTimeout.current = setTimeout(() => {
      if (!isHovered.current) {
        setVisible(false);
      }
    }, flowCanvasConsts.MINIMAP_HIDE_DELAY);
  }, [clearHideTimeout]);

  const reveal = useCallback(() => {
    setVisible(true);
    if (!isHovered.current) {
      scheduleHide();
    }
  }, [scheduleHide]);

  const onPointerEnter = useCallback(() => {
    isHovered.current = true;
    clearHideTimeout();
  }, [clearHideTimeout]);

  const onPointerLeave = useCallback(() => {
    isHovered.current = false;
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => clearHideTimeout, [clearHideTimeout]);

  return { visible, reveal, onPointerEnter, onPointerLeave };
};

export { Minimap, useMinimapVisibility };

const MINIMAP_BORDER_WIDTH = 1;
