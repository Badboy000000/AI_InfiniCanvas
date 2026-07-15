import type { CanvasNode, CanvasPoint, CanvasPortHit } from './types.js';

export const PORT_HIT_RADIUS = 16;
export const OUTPUT_PORT_Y = 50;

export function getInputPortY(index: number, total: number): number {
  if (total <= 1) {
    return 50;
  }

  const spacing = total <= 3 ? 22 : 20;
  const start = 50 - ((total - 1) * spacing) / 2;
  return start + index * spacing;
}

export function getInputPortAnchor(node: CanvasNode, portId: string): CanvasPoint {
  const ports = node.inputPorts ?? [];
  const index = ports.findIndex((port) => port.id === portId);
  const y = index >= 0 ? getInputPortY(index, ports.length) : OUTPUT_PORT_Y;
  return { x: node.x, y: node.y + y };
}

export function getOutputPortAnchor(node: CanvasNode): CanvasPoint {
  const width = node.width ?? 220;
  return { x: node.x + width, y: node.y + OUTPUT_PORT_Y };
}

export function getPortAnchor(node: CanvasNode, portId: string, side: 'left' | 'right'): CanvasPoint {
  return side === 'right' ? getOutputPortAnchor(node) : getInputPortAnchor(node, portId);
}

export function findPortAtPosition(
  nodes: CanvasNode[],
  x: number,
  y: number,
  excludeNodeId?: string,
): CanvasPortHit | null {
  for (const node of nodes) {
    if (excludeNodeId && node.id === excludeNodeId) {
      continue;
    }

    const ports = node.inputPorts ?? [];
    for (let index = 0; index < ports.length; index += 1) {
      const port = ports[index];
      const anchor = getInputPortAnchor(node, port.id);
      const dx = x - anchor.x;
      const dy = y - anchor.y;
      if (dx * dx + dy * dy <= PORT_HIT_RADIUS * PORT_HIT_RADIUS) {
        return { nodeId: node.id, portId: port.id };
      }
    }
  }

  return null;
}
