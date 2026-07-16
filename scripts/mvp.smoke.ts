import { strict as assert } from 'node:assert';
import { createServer, type Server } from 'node:http';
import { wireApiWithInProcessWorker } from './wire-mvp.js';
import { createEcommerceDetailWorkflow } from '../apps/api/src/templates/ecommerce-detail.js';
import type { RunEvent, RunState } from '../packages/event-core/src/index.js';

const app = wireApiWithInProcessWorker();
const server: Server = createServer((req, res) => {
  app.handler(req, res).catch((error) => {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end(String(error));
    }
  });
});

const port: number = await new Promise((resolve) => {
  server.listen(0, () => {
    const address = server.address();
    if (address && typeof address === 'object') resolve(address.port);
    else resolve(0);
  });
});

const base = `http://127.0.0.1:${port}`;

async function fetchJson(path: string, init?: RequestInit) {
  const response = await fetch(`${base}${path}`, init);
  const text = await response.text();
  const body = text ? JSON.parse(text) : undefined;
  return { status: response.status, body };
}

type SseFrame =
  | { type: 'RunStateSnapshot'; state: RunState }
  | RunEvent;

/**
 * 用 fetch 流式读取 SSE。
 * 返回 promise：当收到 WorkflowRunCompleted / WorkflowRunFailed / WorkflowRunCancelled 时 resolve 全部帧。
 */
async function consumeSse(runId: string, timeoutMs = 5000): Promise<SseFrame[]> {
  const controller = new AbortController();
  const response = await fetch(`${base}/api/runs/${runId}/events`, {
    headers: { Accept: 'text/event-stream' },
    signal: controller.signal,
  });
  if (!response.ok || !response.body) {
    throw new Error(`SSE connection failed: ${response.status}`);
  }
  const frames: SseFrame[] = [];
  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let buffer = '';
  const start = Date.now();

  try {
    while (true) {
      if (Date.now() - start > timeoutMs) {
        throw new Error(`SSE timed out after ${timeoutMs}ms, got ${frames.length} frames`);
      }
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx = buffer.indexOf('\n\n');
      while (idx >= 0) {
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        idx = buffer.indexOf('\n\n');
        const dataLine = raw
          .split('\n')
          .find((line) => line.startsWith('data:'));
        if (!dataLine) continue;
        const payload = dataLine.slice(5).trim();
        if (!payload) continue;
        const frame = JSON.parse(payload) as SseFrame;
        frames.push(frame);
        if (
          'type' in frame &&
          (frame.type === 'WorkflowRunCompleted' ||
            frame.type === 'WorkflowRunFailed' ||
            frame.type === 'WorkflowRunCancelled')
        ) {
          controller.abort();
          return frames;
        }
      }
    }
  } finally {
    try {
      controller.abort();
    } catch {
      // ignore
    }
  }
  return frames;
}

try {
  // 1) 定义清单可拉取
  const defs = await fetchJson('/api/node-definitions');
  assert.equal(defs.status, 200);
  const requiredTypes = ['input.text', 'input.image', 'ai.image_analysis', 'processor.context_assembler', 'ai.image_generation', 'processor.image_stitch', 'export.image'];
  for (const type of requiredTypes) {
    assert.ok(defs.body.definitions.some((d: { type: string }) => d.type === type), `missing ${type}`);
  }

  // 2) 保存电商详情图模板
  const workflow = createEcommerceDetailWorkflow('wf-mvp');
  const save = await fetchJson('/api/workflows', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(workflow),
  });
  assert.equal(save.status, 200, `expected 200, got ${save.status}: ${JSON.stringify(save.body)}`);

  // 3) 主动 validate 应无拒绝
  const validate = await fetchJson('/api/workflows/wf-mvp/validate', { method: 'POST' });
  assert.equal(validate.status, 200);
  assert.deepEqual(validate.body.rejections, []);

  // 4) 创建 run
  const runResp = await fetchJson('/api/workflows/wf-mvp/runs', { method: 'POST' });
  assert.equal(runResp.status, 200);
  const runId = runResp.body.run.runId as string;
  assert.ok(runId);

  // 5) 消费 SSE 直到完成
  const frames = await consumeSse(runId, 8000);
  assert.ok(frames.length > 0);
  const snapshot = frames[0];
  assert.equal((snapshot as { type: string }).type, 'RunStateSnapshot');

  const eventTypes = frames.slice(1).map((frame) => (frame as RunEvent).type);
  assert.ok(eventTypes.includes('WorkflowRunStarted'));
  assert.ok(eventTypes.includes('WorkflowRunCompleted'), `expected completed, got ${eventTypes.join(',')}`);
  const nodeSucceeded = eventTypes.filter((type) => type === 'NodeSucceeded').length;
  assert.equal(nodeSucceeded, 7, `expected 7 NodeSucceeded events, got ${nodeSucceeded}`);

  // 6) 最终状态一致性
  const finalRun = await fetchJson(`/api/runs/${runId}`);
  assert.equal(finalRun.status, 200);
  const finalState: RunState = finalRun.body.run;
  assert.equal(finalState.status, 'success');
  for (const nodeId of ['product_text', 'product_images', 'image_analysis', 'context_assembler', 'image_generation', 'image_stitch', 'export_image']) {
    assert.equal(finalState.nodeStates[nodeId]?.status, 'success', `node ${nodeId} expected success, got ${finalState.nodeStates[nodeId]?.status}`);
    assert.ok((finalState.nodeStates[nodeId]?.resultVersionIds.length ?? 0) > 0, `node ${nodeId} missing result version`);
  }

  console.log('mvp smoke passed', { frames: frames.length, runId });
} finally {
  server.close();
}
