import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  PointerSensorOptions,
} from '@dnd-kit/core';
import { ReactFlowInstance, useReactFlow } from '@xyflow/react';
import type { PointerEvent } from 'react';
import { useCallback, useState } from 'react';

import { BuilderState, useBuilderStateContext } from '../builder-hooks';
import { NoteDragOverlayMode } from '../state/notes-state';

import NoteDragOverlay from './nodes/note-node/note-drag-overlay';
import { flowCanvasConsts } from './utils/consts';

const FlowDragLayer = ({ children }: { children: React.ReactNode }) => {
  const reactFlow = useReactFlow();
  const [cursorPositionOnActivation, setCursorPositionOnActivation] = useState<{
    x: number;
    y: number;
  }>({ x: 0, y: 0 });
  const [setDraggedNote, getNoteById, moveNote] = useBuilderStateContext(
    (state) => [state.setDraggedNote, state.getNoteById, state.moveNote],
  );

  const handleDragStart = (e: DragStartEvent) => {
    if (e.active.data.current?.type === flowCanvasConsts.DRAGGED_NOTE_TAG) {
      const draggedNote = getNoteById(e.active.id.toString());
      if (draggedNote) {
        const noteElement = document.getElementById(e.active.id.toString());
        let offset: { x: number; y: number } | undefined;
        if (noteElement) {
          const rect = noteElement.getBoundingClientRect();
          offset = {
            x: cursorPositionOnActivation.x - rect.left,
            y: cursorPositionOnActivation.y - rect.top,
          };
        }
        setDraggedNote(draggedNote, NoteDragOverlayMode.MOVE, offset);
      }
    }
  };

  const handleDragCancel = useCallback(() => {
    setDraggedNote(null, null);
  }, [setDraggedNote]);

  const handleDragEnd = (e: DragEndEvent) => {
    setDraggedNote(null, null);
    handleNoteDragEnd({ e, getNoteById, moveNote, reactFlow });
  };

  const sensors = useSensors(
    useSensor(PointerSensorIgnoringInteractiveItems, {
      activationConstraint: {
        distance: 10,
      },
      onActivation: ({ event }) => {
        if (event instanceof PointerEvent) {
          setCursorPositionOnActivation({ x: event.clientX, y: event.clientY });
        }
      },
    }),
    useSensor(TouchSensor),
  );
  return (
    <>
      <DndContext
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
        sensors={sensors}
      >
        {children}
        <DragOverlay dropAnimation={{ duration: 0 }}></DragOverlay>
      </DndContext>
      <NoteDragOverlay />
    </>
  );
};

export { FlowDragLayer };

function handleNoteDragEnd({
  e,
  getNoteById,
  moveNote,
  reactFlow,
}: { e: DragEndEvent } & Pick<BuilderState, 'getNoteById' | 'moveNote'> & {
    reactFlow: ReactFlowInstance;
  }) {
  if (e.active.data.current?.type === flowCanvasConsts.DRAGGED_NOTE_TAG) {
    const draggedNote = getNoteById(e.active.id.toString());
    if (draggedNote) {
      const element = document.getElementById(e.active.id.toString());
      if (element) {
        const positionOnCanvas = reactFlow.screenToFlowPosition({
          x: element.getBoundingClientRect().left,
          y: element.getBoundingClientRect().top,
        });
        moveNote(draggedNote.id, positionOnCanvas);
      }
    }
  }
}

class PointerSensorIgnoringInteractiveItems extends PointerSensor {
  static activators = [
    {
      eventName: 'onPointerDown' as const,
      handler: (
        { nativeEvent: event }: PointerEvent,
        { onActivation }: PointerSensorOptions,
      ) => {
        const target = event.target as HTMLElement;
        if (target?.closest('[contenteditable="true"]')) {
          return false;
        }

        if (
          !event.isPrimary ||
          event.button !== 0 ||
          isInteractiveElement(event.target as Element)
        ) {
          return false;
        }
        onActivation?.({ event });
        return true;
      },
    },
  ];
}

function isInteractiveElement(element: Element | null): boolean {
  const interactiveElements = [
    'button',
    'input',
    'textarea',
    'select',
    'option',
  ];

  if (
    element?.tagName &&
    interactiveElements.includes(element.tagName.toLowerCase())
  ) {
    return true;
  }

  return false;
}
