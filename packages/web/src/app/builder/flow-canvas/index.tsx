import { isNil } from '@activepieces/core-utils';
import {
  FlowActionType,
  flowStructureUtil,
  FlowTriggerType,
  FlowVersion,
  Note,
  Step,
} from '@activepieces/shared';
import {
  ReactFlow,
  SelectionMode,
  OnSelectionChangeParams,
  useStoreApi,
  PanOnScrollMode,
  useStore,
  NodeChange,
  applyNodeChanges,
  OnConnectStart,
  OnConnectEnd,
  XYPosition,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { cn } from '@/lib/utils';

import { useBuilderStateContext, useBuilderStore } from '../builder-hooks';
import { useHandleKeyPressOnCanvas } from '../shortcuts';
import { useCursorPosition } from '../state/cursor-position-context';

import { CanvasBackground } from './canvas-background';
import { useFitToView } from './canvas-controls/use-fit-to-view';
import {
  CanvasContextMenu,
  ContextMenuType,
} from './context-menu/canvas-context-menu';
import { FlowConnectionLine } from './edges/flow-connection-line';
import { FlowDragLayer } from './flow-drag-layer';
import { flowCanvasHooks } from './hooks';
import { canvasSelectionUtils } from './utils/canvas-selection-utils';
import { flowCanvasConsts } from './utils/consts';
import { flowCanvasUtils } from './utils/flow-canvas-utils';
import { notePlacementUtils } from './utils/note-placement-utils';
import { stepPositionUtils } from './utils/step-position-utils';
import { ApNode, ApNodeType, ApStepNode } from './utils/types';
import { CanvasTestBar } from './widgets';
import { Minimap, useMinimapVisibility } from './widgets/minimap';
import { useShowChevronNextToSelection } from './widgets/selection-chevron-button';

export const FlowCanvas = React.memo(() => {
  const [
    flowVersion,
    setSelectedNodes,
    selectedNodes,
    selectedStep,
    selectStepByName,
    notes,
    readonly,
    startStepDrag,
    setDropTargetId,
    commitStepDrag,
    endStepDrag,
    setPendingStepPosition,
    openPieceSelector,
  ] = useBuilderStateContext((state) => {
    return [
      state.flowVersion,
      state.setSelectedNodes,
      state.selectedNodes,
      state.selectedStep,
      state.selectStepByName,
      state.flowVersion.notes,
      state.readonly,
      state.startStepDrag,
      state.setDropTargetId,
      state.commitStepDrag,
      state.endStepDrag,
      state.setPendingStepPosition,
      state.openPieceSelector,
    ];
  });
  const builderStore = useBuilderStore();
  const containerRef = useRef<HTMLDivElement>(null);
  useShowChevronNextToSelection();
  flowCanvasHooks.useFocusOnStep();
  useHandleKeyPressOnCanvas();
  flowCanvasHooks.useResizeCanvas(containerRef);
  flowCanvasHooks.useZoomContrast(containerRef);
  const reactFlowStore = useStoreApi();
  const { screenToFlowPosition } = useReactFlow();
  const minimap = useMinimapVisibility();
  const fitToView = useFitToView();
  const isCanvasMeasured = useStore(
    (state) =>
      state.width > 0 &&
      state.height > 0 &&
      state.nodeLookup.size > 0 &&
      [...state.nodeLookup.values()].every(
        (node) => node.internals.handleBounds !== undefined,
      ),
  );
  const [fittedVersionId, setFittedVersionId] = useState<string | null>(null);
  useEffect(() => {
    if (!isCanvasMeasured || fittedVersionId === flowVersion.id) {
      return;
    }
    fitToView();
    setFittedVersionId(flowVersion.id);
  }, [isCanvasMeasured, flowVersion.id, fittedVersionId, fitToView]);
  const onSelectionChange = useCallback(
    (ev: OnSelectionChangeParams) => {
      setSelectedNodes(
        canvasSelectionUtils.resolveSelectedNodes({
          canvasSelection: ev.nodes.map((n) => n.id),
          selectedStep: builderStore.getState().selectedStep,
        }),
      );
    },
    [setSelectedNodes, builderStore],
  );
  const graphKey = createGraphKey({
    flowVersion,
    notes,
    selectedStep: selectedStep ?? '',
    readonly,
  });
  const graph = useMemo(() => {
    return flowCanvasUtils.createFlowGraph({
      version: flowVersion,
      notes,
      readonly,
    });
  }, [graphKey]);
  const [clearedVersionId, setClearedVersionId] = useState<string | null>(null);
  useEffect(() => {
    if (readonly || clearedVersionId === flowVersion.id) {
      return;
    }
    setClearedVersionId(flowVersion.id);
    const steps = graph.nodes
      .filter((node): node is ApStepNode => node.type === ApNodeType.STEP)
      .map((node) =>
        notePlacementUtils.stepArea({
          position: node.position,
          height: node.data.height,
        }),
      );
    notePlacementUtils
      .clearSteps({ notes, steps })
      .forEach(({ id, position }) =>
        builderStore.getState().moveNote(id, position),
      );
  }, [readonly, clearedVersionId, flowVersion.id, graph, notes, builderStore]);
  const stepIds = useMemo(
    () =>
      new Set(
        graph.nodes
          .filter((node) => node.type === ApNodeType.STEP)
          .map((node) => node.id),
      ),
    [graph],
  );
  const [localNodes, setLocalNodes] = useState<LocalNodes>({
    key: graphKey,
    nodes: graph.nodes,
  });
  if (localNodes.key !== graphKey) {
    setLocalNodes({
      key: graphKey,
      nodes: carryNodeState({ previous: localNodes.nodes, next: graph.nodes }),
    });
  }
  const onNodesChange = useCallback(
    (changes: NodeChange<ApNode>[]) => {
      const allowedChanges = changes.filter(
        (change) => change.type !== 'position' || stepIds.has(change.id),
      );
      if (allowedChanges.length === 0) {
        return;
      }
      setLocalNodes((current) => ({
        key: current.key,
        nodes: applyNodeChanges(allowedChanges, current.nodes),
      }));
    },
    [stepIds],
  );
  const onNodeDragStart = useCallback(
    (_event: React.MouseEvent, node: ApNode, draggedNodes: ApNode[]) => {
      if (
        readonly ||
        draggedNodes.length !== 1 ||
        node.type !== ApNodeType.STEP ||
        flowStructureUtil.isTrigger(node.data.step.type)
      ) {
        return;
      }
      startStepDrag({
        stepName: node.id,
        targets: stepPositionUtils.getDropTargets({
          graph,
          trigger: flowVersion.trigger,
          draggedStepName: node.id,
        }),
      });
    },
    [readonly, graph, flowVersion.trigger, startStepDrag],
  );
  const onNodeDrag = useCallback(
    (event: React.MouseEvent) => {
      const { stepDrag } = builderStore.getState();
      if (!stepDrag?.active) {
        return;
      }
      setDropTargetId(
        findArmedDropTarget({
          pointer: { x: event.clientX, y: event.clientY },
          targetIds: stepDrag.targets.map((target) => target.id),
          zoom: reactFlowStore.getState().transform[2],
        }),
      );
    },
    [builderStore, reactFlowStore, setDropTargetId],
  );
  const commitDraggedNodes = useCallback(
    (draggedNodes: ApNode[]) => {
      const { stepDrag, dropTargetId } = builderStore.getState();
      const draggedSteps = draggedNodes.filter((node) => stepIds.has(node.id));
      const dropTarget =
        draggedSteps.length === 1 && stepDrag?.active
          ? stepDrag.targets.find((target) => target.id === dropTargetId)
              ?.location ?? null
          : null;
      endStepDrag();
      if (draggedSteps.length === 0) {
        return;
      }
      commitStepDrag({
        positions: Object.fromEntries(
          draggedSteps.map((node) => [node.id, node.position]),
        ),
        dropTarget,
      });
    },
    [builderStore, stepIds, commitStepDrag, endStepDrag],
  );
  const connectionStartRef = useRef<XYPosition | null>(null);
  const onConnectStart: OnConnectStart = useCallback((event) => {
    connectionStartRef.current = getClientPoint(event);
  }, []);
  const onConnectEnd: OnConnectEnd = useCallback(
    (event, connectionState) => {
      const start = connectionStartRef.current;
      connectionStartRef.current = null;
      const end = getClientPoint(event);
      const fromNodeId = connectionState.fromNode?.id;
      const fromHandleId = connectionState.fromHandle?.id;
      if (
        readonly ||
        isNil(start) ||
        isNil(end) ||
        isNil(fromNodeId) ||
        isNil(fromHandleId) ||
        Math.hypot(end.x - start.x, end.y - start.y) <=
          CONNECTION_CLICK_DISTANCE ||
        !isEmptyCanvasPoint(end)
      ) {
        return;
      }
      const stepNode = graph.nodes.find(
        (node) => node.type === ApNodeType.STEP && node.id === fromNodeId,
      );
      const output =
        stepNode?.type === ApNodeType.STEP
          ? stepNode.data.outputs.find((output) => output.id === fromHandleId)
          : undefined;
      if (isNil(output)) {
        return;
      }
      const selectorId = output.hasStub
        ? flowCanvasUtils.getOutputStubId({
            stepName: fromNodeId,
            outputId: output.id,
          })
        : flowCanvasUtils.getOutputEdgeId({
            nodeId: fromNodeId,
            outputId: output.id,
          });
      setPendingStepPosition({
        selectorId,
        position: screenToFlowPosition(end),
      });
      openPieceSelector({
        id: selectorId,
        operation: flowCanvasUtils.createAddOperationFromAddButtonData(
          output.insertLocation,
        ),
      });
    },
    [
      readonly,
      graph,
      screenToFlowPosition,
      setPendingStepPosition,
      openPieceSelector,
    ],
  );
  const [contextMenuType, setContextMenuType] = useState<ContextMenuType>(
    ContextMenuType.CANVAS,
  );

  const onContextMenu = useCallback(
    (ev: React.MouseEvent<HTMLDivElement>) => {
      if (ev.target instanceof HTMLElement || ev.target instanceof SVGElement) {
        const stepElement = ev.target.closest(
          `[data-${flowCanvasConsts.STEP_CONTEXT_MENU_ATTRIBUTE}]`,
        );
        const stepName = stepElement?.getAttribute(
          `data-${flowCanvasConsts.STEP_CONTEXT_MENU_ATTRIBUTE}`,
        );

        if (stepElement && stepName) {
          selectStepByName(stepName);
          canvasSelectionUtils.selectStepOnCanvas({
            stepName,
            canvas: reactFlowStore.getState(),
          });
        }
        const targetIsSelectionChevron = ev.target.closest(
          `[data-${flowCanvasConsts.SELECTION_RECT_CHEVRON_ATTRIBUTE}]`,
        );
        const targetIsSelectionRect = ev.target.classList.contains(
          flowCanvasConsts.NODE_SELECTION_RECT_CLASS_NAME,
        );
        const showStepContextMenu =
          stepElement || targetIsSelectionRect || targetIsSelectionChevron;
        if (showStepContextMenu) {
          setContextMenuType(ContextMenuType.STEP);
        } else {
          setContextMenuType(ContextMenuType.CANVAS);
        }
        const shouldRemoveSelectionRect =
          !targetIsSelectionRect && !targetIsSelectionChevron;
        if (shouldRemoveSelectionRect) {
          document
            .querySelector(
              `.${flowCanvasConsts.NODE_SELECTION_RECT_CLASS_NAME}`,
            )
            ?.remove();
        }
      }
    },
    [selectStepByName, reactFlowStore],
  );

  const onSelectionEnd = useCallback(() => {
    const isUnselectingNodes =
      document.querySelector(
        `.${flowCanvasConsts.NODE_SELECTION_RECT_CLASS_NAME}`,
      ) !== null;
    if (isUnselectingNodes) {
      reactFlowStore.getState().addSelectedNodes([]);
      return;
    }
    const canvasSelection = canvasSelectionUtils.getCanvasSelection(
      reactFlowStore.getState().nodeLookup,
    );
    if (canvasSelection.length === 0) {
      return;
    }
    reactFlowStore.getState().addSelectedNodes(
      canvasSelectionUtils.expandSelectionWithChildren({
        stepNames: canvasSelection,
        trigger: flowVersion.trigger,
      }),
    );
  }, [reactFlowStore, flowVersion.trigger]);

  const { setCursorPosition } = useCursorPosition();
  return (
    <div
      ref={containerRef}
      data-canvas-contrast
      data-single-selection={selectedNodes.length <= 1}
      className="@container size-full relative overflow-hidden z-30 bg-gray-2"
      onMouseMove={(event) => {
        const cursorPosition = { x: event.clientX, y: event.clientY };
        setCursorPosition(cursorPosition);
      }}
    >
      <FlowDragLayer>
        <CanvasContextMenu contextMenuType={contextMenuType}>
          <ReactFlow
            className={cn(
              'bg-gray-2 transition-opacity duration-300 ease-standard',
              fittedVersionId === null ? 'opacity-0' : 'opacity-100',
            )}
            onContextMenu={onContextMenu}
            onPaneClick={() => {
              reactFlowStore.getState().unselectNodesAndEdges();
            }}
            onMove={(event) => {
              if (event) {
                minimap.reveal();
              }
            }}
            nodeTypes={flowCanvasConsts.nodeTypes}
            nodes={localNodes.nodes}
            onNodesChange={onNodesChange}
            onNodeDragStart={onNodeDragStart}
            onNodeDrag={onNodeDrag}
            onNodeDragStop={(_event, _node, draggedNodes) =>
              commitDraggedNodes(draggedNodes)
            }
            onSelectionDragStop={(_event, draggedNodes) =>
              commitDraggedNodes(draggedNodes)
            }
            snapToGrid={true}
            snapGrid={SNAP_GRID}
            nodeDragThreshold={NODE_DRAG_THRESHOLD}
            nodeClickDistance={NODE_CLICK_DISTANCE}
            elevateNodesOnSelect={false}
            onConnectStart={onConnectStart}
            onConnectEnd={onConnectEnd}
            connectOnClick={false}
            isValidConnection={rejectConnection}
            connectionLineComponent={FlowConnectionLine}
            edgeTypes={flowCanvasConsts.edgeTypes}
            edges={graph.edges}
            draggable={false}
            edgesFocusable={false}
            elevateEdgesOnSelect={false}
            maxZoom={flowCanvasConsts.MAX_ZOOM}
            minZoom={flowCanvasConsts.MIN_ZOOM}
            panOnDrag={MIDDLE_MOUSE_BUTTON}
            panActivationKeyCode={PAN_ACTIVATION_KEYS}
            zoomActivationKeyCode={PAN_ACTIVATION_KEYS}
            deleteKeyCode={null}
            zoomOnDoubleClick={false}
            panOnScroll={true}
            panOnScrollMode={PanOnScrollMode.Free}
            fitView={false}
            nodesConnectable={!readonly}
            elementsSelectable={true}
            nodesDraggable={false}
            nodesFocusable={false}
            selectionKeyCode={null}
            multiSelectionKeyCode="Shift"
            selectionOnDrag={true}
            selectNodesOnDrag={true}
            selectionMode={SelectionMode.Partial}
            onSelectionChange={onSelectionChange}
            onSelectionEnd={onSelectionEnd}
          >
            <CanvasBackground readonly={readonly} />
            <Minimap
              visible={minimap.visible}
              onPointerEnter={minimap.onPointerEnter}
              onPointerLeave={minimap.onPointerLeave}
            />
          </ReactFlow>
        </CanvasContextMenu>
      </FlowDragLayer>
      <CanvasTestBar />
    </div>
  );
});

FlowCanvas.displayName = 'FlowCanvas';

function carryNodeState({
  previous,
  next,
}: {
  previous: ApNode[];
  next: ApNode[];
}): ApNode[] {
  const previousById = new Map(previous.map((node) => [node.id, node]));
  return next.map((node) => {
    const prior = previousById.get(node.id);
    if (isNil(prior) || prior.type !== node.type) {
      return node;
    }
    return { ...node, selected: prior.selected, measured: prior.measured };
  });
}

function findArmedDropTarget({
  pointer,
  targetIds,
  zoom,
}: {
  pointer: XYPosition;
  targetIds: string[];
  zoom: number;
}): string | null {
  const candidates = targetIds
    .map((id) => {
      const element = document.querySelector(
        `[data-drop-target="${CSS.escape(id)}"]`,
      );
      if (isNil(element)) {
        return null;
      }
      const rect = element.getBoundingClientRect();
      const distance =
        Math.hypot(
          rect.left + rect.width / 2 - pointer.x,
          rect.top + rect.height / 2 - pointer.y,
        ) / zoom;
      return { id, distance };
    })
    .filter(
      (candidate): candidate is { id: string; distance: number } =>
        !isNil(candidate) && candidate.distance <= DROP_TARGET_RADIUS,
    )
    .sort((a, b) => a.distance - b.distance);
  return candidates[0]?.id ?? null;
}

function getClientPoint(event: MouseEvent | TouchEvent): XYPosition | null {
  if ('clientX' in event) {
    return { x: event.clientX, y: event.clientY };
  }
  const touch = event.changedTouches[0] ?? event.touches[0];
  return isNil(touch) ? null : { x: touch.clientX, y: touch.clientY };
}

function isEmptyCanvasPoint(point: XYPosition): boolean {
  const element = document
    .elementsFromPoint(point.x, point.y)
    .find((candidate) => isNil(candidate.closest(CONNECTION_LINE_SELECTOR)));
  return (
    !isNil(element) &&
    (element.classList.contains(REACT_FLOW_PANE_CLASS_NAME) ||
      !isNil(element.closest(EDGES_SELECTOR)))
  );
}

function rejectConnection(): boolean {
  return false;
}

const MIDDLE_MOUSE_BUTTON = [1];
const PAN_ACTIVATION_KEYS = ['Space', 'Control', 'Meta'];
const SNAP_GRID: [number, number] = [16, 16];
const NODE_DRAG_THRESHOLD = 4;
const NODE_CLICK_DISTANCE = 4;
const CONNECTION_CLICK_DISTANCE = 4;
const DROP_TARGET_RADIUS = 32;
const REACT_FLOW_PANE_CLASS_NAME = 'react-flow__pane';
const CONNECTION_LINE_SELECTOR = '.react-flow__connectionline';
const EDGES_SELECTOR = '.react-flow__edges';
const getChildrenKey = (step: Step) => {
  switch (step.type) {
    case FlowActionType.LOOP_ON_ITEMS:
      return step.firstLoopAction ? step.firstLoopAction.name : '';
    case FlowActionType.ROUTER:
    case FlowActionType.AI_ROUTER:
      return step.children.reduce((routerKey, child) => {
        const childrenKey = child
          ? flowStructureUtil
              .getAllSteps(child)
              .reduce(
                (childKey, grandChild) => `${childKey}-${grandChild.name}`,
                '',
              )
          : 'null';
        return `${routerKey}-${childrenKey}`;
      }, '');
    case FlowActionType.CODE:
    case FlowActionType.PIECE: {
      const cofEnabled = flowStructureUtil.hasContinueOnFailureBranches(step);
      const branches = step.continueOnFailureBranches;
      const onSuccessKey = branches?.onSuccess
        ? flowStructureUtil
            .getAllSteps(branches.onSuccess)
            .reduce((acc, s) => `${acc}-${s.name}`, '')
        : 'null';
      const onFailureKey = branches?.onFailure
        ? flowStructureUtil
            .getAllSteps(branches.onFailure)
            .reduce((acc, s) => `${acc}-${s.name}`, '')
        : 'null';
      return `cof:${cofEnabled}-success:${onSuccessKey}-failure:${onFailureKey}`;
    }
  }
};
const createGraphKey = ({
  flowVersion,
  notes,
  selectedStep,
  readonly,
}: {
  flowVersion: FlowVersion;
  notes: Note[];
  selectedStep: string;
  readonly: boolean;
}) => {
  const flowGraphKey = flowStructureUtil
    .getAllSteps(flowVersion.trigger)
    .reduce((acc, step) => {
      const branchesNames = flowStructureUtil.isBranchedAction(step)
        ? step.settings.branches.map((branch) => branch.branchName).join('-')
        : '0';
      const childrenKey = getChildrenKey(step);
      return `${acc}-${step.displayName}-${step.type}-${
        step.nextAction ? step.nextAction.name : ''
      }-${
        step.type === FlowActionType.PIECE ||
        step.type === FlowTriggerType.PIECE
          ? `${step.settings.pieceName}-${step.settings.pieceVersion}`
          : ''
      }-${branchesNames}-${childrenKey}}`;
    }, '');
  const notesGraphKey = notes
    .map((note) => `${note.id}-${note.position.x}-${note.position.y}`)
    .join('-');
  const stepPositionsKey = Object.entries(flowVersion.stepPositions ?? {})
    .map(([stepName, position]) => `${stepName}:${position.x},${position.y}`)
    .join('|');
  return `${flowVersion.id}-${flowGraphKey}-${notesGraphKey}-${stepPositionsKey}-${selectedStep}-${readonly}`;
};

type LocalNodes = {
  key: string;
  nodes: ApNode[];
};
