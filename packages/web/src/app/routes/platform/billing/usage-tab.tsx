import { PlatformBillingInformation } from '@activepieces/shared';
import { t } from 'i18next';
import { Info } from 'lucide-react';

import { DashboardPageHeader } from '@/app/components/dashboard-page-header';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { FeatureUsageCards, ProjectsUsageTable } from '@/features/billing';
import { platformHooks } from '@/hooks/platform-hooks';

export function UsageTab({ platform, info }: UsageTabProps) {
  return (
    <div className="flex w-full flex-col gap-4 pb-6">
      <DashboardPageHeader
        title={
          <div className="flex items-center gap-1.5">
            <h1 className="text-xl font-semibold leading-tight text-gray-12">
              {t('Usage')}
            </h1>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info
                  aria-label={t(
                    'Usage figures may be a few minutes out of date.',
                  )}
                  className="size-3.5 text-gray-11 cursor-help"
                />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-60">
                <p className="text-sm">
                  {t('Usage figures may be a few minutes out of date.')}
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
        }
        description={t('Track your workspace usage across your plan limits.')}
      />
      <FeatureUsageCards platformSubscription={info} />
      <Separator />
      <ProjectsUsageTable platformId={platform.id} />
    </div>
  );
}

type UsageTabProps = {
  platform: ReturnType<typeof platformHooks.useCurrentPlatform>['platform'];
  info: PlatformBillingInformation;
};
