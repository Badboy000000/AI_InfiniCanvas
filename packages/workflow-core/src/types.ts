import type { Node } from '../../node-protocol/src/index.js';

export type Edge = {
  id: string;
  sourceNodeId: string;
  sourceOutputKey: string;
  targetNodeId: string;
  targetInputKey: string;
};

export type Workflow = {
  id: string;
  name: string;
  description?: string;
  nodes: Node[];
  edges: Edge[];
  canvas?: {
    viewport?: {
      x: number;
      y: number;
      zoom: number;
    };
  };
  templateInfo?: {
    isTemplate?: boolean;
    demoInputRefs?: string[];
    demoResultVersionIds?: string[];
    demoAssetIds?: string[];
  };
  createdAt?: string;
  updatedAt?: string;
};

export type ExecutionPlan = {
  orderedNodes: string[];
  executionGroups?: string[][];
};

export type WorkflowOutputSnapshot = Record<
  string,
  {
    value: unknown;
    versionId: string;
  }
>;

export type WorkflowOutputSnapshots = Record<string, WorkflowOutputSnapshot>;

export type WorkflowSourceRef = {
  sourceNodeId: string;
  sourceOutputKey: string;
  versionId: string;
};

export type ResolvedWorkflowInput = {
  inputKey: string;
  value: unknown;
  sourceRefs: WorkflowSourceRef[];
};

export type ResolvedWorkflowInputs = Record<string, ResolvedWorkflowInput>;

export type WorkflowPortCompatibilityInput = {
  sourceDataType: string;
  targetAcceptedTypes: string[];
};
