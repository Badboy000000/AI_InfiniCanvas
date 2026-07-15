import type {
  CanvasBounds,
  CanvasMiniMapLayout,
  CanvasSize,
  CanvasViewport,
  CanvasViewportRect,
} from './types.js';

export function computeMiniMapLayout(bounds: CanvasBounds, miniMapSize: CanvasSize): CanvasMiniMapLayout {
  const worldWidth = bounds.maxX - bounds.minX;
  const worldHeight = bounds.maxY - bounds.minY;
  const scaleRatio = Math.min(miniMapSize.width / worldWidth, miniMapSize.height / worldHeight);
  const offsetX = (miniMapSize.width - worldWidth * scaleRatio) / 2;
  const offsetY = (miniMapSize.height - worldHeight * scaleRatio) / 2;

  return {
    scaleRatio,
    offsetX,
    offsetY,
  };
}

export function computeViewportRect(
  boardSize: CanvasSize,
  viewport: CanvasViewport,
  bounds: CanvasBounds,
  miniMapLayout: CanvasMiniMapLayout,
): CanvasViewportRect {
  const viewportWorldX = -viewport.x / viewport.scale;
  const viewportWorldY = -viewport.y / viewport.scale;
  const viewportWorldWidth = boardSize.width / viewport.scale;
  const viewportWorldHeight = boardSize.height / viewport.scale;

  return {
    x: (viewportWorldX - bounds.minX) * miniMapLayout.scaleRatio + miniMapLayout.offsetX,
    y: (viewportWorldY - bounds.minY) * miniMapLayout.scaleRatio + miniMapLayout.offsetY,
    w: viewportWorldWidth * miniMapLayout.scaleRatio,
    h: viewportWorldHeight * miniMapLayout.scaleRatio,
  };
}
