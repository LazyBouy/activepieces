import { isNil } from '@activepieces/core-utils';
import { t } from 'i18next';
import { ChevronRight, PackagePlus } from 'lucide-react';
import React, { useEffect, useId, useRef, useState } from 'react';

import { CardListOption } from '@/components/custom/card-list';
import { Skeleton } from '@/components/ui/skeleton';
import { VirtualizedScrollArea } from '@/components/ui/virtualized-scroll-area';
import {
  PiecesSearchInput,
  PieceSelectorGroupRow,
  PieceSelectorOperation,
  PieceSelectorTabRow,
} from '@/features/pieces';
import { cn } from '@/lib/utils';

import { CatalogPieceRow } from './catalog-piece-row';
import { GenericActionOrTriggerItem } from './generic-piece-selector-item';
import { NoResultsFound } from './no-results-found';
import { PieceCardListItem } from './piece-card-item';
import {
  PiecePanelRow,
  PiecePanelViewModel,
  piecePanelUtils,
} from './piece-panel-utils';
import { triggerOptionDisplay } from './trigger-option-display';

const PiecePanelView = ({
  header,
  query,
  onQueryChange,
  rows,
  isLoading,
  isTop,
  canPop,
  onPop,
  onClose,
  onActivate,
  emptyState,
}: PiecePanelViewProps) => {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [pointerMoved, setPointerMoved] = useState(false);
  const activeIndex = piecePanelUtils.resolveActiveIndex({ rows, activeKey });
  const activeRow = activeIndex === -1 ? undefined : rows[activeIndex];
  const showList = !isLoading && rows.length > 0;

  useEffect(() => {
    if (!isTop) {
      return;
    }
    const focusInput = () => inputRef.current?.focus({ preventScroll: true });
    focusInput();
    const timeout = setTimeout(focusInput);
    return () => clearTimeout(timeout);
  }, [isTop]);

  useEffect(() => {
    if (isTop && document.activeElement === document.body) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [isTop, showList]);

  const changeQuery = (nextQuery: string) => {
    setActiveKey(null);
    onQueryChange(nextQuery);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) {
      return;
    }
    const input = event.currentTarget;
    const action = piecePanelUtils.resolveKeyAction({
      key: event.key,
      query,
      caretAtEnd:
        input.selectionStart === input.value.length &&
        input.selectionEnd === input.value.length,
      canPop,
      activeRowOpensSubView: piecePanelUtils.opensSubView(activeRow),
    });
    if (isNil(action)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    switch (action) {
      case 'next':
      case 'previous': {
        const nextIndex = piecePanelUtils.moveActiveIndex({
          rows,
          activeIndex,
          step: action === 'next' ? 1 : -1,
        });
        setActiveKey(rows[nextIndex]?.key ?? null);
        return;
      }
      case 'activate':
      case 'push':
        if (!isNil(activeRow)) {
          onActivate(activeRow);
        }
        return;
      case 'pop':
        onPop();
        return;
      case 'clear':
        changeQuery('');
        return;
      case 'close':
        onClose();
        return;
    }
  };

  const renderRow = (row: PiecePanelRow, index: number) => {
    const optionProps = {
      id: getOptionId({ listId, index }),
      active: index === activeIndex,
      hoverEnabled: pointerMoved,
      onClick: () => onActivate(row),
    };
    switch (row.kind) {
      case 'label':
        return (
          <div className="px-4 pt-4 pb-1 text-xss leading-3 font-semibold tracking-widest text-gray-11 uppercase">
            {row.text}
          </div>
        );
      case 'separator':
        return (
          <div aria-hidden className="px-4 pt-4 pb-3">
            <div className="h-px bg-canvas-divider" />
          </div>
        );
      case 'category':
        return (
          <CardListOption
            {...optionProps}
            aria-expanded={row.expanded}
            data-piece-panel-category={row.title}
            className="gap-2 border-b border-canvas-divider px-4 py-2"
          >
            <span className="min-w-0 flex-1 truncate text-sm leading-tight font-semibold text-gray-12">
              {row.title}
            </span>
            <ChevronRight
              className={cn(
                'size-4 shrink-0 text-gray-11 transition-transform duration-200 motion-reduce:transition-none',
                { 'rotate-90': row.expanded },
              )}
            />
          </CardListOption>
        );
      case 'group':
        return <PieceSelectorTabRow tab={row.tab} {...optionProps} />;
      case 'trigger-option': {
        const display = triggerOptionDisplay.get(row.option.id);
        return (
          <PieceSelectorGroupRow
            groupKey={row.key}
            icon={<display.Icon />}
            title={display.title}
            description={display.description}
            opensList={row.option.kind !== 'pick'}
            {...optionProps}
          />
        );
      }
      case 'piece':
        return (
          <PieceCardListItem
            pieceMetadata={row.metadata}
            showDescription={row.showDescription}
            {...optionProps}
          />
        );
      case 'item':
        return (
          <GenericActionOrTriggerItem
            item={row.item}
            logoUrl={row.logoUrl}
            logoName={row.logoName}
            hideLogo={row.hideLogo}
            {...optionProps}
          />
        );
      case 'browse-catalog':
        return (
          <PieceSelectorGroupRow
            groupKey="catalog"
            icon={<PackagePlus />}
            title={t('Browse more pieces')}
            description={t(
              'Download pieces from the catalog when you need them',
            )}
            {...optionProps}
          />
        );
      case 'catalog-piece':
        return (
          <CatalogPieceRow
            piece={row.piece}
            status={row.status}
            {...optionProps}
          />
        );
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {header}
      <PiecesSearchInput
        value={query}
        onValueChange={changeQuery}
        inputRef={inputRef}
        onKeyDown={handleKeyDown}
        isActive={isTop}
        listId={listId}
        activeOptionId={
          showList && activeIndex !== -1
            ? getOptionId({ listId, index: activeIndex })
            : undefined
        }
      />
      <div
        id={listId}
        role="listbox"
        data-piece-panel-list
        className="min-h-0 flex-1"
        onPointerMove={() => {
          if (!pointerMoved) {
            setPointerMoved(true);
          }
        }}
      >
        {isLoading && <PiecePanelListSkeleton />}
        {!isLoading && rows.length === 0 && (emptyState ?? <NoResultsFound />)}
        {showList && (
          <VirtualizedScrollArea
            items={rows}
            measureItems={true}
            scrollToIndex={activeIndex}
            estimateSize={(index) => estimateRowSize(rows[index])}
            getItemKey={(index) => rows[index].key}
            renderItem={renderRow}
          />
        )}
      </div>
    </div>
  );
};

const PiecePanelListSkeleton = () => (
  <div data-piece-panel-loading className="flex flex-col">
    {SKELETON_ROWS.map((row) => (
      <div key={row} className="flex h-12 items-center gap-4 pr-2 pl-4">
        <Skeleton className="size-6 shrink-0 rounded-sm" />
        <Skeleton className="h-4 flex-1" />
      </div>
    ))}
  </div>
);

function getOptionId({ listId, index }: { listId: string; index: number }) {
  return `${listId}-option-${index}`;
}

function estimateRowSize(row: PiecePanelRow | undefined): number {
  switch (row?.kind) {
    case 'label':
      return 32;
    case 'separator':
      return 29;
    case 'category':
      return 36;
    case 'group':
    case 'trigger-option':
    case 'browse-catalog':
      return 58;
    default:
      return 64;
  }
}

const SKELETON_ROWS = [0, 1, 2];

export { PiecePanelView };

export type PiecePanelViewBaseProps = {
  operation: PieceSelectorOperation;
  query: string;
  isTop: boolean;
  depth: number;
  onQueryChange: (query: string) => void;
  onPush: (view: PiecePanelViewModel) => void;
  onPop: () => void;
  onClose: () => void;
  onAnnounce: (message: string) => void;
};

type PiecePanelViewProps = {
  header: React.ReactNode;
  query: string;
  onQueryChange: (query: string) => void;
  rows: PiecePanelRow[];
  isLoading: boolean;
  isTop: boolean;
  canPop: boolean;
  onPop: () => void;
  onClose: () => void;
  onActivate: (row: PiecePanelRow) => void;
  emptyState?: React.ReactNode;
};
