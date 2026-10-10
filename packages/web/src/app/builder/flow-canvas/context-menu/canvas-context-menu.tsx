import { ShortcutProps } from '@/components/custom/shortcut';
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu';

import { CanvasContextMenuContent } from './canvas-context-menu-content';

export enum ContextMenuType {
  CANVAS = 'CANVAS',
  STEP = 'STEP',
}

export const CanvasContextMenu = ({
  contextMenuType,
  children,
}: CanvasContextMenuProps) => {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <CanvasContextMenuContent
        contextMenuType={contextMenuType}
      ></CanvasContextMenuContent>
    </ContextMenu>
  );
};

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
  | 'AddNote';

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
