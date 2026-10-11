import { isNil } from '@activepieces/core-utils';
import { t } from 'i18next';
import React, { useLayoutEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

import { useBuilderStateContext } from '../builder-hooks';
import { flowCanvasConsts } from '../flow-canvas/utils/consts';

import { LogsDetails } from './logs-details';
import { LogsOverview } from './logs-overview';
import { LogsPanelBar } from './logs-panel-bar';
import {
  ListWidthSetting,
  LOGS_PANEL_LAYOUT,
  logsPanelLayoutUtils,
} from './logs-panel-layout-utils';
import { LogsToggleButton } from './logs-toggle-button';

const CanvasWithLogsPanel = ({ children }: { children: React.ReactNode }) => {
  const columnRef = useRef<HTMLDivElement>(null);
  const columnHeight = useElementSize(columnRef).height;
  const [isOpen, setLogsPanelOpen, hasRun] = useBuilderStateContext((state) => [
    state.isLogsPanelOpen,
    state.setLogsPanelOpen,
    !isNil(state.run),
  ]);
  const [savedHeight, setSavedHeight] = useState<number | null>(() =>
    logsPanelLayoutUtils.readSavedHeight(),
  );
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const openHeight = logsPanelLayoutUtils.resolveOpenHeight({
    columnHeight,
    savedHeight,
  });
  const height =
    dragHeight ?? (isOpen ? openHeight : LOGS_PANEL_LAYOUT.collapsedHeight);
  const isMeasured = columnHeight > 0;

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !isMeasured) {
      return;
    }
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = height;
    const session = { rawHeight: startHeight, moved: false };
    const handleMove = (moveEvent: PointerEvent) => {
      session.rawHeight = startHeight + (startY - moveEvent.clientY);
      session.moved = true;
      setDragHeight(
        logsPanelLayoutUtils.resolveDragHeight({
          columnHeight,
          rawHeight: session.rawHeight,
        }),
      );
    };
    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
      setDragHeight(null);
      if (!session.moved) {
        return;
      }
      const drop = logsPanelLayoutUtils.resolveDrop({
        columnHeight,
        rawHeight: session.rawHeight,
      });
      if (drop.collapse) {
        if (isOpen) {
          setLogsPanelOpen(false);
        }
        return;
      }
      setSavedHeight(drop.height);
      logsPanelLayoutUtils.saveHeight({ height: drop.height });
      if (!isOpen) {
        setLogsPanelOpen(true);
      }
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
  };

  return (
    <div ref={columnRef} className="flex h-full w-full flex-col">
      <div className="relative isolate min-h-0 flex-1">{children}</div>
      <section
        aria-label={t('Logs')}
        {...{ [`data-${flowCanvasConsts.LOGS_PANEL_ATTRIBUTE}`]: true }}
        data-state={isOpen ? 'open' : 'collapsed'}
        className={cn(
          'relative z-10 flex shrink-0 flex-col border-t border-canvas-divider bg-canvas-logs text-gray-12',
          {
            'transition-[height] duration-200 ease-decelerate motion-reduce:transition-none':
              isMeasured && isNil(dragHeight),
            'select-none': !isNil(dragHeight),
          },
        )}
        style={{ height }}
      >
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label={t('Resize logs panel')}
          data-logs-resize-handle
          onPointerDown={startResize}
          className="absolute inset-x-0 -top-0.75 z-20 h-1.5 cursor-ns-resize touch-none"
        />
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {isOpen ? (
            hasRun ? (
              <LogsPanelColumns onCollapse={() => setLogsPanelOpen(false)} />
            ) : (
              <LogsEmptyState onCollapse={() => setLogsPanelOpen(false)} />
            )
          ) : (
            <div className="min-w-0 flex-1">
              <LogsPanelBar />
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

const LogsPanelColumns = ({ onCollapse }: { onCollapse: () => void }) => {
  const run = useBuilderStateContext((state) => state.run);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelWidth = useElementSize(panelRef).width;
  const [listWidthSetting, setListWidthSetting] =
    useState<ListWidthSetting | null>(() =>
      logsPanelLayoutUtils.readSavedListWidth(),
    );
  const [dragSetting, setDragSetting] = useState<ListWidthSetting | null>(null);
  const listWidth = logsPanelLayoutUtils.resolveListWidth({
    panelWidth,
    setting: dragSetting ?? listWidthSetting,
  });

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const panel = panelRef.current;
    if (event.button !== 0 || isNil(panel)) {
      return;
    }
    event.preventDefault();
    const bounds = panel.getBoundingClientRect();
    const session: { setting: ListWidthSetting | null } = { setting: null };
    const handleMove = (moveEvent: PointerEvent) => {
      session.setting = logsPanelLayoutUtils.listWidthFromOffset({
        panelWidth: bounds.width,
        offset: moveEvent.clientX - bounds.left,
      });
      setDragSetting(session.setting);
    };
    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
      setDragSetting(null);
      if (isNil(session.setting)) {
        return;
      }
      setListWidthSetting(session.setting);
      logsPanelLayoutUtils.saveListWidth({ width: session.setting });
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
  };

  if (isNil(run)) {
    return null;
  }

  return (
    <div
      ref={panelRef}
      className={cn('relative flex min-h-0 min-w-0 flex-1', {
        'cursor-ew-resize select-none': !isNil(dragSetting),
      })}
    >
      {panelWidth > 0 && (
        <>
          <div
            data-logs-list
            className={cn('flex min-h-0 min-w-0 flex-col bg-canvas-logs', {
              'flex-1': listWidth.full,
              'shrink-0': !listWidth.full,
            })}
            style={listWidth.full ? undefined : { width: listWidth.width }}
          >
            <LogsOverview
              key={run.id}
              run={run}
              listWidth={listWidth.width}
              showToggle={listWidth.full}
              onCollapse={onCollapse}
            />
          </div>
          <div className="relative w-px shrink-0 bg-canvas-divider">
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label={t('Resize columns')}
              data-logs-list-divider
              onPointerDown={startDrag}
              className={cn(
                'absolute inset-y-0 z-10 w-1.5 cursor-ew-resize touch-none',
                listWidth.full ? '-left-1.5' : '-left-0.75',
              )}
            />
          </div>
          {!listWidth.full && <LogsDetails className="min-w-0 flex-1" />}
        </>
      )}
    </div>
  );
};

const LogsEmptyState = ({ onCollapse }: { onCollapse: () => void }) => (
  <div data-logs-empty className="flex min-h-0 min-w-0 flex-1 flex-col">
    <div
      className="flex h-9 shrink-0 items-center border-b border-canvas-divider bg-canvas-logs px-2"
      onClick={(event) => {
        if (
          !(event.target instanceof Element && event.target.closest('button'))
        ) {
          onCollapse();
        }
      }}
    >
      <span className="text-xs font-semibold text-gray-12">{t('Logs')}</span>
      <LogsToggleButton className="ml-auto" />
    </div>
    <div className="flex min-h-0 flex-1 items-center justify-center px-4 text-center text-xs text-gray-11">
      {t("Test the flow to see each step's logs here")}
    </div>
  </div>
);

function useElementSize(ref: React.RefObject<HTMLDivElement | null>): {
  width: number;
  height: number;
} {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const element = ref.current;
    if (isNil(element)) {
      return;
    }
    const measure = () => {
      const rect = element.getBoundingClientRect();
      setSize((current) =>
        current.width === rect.width && current.height === rect.height
          ? current
          : { width: rect.width, height: rect.height },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

CanvasWithLogsPanel.displayName = 'CanvasWithLogsPanel';
export { CanvasWithLogsPanel };
