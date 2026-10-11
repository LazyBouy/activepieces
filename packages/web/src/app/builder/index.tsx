import {
  FlowActionType,
  FlowTriggerType,
  flowStructureUtil,
} from '@activepieces/shared';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PanelImperativeHandle } from 'react-resizable-panels';

import { useBuilderStateContext } from '@/app/builder/builder-hooks';
import { CanvasControls } from '@/app/builder/flow-canvas/canvas-controls';
import { RightSideBarType } from '@/app/builder/types';
import { ChatDrawer } from '@/app/routes/chat/chat-drawer';
import { ShowPoweredBy } from '@/components/custom/show-powered-by';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable-panel';
import { piecesHooks } from '@/features/pieces';
import { platformHooks } from '@/hooks/platform-hooks';
import { cn } from '@/lib/utils';

import { BuilderHeader } from './builder-header/builder-header';
import { FlowCanvas } from './flow-canvas';
import { flowCanvasHooks } from './flow-canvas/hooks';
import { flowCanvasConsts } from './flow-canvas/utils/consts';
import { BuilderBanner } from './flow-canvas/widgets/builder-banner';
import { CanvasToolbar } from './flow-canvas/widgets/canvas-toolbar';
import { FlowVersionsList } from './flow-versions';
import { RunsList } from './run-list';
import { CursorPositionProvider } from './state/cursor-position-context';
import { StepModal } from './step-modal';

const BuilderPage = () => {
  const { platform } = platformHooks.useCurrentPlatform();
  const [rightSidebar, removeAllStepTestsListeners, selectedStep] =
    useBuilderStateContext((state) => [
      state.rightSidebar,
      state.removeAllStepTestsListeners,
      flowStructureUtil.getStep(
        state.selectedStep ?? '',
        state.flowVersion.trigger,
      ),
    ]);
  useEffect(() => {
    return () => {
      removeAllStepTestsListeners();
    };
  }, [removeAllStepTestsListeners]);
  flowCanvasHooks.useShowBuilderIsSavingWarningBeforeLeaving();
  const [isDraggingHandle, setIsDraggingHandle] = useState(false);
  useEffect(() => {
    const handlePointerUp = () => setIsDraggingHandle(false);
    window.addEventListener('pointerup', handlePointerUp);
    return () => window.removeEventListener('pointerup', handlePointerUp);
  }, []);

  const rightHandleRef = useRef<PanelImperativeHandle>(null);

  useLayoutEffect(() => {
    const handle = rightHandleRef.current;
    if (!handle) return;
    const targetSize =
      rightSidebar === RightSideBarType.NONE ? '0%' : DEFAULT_SIDEBAR_SIZE;
    handle.resize(targetSize);
    const rafId = window.requestAnimationFrame(() => handle.resize(targetSize));
    return () => window.cancelAnimationFrame(rafId);
  }, [rightSidebar]);

  const {
    pieceModel,
    isNotFound: pieceModelNotFound,
    refetch: refetchPiece,
  } = piecesHooks.usePieceModelForStepSettings({
    name: selectedStep?.settings.pieceName,
    version: selectedStep?.settings.pieceVersion,
    enabled:
      selectedStep?.type === FlowActionType.PIECE ||
      selectedStep?.type === FlowTriggerType.PIECE,
  });
  flowCanvasHooks.useSetSocketListener(refetchPiece);
  flowCanvasHooks.useListenToExistingRun();

  return (
    <div className="flex h-full w-full flex-col relative max-h-[100vh]">
      <div className="z-40">
        <BuilderHeader />
      </div>
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel defaultSize="100%" id="flow-canvas">
          <div className="relative h-full w-full">
            <CursorPositionProvider>
              <FlowCanvas></FlowCanvas>
            </CursorPositionProvider>

            <BuilderBanner />
            <CanvasControls />
            <CanvasToolbar />

            <ShowPoweredBy
              position="absolute"
              show={platform?.plan.showPoweredBy}
            />
          </div>
        </ResizablePanel>

        <ResizableHandle
          disabled={rightSidebar === RightSideBarType.NONE}
          withHandle={rightSidebar !== RightSideBarType.NONE}
          onPointerDown={() => setIsDraggingHandle(true)}
          onPointerUp={() => setIsDraggingHandle(false)}
          onPointerCancel={() => setIsDraggingHandle(false)}
          className={
            rightSidebar === RightSideBarType.NONE ? 'bg-transparent' : ''
          }
        />

        <ResizablePanel
          panelRef={rightHandleRef}
          id="right-sidebar"
          collapsedSize="0%"
          defaultSize="0%"
          minSize={
            rightSidebar === RightSideBarType.NONE ? '0%' : DEFAULT_MIN_SIZE
          }
          maxSize={rightSidebar === RightSideBarType.NONE ? '0%' : '60%'}
          className={cn('min-w-0 bg-panel z-30', {
            'transition-all': !isDraggingHandle,
          })}
          style={{
            transitionDuration: `${
              isDraggingHandle ? 0 : flowCanvasConsts.SIDEBAR_ANIMATION_DURATION
            }ms`,
          }}
        >
          <div className="h-full w-full">
            {rightSidebar === RightSideBarType.RUNS && <RunsList />}
            {rightSidebar === RightSideBarType.VERSIONS && <FlowVersionsList />}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      <StepModal
        pieceModel={pieceModel}
        pieceModelNotFound={pieceModelNotFound}
      />
      <ChatDrawer />
    </div>
  );
};

BuilderPage.displayName = 'BuilderPage';
export { BuilderPage };

const DEFAULT_SIDEBAR_SIZE = '25%';
const DEFAULT_MIN_SIZE = '400px';
