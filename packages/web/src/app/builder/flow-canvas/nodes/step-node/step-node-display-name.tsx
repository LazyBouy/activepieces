import { t } from 'i18next';

import { cn } from '@/lib/utils';

import { flowCanvasConsts } from '../../utils/consts';

const StepNodeDisplayName = ({
  stepDisplayName,
  pieceDisplayName,
  isSkipped,
  className,
}: {
  stepDisplayName: string;
  pieceDisplayName: string;
  isSkipped: boolean;
  className?: string;
}) => {
  return (
    <div
      data-step-label
      style={{ width: flowCanvasConsts.STEP_LABEL_MIN_WIDTH }}
      className={cn(
        'pointer-events-none absolute top-full left-1/2 mt-2 flex -translate-x-1/2 flex-col items-center text-center',
        className,
      )}
    >
      <div className="line-clamp-2 w-full text-base leading-tight font-medium wrap-anywhere text-gray-12">
        {stepDisplayName}
      </div>
      {isSkipped && (
        <div className="w-full text-base leading-tight font-medium text-gray-12">
          {t('(Skipped)')}
        </div>
      )}
      {pieceDisplayName.length > 0 && (
        <div className="mt-1 w-full truncate text-xsm leading-tight text-gray-11">
          {pieceDisplayName}
        </div>
      )}
    </div>
  );
};

export { StepNodeDisplayName };
