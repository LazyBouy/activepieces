import { Handle, NodeProps, Position } from '@xyflow/react';
import { t } from 'i18next';
import React from 'react';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import { useBuilderStateContext } from '../../builder-hooks';
import { canvasRunUtils } from '../utils/canvas-run-utils';
import { flowCanvasConsts } from '../utils/consts';
import { flowCanvasUtils } from '../utils/flow-canvas-utils';
import { ApJoinNode } from '../utils/types';

import { OutputStub } from './step-node/output-stub';

const ApJoinCanvasNode = React.memo(
  ({ id, data }: NodeProps & Omit<ApJoinNode, 'position'>) => {
    const hasRunThrough = useBuilderStateContext(
      (state) =>
        !!canvasRunUtils.getStepOutput({
          stepName: data.stepName,
          run: state.run,
          loopsIndexes: state.loopsIndexes,
        }),
    );
    return (
      <div
        data-join-node={data.stepName}
        style={{
          width: flowCanvasConsts.JOIN_SIZE,
          height: flowCanvasConsts.JOIN_SIZE,
        }}
        className="relative"
      >
        <Tooltip delayDuration={flowCanvasConsts.STATUS_TOOLTIP_DELAY}>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "absolute inset-0 rounded-full border border-canvas-handle-border bg-canvas-handle before:absolute before:-inset-1 before:rounded-full before:content-['']",
                { 'border-[1.5px] border-canvas-success': hasRunThrough },
              )}
            />
          </TooltipTrigger>
          <TooltipContent side="top">
            {t('Branches join here before the next step')}
          </TooltipContent>
        </Tooltip>
        <Handle
          type="target"
          id={flowCanvasUtils.JOIN_TARGET_ID}
          position={Position.Left}
          isConnectable={false}
          isConnectableStart={false}
          isConnectableEnd={false}
          className={JOIN_HANDLE_CLASS_NAME}
        />
        <Handle
          type="source"
          id={flowCanvasUtils.JOIN_SOURCE_ID}
          position={Position.Right}
          isConnectable={false}
          isConnectableStart={false}
          isConnectableEnd={false}
          className={JOIN_HANDLE_CLASS_NAME}
        />
        {data.stub && (
          <OutputStub
            id={`${id}-out`}
            insertLocation={data.stub}
            top={flowCanvasConsts.JOIN_SIZE / 2}
            left={flowCanvasConsts.JOIN_SIZE}
            length={flowCanvasConsts.STUB_LENGTHS.short}
            hasRunData={hasRunThrough}
            itemCount={null}
          />
        )}
      </div>
    );
  },
);

const JOIN_HANDLE_CLASS_NAME =
  'pointer-events-none! top-0! left-0! size-4! min-h-0! min-w-0! transform-none! rounded-full! border-0! bg-transparent! opacity-0';

ApJoinCanvasNode.displayName = 'ApJoinCanvasNode';
export { ApJoinCanvasNode };
