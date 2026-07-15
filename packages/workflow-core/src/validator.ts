import { Workflow, Edge } from './types.js';
import type { NodeDefinition } from '../../node-protocol/src/index.js';

export class WorkflowValidationError extends Error {
  constructor(message: string, public readonly details?: unknown) {
    super(message);
    this.name = 'WorkflowValidationError';
  }
}

/**
 * Detects if the workflow contains any cycles
 * Throws WorkflowValidationError if a cycle is detected
 */
export function detectCycles(workflow: Workflow): void {
  const adjList = new Map<string, string[]>();
  
  for (const node of workflow.nodes) {
    adjList.set(node.id, []);
  }

  for (const edge of workflow.edges) {
    if (!adjList.has(edge.sourceNodeId)) {
      adjList.set(edge.sourceNodeId, []);
    }
    adjList.get(edge.sourceNodeId)!.push(edge.targetNodeId);
  }

  const visited = new Set<string>();
  const recStack = new Set<string>();

  function dfs(nodeId: string, path: string[]): boolean {
    if (recStack.has(nodeId)) {
      throw new WorkflowValidationError(`Cycle detected: ${path.join(' -> ')} -> ${nodeId}`);
    }
    if (visited.has(nodeId)) {
      return false;
    }

    visited.add(nodeId);
    recStack.add(nodeId);

    const neighbors = adjList.get(nodeId) || [];
    for (const neighbor of neighbors) {
      dfs(neighbor, [...path, nodeId]);
    }

    recStack.delete(nodeId);
    return false;
  }

  for (const node of workflow.nodes) {
    if (!visited.has(node.id)) {
      dfs(node.id, []);
    }
  }
}

/**
 * Validates edge connections based on node definitions
 */
export function validateEdges(
  workflow: Workflow,
  definitions: Record<string, NodeDefinition>
): void {
  const nodeMap = new Map(workflow.nodes.map(n => [n.id, n]));

  for (const edge of workflow.edges) {
    const sourceNode = nodeMap.get(edge.sourceNodeId);
    const targetNode = nodeMap.get(edge.targetNodeId);

    if (!sourceNode) {
      throw new WorkflowValidationError(`Source node not found: ${edge.sourceNodeId}`, { edge });
    }
    if (!targetNode) {
      throw new WorkflowValidationError(`Target node not found: ${edge.targetNodeId}`, { edge });
    }

    const sourceDef = definitions[sourceNode.type];
    const targetDef = definitions[targetNode.type];

    if (!sourceDef) {
      throw new WorkflowValidationError(`Definition not found for node type: ${sourceNode.type}`, { node: sourceNode });
    }
    if (!targetDef) {
      throw new WorkflowValidationError(`Definition not found for node type: ${targetNode.type}`, { node: targetNode });
    }

    const outputPort = sourceDef.outputs.find((outputPort) => outputPort.key === edge.sourceOutputKey);
    const inputPort = targetDef.inputs.find((inputPort) => inputPort.key === edge.targetInputKey);

    if (!outputPort) {
      throw new WorkflowValidationError(
        `Output port '${edge.sourceOutputKey}' not found on node '${sourceNode.id}' (type: ${sourceNode.type})`,
        { edge }
      );
    }
    if (!inputPort) {
      throw new WorkflowValidationError(
        `Input port '${edge.targetInputKey}' not found on node '${targetNode.id}' (type: ${targetNode.type})`,
        { edge }
      );
    }

    // Check data type compatibility
    if (!inputPort.acceptedTypes.includes(outputPort.dataType)) {
      throw new WorkflowValidationError(
        `Type mismatch: output port '${outputPort.key}' provides '${outputPort.dataType}', but input port '${inputPort.key}' accepts [${inputPort.acceptedTypes.join(', ')}]`,
        { edge, outputPort, inputPort }
      );
    }
  }
}

export function validateWorkflow(workflow: Workflow, definitions: Record<string, NodeDefinition>): void {
  detectCycles(workflow);
  validateEdges(workflow, definitions);
}
