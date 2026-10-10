import {
  FlowAction,
  StepLocationRelativeToParent,
  FlowTrigger,
  Note,
} from '@activepieces/shared';
import { Edge } from '@xyflow/react';

export enum ApNodeType {
  STEP = 'STEP',
  JOIN = 'JOIN',
  NOTE = 'NOTE',
}

export enum ApEdgeType {
  FLOW = 'ApFlowEdge',
}

export type ApButtonData =
  | {
      parentStepName: string;
      stepLocationRelativeToParent:
        | StepLocationRelativeToParent.AFTER
        | StepLocationRelativeToParent.INSIDE_LOOP
        | StepLocationRelativeToParent.INSIDE_ON_SUCCESS_BRANCH
        | StepLocationRelativeToParent.INSIDE_ON_FAILURE_BRANCH;
    }
  | {
      parentStepName: string;
      stepLocationRelativeToParent: StepLocationRelativeToParent.INSIDE_BRANCH;
      branchIndex: number;
    };

export type ApOutputLabelKind =
  | 'branch'
  | 'fallback'
  | 'done'
  | 'loop'
  | 'success'
  | 'failure';

export type ApStepOutput = {
  id: string;
  offset: number;
  labelKind: ApOutputLabelKind | null;
  branchName: string | null;
  branchIndex: number | null;
  insertLocation: ApButtonData;
  hasStub: boolean;
};

export type ApNodeRuntimeState = {
  selected?: boolean;
  dragging?: boolean;
  measured?: {
    width?: number;
    height?: number;
  };
};

export type ApStepNode = ApNodeRuntimeState & {
  id: string;
  type: ApNodeType.STEP;
  position: {
    x: number;
    y: number;
  };
  data: {
    step: FlowAction | FlowTrigger;
    height: number;
    outputs: ApStepOutput[];
    hasInput: boolean;
    hasIncomingEdge: boolean;
  };
  selectable?: boolean;
  draggable?: boolean;
  zIndex?: number;
  style?: React.CSSProperties;
};

export type ApJoinNode = ApNodeRuntimeState & {
  id: string;
  type: ApNodeType.JOIN;
  position: {
    x: number;
    y: number;
  };
  data: {
    stepName: string;
    stub: ApButtonData | null;
  };
  selectable?: boolean;
  draggable?: boolean;
  zIndex?: number;
  style?: React.CSSProperties;
};

export type ApNoteNode = ApNodeRuntimeState & {
  id: string;
  type: ApNodeType.NOTE;
  position: {
    x: number;
    y: number;
  };
  data: Pick<Note, 'content' | 'ownerId' | 'color' | 'size'>;
  draggable?: boolean;
  className?: string;
  zIndex?: number;
};

export type ApNode = ApStepNode | ApJoinNode | ApNoteNode;

export type ApEdgeRunCheck =
  | { kind: 'step'; stepName: string }
  | { kind: 'branch'; stepName: string; branchIndex: number }
  | { kind: 'cof-branch'; stepName: string; onFailure: boolean };

export type ApFlowEdge = Edge & {
  type: ApEdgeType.FLOW;
  data: {
    insertLocation: ApButtonData;
    sourceStepName: string;
    targetRunCheck: ApEdgeRunCheck;
    targetIsJoin: boolean;
    sourceOutput: { stepName: string; isLoopOutput: boolean } | null;
  };
};

export type ApEdge = ApFlowEdge;

export type ApGraph = {
  nodes: ApNode[];
  edges: ApEdge[];
};

export type ApDropTarget = {
  id: string;
  location: ApButtonData;
};
