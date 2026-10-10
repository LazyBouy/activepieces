import { t } from 'i18next';
import { Square } from 'lucide-react';

import { EditFlowOrViewDraftButton } from '@/app/builder/builder-header/flow-status/view-draft-or-edit-flow-button';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { flowCanvasConsts } from '../utils/consts';

import { AboveTriggerButton } from './above-trigger-button';
import { useTestFlowAction } from './use-test-flow-action';

const TestFlowWidget = () => {
  const action = useTestFlowAction();

  if (!action.isAvailable) {
    return null;
  }

  if (action.isRunning) {
    return (
      <>
        <AboveTriggerButton
          onClick={action.rerun}
          text={action.runText}
          loading
        />
        {action.isCancellable && (
          <StopRunButton
            onClick={action.cancel}
            loading={action.isCancellingRun}
          />
        )}
      </>
    );
  }

  if (action.readonly) {
    return (
      <EditFlowOrViewDraftButton onCanvas={true}></EditFlowOrViewDraftButton>
    );
  }

  if (action.isChatTrigger) {
    return <AboveTriggerButton onClick={action.start} text={action.runText} />;
  }

  if (!action.canStart) {
    return null;
  }

  return (
    <AboveTriggerButton
      onClick={action.start}
      text={action.runText}
      disable={action.needsSampleData}
    />
  );
};

const StopRunButton = ({
  onClick,
  loading,
}: {
  onClick: () => void;
  loading: boolean;
}) => {
  return (
    <Tooltip delayDuration={flowCanvasConsts.CHROME_TOOLTIP_DELAY}>
      <TooltipTrigger asChild>
        <Button
          variant="secondary"
          size="icon-lg"
          aria-label={t('Stop')}
          loading={loading}
          onClick={onClick}
        >
          <Square className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{t('Stop')}</TooltipContent>
    </Tooltip>
  );
};

TestFlowWidget.displayName = 'TestFlowWidget';

export { TestFlowWidget };
