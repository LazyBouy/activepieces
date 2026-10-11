import { t } from 'i18next';
import { ArrowLeft, ArrowRight, GripVertical } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';

const ColumnGrip = ({
  left,
  isDragging,
  onPointerDown,
  onDoubleClick,
}: ColumnGripProps) => (
  <div
    role="separator"
    aria-orientation="vertical"
    aria-label={t('Move columns')}
    data-step-modal-grip
    onPointerDown={onPointerDown}
    onDoubleClick={onDoubleClick}
    className="group/grip absolute bottom-full z-20 flex h-4.5 -translate-x-1/2 cursor-ew-resize touch-none items-start select-none"
    style={{ left }}
  >
    <ArrowLeft
      aria-hidden
      className={cn(
        'mt-1 mr-1.5 size-2.5 text-canvas-placeholder-ink opacity-0 transition-opacity duration-100 group-hover/grip:opacity-100',
        { 'opacity-100': isDragging },
      )}
    />
    <span className="flex h-full items-start rounded-t-sm border border-b-0 border-gray-6 bg-canvas-step px-1.5 pt-1">
      <GripVertical className="size-3 text-canvas-placeholder-ink" />
    </span>
    <ArrowRight
      aria-hidden
      className={cn(
        'mt-1 ml-1.5 size-2.5 text-canvas-placeholder-ink opacity-0 transition-opacity duration-100 group-hover/grip:opacity-100',
        { 'opacity-100': isDragging },
      )}
    />
  </div>
);

export { ColumnGrip };

type ColumnGripProps = {
  left: number;
  isDragging: boolean;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onDoubleClick: () => void;
};
