import { Note, NoteColorVariant } from '@activepieces/shared';
import { useDraggable } from '@dnd-kit/core';
import { Editor } from '@tiptap/core';
import { NodeProps, NodeResizer } from '@xyflow/react';
import { t } from 'i18next';
import { useRef, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';

import { MarkdownInput } from '@/components/custom/markdown-input';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import { useBuilderStateContext } from '../../../builder-hooks';
import { flowCanvasConsts } from '../../utils/consts';
import { ApNoteNode } from '../../utils/types';

import { NoteFooter } from './note-footer';
import { NoteTools } from './note-tools';

const ApNoteCanvasNode = (props: NodeProps & Omit<ApNoteNode, 'position'>) => {
  const [draggedNote, resizeNote, note, readonly] = useBuilderStateContext(
    (state) => [
      state.draggedNote,
      state.resizeNote,
      state.getNoteById(props.id),
      state.readonly,
    ],
  );
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: props.id,
    data: {
      type: flowCanvasConsts.DRAGGED_NOTE_TAG,
    },
  });
  const [isFocusWithin, setIsFocusWithin] = useState(false);
  const [size, setSize] = useState(props.data.size);
  const [resizeOffset, setResizeOffset] = useState({ x: 0, y: 0 });
  if (draggedNote?.id === props.id || note === null) {
    return null;
  }
  return (
    <div
      className={cn('group note-node outline-none', {
        nowheel: isFocusWithin,
      })}
      onFocus={() => setIsFocusWithin(true)}
      onBlur={() => setIsFocusWithin(false)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          setIsFocusWithin(false);
          if (
            document.activeElement instanceof HTMLElement &&
            document.activeElement.closest('.note-node')
          ) {
            document.activeElement.blur();
          }
        }
      }}
    >
      <NodeResizer
        isVisible={!readonly}
        minWidth={flowCanvasConsts.NOTE_MIN_WIDTH}
        minHeight={flowCanvasConsts.NOTE_MIN_HEIGHT}
        maxWidth={flowCanvasConsts.NOTE_MAX_SIZE}
        maxHeight={flowCanvasConsts.NOTE_MAX_SIZE}
        onResize={(_, params) => {
          setSize({ width: params.width, height: params.height });
          setResizeOffset({
            x: params.x - note.position.x,
            y: params.y - note.position.y,
          });
        }}
        onResizeEnd={(_, params) => {
          setResizeOffset({ x: 0, y: 0 });
          resizeNote({
            id: props.id,
            size: { width: params.width, height: params.height },
            position: { x: params.x, y: params.y },
          });
        }}
      />

      <div
        key={
          props.data.size.height +
          props.data.size.width +
          note.position.x +
          note.position.y
        }
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        className={cn('outline-hidden', {
          'cursor-default': readonly,
        })}
        style={
          resizeOffset.x !== 0 || resizeOffset.y !== 0
            ? {
                transform: `translate(${resizeOffset.x}px, ${resizeOffset.y}px)`,
              }
            : undefined
        }
      >
        <NoteContent
          note={{
            ...note,
            size,
          }}
          isDragging={false}
          isSelected={props.selected}
        />
      </div>
    </div>
  );
};
ApNoteCanvasNode.displayName = 'ApNoteCanvasNode';

const NoteContent = ({ note, isDragging, isSelected }: NoteContentProps) => {
  const { id, ownerId: creatorId, color, size } = note;
  const { width, height } = size;
  const [localNote, setLocalNote] = useState(note);
  const [updateContent, readonly] = useBuilderStateContext((state) => [
    state.updateContent,
    state.readonly,
  ]);
  const debouncedUpdateContent = useDebouncedCallback(
    (id: string, content: string) => {
      updateContent(id, content);
    },
    500,
  );

  const editorRef = useRef<Editor | null>(null);
  return (
    <div
      id={id}
      className={cn(
        'relative flex flex-col rounded-sm border border-solid px-3 py-2 text-canvas-note-ink',
        NoteColorVariantClassName[color],
        {
          'ring-4 ring-canvas-note-ring': isSelected,
          'group-focus-within:ring-4 group-focus-within:ring-canvas-note-ring':
            !isDragging,
        },
      )}
      style={{
        width: `${width}px`,
        height: `${height}px`,
      }}
    >
      {!isDragging && !readonly && editorRef.current && (
        <div
          className="pointer-events-none opacity-0 transition-opacity duration-100 ease-cubic-in group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <NoteTools
            editor={editorRef.current}
            currentColor={note.color}
            id={id}
          />
        </div>
      )}

      <div className="flex h-full min-h-0 flex-col gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              onContextMenu={(e) => e.stopPropagation()}
              className="grow h-full min-h-0 overflow-auto"
              onDoubleClick={(e) => {
                e.stopPropagation();
                editorRef.current?.commands.focus();
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
              }}
            >
              <MarkdownInput
                ref={editorRef}
                key={`${localNote.id}-${readonly ? 'readonly' : 'editable'}-${
                  localNote.position.x
                }-${localNote.position.y}`}
                disabled={isDragging || readonly}
                initialValue={localNote.content}
                className={cn('h-full text-sm leading-normal', {
                  'cursor-grabbing!': isDragging,
                })}
                onlyEditableOnDoubleClick={true}
                placeholder={t('Double click to edit...')}
                placeholderClassName="text-sm leading-normal"
                onChange={(value: string) => {
                  if (value !== localNote.content) {
                    setLocalNote({ ...localNote, content: value });
                    debouncedUpdateContent(id, value);
                  }
                }}
              />
            </div>
          </TooltipTrigger>
          {!readonly && !isDragging && !editorRef.current?.isFocused && (
            <TooltipContent side="right">
              {t('Double click to edit')}
            </TooltipContent>
          )}
        </Tooltip>
        <NoteFooter id={id} isDragging={isDragging} creatorId={creatorId} />
      </div>
    </div>
  );
};
export { ApNoteCanvasNode, NoteContent };
type NoteContentProps = {
  note: Note;
  isDragging: boolean;
  isSelected?: boolean;
};

const NoteColorVariantClassName = {
  [NoteColorVariant.YELLOW]:
    'bg-canvas-note-yellow border-canvas-note-yellow-border',
  [NoteColorVariant.ORANGE]:
    'bg-canvas-note-orange border-canvas-note-orange-border',
  [NoteColorVariant.RED]: 'bg-canvas-note-red border-canvas-note-red-border',
  [NoteColorVariant.GREEN]:
    'bg-canvas-note-green border-canvas-note-green-border',
  [NoteColorVariant.BLUE]: 'bg-canvas-note-blue border-canvas-note-blue-border',
  [NoteColorVariant.PURPLE]:
    'bg-canvas-note-purple border-canvas-note-purple-border',
};
