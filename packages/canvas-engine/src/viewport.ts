import type { CanvasBounds, CanvasNode, CanvasPoint, CanvasViewport } from './types.js';

export const MIN_SCALE = 0.2;
export const MAX_SCALE = 3;

export function screenToWorld(screenX: number, screenY: number, viewport: CanvasViewport): CanvasPoint {
  return {
    x: (screenX - viewport.x) / viewport.scale,
    y: (screenY - viewport.y) / viewport.scale,
  };
}

export function worldToScreen(worldX: number, worldY: number, viewport: CanvasViewport): CanvasPoint {
  return {
    x: worldX * viewport.scale + viewport.x,
    y: worldY * viewport.scale + viewport.y,
  };
}

export function zoomAtPoint(
  viewport: CanvasViewport,
  anchorScreenX: number,
  anchorScreenY: number,
  deltaScale: number,
): CanvasViewport {
  const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, viewport.scale * deltaScale));
  if (newScale === viewport.scale) {
    return viewport;
  }

  const worldBefore = screenToWorld(anchorScreenX, anchorScreenY, viewport);
  return {
    scale: newScale,
    x: anchorScreenX - worldBefore.x * newScale,
    y: anchorScreenY - worldBefore.y * newScale,
  };
}

export function computeWorldBounds(nodes: CanvasNode[]): CanvasBounds {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 1000, maxY: 600 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    const width = node.width ?? 220;
    const height = node.height ?? 110;
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + width);
    maxY = Math.max(maxY, node.y + height);
  }

  const padding = 40;
  return {
    minX: minX - padding,
    minY: minY - padding,
    maxX: maxX + padding,
    maxY: maxY + padding,
  };
}
