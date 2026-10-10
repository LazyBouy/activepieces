import { FlowActionType, Step } from '@activepieces/shared';
import { t } from 'i18next';
import { LucideIcon, RotateCw, ShieldAlert } from 'lucide-react';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { flowCanvasConsts } from '../../utils/consts';

const StepNodeSettingsBadges = ({ step }: { step: Step }) => {
  const badges = getSettingsBadges(step);
  if (badges.length === 0) {
    return null;
  }
  return (
    <div className="absolute top-1.5 right-1.5 flex gap-px">
      {badges.map((badge) => (
        <Tooltip
          key={badge.title}
          delayDuration={flowCanvasConsts.STATUS_TOOLTIP_DELAY}
        >
          <TooltipTrigger asChild>
            <div
              data-step-badge
              className="flex size-5 items-center justify-center text-gray-11"
            >
              <badge.Icon className="size-3" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-60">
            <div className="flex flex-col gap-0.5 text-start">
              <span className="font-semibold">{badge.title}</span>
              <span className="font-normal">{badge.body}</span>
            </div>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
};

function getSettingsBadges(step: Step): SettingsBadge[] {
  if (step.type !== FlowActionType.CODE && step.type !== FlowActionType.PIECE) {
    return [];
  }
  const options = step.settings.errorHandlingOptions;
  const retry: SettingsBadge[] = options?.retryOnFailure?.value
    ? [
        {
          Icon: RotateCw,
          title: t('Retry on Failure'),
          body: t('Retries up to 4 times before failing the step.'),
        },
      ]
    : [];
  const continueOnFailure: SettingsBadge[] = options?.continueOnFailure?.value
    ? [
        {
          Icon: ShieldAlert,
          title: t('On failure'),
          body: t(
            'When this step fails, the flow continues down its Failure branch.',
          ),
        },
      ]
    : [];
  return [...retry, ...continueOnFailure];
}

export { StepNodeSettingsBadges };

type SettingsBadge = {
  Icon: LucideIcon;
  title: string;
  body: string;
};
