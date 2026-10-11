import { isNil } from '@activepieces/core-utils';
import { FlowAction, FlowTrigger } from '@activepieces/shared';
import { t } from 'i18next';
import { X } from 'lucide-react';
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { LogoPlate } from '@/components/custom/logo-plate';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { stepsHooks } from '@/features/pieces';

import { useBuilderStateContext } from '../builder-hooks';
import EditableStepName from '../step-settings/editable-step-name';
import { StepNavigationButtons } from '../step-settings/step-navigation-buttons';
import { useStepSettingsContext } from '../step-settings/step-settings-context';

const StepModalHeader = ({ onClose }: { onClose: () => void }) => {
  const form = useFormContext<FlowAction | FlowTrigger>();
  const { selectedStep } = useStepSettingsContext();
  const [
    readonly,
    selectedBranchIndex,
    setSelectedBranchIndex,
    editNameOnOpen,
  ] = useBuilderStateContext((state) => [
    state.readonly,
    state.selectedBranchIndex,
    state.setSelectedBranchIndex,
    state.stepModalEditNameOnOpen,
  ]);
  const [isEditingName, setIsEditingName] = useState(
    editNameOnOpen && !readonly,
  );
  const { stepMetadata } = stepsHooks.useStepMetadata({ step: selectedStep });
  const modifiedStep = form.getValues();

  return (
    <div className="flex h-10 shrink-0 items-center gap-1 border-b border-gray-6 bg-canvas-step p-1">
      <div className="flex min-w-0 flex-1 items-center gap-2 pl-2">
        <LogoPlate
          size="row"
          src={stepMetadata?.logoUrl}
          alt={stepMetadata?.displayName ?? selectedStep.displayName}
        />
        <div
          data-step-modal-name
          className="flex max-w-125 min-w-0 items-center gap-1.5 text-sm font-normal text-gray-12"
        >
          <EditableStepName
            selectedBranchIndex={selectedBranchIndex}
            setDisplayName={(value) => {
              form.setValue('displayName', value, {
                shouldValidate: true,
              });
            }}
            readonly={readonly}
            displayName={modifiedStep.displayName}
            branchName={
              !isNil(selectedBranchIndex)
                ? modifiedStep.settings.branches?.[selectedBranchIndex]
                    ?.branchName
                : undefined
            }
            setBranchName={(value) => {
              if (!isNil(selectedBranchIndex)) {
                form.setValue(
                  `settings.branches[${selectedBranchIndex}].branchName`,
                  value,
                  {
                    shouldValidate: true,
                  },
                );
              }
            }}
            setSelectedBranchIndex={setSelectedBranchIndex}
            isEditingStepOrBranchName={isEditingName}
            setIsEditingStepOrBranchName={setIsEditingName}
            tooltipTitle={
              stepMetadata?.actionOrTriggerOrAgentDisplayName ||
              stepMetadata?.displayName
            }
            tooltipDescription={
              stepMetadata?.actionOrTriggerOrAgentDescription ||
              stepMetadata?.description
            }
          />
        </div>
      </div>
      <StepNavigationButtons />
      <div className="flex items-center pl-2">
        <span aria-hidden className="h-5 w-px bg-gray-6" />
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t('Close')}
            data-testid="step-modal-close"
            className="hover:bg-gray-3"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t('Close')}</TooltipContent>
      </Tooltip>
    </div>
  );
};

export { StepModalHeader };
