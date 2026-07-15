import {
  computeMiniMapLayout,
  computeViewportRect,
  computeWorldBounds,
  findPortAtPosition,
  getInputPortAnchor,
  getOutputPortAnchor,
  screenToWorld,
  worldToScreen,
  zoomAtPoint,
  type CanvasNode,
  type CanvasViewport,
} from '../packages/canvas-engine/src/index.js';
import { strict as assert } from 'node:assert';

const viewport: CanvasViewport = { scale: 2, x: 100, y: 80 };
assert.deepEqual(screenToWorld(140, 120, viewport), { x: 20, y: 20 });
assert.deepEqual(worldToScreen(20, 20, viewport), { x: 140, y: 120 });

const zoomed = zoomAtPoint({ scale: 1, x: 0, y: 0 }, 200, 100, 2);
assert.deepEqual(zoomed, { scale: 2, x: -200, y: -100 });

const nodes: CanvasNode[] = [
  {
    id: 'node-a',
    x: 10,
    y: 20,
    width: 200,
    inputPorts: [
      { id: 'input-1', label: '输入 1' },
      { id: 'input-2', label: '输入 2' },
    ],
  },
  {
    id: 'node-b',
    x: 320,
    y: 180,
    width: 240,
  },
];

const bounds = computeWorldBounds(nodes);
assert.deepEqual(bounds, {
  minX: -30,
  minY: -20,
  maxX: 600,
  maxY: 330,
});

assert.deepEqual(getInputPortAnchor(nodes[0], 'input-1'), { x: 10, y: 59 });
assert.deepEqual(getOutputPortAnchor(nodes[0]), { x: 210, y: 70 });

const hit = findPortAtPosition(nodes, 10, 59, undefined);
assert.deepEqual(hit, { nodeId: 'node-a', portId: 'input-1' });

const miss = findPortAtPosition(nodes, 500, 500, undefined);
assert.equal(miss, null);

const miniMapLayout = computeMiniMapLayout(bounds, { width: 100, height: 80 });
assert.equal(miniMapLayout.scaleRatio, 100 / 630);
assert.equal(miniMapLayout.offsetX, 0);
assert.ok(Math.abs(miniMapLayout.offsetY - 12.222222222222223) < 1e-9);

const viewportRect = computeViewportRect({ width: 1200, height: 700 }, { scale: 1, x: 0, y: 0 }, bounds, miniMapLayout);
assert.ok(Math.abs(viewportRect.x - 4.761904761904762) < 1e-9);
assert.ok(Math.abs(viewportRect.y - 15.396825396825397) < 1e-9);
assert.ok(Math.abs(viewportRect.w - 190.47619047619048) < 1e-9);
assert.ok(Math.abs(viewportRect.h - 111.11111111111111) < 1e-9);

console.log('canvas-engine tests passed');
