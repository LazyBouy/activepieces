import { isNil } from '@activepieces/core-utils';
import { FlowTriggerType, flowStructureUtil } from '@activepieces/shared';
import { t } from 'i18next';

import { pieceSelectorUtils } from '@/features/pieces';
import { projectCollectionUtils } from '@/features/projects';

import { useBuilderStateContext } from '../builder-hooks';
import { RunStepOutputPane } from '../run-details/flow-step-input-output';
import { TestStepContainer } from '../test-step';

import { DataPane } from './data-pane';

const StepModalOutputPane = () => {
  const [hasRun, readonly, selectedStep, flowVersion, saving] =
    useBuilderStateContext((state) => [
      !isNil(state.run),
      state.readonly,
      state.selectedStep
        ? flowStructureUtil.getStep(
            state.selectedStep,
            state.flowVersion.trigger,
          )
        : undefined,
      state.flowVersion,
      state.saving,
    ]);
  const { project } = projectCollectionUtils.useCurrentProject();
  if (hasRun) {
    return <RunStepOutputPane />;
  }
  const canTest =
    !readonly &&
    !isNil(selectedStep) &&
    !isNil(project) &&
    selectedStep.type !== FlowTriggerType.EMPTY &&
    !(
      selectedStep.type === FlowTriggerType.PIECE &&
      pieceSelectorUtils.isManualTrigger({
        pieceName: selectedStep.settings.pieceName,
        triggerName: selectedStep.settings.triggerName ?? '',
      })
    );
  if (!canTest || isNil(selectedStep) || isNil(project)) {
    return (
      <DataPane title={t('Output')} testId="step-modal-output">
        {null}
      </DataPane>
    );
  }
  return (
    <TestStepContainer
      type={selectedStep.type}
      flowId={flowVersion.flowId}
      flowVersionId={flowVersion.id}
      projectId={project.id}
      isSaving={saving}
    />
  );
};

export { StepModalOutputPane };
