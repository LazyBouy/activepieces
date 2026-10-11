import { t } from 'i18next';

import { TabsList, TabsTrigger } from '@/components/ui/tabs';

import { TestStepCTAButton } from '../test-step/test-step-cta-button';

const StepModalCenterHeader = ({
  showSettingsTab,
}: StepModalCenterHeaderProps) => (
  <div className="relative flex h-10.5 shrink-0 items-end justify-between gap-2 border-b border-gray-6 bg-canvas-step pr-2">
    <TabsList
      variant="outline"
      className="relative z-10 h-full translate-y-px items-end"
    >
      <TabsTrigger
        value={STEP_MODAL_TABS.parameters}
        variant="outline"
        size="compact"
        className="pb-3.5 text-gray-11 transition-colors duration-200"
      >
        {t('Parameters')}
      </TabsTrigger>
      {showSettingsTab && (
        <TabsTrigger
          value={STEP_MODAL_TABS.settings}
          variant="outline"
          size="compact"
          className="pb-3.5 text-gray-11 transition-colors duration-200"
        >
          {t('Settings')}
        </TabsTrigger>
      )}
    </TabsList>
    <div className="flex h-full items-center">
      <TestStepCTAButton />
    </div>
  </div>
);

export const STEP_MODAL_TABS = {
  parameters: 'parameters',
  settings: 'settings',
};

export { StepModalCenterHeader };

type StepModalCenterHeaderProps = {
  showSettingsTab: boolean;
};
