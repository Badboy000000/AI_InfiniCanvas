import {
  computeWorldBounds,
  MAX_SCALE,
  MIN_SCALE,
  screenToWorld,
  worldToScreen,
  zoomAtPoint,
  type CanvasNode,
  type CanvasViewport,
} from '@ai-canvas/canvas-engine';
import type { WorkflowNode } from '../types';

export type Viewport = CanvasViewport;

export { computeWorldBounds, MAX_SCALE, MIN_SCALE, screenToWorld, worldToScreen, zoomAtPoint };

export function toCanvasNodes(nodes: WorkflowNode[]): CanvasNode[] {
  return nodes.map((node) => ({
    id: node.id,
    x: node.x,
    y: node.y,
    width: node.width,
    inputPorts: node.inputPorts,
  }));
}
