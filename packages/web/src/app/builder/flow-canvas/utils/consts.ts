import { flowLayoutUtil } from '@activepieces/shared';

import { ApFlowCanvasEdge } from '../edges/flow-edge';
import { ApJoinCanvasNode } from '../nodes/join-node';
import { ApNoteCanvasNode } from '../nodes/note-node';
import { ApStepCanvasNode } from '../nodes/step-node';

import { flowCanvasUtils } from './flow-canvas-utils';
import { ApEdgeType, ApNodeType } from './types';

const NOTE_MIN_WIDTH = 150;
const NOTE_MIN_HEIGHT = 80;
const NOTE_MAX_SIZE = 600;
const DRAGGED_NOTE_TAG = 'dragged-note';

export const flowCanvasConsts = {
  NODE_SIZE: flowLayoutUtil.constants.NODE,
  JOIN_SIZE: flowLayoutUtil.constants.JOIN,
  HANDLE_SIZE: 16,
  STUB_BOX_SIZE: 24,
  STUB_LENGTHS: { short: 46, medium: 66, long: 80 },
  OUTPUT_LABEL_OFFSET: 12,
  OUTPUT_LABEL_MAX_WIDTH: 96,
  STEP_LABEL_MIN_WIDTH: 192,
  EDGE_TOOLBAR_HIDE_DELAY: 150,
  edgeTypes: {
    [ApEdgeType.FLOW]: ApFlowCanvasEdge,
  },
  nodeTypes: {
    [ApNodeType.STEP]: ApStepCanvasNode,
    [ApNodeType.JOIN]: ApJoinCanvasNode,
    [ApNodeType.NOTE]: ApNoteCanvasNode,
  },
  DRAGGED_NOTE_TAG,
  NOTE_CREATION_OVERLAY_WIDTH: flowCanvasUtils.NOTE_DEFAULT_SIZE.width,
  NOTE_CREATION_OVERLAY_HEIGHT: flowCanvasUtils.NOTE_DEFAULT_SIZE.height,
  NOTE_MIN_WIDTH,
  NOTE_MIN_HEIGHT,
  NOTE_MAX_SIZE,
  STEP_CONTEXT_MENU_ATTRIBUTE: 'step-context-menu',
  SELECTION_RECT_CHEVRON_ATTRIBUTE: 'selection-rect-chevron',
  NODE_SELECTION_RECT_CLASS_NAME:
    flowCanvasUtils.NODE_SELECTION_RECT_CLASS_NAME,
  SIDEBAR_ANIMATION_DURATION: 200,
  DEFAULT_NOTE_CONTENT: '<br>',
  DEFAULT_NOTE_COLOR: flowCanvasUtils.NOTE_DEFAULT_COLOR,
  BUILDER_HEADER_HEIGHT: 60,
  MIN_ZOOM: 0.05,
  MAX_ZOOM: 4,
  BACKGROUND_GAP: 16,
  FIT_VIEW_OPTIONS: { padding: 0.2, maxZoom: 1 },
  CHROME_TOOLTIP_DELAY: 500,
  STATUS_TOOLTIP_DELAY: 500,
  MINIMAP_WIDTH: 200,
  MINIMAP_HEIGHT: 120,
  MINIMAP_HIDE_DELAY: 1000,
  MINIMAP_NODE_RADIUS: 16,
  READONLY_STRIPE_TILE: 20,
  CANVAS_CHROME_ATTRIBUTE: 'canvas-chrome',
};
