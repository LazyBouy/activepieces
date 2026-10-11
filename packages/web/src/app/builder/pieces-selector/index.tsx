import { isNil } from '@activepieces/core-utils';
import { FlowOperationType, flowStructureUtil } from '@activepieces/shared';
import { t } from 'i18next';
import {
  CheckCircle2Icon,
  LayoutGridIcon,
  PuzzleIcon,
  SparklesIcon,
  WrenchIcon,
  X,
} from 'lucide-react';
import { AnimatePresence, motion, type Transition } from 'motion/react';
import React, { useEffect, useRef, useState } from 'react';

import { useBuilderStateContext } from '@/app/builder/builder-hooks';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  PieceSelectorOperation,
  PieceSelectorTabType,
  pieceSelectorCustomization,
  piecesHooks,
} from '@/features/pieces';
import { aiProviderQueries } from '@/features/platform-admin';
import { platformHooks } from '@/hooks/platform-hooks';
import { authenticationSession } from '@/lib/authentication-session';
import { isEditableTarget } from '@/lib/dom-utils';

import { AITabContent } from './ai-tab-content';
import { ApprovalsTabContent } from './approvals-tab-content';
import { ExploreTabContent } from './explore-tab-content';
import {
  PieceActionsOrTriggersList,
  useActivatePiecePanelRow,
} from './piece-actions-or-triggers-list';
import { PiecePanelRootHeader } from './piece-panel-header';
import {
  PiecePanelMode,
  PiecePanelStackEntry,
  PiecePanelViewModel,
  piecePanelUtils,
} from './piece-panel-utils';
import { PiecePanelView, PiecePanelViewBaseProps } from './piece-panel-view';
import { PiecesCardList, usePieceSearchResultRows } from './pieces-card-list';

