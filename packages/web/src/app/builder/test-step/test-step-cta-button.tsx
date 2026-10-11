import { isNil } from '@activepieces/core-utils';
import {
  FlowAction,
  FlowTrigger,
  FlowTriggerType,
  Step,
  flowStructureUtil,
} from '@activepieces/shared';
import { t } from 'i18next';
import { Play } from 'lucide-react';
import { ComponentProps, useContext, useEffect } from 'react';
import { toast } from 'sonner';

import { useBuilderStateContext } from '@/app/builder/builder-hooks';
import { LoadingSpinner } from '@/components/custom/spinner';
import { Button } from '@/components/ui/button';
import { pieceSelectorUtils } from '@/features/pieces';
import { cn } from '@/lib/utils';

import { DynamicPropertiesContext } from '../piece-properties/dynamic-properties-context';

import {
  useActionTestRunner,
  useTriggerTestRunner,
} from './test-runner-context';
import { TestButtonTooltip } from './test-step-tooltip';

const TestStepCTAButton = () => {
  const [selectedStep, flowVersion, run, saving, readonly] =
    useBuilderStateContext((state) => [
      state.selectedStep,
      state.flowVersion,
      state.run,
      state.saving,
      state.readonly,
    ]);

  const currentStep = selectedStep
    ? flowStructureUtil.getStep(selectedStep, flowVersion.trigger)
    : null;

  if (!currentStep || !isNil(run) || readonly) {
    return null;
  }

  const sampleDataExists = !isNil(
    currentStep.settings?.sampleData?.lastTestDate,
  );

  if (isFlowAction(currentStep)) {
    return (
      <ActionTestButton
        currentStep={currentStep}
        sampleDataExists={sampleDataExists}
        saving={saving}
      />
    );
  }

  if (isPieceTrigger(currentStep)) {
    if (
      pieceSelectorUtils.isManualTrigger({
        pieceName: currentStep.settings.pieceName,
        triggerName: currentStep.settings.triggerName ?? '',
      })
    ) {
      return null;
    }
    return (
      <TriggerTestButton
        sampleDataExists={sampleDataExists}
        stepIsValid={currentStep.valid !== false}
        saving={saving}
      />
    );
  }

  return null;
};

const isFlowAction = (step: Step): step is FlowAction =>
  flowStructureUtil.isAction(step.type);

const isPieceTrigger = (
  step: Step,
): step is Extract<FlowTrigger, { type: FlowTriggerType.PIECE }> =>
  step.type === FlowTriggerType.PIECE;

const ActionTestButton = ({
  currentStep,
  sampleDataExists,
  saving,
}: ActionTestButtonProps) => {
  const stepIsValid = currentStep.valid !== false;
  const { isLoadingDynamicProperties } = useContext(DynamicPropertiesContext);
  const runner = useActionTestRunner();
  const runnerBusy = runner?.isTesting ?? false;
  useConfigureStepShortcutToast(stepIsValid || runnerBusy);

  if (runnerBusy) {
    return (
      <HeaderTestButton
        label={t('Testing...')}
        testId="test-step-button"
        testing={true}
        disabled={false}
      />
    );
  }

  return (
    <TestButtonTooltip saving={saving} invalid={!stepIsValid}>
      <HeaderTestButton
        label={sampleDataExists ? t('Retest Step') : t('Test Step')}
        testId="test-step-button"
        testing={false}
        disabled={saving || !stepIsValid || isLoadingDynamicProperties}
        onTest={() => runner?.fireTest()}
      />
    </TestButtonTooltip>
  );
};

const TriggerTestButton = ({
  sampleDataExists,
  stepIsValid,
  saving,
}: TriggerTestButtonProps) => {
  const runner = useTriggerTestRunner();
  const runnerBusy = runner?.isTesting ?? false;
  useConfigureStepShortcutToast(stepIsValid || runnerBusy);

  if (runnerBusy) {
    return (
      <HeaderTestButton
        label={t('Testing Trigger')}
        testId="test-trigger-button"
        testing={true}
        disabled={false}
      />
    );
  }

  const runnerReady = runner?.canFireTest ?? false;
  return (
    <TestButtonTooltip saving={saving} invalid={!stepIsValid}>
      <HeaderTestButton
        label={sampleDataExists ? t('Retest Trigger') : t('Test Trigger')}
        testId="test-trigger-button"
        testing={false}
        disabled={saving || !runnerReady}
        onTest={() => runner?.fireTest()}
      />
    </TestButtonTooltip>
  );
};

const HeaderTestButton = ({
  label,
  testId,
  testing,
  disabled,
  onTest,
  className,
  ...rest
}: HeaderTestButtonProps) => (
  <Button
    {...rest}
    type="button"
    size="sm"
    data-testid={testId}
    data-testing={testing || undefined}
    aria-busy={testing || undefined}
    disabled={disabled}
    keyboardShortcut="G"
    keyboardShortcutClassName={SHORTCUT_CHIP_CLASS_NAME}
    onKeyboardShortcut={testing ? undefined : onTest}
    onClick={testing ? undefined : onTest}
    className={cn(
      'transition-[color,background-color,box-shadow,opacity] duration-200',
      className,
    )}
  >
    {testing ? (
      <LoadingSpinner className="size-3 stroke-on-accent" />
    ) : (
      <Play className="size-3 fill-current" />
    )}
    {label}
  </Button>
);

const useConfigureStepShortcutToast = (stepIsValid: boolean) => {
  useEffect(() => {
    if (stepIsValid) return;
    const isMac = /(Mac)/i.test(navigator.userAgent);
    const onKeyDown = (e: KeyboardEvent) => {
      const isCtrlG =
        e.key.toLowerCase() === 'g' && (isMac ? e.metaKey : e.ctrlKey);
      if (!isCtrlG) return;
      toast.error(t('Configure step first'));
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [stepIsValid]);
};

const SHORTCUT_CHIP_CLASS_NAME =
  'inline-flex h-4.5 grow-0 items-center rounded-xs bg-on-accent/20 px-1 text-xss tracking-normal text-on-accent';

TestStepCTAButton.displayName = 'TestStepCTAButton';
export { TestStepCTAButton };

type ActionTestButtonProps = {
  currentStep: FlowAction;
  sampleDataExists: boolean;
  saving: boolean;
};

type TriggerTestButtonProps = {
  sampleDataExists: boolean;
  stepIsValid: boolean;
  saving: boolean;
};

type HeaderTestButtonProps = Omit<
  ComponentProps<typeof Button>,
  'onClick' | 'disabled'
> & {
  label: string;
  testId: string;
  testing: boolean;
  disabled: boolean;
  onTest?: () => void;
};
