import {
  computeMiniMapLayout,
  computeViewportRect,
  findPortAtPosition as findCanvasPortAtPosition,
  getInputPortAnchor as getCanvasInputPortAnchor,
  getInputPortY,
  getOutputPortAnchor as getCanvasOutputPortAnchor,
  getPortAnchor as getCanvasPortAnchor,
  OUTPUT_PORT_Y,
  PORT_HIT_RADIUS,
  type CanvasBounds,
  type CanvasNode,
  type CanvasSize,
  type CanvasViewport,
} from '@ai-canvas/canvas-engine';
import type { InputPortDef, WorkflowNode } from '../types';

function toCanvasNode(node: WorkflowNode): CanvasNode {
  return {
    id: node.id,
    x: node.x,
    y: node.y,
    width: node.width,
    inputPorts: node.inputPorts,
  };
}

export { computeMiniMapLayout, computeViewportRect, getInputPortY, OUTPUT_PORT_Y, PORT_HIT_RADIUS };

export function toCanvasNodeList(nodes: WorkflowNode[]): CanvasNode[] {
  return nodes.map((node) => toCanvasNode(node));
}

export type MiniMapLayoutInput = {
  bounds: CanvasBounds;
  miniMapSize: CanvasSize;
  boardSize: CanvasSize;
  viewport: CanvasViewport;
};

export function getMiniMapViewportRect({ bounds, miniMapSize, boardSize, viewport }: MiniMapLayoutInput) {
  const layout = computeMiniMapLayout(bounds, miniMapSize);
  return {
    layout,
    viewportRect: computeViewportRect(boardSize, viewport, bounds, layout),
  };
}

export function getInputPortAnchor(node: WorkflowNode, portId: string): { x: number; y: number } {
  return getCanvasInputPortAnchor(toCanvasNode(node), portId);
}

export function getOutputPortAnchor(node: WorkflowNode): { x: number; y: number } {
  return getCanvasOutputPortAnchor(toCanvasNode(node));
}

export function getPortAnchor(
  node: WorkflowNode,
  port: string,
  side: 'left' | 'right',
): { x: number; y: number } {
  return getCanvasPortAnchor(toCanvasNode(node), port, side);
}

// isConnectionCompatible / wouldCreateCycle 已下沉到 @ai-canvas/workflow-core，
// 由 apps/web/src/domain/edge-validation.ts 通过 tryValidateEdge 统一使用；本文件不再暴露判定入口。

export function findPortAtPosition(
  nodes: WorkflowNode[],
  x: number,
  y: number,
  excludeNodeId?: string,
): { nodeId: string; portId: string; port: InputPortDef } | null {
  const hit = findCanvasPortAtPosition(
    nodes.map((node) => toCanvasNode(node)),
    x,
    y,
    excludeNodeId,
  );

  if (!hit) {
    return null;
  }

  const node = nodes.find((candidate) => candidate.id === hit.nodeId);
  const port = node?.inputPorts?.find((candidate) => candidate.id === hit.portId);
  if (!node || !port) {
    return null;
  }

  return {
    nodeId: hit.nodeId,
    portId: hit.portId,
    port,
  };
}
