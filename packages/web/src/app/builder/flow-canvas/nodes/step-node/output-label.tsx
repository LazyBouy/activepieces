import { FlowOperationType, flowStructureUtil } from '@activepieces/shared';
import { useReactFlow } from '@xyflow/react';
import { t } from 'i18next';
import { CopyPlus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

import { useBuilderStateContext } from '../../../builder-hooks';
import { flowCanvasConsts } from '../../utils/consts';
import { flowCanvasUtils } from '../../utils/flow-canvas-utils';
import { ApStepOutput } from '../../utils/types';

const OutputLabel = ({
  stepName,
  output,
  text,
  maxWidth,
}: {
  stepName: string;
  output: ApStepOutput;
  text: string;
  maxWidth: number;
}) => {
  const isRouterBranch =
    output.labelKind === 'branch' || output.labelKind === 'fallback';
  const style = {
    left: flowCanvasConsts.NODE_SIZE + flowCanvasConsts.OUTPUT_LABEL_OFFSET,
    top: output.offset,
    maxWidth,
  };
  if (!isRouterBranch || output.branchIndex === null) {
    return (
      <div
        data-output-label={output.id}
        style={style}
        className="pointer-events-none absolute -translate-y-1/2 truncate rounded-sm bg-canvas-label-backdrop px-0.5 text-xs leading-tight text-canvas-label"
      >
        {text}
      </div>
    );
  }
  return (
    <RouterBranchLabel
      stepName={stepName}
      branchIndex={output.branchIndex}
      isFallback={output.labelKind === 'fallback'}
      text={text}
      style={style}
      outputId={output.id}
    />
  );
};

const RouterBranchLabel = ({
  stepName,
  branchIndex,
  isFallback,
  text,
  style,
  outputId,
}: {
  stepName: string;
  branchIndex: number;
  isFallback: boolean;
  text: string;
  style: React.CSSProperties;
  outputId: string;
}) => {
  const [
    step,
    applyOperation,
    readonly,
    selectStepByName,
    setBranchIndex,
    openStepModal,
  ] = useBuilderStateContext((state) => [
    flowStructureUtil.getStep(stepName, state.flowVersion.trigger),
    state.applyOperation,
    state.readonly,
    state.selectStepByName,
    state.setSelectedBranchIndex,
    state.openStepModal,
  ]);
  const { fitView } = useReactFlow();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const branchCount =
    step && flowStructureUtil.isBranchedAction(step)
      ? step.settings.branches.length
      : 0;
  const hasMenu = !isFallback && !readonly;
  const selectBranch = () => {
    setIsMenuOpen(false);
    openStepModal({ stepName, branchIndex });
    fitView(flowCanvasUtils.createFocusStepInGraphParams(stepName));
  };
  const label = (
    <div
      data-output-label={outputId}
      role="button"
      tabIndex={-1}
      style={style}
      className={cn(
        'nodrag nopan absolute -translate-y-1/2 cursor-pointer truncate rounded-sm bg-canvas-label-backdrop px-0.5 text-xs leading-tight text-canvas-label transition-colors hover:bg-gray-4 hover:text-gray-12',
        { 'bg-gray-4 text-gray-12': isMenuOpen },
      )}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => {
        e.stopPropagation();
        selectBranch();
      }}
    >
      {text}
    </div>
  );
  if (!hasMenu) {
    return label;
  }
  return (
    <DropdownMenu modal={false} open={isMenuOpen} onOpenChange={setIsMenuOpen}>
      <DropdownMenuTrigger asChild>{label}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuItem
          onSelect={() => {
            applyOperation({
              type: FlowOperationType.DUPLICATE_BRANCH,
              request: { stepName, branchIndex },
            });
            setBranchIndex(branchIndex + 1);
          }}
        >
          <CopyPlus className="size-4" />
          {t('Duplicate Branch')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={branchCount <= 2}
          className="text-danger-11"
          onSelect={() => {
            setBranchIndex(null);
            applyOperation({
              type: FlowOperationType.DELETE_BRANCH,
              request: { stepName, branchIndex },
            });
            selectStepByName(stepName);
          }}
        >
          <Trash2 className="size-4 text-danger-11" />
          {t('Delete Branch')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export { OutputLabel };
