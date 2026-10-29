import { isNil } from '@activepieces/core-utils';
import { FlowOperationType, flowStructureUtil } from '@activepieces/shared';
import { t } from 'i18next';
import { X } from 'lucide-react';
import {
  AnimatePresence,
  motion,
  useIsPresent,
  type Transition,
} from 'motion/react';
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
  pieceSelectorCustomization,
  piecesHooks,
} from '@/features/pieces';
import { platformHooks } from '@/hooks/platform-hooks';
import { isEditableTarget } from '@/lib/dom-utils';

import { CatalogView } from './catalog-view';
import { PieceCategoryView, TriggerListView } from './category-view';
import { NoResultsFound } from './no-results-found';
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
          onKeyDown={keepTabInPanel}
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
  const [announcement, setAnnouncement] = useState<{
    id: number;
    message: string;
  } | null>(null);
  const push = ({
    view,
    parentId,
  }: {
    view: PiecePanelViewModel;
    parentId: number;
  }) => {
    const id = nextEntryIdRef.current;
    nextEntryIdRef.current += 1;
    setStack((current) =>
      piecePanelUtils.pushView({ stack: current, view, id, parentId }),
    );
  };
  const announce = (message: string) =>
    setAnnouncement((current) => ({ id: (current?.id ?? 0) + 1, message }));
  const pop = () => setStack((current) => piecePanelUtils.popView(current));
  const setQuery = (query: string) =>
    setStack((current) =>
      piecePanelUtils.setTopQuery({ stack: current, query }),
    );

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <AnimatePresence initial={false}>
        {stack.map((entry, index) => (
          <PiecePanelLayer
            key={entry.id}
            entry={entry}
            isTop={index === stack.length - 1}
            depth={index}
            operation={operation}
            onQueryChange={setQuery}
            onPush={(view) => push({ view, parentId: entry.id })}
            onPop={pop}
            onClose={onClose}
            onAnnounce={announce}
          />
        ))}
      </AnimatePresence>
      <div
        role="status"
        aria-live="polite"
        data-piece-panel-announcer
        className="sr-only"
      >
        {announcement && (
          <span key={announcement.id}>{announcement.message}</span>
        )}
      </div>
    </div>
  );
};

const PiecePanelLayer = ({
  entry,
  isTop,
  ...viewProps
}: Omit<PiecePanelViewBaseProps, 'query'> & {
  entry: PiecePanelStackEntry;
}) => {
  const isPresent = useIsPresent();
  const isActive = isTop && isPresent;
  return (
    <motion.div
      data-piece-panel-view={entry.view.kind}
      data-piece-panel-top={isActive || undefined}
      inert={!isActive}
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={SLIDE_TRANSITION}
      className="absolute inset-0 flex flex-col bg-panel motion-reduce:transition-none"
    >
      <PiecePanelEntry
        {...viewProps}
        view={entry.view}
        query={entry.query}
        isTop={isActive}
      />
    </motion.div>
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
    case 'catalog':
      return <CatalogView {...viewProps} />;
    case 'trigger-list':
      return <TriggerListView {...viewProps} list={view.list} />;
    case 'group': {
      const tabType = view.tab.type;
      if (pieceSelectorCustomization.isCategoryTabType(tabType)) {
        return (
          <PieceCategoryView {...viewProps} tab={view.tab} category={tabType} />
        );
      }
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
  const triggerOptions = piecesHooks.useTriggerOptions({
    enabled: mode === 'trigger',
  });
  const isCatalogAvailable = piecesHooks.useIsPieceCatalogAvailable();
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
          : piecePanelUtils.buildRootRows({
              tabs,
              triggerOptions: triggerOptions.options,
              showCatalog: isCatalogAvailable,
            })
      }
      isLoading={
        isSearching ? searchResults.isLoading : triggerOptions.isLoading
      }
      isTop={isTop}
      canPop={depth > 0}
      onPop={onPop}
      onClose={viewProps.onClose}
      onActivate={activateRow}
      emptyState={
        <NoResultsFound
          onSearchCatalog={
            isCatalogAvailable
              ? () => onPush({ kind: 'catalog', initialQuery: query })
              : undefined
          }
        />
      }
    />
  );
};

function useRootTabs(operation: PieceSelectorOperation) {
  const { platform } = platformHooks.useCurrentPlatform();
  return pieceSelectorCustomization.buildResolvedTabs({
    availableBuiltinTabs: getTabsList(operation.type),
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

function getTabsList(operationType: FlowOperationType) {
  return operationType === FlowOperationType.UPDATE_TRIGGER
    ? []
    : pieceSelectorCustomization.getCategoryTabs();
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

function keepTabInPanel(event: React.KeyboardEvent<HTMLElement>): void {
  if (event.key !== 'Tab' || event.defaultPrevented) {
    return;
  }
  const stops = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(TAB_STOP_SELECTOR),
  ).filter((element) => isTabStop({ element }));
  const next =
    stops[
      piecePanelUtils.nextTabStopIndex({
        count: stops.length,
        currentIndex: stops.findIndex(
          (element) => element === document.activeElement,
        ),
        backwards: event.shiftKey,
      })
    ];
  if (isNil(next)) {
    return;
  }
  event.preventDefault();
  next.focus();
}

function isTabStop({ element }: { element: HTMLElement }): boolean {
  return (
    element.closest('[inert]') === null &&
    element.closest(ACTIVE_LAYER_OR_CLOSE_SELECTOR) !== null &&
    element.getClientRects().length > 0
  );
}

const TAB_STOP_SELECTOR =
  'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

const ACTIVE_LAYER_OR_CLOSE_SELECTOR =
  '[data-piece-panel-top], [data-piece-panel-close]';

const SLIDE_TRANSITION: Transition = {
  duration: 0.2,
  ease: [0.25, 0.1, 0.25, 1],
};

const KEEP_OPEN_SELECTOR =
  '[data-piece-selector-opener], [data-radix-popper-content-wrapper], [role="dialog"], [data-sonner-toaster]';

const DIALOG_SELECTOR = '[role="dialog"], [role="alertdialog"]';

export { PiecePanel };
