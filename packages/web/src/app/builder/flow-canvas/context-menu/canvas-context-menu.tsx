import { createContext, useContext, useState } from 'react';

import { ShortcutProps } from '@/components/custom/shortcut';
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu';

import { CanvasContextMenuContent } from './canvas-context-menu-content';

export enum ContextMenuType {
  CANVAS = 'CANVAS',
  STEP = 'STEP',
}

const CanvasContextMenuOpenContext = createContext(false);

export const CanvasContextMenu = ({
  contextMenuType,
  children,
}: CanvasContextMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <CanvasContextMenuOpenContext.Provider value={isOpen}>
      <ContextMenu onOpenChange={setIsOpen}>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <CanvasContextMenuContent
          contextMenuType={contextMenuType}
        ></CanvasContextMenuContent>
      </ContextMenu>
    </CanvasContextMenuOpenContext.Provider>
  );
};

export const useIsCanvasContextMenuOpen = () =>
  useContext(CanvasContextMenuOpenContext);

export type CanvasShortcutAction =
  | 'ExitDrag'
  | 'Paste'
  | 'Copy'
  | 'Delete'
  | 'Skip'
  | 'FitView'
  | 'ResetZoom'
  | 'ZoomIn'
  | 'ZoomOut'
  | 'AddNote'
  | 'TidyUp'
  | 'OpenStepModal'
  | 'RenameStep'
  | 'AddStep'
  | 'ReplaceStep';

export type CanvasShortcutProps = ShortcutProps & {
  shortcutCode?: string;
  ignoreShift?: boolean;
  requiresCanvasFocus?: boolean;
};

export type CanvasShortcutsProps = Record<
  CanvasShortcutAction,
  CanvasShortcutProps
>;

export type CanvasContextMenuProps = {
  children?: React.ReactNode;
  contextMenuType: ContextMenuType;
};
