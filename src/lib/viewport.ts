import type { WorkflowNode } from '../types';

export type Viewport = { scale: number; x: number; y: number };

export const MIN_SCALE = 0.2;
export const MAX_SCALE = 3;

export function screenToWorld(
  screenX: number,
  screenY: number,
  vp: Viewport,
): { x: number; y: number } {
  return {
    x: (screenX - vp.x) / vp.scale,
    y: (screenY - vp.y) / vp.scale,
  };
}

export function worldToScreen(
  worldX: number,
  worldY: number,
  vp: Viewport,
): { x: number; y: number } {
  return {
    x: worldX * vp.scale + vp.x,
    y: worldY * vp.scale + vp.y,
  };
}

export function zoomAtPoint(
  vp: Viewport,
  anchorScreenX: number,
  anchorScreenY: number,
  deltaScale: number,
): Viewport {
  const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, vp.scale * deltaScale));
  if (newScale === vp.scale) return vp;
  const worldBefore = screenToWorld(anchorScreenX, anchorScreenY, vp);
  return {
    scale: newScale,
    x: anchorScreenX - worldBefore.x * newScale,
    y: anchorScreenY - worldBefore.y * newScale,
  };
}

export function computeWorldBounds(nodes: WorkflowNode[]) {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 1000, maxY: 600 };
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const node of nodes) {
    const w = node.width ?? 220;
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + w);
    maxY = Math.max(maxY, node.y + 110);
  }
  const pad = 40;
  return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
}
