import type { InputPortDef, WorkflowEdge, WorkflowNode } from '../types';

export const PORT_HIT_RADIUS = 16;

export function getInputPortY(index: number, total: number): number {
  if (total <= 1) return 50;
  const spacing = total <= 3 ? 22 : 20;
  const start = 50 - ((total - 1) * spacing) / 2;
  return start + index * spacing;
}

export const OUTPUT_PORT_Y = 50;

export function getInputPortAnchor(node: WorkflowNode, portId: string): { x: number; y: number } {
  const ports = node.inputPorts ?? [];
  const index = ports.findIndex((p) => p.id === portId);
  const y = index >= 0 ? getInputPortY(index, ports.length) : OUTPUT_PORT_Y;
  return { x: node.x, y: node.y + y };
}

export function getOutputPortAnchor(node: WorkflowNode): { x: number; y: number } {
  const width = node.width ?? 220;
  return { x: node.x + width, y: node.y + OUTPUT_PORT_Y };
}

export function getPortAnchor(
  node: WorkflowNode,
  port: string,
  side: 'left' | 'right',
): { x: number; y: number } {
  return side === 'right' ? getOutputPortAnchor(node) : getInputPortAnchor(node, port);
}

export function isConnectionCompatible(
  outputNode: WorkflowNode,
  targetPort: InputPortDef,
): boolean {
  if (targetPort.dataType === 'any') return true;
  return outputNode.dataType === targetPort.dataType;
}

export function wouldCreateCycle(
  edges: WorkflowEdge[],
  fromId: string,
  toId: string,
): boolean {
  if (fromId === toId) return true;
  const visited = new Set<string>();
  const queue = [toId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const edge of edges) {
      if (edge.from === current) {
        if (edge.to === fromId) return true;
        queue.push(edge.to);
      }
    }
  }
  return false;
}

export function findPortAtPosition(
  nodes: WorkflowNode[],
  x: number,
  y: number,
  excludeNodeId?: string,
): { nodeId: string; portId: string; port: InputPortDef } | null {
  for (const node of nodes) {
    if (excludeNodeId && node.id === excludeNodeId) continue;
    const ports = node.inputPorts ?? [];
    for (let i = 0; i < ports.length; i++) {
      const port = ports[i];
      const anchor = getInputPortAnchor(node, port.id);
      const dx = x - anchor.x;
      const dy = y - anchor.y;
      if (dx * dx + dy * dy <= PORT_HIT_RADIUS * PORT_HIT_RADIUS) {
        return { nodeId: node.id, portId: port.id, port };
      }
    }
  }
  return null;
}
