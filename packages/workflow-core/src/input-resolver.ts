import type { InputPort, NodeDefinition } from '../../node-protocol/src/index.js';
import type {
  Edge,
  ResolvedWorkflowInput,
  ResolvedWorkflowInputs,
  Workflow,
  WorkflowOutputSnapshots,
  WorkflowPortCompatibilityInput,
} from './types.js';
import { WorkflowValidationError } from './validator.js';

export function isWorkflowPortCompatible({
  sourceDataType,
  targetAcceptedTypes,
}: WorkflowPortCompatibilityInput): boolean {
  return targetAcceptedTypes.includes(sourceDataType);
}

export function wouldCreateWorkflowCycle(edges: Edge[], fromNodeId: string, toNodeId: string): boolean {
  if (fromNodeId === toNodeId) {
    return true;
  }

  const visited = new Set<string>();
  const queue = [toNodeId];

  while (queue.length > 0) {
    const currentNodeId = queue.shift();
    if (!currentNodeId || visited.has(currentNodeId)) {
      continue;
    }

    visited.add(currentNodeId);

    for (const edge of edges) {
      if (edge.sourceNodeId !== currentNodeId) {
        continue;
      }

      if (edge.targetNodeId === fromNodeId) {
        return true;
      }

      queue.push(edge.targetNodeId);
    }
  }

  return false;
}

export function resolveNodeInputs({
  workflow,
  nodeId,
  definitions,
  outputSnapshots,
}: {
  workflow: Workflow;
  nodeId: string;
  definitions: Record<string, NodeDefinition>;
  outputSnapshots: WorkflowOutputSnapshots;
}): ResolvedWorkflowInputs {
  const node = workflow.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) {
    throw new WorkflowValidationError(`Node not found: ${nodeId}`);
  }

  const definition = definitions[node.type];
  if (!definition) {
    throw new WorkflowValidationError(`Definition not found for node type: ${node.type}`);
  }

  const incomingEdges = workflow.edges.filter((edge) => edge.targetNodeId === nodeId);
  const resolvedInputs: ResolvedWorkflowInputs = {};

  for (const inputPort of definition.inputs) {
    const matchingEdges = incomingEdges.filter((edge) => edge.targetInputKey === inputPort.key);

    if (matchingEdges.length === 0) {
      if (inputPort.required) {
        throw new WorkflowValidationError(`Missing required input '${inputPort.key}' on node '${nodeId}'`);
      }
      continue;
    }

    if (inputPort.cardinality === 'single') {
      if (matchingEdges.length > 1) {
        throw new WorkflowValidationError(
          `Input '${inputPort.key}' on node '${nodeId}' does not allow multiple upstream connections`,
        );
      }

      resolvedInputs[inputPort.key] = resolveSingleInput(inputPort, matchingEdges[0], outputSnapshots);
      continue;
    }

    resolvedInputs[inputPort.key] = resolveArrayInput(inputPort, matchingEdges, node.config.orderedInputs?.[inputPort.key], outputSnapshots);
  }

  return resolvedInputs;
}

function resolveSingleInput(
  inputPort: InputPort,
  edge: Edge,
  outputSnapshots: WorkflowOutputSnapshots,
): ResolvedWorkflowInput {
  const snapshot = getOutputSnapshot(outputSnapshots, edge);
  return {
    inputKey: inputPort.key,
    value: snapshot.value,
    sourceRefs: [
      {
        sourceNodeId: edge.sourceNodeId,
        sourceOutputKey: edge.sourceOutputKey,
        versionId: snapshot.versionId,
      },
    ],
  };
}

function resolveArrayInput(
  inputPort: InputPort,
  edges: Edge[],
  orderedInputs: Array<{ sourceNodeId: string; sourceOutputKey: string }> | undefined,
  outputSnapshots: WorkflowOutputSnapshots,
): ResolvedWorkflowInput {
  const sortedEdges = sortEdgesForArrayInput(edges, orderedInputs);
  const values: unknown[] = [];
  const sourceRefs: ResolvedWorkflowInput['sourceRefs'] = [];

  for (const edge of sortedEdges) {
    const snapshot = getOutputSnapshot(outputSnapshots, edge);
    values.push(snapshot.value);
    sourceRefs.push({
      sourceNodeId: edge.sourceNodeId,
      sourceOutputKey: edge.sourceOutputKey,
      versionId: snapshot.versionId,
    });
  }

  return {
    inputKey: inputPort.key,
    value: values,
    sourceRefs,
  };
}

function sortEdgesForArrayInput(
  edges: Edge[],
  orderedInputs: Array<{ sourceNodeId: string; sourceOutputKey: string }> | undefined,
): Edge[] {
  if (!orderedInputs || orderedInputs.length === 0) {
    return [...edges];
  }

  const orderMap = new Map<string, number>();
  orderedInputs.forEach((item, index) => {
    orderMap.set(createEdgeKey(item.sourceNodeId, item.sourceOutputKey), index);
  });

  return [...edges].sort((left, right) => {
    const leftOrder = orderMap.get(createEdgeKey(left.sourceNodeId, left.sourceOutputKey));
    const rightOrder = orderMap.get(createEdgeKey(right.sourceNodeId, right.sourceOutputKey));

    if (leftOrder === undefined && rightOrder === undefined) {
      return 0;
    }

    if (leftOrder === undefined) {
      return 1;
    }

    if (rightOrder === undefined) {
      return -1;
    }

    return leftOrder - rightOrder;
  });
}

function getOutputSnapshot(outputSnapshots: WorkflowOutputSnapshots, edge: Edge) {
  const nodeOutputs = outputSnapshots[edge.sourceNodeId];
  if (!nodeOutputs) {
    throw new WorkflowValidationError(`Output snapshot not found for node '${edge.sourceNodeId}'`, { edge });
  }

  const snapshot = nodeOutputs[edge.sourceOutputKey];
  if (!snapshot) {
    throw new WorkflowValidationError(
      `Output snapshot not found for '${edge.sourceNodeId}.${edge.sourceOutputKey}'`,
      { edge },
    );
  }

  return snapshot;
}

function createEdgeKey(sourceNodeId: string, sourceOutputKey: string): string {
  return `${sourceNodeId}:${sourceOutputKey}`;
}
