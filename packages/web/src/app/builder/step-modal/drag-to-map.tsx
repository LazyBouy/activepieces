import { isNil } from '@activepieces/core-utils';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { cn } from '@/lib/utils';

import { useBuilderStateContext } from '../builder-hooks';
import { MappingDragSource } from '../state/step-form-state';

import { mappingDropEvent } from './mapping-drop-event';

const DragToMapContext = createContext<DragToMapContextValue | null>(null);

const DragToMapProvider = ({ children }: { children: React.ReactNode }) => {
  const setMappingDragSource = useBuilderStateContext(
    (state) => state.setMappingDragSource,
  );
  const [pill, setPill] = useState<DragPillState | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      cancelRef.current?.();
    };
  }, []);

  const startDrag = useCallback(
    ({ source, event }: StartDragParams) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      cancelRef.current?.();
      const origin = { x: event.clientX, y: event.clientY };
      const session: DragSession = { active: false, target: null };
      const moveTarget = (next: HTMLElement | null) => {
        if (next === session.target) {
          return;
        }
        session.target?.removeAttribute(mappingDropEvent.OVER_ATTRIBUTE);
        next?.setAttribute(mappingDropEvent.OVER_ATTRIBUTE, '');
        session.target = next;
      };
      const finish = () => {
        moveTarget(null);
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
        window.removeEventListener('pointercancel', finish);
        window.removeEventListener('keydown', handleKeyDown, true);
        document.documentElement.removeAttribute(DRAGGING_ATTRIBUTE);
        cancelRef.current = null;
        setPill(null);
        if (session.active) {
          setMappingDragSource(null);
        }
      };
      const handleMove = (moveEvent: PointerEvent) => {
        if (!session.active) {
          const distance = Math.hypot(
            moveEvent.clientX - origin.x,
            moveEvent.clientY - origin.y,
          );
          if (distance < DRAG_THRESHOLD_PX) {
            return;
          }
          session.active = true;
          document.documentElement.setAttribute(DRAGGING_ATTRIBUTE, '');
          setMappingDragSource(source);
        }
        moveEvent.preventDefault();
        moveTarget(
          dragToMapUtils.findDropTarget(
            document.elementFromPoint(moveEvent.clientX, moveEvent.clientY),
          ),
        );
        setPill({
          label: source.label,
          x: moveEvent.clientX,
          y: moveEvent.clientY,
          isOverTarget: session.target !== null,
        });
      };
      const handleUp = (upEvent: PointerEvent) => {
        if (session.active) {
          const target = dragToMapUtils.findDropTarget(
            document.elementFromPoint(upEvent.clientX, upEvent.clientY),
          );
          if (!isNil(target)) {
            dragToMapUtils.dispatchDrop({
              target,
              propertyPath: source.propertyPath,
              clientX: upEvent.clientX,
              clientY: upEvent.clientY,
            });
          }
          suppressNextClick();
        }
        finish();
      };
      const handleKeyDown = (keyEvent: KeyboardEvent) => {
        if (keyEvent.key !== 'Escape' || !session.active) {
          return;
        }
        keyEvent.preventDefault();
        keyEvent.stopPropagation();
        finish();
      };
      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
      window.addEventListener('pointercancel', finish);
      window.addEventListener('keydown', handleKeyDown, true);
      cancelRef.current = finish;
    },
    [setMappingDragSource],
  );

  return (
    <DragToMapContext.Provider value={{ startDrag }}>
      {children}
      {pill && <DragPill pill={pill} />}
    </DragToMapContext.Provider>
  );
};

const DragPill = ({ pill }: { pill: DragPillState }) => (
  <div
    data-theme="light"
    data-mapping-pill
    className={cn(
      'pointer-events-none fixed z-80 flex h-6 max-w-60 items-center truncate rounded-sm border px-1.5 text-xs shadow-[0_2px_6px_rgb(28_25_23/20%)]',
      pill.isOverTarget
        ? 'border-success-7 bg-panel text-success-9'
        : 'border-accent-7 bg-accent-3 text-accent-9',
    )}
    style={{
      left: pill.x,
      top: pill.y,
      transform: 'translate(-50%, -100%)',
    }}
  >
    {pill.label}
  </div>
);

function useMappingDragSource(
  source: MappingDragSource | null,
): React.PointerEventHandler<HTMLElement> | undefined {
  const context = useContext(DragToMapContext);
  if (isNil(context) || isNil(source)) {
    return undefined;
  }
  return (event) => context.startDrag({ source, event });
}

function useIsMappingDragSource(propertyPath: string | null): boolean {
  return useBuilderStateContext(
    (state) =>
      !isNil(propertyPath) &&
      state.mappingDragSource?.propertyPath === propertyPath,
  );
}

function findDropTarget(element: Element | null): HTMLElement | null {
  const target = element?.closest(`[${mappingDropEvent.TARGET_ATTRIBUTE}]`);
  return target instanceof HTMLElement ? target : null;
}

function dispatchDrop({
  target,
  propertyPath,
  clientX,
  clientY,
}: {
  target: HTMLElement;
  propertyPath: string;
  clientX: number;
  clientY: number;
}): void {
  target.dispatchEvent(
    mappingDropEvent.create({ propertyPath, clientX, clientY }),
  );
}

function suppressNextClick(): void {
  const stopClick = (event: MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
  };
  window.addEventListener('click', stopClick, { capture: true, once: true });
  window.setTimeout(
    () => window.removeEventListener('click', stopClick, true),
    0,
  );
}

const DRAG_THRESHOLD_PX = 4;
const DRAGGING_ATTRIBUTE = 'data-mapping-dragging';

export const dragToMapUtils = {
  findDropTarget,
  dispatchDrop,
};

export { DragToMapProvider, useMappingDragSource, useIsMappingDragSource };

type DragToMapContextValue = {
  startDrag: (params: StartDragParams) => void;
};

type StartDragParams = {
  source: MappingDragSource;
  event: React.PointerEvent<HTMLElement>;
};

type DragSession = {
  active: boolean;
  target: HTMLElement | null;
};

type DragPillState = {
  label: string;
  x: number;
  y: number;
  isOverTarget: boolean;
};
