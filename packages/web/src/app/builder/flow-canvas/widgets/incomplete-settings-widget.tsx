import {
  FlowTriggerType,
  FlowVersion,
  flowStructureUtil,
} from '@activepieces/shared';
import { useReactFlow } from '@xyflow/react';
import { t } from 'i18next';
import React, { useMemo } from 'react';

import { BuilderState } from '@/app/builder/builder-hooks';
import { Button } from '@/components/ui/button';

import { flowCanvasUtils } from '../utils/flow-canvas-utils';

type IncompleteSettingsButtonProps = {
  flowVersion: FlowVersion;
  selectStepByName: BuilderState['selectStepByName'];
  openStepModal: BuilderState['openStepModal'];
  setOpenedPieceSelectorStepNameOrAddButtonId: BuilderState['setOpenedPieceSelectorStepNameOrAddButtonId'];
};

const IncompleteSettingsButton: React.FC<IncompleteSettingsButtonProps> = ({
  flowVersion,
  selectStepByName,
  openStepModal,
  setOpenedPieceSelectorStepNameOrAddButtonId,
}) => {
  const invalidStepCount = useMemo(
    () => getInvalidSteps(flowVersion).length,
    [flowVersion],
  );
  const { fitView } = useReactFlow();
  function onClick() {
    const invalidSteps = getInvalidSteps(flowVersion);
    if (invalidSteps.length > 0) {
      const stepToFocus = invalidSteps[0];
      if (stepToFocus.type === FlowTriggerType.EMPTY) {
        selectStepByName(stepToFocus.name);
        setOpenedPieceSelectorStepNameOrAddButtonId(stepToFocus.name);
      } else {
        openStepModal({ stepName: stepToFocus.name });
      }
      fitView(flowCanvasUtils.createFocusStepInGraphParams(stepToFocus.name));
    }
  }
  return (
    !flowVersion.valid && (
      <Button
        variant="ghost"
        size="lg"
        className="border border-solid border-warning-7 bg-warning-3 px-3 text-warning-11 hover:border-warning-8 hover:bg-warning-4 hover:text-warning-11 motion-safe:animate-overlay-in"
        key={'complete-flow-button'}
        onClick={(e) => {
          onClick();
          e.stopPropagation();
          e.preventDefault();
        }}
      >
        {t('incompleteSteps', { invalidSteps: invalidStepCount })}
      </Button>
    )
  );
};

IncompleteSettingsButton.displayName = 'IncompleteSettingsButton';
export default IncompleteSettingsButton;
function getInvalidSteps(flowVersion: FlowVersion) {
  const skippedStepNames = flowStructureUtil.getSkippedStepNames({
    trigger: flowVersion.trigger,
  });
  return flowStructureUtil
    .getAllSteps(flowVersion.trigger)
    .filter((step) => !step.valid && !skippedStepNames.has(step.name));
}
