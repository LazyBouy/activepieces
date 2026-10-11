import {
  FlowAction,
  FlowTriggerType,
  Step,
  flowStructureUtil,
} from '@activepieces/shared';
import { t } from 'i18next';
import { Ellipsis, LucideIcon, Play, RouteOff, Trash2 } from 'lucide-react';

import { Shortcut, ShortcutProps } from '@/components/custom/shortcut';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { pieceSelectorUtils } from '@/features/pieces';
import { cn } from '@/lib/utils';

import { useBuilderStateContext } from '../../../builder-hooks';
import { CanvasShortcuts } from '../../../shortcuts';
import { canvasBulkActions } from '../../utils/bulk-actions';
import { flowCanvasConsts } from '../../utils/consts';

const StepNodeToolbar = ({ step }: { step: Step }) => {
  const [
    flowVersion,
    applyOperation,
    selectedStep,
    exitStepSettings,
    openStepModal,
    isBeingTested,
  ] = useBuilderStateContext((state) => [
    state.flowVersion,
    state.applyOperation,
    state.selectedStep,
    state.exitStepSettings,
    state.openStepModal,
    state.isStepBeingTested(step.name),
  ]);
  const isAction = flowStructureUtil.isAction(step.type);
  const isSkipped = isAction && isSkippedAction(step);
  const testDisabled = step.valid === false || isBeingTested;

  return (
    <div
      data-step-toolbar
      className="nodrag nopan absolute bottom-full left-1/2 -translate-x-1/2 pb-3 motion-safe:animate-canvas-toolbar-in"
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div className="flex rounded-sm bg-gray-2">
        {isTestable(step) && (
          <ToolbarButton
            icon={Play}
            label={t('Test Step')}
            tooltip={
              testDisabled ? t('Fill in the required fields first') : undefined
            }
            disabled={testDisabled}
            onClick={() =>
              openStepModal({ stepName: step.name, runTest: true })
            }
          />
        )}
        {isAction && (
          <ToolbarButton
            icon={RouteOff}
            label={isSkipped ? t('Unskip') : t('Skip')}
            shortcut={CanvasShortcuts.Skip}
            onClick={() =>
              canvasBulkActions.toggleSkipSelectedNodes({
                selectedNodes: [step.name],
                flowVersion,
                applyOperation,
              })
            }
          />
        )}
        {isAction && (
          <ToolbarButton
            icon={Trash2}
            label={t('Delete')}
            shortcut={DELETE_CHIP}
            onClick={() =>
              canvasBulkActions.deleteSelectedNodes({
                selectedNodes: [step.name],
                applyOperation,
                selectedStep,
                exitStepSettings,
              })
            }
          />
        )}
        <ToolbarButton
          icon={Ellipsis}
          label={t('More')}
          onClick={(event) => {
            const button = event.currentTarget;
            const rect = button.getBoundingClientRect();
            button.dispatchEvent(
              new MouseEvent('contextmenu', {
                bubbles: true,
                cancelable: true,
                view: window,
                button: 2,
                clientX: rect.left,
                clientY: rect.bottom,
              }),
            );
          }}
        />
      </div>
    </div>
  );
};

const ToolbarButton = ({
  icon: Icon,
  label,
  tooltip,
  shortcut,
  disabled = false,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  tooltip?: string;
  shortcut?: ShortcutProps;
  disabled?: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) => {
  return (
    <Tooltip delayDuration={flowCanvasConsts.CHROME_TOOLTIP_DELAY}>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          aria-disabled={disabled || undefined}
          className={cn('rounded-sm', {
            'cursor-not-allowed opacity-50 hover:bg-transparent': disabled,
          })}
          onClick={(event) => {
            event.stopPropagation();
            if (!disabled) {
              onClick(event);
            }
          }}
        >
          <Icon className="size-3.5 text-gray-12" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <span className="flex items-center gap-2">
          {tooltip ?? label}
          {shortcut && <Shortcut {...shortcut} variant="keys" />}
        </span>
      </TooltipContent>
    </Tooltip>
  );
};

function isSkippedAction(step: Step): boolean {
  return isFlowAction(step) && step.skip === true;
}

function isFlowAction(step: Step): step is FlowAction {
  return flowStructureUtil.isAction(step.type);
}

function isTestable(step: Step): boolean {
  if (flowStructureUtil.isAction(step.type)) {
    return true;
  }
  if (step.type !== FlowTriggerType.PIECE) {
    return false;
  }
  return !pieceSelectorUtils.isManualTrigger({
    pieceName: step.settings.pieceName,
    triggerName: step.settings.triggerName ?? '',
  });
}

const DELETE_CHIP: ShortcutProps = { shortcutKey: 'Del' };

export { StepNodeToolbar };
