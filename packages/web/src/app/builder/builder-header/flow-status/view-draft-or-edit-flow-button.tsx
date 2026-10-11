import { Permission } from '@activepieces/core-utils';
import { FlowVersionState } from '@activepieces/shared';
import { t } from 'i18next';
import { EyeIcon, PencilIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLocation } from 'react-use';

import { Button } from '@/components/ui/button';
import { useAuthorization } from '@/hooks/authorization-hooks';

import { useBuilderStateContext } from '../../builder-hooks';
import { flowCanvasHooks } from '../../flow-canvas/hooks';
import { AboveTriggerButton } from '../../flow-canvas/widgets/above-trigger-button';

export function useLeaveRun() {
  const location = useLocation();
  const navigate = useNavigate();
  const { switchToDraft, isSwitchingToDraftPending } =
    flowCanvasHooks.useSwitchToDraft();
  const flowId = useBuilderStateContext((state) => state.flow.id);
  const leaveRun = () => {
    if (location.pathname?.includes('/runs')) {
      navigate(`/flows/${flowId}`);
    } else {
      switchToDraft();
    }
  };
  return {
    leaveRun,
    isLeavingRun: isSwitchingToDraftPending,
  };
}

const EditFlowOrViewDraftButton = ({ onCanvas }: { onCanvas: boolean }) => {
  const { checkAccess } = useAuthorization();
  const { leaveRun, isLeavingRun } = useLeaveRun();
  const [flowVersion, readonly, run, isStepModalOpen] = useBuilderStateContext(
    (state) => [
      state.flowVersion,
      state.readonly,
      state.run,
      state.isStepModalOpen,
    ],
  );
  const isViewingDraft = flowVersion.state === FlowVersionState.DRAFT;
  const permissionToEditFlow = checkAccess(Permission.WRITE_FLOW);
  if (!readonly || (isViewingDraft && !run)) {
    return null;
  }
  const { text, icon } = getButtonTextAndIcon({
    hasPermissionToEditFlow: permissionToEditFlow,
  });

  return (
    <>
      {onCanvas && (
        <AboveTriggerButton
          shortCutIsEscape={true}
          listenToShortcut={!isStepModalOpen}
          showPrimaryBg={false}
          onClick={leaveRun}
          text={text}
          icon={icon}
          loading={isLeavingRun}
        ></AboveTriggerButton>
      )}

      {!onCanvas && (
        <Button
          size={'xs'}
          variant={'basic'}
          loading={isLeavingRun}
          className="gap-2"
          onClick={leaveRun}
        >
          {icon}
          {text}
        </Button>
      )}
    </>
  );
};
EditFlowOrViewDraftButton.displayName = 'EditFlowOrViewDraftButton';
export { EditFlowOrViewDraftButton };
function getButtonTextAndIcon({
  hasPermissionToEditFlow,
}: {
  hasPermissionToEditFlow: boolean;
}) {
  const text = hasPermissionToEditFlow ? t('Edit flow') : t('View draft');

  if (hasPermissionToEditFlow) {
    return {
      icon: <PencilIcon className="size-4" />,
      text,
    };
  }
  return {
    icon: <EyeIcon className="size-4" />,
    text,
  };
}
