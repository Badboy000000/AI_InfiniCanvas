import { Workflow, ExecutionPlan } from './types.js';
import { detectCycles } from './validator.js';

export class WorkflowCompilationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowCompilationError';
  }
}

/**
 * Topologically sorts the workflow nodes and creates an execution plan.
 * Nodes that have no dependencies on each other will be grouped in executionGroups
 * for potential parallel execution.
 */
export function compileExecutionPlan(workflow: Workflow): ExecutionPlan {
  // Ensure no cycles exist before sorting
  detectCycles(workflow);

  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();
  
  for (const node of workflow.nodes) {
    inDegree.set(node.id, 0);
    adjList.set(node.id, []);
  }

  for (const edge of workflow.edges) {
    if (!adjList.has(edge.sourceNodeId)) {
      adjList.set(edge.sourceNodeId, []);
    }
    if (!inDegree.has(edge.targetNodeId)) {
      inDegree.set(edge.targetNodeId, 0);
    }
    
    adjList.get(edge.sourceNodeId)!.push(edge.targetNodeId);
    inDegree.set(edge.targetNodeId, inDegree.get(edge.targetNodeId)! + 1);
  }

  const orderedNodes: string[] = [];
  const executionGroups: string[][] = [];

  let queue: string[] = [];
  for (const [nodeId, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(nodeId);
    }
  }

  while (queue.length > 0) {
    // Current queue represents nodes that can run in parallel
    const currentGroup = [...queue];
    executionGroups.push(currentGroup);
    
    const nextQueue: string[] = [];
    
    for (const nodeId of currentGroup) {
      orderedNodes.push(nodeId);
      
      const neighbors = adjList.get(nodeId) || [];
      for (const neighbor of neighbors) {
        const degree = inDegree.get(neighbor)! - 1;
        inDegree.set(neighbor, degree);
        if (degree === 0) {
          nextQueue.push(neighbor);
        }
      }
    }
    
    queue = nextQueue;
  }

  if (orderedNodes.length !== workflow.nodes.length) {
    throw new WorkflowCompilationError('Workflow contains cycles or unresolvable dependencies');
  }

  return {
    orderedNodes,
    executionGroups
  };
}
