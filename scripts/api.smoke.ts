import { strict as assert } from 'node:assert';
import { createServer, type Server } from 'node:http';
import { createApiApplication } from '../apps/api/src/application.js';
import type { Workflow } from '../packages/workflow-core/src/index.js';
import type { NodeDefinition } from '../packages/node-protocol/src/index.js';

const app = createApiApplication();
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
    if (address && typeof address === 'object') {
      resolve(address.port);
    } else {
      resolve(0);
    }
  });
});

const base = `http://127.0.0.1:${port}`;

async function fetchJson(path: string, init?: RequestInit) {
  const response = await fetch(`${base}${path}`, init);
  const text = await response.text();
  const body = text ? JSON.parse(text) : undefined;
  return { status: response.status, body };
}

try {
  // GET /api/node-definitions
  const defs = await fetchJson('/api/node-definitions');
  assert.equal(defs.status, 200);
  const definitions: NodeDefinition[] = defs.body.definitions;
  assert.ok(definitions.length > 0);
  const definitionByType = Object.fromEntries(definitions.map((d) => [d.type, d]));
  assert.ok(definitionByType['input.text']);
  assert.ok(definitionByType['ai.text_generation']);

  // POST /api/workflows: 一个合法 workflow
  const validWorkflow: Workflow = {
    id: 'wf-1',
    name: '样例',
    nodes: [
      { id: 'src', type: 'input.text', title: 'src', position: { x: 0, y: 0 }, config: { params: {} } },
      { id: 'gen', type: 'ai.text_generation', title: 'gen', position: { x: 0, y: 0 }, config: { params: {} } },
    ],
    edges: [
      { id: 'e1', sourceNodeId: 'src', sourceOutputKey: 'text', targetNodeId: 'gen', targetInputKey: 'context' },
    ],
  };
  const created = await fetchJson('/api/workflows', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(validWorkflow),
  });
  assert.equal(created.status, 200);
  assert.equal(created.body.workflow.id, 'wf-1');
  assert.ok(created.body.workflow.updatedAt);

  // GET /api/workflows/:id
  const fetched = await fetchJson('/api/workflows/wf-1');
  assert.equal(fetched.status, 200);
  assert.equal(fetched.body.workflow.name, '样例');

  // POST /api/workflows: 非法 workflow（类型不兼容）
  const invalidWorkflow: Workflow = {
    id: 'wf-2',
    name: '错误示例',
    nodes: [
      { id: 'img', type: 'input.image', title: 'img', position: { x: 0, y: 0 }, config: { params: {} } },
      { id: 'gen', type: 'ai.text_generation', title: 'gen', position: { x: 0, y: 0 }, config: { params: {} } },
    ],
    edges: [
      { id: 'bad', sourceNodeId: 'img', sourceOutputKey: 'images', targetNodeId: 'gen', targetInputKey: 'context' },
    ],
  };
  const rejected = await fetchJson('/api/workflows', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(invalidWorkflow),
  });
  assert.equal(rejected.status, 422);
  assert.ok(Array.isArray(rejected.body.rejections));
  assert.equal(rejected.body.rejections[0].code, 'type_incompatible');

  // POST /api/workflows/:id/runs：正常发起 run，dispatcher 被调用
  const runResp = await fetchJson('/api/workflows/wf-1/runs', { method: 'POST' });
  assert.equal(runResp.status, 200);
  assert.ok(runResp.body.run.runId);
  assert.equal(runResp.body.run.status, 'pending');

  // GET /api/runs/:runId
  const runId = runResp.body.run.runId;
  const runStateResp = await fetchJson(`/api/runs/${runId}`);
  assert.equal(runStateResp.status, 200);
  assert.equal(runStateResp.body.run.runId, runId);

  // DELETE
  const del = await fetchJson('/api/workflows/wf-1', { method: 'DELETE' });
  assert.equal(del.status, 204);
  const missing = await fetchJson('/api/workflows/wf-1');
  assert.equal(missing.status, 404);

  console.log('api smoke passed');
} finally {
  server.close();
}