const PiecePanel = () => {
  const [openerId, operation, closePieceSelector] = useBuilderStateContext(
    (state) => [
      state.openedPieceSelectorStepNameOrAddButtonId,
      state.pieceSelectorOperation,
      state.closePieceSelector,
    ],
  );
  const panelRef = useRef<HTMLElement>(null);
  const isOpen = !isNil(openerId) && !isNil(operation);
  usePiecePanelDismiss({ isOpen, panelRef, onDismiss: closePieceSelector });

  return (
    <AnimatePresence initial={false}>
      {!isNil(openerId) && !isNil(operation) && (
        <motion.aside
          key="piece-panel"
          ref={panelRef}
          data-piece-panel
          aria-label={getRootTitle(piecePanelUtils.getPanelMode(operation))}
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={SLIDE_TRANSITION}
          className="absolute inset-y-0 right-0 z-40 flex w-[385px] flex-col overflow-hidden border-l border-canvas-divider bg-panel text-gray-12 motion-reduce:transition-none @max-[427px]/builder-body:left-10.5 @max-[427px]/builder-body:w-auto"
        >
          <PiecePanelStack
            key={`${openerId}:${piecePanelUtils.getOperationKey(operation)}`}
            operation={operation}
            onClose={closePieceSelector}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('Close')}
                data-piece-panel-close
                className="absolute top-3 right-3 z-10 hidden @max-[427px]/builder-body:flex"
                onClick={closePieceSelector}
              >
                <X className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('Close')}</TooltipContent>
          </Tooltip>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};

const PiecePanelStack = ({
  operation,
  onClose,
}: {
  operation: PieceSelectorOperation;
  onClose: () => void;
}) => {
  const nextEntryIdRef = useRef(1);
  const [stack, setStack] = useState<PiecePanelStackEntry[]>(() => [
    { id: 0, view: { kind: 'root' }, query: '' },
  ]);
  const push = (view: PiecePanelViewModel) => {
    const id = nextEntryIdRef.current;
    nextEntryIdRef.current += 1;
    setStack((current) =>
      piecePanelUtils.pushView({ stack: current, view, id }),
    );
  };
  const pop = () => setStack((current) => piecePanelUtils.popView(current));
  const setQuery = (query: string) =>
    setStack((current) =>
      piecePanelUtils.setTopQuery({ stack: current, query }),
    );

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <AnimatePresence initial={false}>
        {stack.map((entry, index) => {
          const isTop = index === stack.length - 1;
          return (
            <motion.div
              key={entry.id}
              data-piece-panel-view={entry.view.kind}
              data-piece-panel-top={isTop || undefined}
              inert={!isTop}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={SLIDE_TRANSITION}
              className="absolute inset-0 flex flex-col bg-panel motion-reduce:transition-none"
            >
              <PiecePanelEntry
                view={entry.view}
                operation={operation}
                query={entry.query}
                isTop={isTop}
                depth={index}
                onQueryChange={setQuery}
                onPush={push}
                onPop={pop}
                onClose={onClose}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

const PiecePanelEntry = ({
  view,
  ...viewProps
}: PiecePanelViewBaseProps & { view: PiecePanelViewModel }) => {
  switch (view.kind) {
    case 'root':
      return <RootView {...viewProps} />;
    case 'piece':
      return (
        <PieceActionsOrTriggersList {...viewProps} metadata={view.metadata} />
      );
    case 'group':
      switch (view.tab.type) {
        case PieceSelectorTabType.EXPLORE:
          return <ExploreTabContent {...viewProps} tab={view.tab} />;
        case PieceSelectorTabType.AI_AND_AGENTS:
          return <AITabContent {...viewProps} tab={view.tab} />;
        case PieceSelectorTabType.APPROVALS:
          return <ApprovalsTabContent {...viewProps} tab={view.tab} />;
        default:
          return <PiecesCardList {...viewProps} tab={view.tab} />;
      }
  }
};

const RootView = (viewProps: PiecePanelViewBaseProps) => {
  const { operation, query, isTop, depth, onQueryChange, onPush, onPop } =
    viewProps;
  const mode = piecePanelUtils.getPanelMode(operation);
  const replacedStepName = useBuilderStateContext((state) =>
    operation.type === FlowOperationType.UPDATE_ACTION
      ? flowStructureUtil.getStep(operation.stepName, state.flowVersion.trigger)
          ?.displayName ?? operation.stepName
      : '',
  );
  const tabs = useRootTabs(operation);
  const searchResults = usePieceSearchResultRows({ query, operation });
  const activateRow = useActivatePiecePanelRow({ operation, query, onPush });
  const isSearching = query !== '';
  return (
    <PiecePanelView
      header={
        <PiecePanelRootHeader
          title={getRootTitle(mode)}
          subtitle={getRootSubtitle({ mode, stepName: replacedStepName })}
        />
      }
      query={query}
      onQueryChange={onQueryChange}
      rows={
        isSearching
          ? searchResults.rows
          : piecePanelUtils.buildRootRows({ tabs })
      }
      isLoading={isSearching && searchResults.isLoading}
      isTop={isTop}
      canPop={depth > 0}
      onPop={onPop}
      onClose={viewProps.onClose}
      onActivate={activateRow}
    />
  );
};

function useRootTabs(operation: PieceSelectorOperation) {
  const { data: aiProviders } = aiProviderQueries.useProjectAiProviders();
  const {
    pieceModel: aiPieceModel,
    isError: isAiPieceError,
    isSuccess: isAiPieceLoaded,
  } = piecesHooks.usePiece({
    name: '@activepieces/piece-ai',
    projectId: authenticationSession.getProjectId() ?? undefined,
  });
  const { platform } = platformHooks.useCurrentPlatform();
  const isAiPieceUnavailable =
    isAiPieceError ||
    (isAiPieceLoaded && Object.keys(aiPieceModel?.actions ?? {}).length === 0);
  const hasAiPieceActions =
    !isNil(aiProviders) && aiProviders.length > 0 && !isAiPieceUnavailable;
  return pieceSelectorCustomization.buildResolvedTabs({
    availableBuiltinTabs: getTabsList({
      operationType: operation.type,
      aiAndAgentsAvailable: hasAiPieceActions,
    }),
    config: platform.pieceSelectorConfig,
  });
}

function usePiecePanelDismiss({
  isOpen,
  panelRef,
  onDismiss,
}: {
  isOpen: boolean;
  panelRef: React.RefObject<HTMLElement | null>;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (
        !(event.target instanceof Element) ||
        panelRef.current?.contains(event.target) ||
        !isNil(event.target.closest(KEEP_OPEN_SELECTOR))
      ) {
        return;
      }
      onDismiss();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== 'Escape' ||
        event.defaultPrevented ||
        isEditableTarget(event.target) ||
        (event.target instanceof Element &&
          !isNil(event.target.closest(DIALOG_SELECTOR)))
      ) {
        return;
      }
      onDismiss();
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, panelRef, onDismiss]);
}

function getTabsList({
  operationType,
  aiAndAgentsAvailable,
}: {
  operationType: FlowOperationType;
  aiAndAgentsAvailable: boolean;
}) {
  const baseTabs = [
    {
      value: PieceSelectorTabType.EXPLORE,
      name: t('Explore'),
      icon: <LayoutGridIcon className="size-5" />,
    },
    {
      value: PieceSelectorTabType.APPS,
      name: t('Apps'),
      icon: <PuzzleIcon className="size-5" />,
    },
    {
      value: PieceSelectorTabType.UTILITY,
      name: t('Utility'),
      icon: <WrenchIcon className="size-5" />,
    },
  ];
  const replaceOrAddAction = [
    FlowOperationType.ADD_ACTION,
    FlowOperationType.UPDATE_ACTION,
  ].includes(operationType);
  const aiTab = {
    value: PieceSelectorTabType.AI_AND_AGENTS,
    name: t('AI & Agents'),
    icon: <SparklesIcon className="size-5" />,
  };
  const approvalsTab = {
    value: PieceSelectorTabType.APPROVALS,
    name: t('Approvals'),
    icon: <CheckCircle2Icon className="size-5" />,
  };
  return [
    baseTabs[0],
    ...(replaceOrAddAction && aiAndAgentsAvailable ? [aiTab] : []),
    ...baseTabs.slice(1),
    ...(replaceOrAddAction ? [approvalsTab] : []),
  ];
}

function getRootTitle(mode: PiecePanelMode): string {
  switch (mode) {
    case 'next-step':
      return t('Add a step');
    case 'trigger':
      return t('Choose a trigger');
    case 'replace':
      return t('Replace step');
  }
}

function getRootSubtitle({
  mode,
  stepName,
}: {
  mode: PiecePanelMode;
  stepName: string;
}): string | null {
  switch (mode) {
    case 'next-step':
      return null;
    case 'trigger':
      return t('Pick the event that starts this flow');
    case 'replace':
      return t('Pick another piece for {stepName}', { stepName });
  }
}

const SLIDE_TRANSITION: Transition = {
  duration: 0.2,
  ease: [0.25, 0.1, 0.25, 1],
};

const KEEP_OPEN_SELECTOR =
  '[data-piece-selector-opener], [data-radix-popper-content-wrapper], [role="dialog"], [data-sonner-toaster]';

const DIALOG_SELECTOR = '[role="dialog"], [role="alertdialog"]';

export { PiecePanel };
