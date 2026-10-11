import { t } from 'i18next';
import { MessageCircle, Play, Zap } from 'lucide-react';
import { RefObject, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import { useTestFlowAction } from '../../widgets/use-test-flow-action';

const TriggerWidget = ({
  boxRef,
}: {
  boxRef: RefObject<HTMLDivElement | null>;
}) => {
  const action = useTestFlowAction();
  const isInZone = useIsPointerInHoverZone(boxRef);
  const hasButton = action.isAvailable && !action.readonly && action.canStart;
  const showButton = hasButton && isInZone;
  return (
    <>
      <Zap
        data-trigger-bolt
        className={cn(
          'pointer-events-none absolute top-1/2 right-full mr-4 size-4 -translate-y-1/2 fill-accent-9 text-accent-9 transition-[opacity,translate] duration-100 ease-[ease-in]',
          { '-translate-x-3 opacity-0': showButton },
        )}
      />
      {showButton && (
        <TriggerTestButton
          text={action.runText}
          isChatTrigger={action.isChatTrigger}
          needsSampleData={action.needsSampleData}
          isRunning={action.isRunning}
          onClick={action.start}
        />
      )}
    </>
  );
};

const TriggerTestButton = ({
  text,
  isChatTrigger,
  needsSampleData,
  isRunning,
  onClick,
}: {
  text: string;
  isChatTrigger: boolean;
  needsSampleData: boolean;
  isRunning: boolean;
  onClick: () => void;
}) => {
  const disabled = needsSampleData || isRunning;
  const button = (
    <span
      className={cn(
        'nodrag nopan absolute top-1/2 right-full mr-4 inline-flex -translate-y-1/2 motion-safe:animate-trigger-test-in',
        { 'cursor-not-allowed': disabled },
      )}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <Button
        size="lg"
        className="px-3 disabled:pointer-events-none"
        disabled={disabled}
        onClick={onClick}
      >
        {isChatTrigger ? (
          <MessageCircle className="size-4" />
        ) : (
          <Play className="size-4 fill-current" />
        )}
        {text}
      </Button>
    </span>
  );
  if (!needsSampleData) {
    return button;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="top">
        {t('Please test the trigger first')}
      </TooltipContent>
    </Tooltip>
  );
};

function useIsPointerInHoverZone(
  boxRef: RefObject<HTMLDivElement | null>,
): boolean {
  const [isInZone, setIsInZone] = useState(false);
  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const box = boxRef.current;
      if (!box) {
        return;
      }
      setIsInZone(
        isOverCanvas(event.target) &&
          isInsideHoverZone({
            rect: box.getBoundingClientRect(),
            x: event.clientX,
            y: event.clientY,
          }),
      );
    };
    const onPointerLeaveWindow = () => setIsInZone(false);
    window.addEventListener('pointermove', onPointerMove);
    document.documentElement.addEventListener(
      'pointerleave',
      onPointerLeaveWindow,
    );
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      document.documentElement.removeEventListener(
        'pointerleave',
        onPointerLeaveWindow,
      );
    };
  }, [boxRef]);
  return isInZone;
}

function isOverCanvas(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('.react-flow') !== null;
}

function isInsideHoverZone({
  rect,
  x,
  y,
}: {
  rect: DOMRect;
  x: number;
  y: number;
}): boolean {
  const left = rect.left - 2 * rect.width;
  const top = rect.top - rect.height;
  return (
    x >= left &&
    x <= left + 4 * rect.width &&
    y >= top &&
    y <= top + 3 * rect.height
  );
}

export { TriggerWidget };
