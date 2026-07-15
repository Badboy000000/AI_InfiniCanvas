export type CanvasNode = {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  inputPorts?: Array<{
    id: string;
    label: string;
  }>;
};

export type CanvasViewport = {
  scale: number;
  x: number;
  y: number;
};

export type CanvasPoint = {
  x: number;
  y: number;
};

export type CanvasBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type CanvasSize = {
  width: number;
  height: number;
};

export type CanvasMiniMapLayout = {
  scaleRatio: number;
  offsetX: number;
  offsetY: number;
};

export type CanvasViewportRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type CanvasPortHit = {
  nodeId: string;
  portId: string;
};
