import { isNil } from '@activepieces/core-utils';
import { PieceMetadataModel } from '@activepieces/pieces-framework';
import {
  FlowAction,
  FlowActionType,
  FlowTrigger,
  FlowTriggerType,
  flowStructureUtil,
} from '@activepieces/shared';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { useRef, useState } from 'react';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent } from '@/components/ui/tabs';

import { useBuilderStateContext } from '../builder-hooks';
import {
  StepParametersTab,
  StepSettingsForm,
  StepSettingsTab,
  useHasStepSettingsTab,
} from '../step-settings';
import {
  StepSettingsProvider,
  useStepSettingsContext,
} from '../step-settings/step-settings-context';

import { DragToMapProvider } from './drag-to-map';
import { StepModalInputPane } from './input-pane';
import { NeighbourChips } from './neighbour-chips';
import { StepModalOutputPane } from './output-pane';
import {
  STEP_MODAL_TABS,
  StepModalCenterHeader,
} from './step-modal-center-header';
import { StepModalColumns } from './step-modal-columns';
import { StepModalHeader } from './step-modal-header';
import { stepModalLayoutUtils } from './step-modal-layout-utils';
import { StepModalPortalContext } from './step-modal-portal';

const StepModal = ({ pieceModel, pieceModelNotFound }: StepModalProps) => {
  const [isStepModalOpen, selectedStep, flowVersionId, closeStepModal] =
    useBuilderStateContext((state) => [
      state.isStepModalOpen,
      state.selectedStep
        ? flowStructureUtil.getStep(
            state.selectedStep,
            state.flowVersion.trigger,
          )
        : undefined,
      state.flowVersion.id,
      state.closeStepModal,
    ]);
  const contentRef = useRef<HTMLDivElement>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null,
  );
  const open =
    isStepModalOpen &&
    !isNil(selectedStep) &&
    selectedStep.type !== FlowTriggerType.EMPTY;

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          closeStepModal();
        }
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          data-step-modal-overlay
          className="fixed inset-0 z-45 bg-scrim-strong"
        />
        <DialogPrimitive.Content
          ref={contentRef}
          tabIndex={-1}
          aria-describedby={undefined}
          data-testid="step-modal"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            contentRef.current?.focus();
          }}
          onEscapeKeyDown={(event) => {
            if (stepModalUtils.shouldKeepOpenOnEscape(event.target)) {
              event.preventDefault();
            }
          }}
          onInteractOutside={(event) => {
            if (stepModalUtils.isInsideToast(event.target)) {
              event.preventDefault();
            }
          }}
          className="fixed inset-6 z-45 text-gray-12 outline-hidden"
        >
          <div
            data-step-modal-frame
            className="flex size-full flex-col overflow-hidden rounded-lg border border-gray-6 bg-canvas-step"
          >
            {selectedStep && open && (
              <>
                <DialogPrimitive.Title className="sr-only">
                  {selectedStep.displayName}
                </DialogPrimitive.Title>
                <StepModalPortalContext.Provider value={portalContainer}>
                  <StepSettingsProvider
                    pieceModel={pieceModel}
                    pieceModelNotFound={pieceModelNotFound}
                    selectedStep={selectedStep}
                    key={constructContainerKey({
                      flowVersionId,
                      step: selectedStep,
                      hasPieceModelLoaded: !!pieceModel,
                    })}
                  >
                    <DragToMapProvider>
                      <StepSettingsForm>
                        <StepModalBody onClose={closeStepModal} />
                      </StepSettingsForm>
                    </DragToMapProvider>
                  </StepSettingsProvider>
                </StepModalPortalContext.Provider>
              </>
            )}
          </div>
          {open && <NeighbourChips />}
          <div ref={setPortalContainer} data-step-modal-portal />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

const StepModalBody = ({ onClose }: { onClose: () => void }) => {
  const { selectedStep } = useStepSettingsContext();
  const showSettingsTab = useHasStepSettingsTab();
  const [requestedTab, setRequestedTab] = useState(STEP_MODAL_TABS.parameters);
  const activeTab =
    requestedTab === STEP_MODAL_TABS.settings && !showSettingsTab
      ? STEP_MODAL_TABS.parameters
      : requestedTab;
  const layoutClass = stepModalLayoutUtils.getLayoutClass(selectedStep);
  const storageKey = stepModalLayoutUtils.getStorageKey(selectedStep);

  return (
    <>
      <StepModalHeader onClose={onClose} />
      <StepModalColumns
        layoutClass={layoutClass}
        storageKey={storageKey}
        input={<StepModalInputPane />}
        center={
          <Tabs
            value={activeTab}
            onValueChange={setRequestedTab}
            className="flex min-h-0 flex-1 flex-col"
          >
            <StepModalCenterHeader showSettingsTab={showSettingsTab} />
            <TabsContent
              value={STEP_MODAL_TABS.parameters}
              forceMount
              className="mt-0 min-h-0 flex-1 data-[state=inactive]:hidden"
            >
              <ScrollArea className="h-full">
                <div className="p-4">
                  <StepParametersTab />
                </div>
              </ScrollArea>
            </TabsContent>
            {showSettingsTab && (
              <TabsContent
                value={STEP_MODAL_TABS.settings}
                className="mt-0 min-h-0 flex-1"
              >
                <ScrollArea className="h-full">
                  <div className="p-4">
                    <StepSettingsTab />
                  </div>
                </ScrollArea>
              </TabsContent>
            )}
          </Tabs>
        }
        output={<StepModalOutputPane />}
      />
    </>
  );
};

function shouldKeepOpenOnEscape(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable && target.closest('[data-step-modal-name]')) {
    return true;
  }
  if (target.closest('[data-pane-search]')) {
    return true;
  }
  const codeEditor = target.closest('.cm-editor');
  return (
    !isNil(codeEditor) &&
    !isNil(codeEditor.querySelector('.cm-tooltip-autocomplete'))
  );
}

function isInsideToast(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest('[data-sonner-toaster]') !== null
  );
}

function constructContainerKey({
  flowVersionId,
  step,
  hasPieceModelLoaded,
}: {
  flowVersionId: string;
  step: FlowAction | FlowTrigger;
  hasPieceModelLoaded: boolean;
}) {
  const triggerOrActionName =
    step.type === FlowTriggerType.PIECE
      ? step.settings.triggerName
      : step.settings.actionName;
  const isPieceStep =
    step.type === FlowTriggerType.PIECE || step.type === FlowActionType.PIECE;
  const pieceName = isPieceStep ? step.settings.pieceName : undefined;
  const pieceVersion = isPieceStep ? step.settings.pieceVersion : undefined;
  const isSkipped =
    step.type !== FlowTriggerType.EMPTY &&
    step.type !== FlowTriggerType.PIECE &&
    step.skip;
  return `${flowVersionId}-${step.name}-${triggerOrActionName ?? ''}-${
    pieceName ?? ''
  }-${pieceVersion ?? ''}-${'skipped-' + !!isSkipped}-${
    hasPieceModelLoaded ? 'loaded' : 'not-loaded'
  }`;
}

export const stepModalUtils = {
  shouldKeepOpenOnEscape,
  isInsideToast,
  constructContainerKey,
};

export { StepModal };

type StepModalProps = {
  pieceModel: PieceMetadataModel | undefined;
  pieceModelNotFound: boolean;
};
