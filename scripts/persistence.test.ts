import { strict as assert } from 'node:assert';
import {
  BullMqRunDispatcher,
  InMemoryAssetStore,
  InMemoryCapabilityCallLogStore,
  InMemoryNodeResultVersionStore,
  PrismaWorkflowRepository,
  createPrismaStores,
  type NodeResultVersionRecord,
} from '../packages/persistence/src/index.js';

// InMemoryNodeResultVersionStore CRUD
const versions = new InMemoryNodeResultVersionStore();
const sample: NodeResultVersionRecord = {
  id: 'ver-1',
  workflowId: 'wf-1',
  nodeId: 'n-1',
  outputKey: 'text',
  versionNumber: 1,
  sourceType: 'ai_generated',
  contentType: 'markdown',
  content: 'hello',
  createdBy: 'system',
  createdAt: '2026-07-16T00:00:00Z',
};
await versions.save(sample);
assert.equal((await versions.getById('ver-1'))?.content, 'hello');
assert.equal((await versions.listByNode('wf-1', 'n-1', 'text')).length, 1);
assert.equal((await versions.listByNode('wf-1', 'n-1', 'other')).length, 0);

// InMemoryAssetStore
const assets = new InMemoryAssetStore();
await assets.save({ id: 'a-1', type: 'image', url: 'http://x/a-1.jpg', createdAt: '2026-07-16T00:00:00Z' });
assert.equal((await assets.getById('a-1'))?.url, 'http://x/a-1.jpg');

// InMemoryCapabilityCallLogStore
const logs = new InMemoryCapabilityCallLogStore();
await logs.append({
  id: 'log-1',
  workflowId: 'wf-1',
  runId: 'run-1',
  nodeId: 'n-1',
  executorKey: 'e',
  capability: 'text.generate',
  task: 't',
  provider: 'mock',
  adapterKey: 'mock.local',
  status: 'success',
  latencyMs: 10,
  retryCount: 0,
  fallbackUsed: false,
  attempts: [],
  createdAt: '2026-07-16T00:00:00Z',
});
assert.equal((await logs.listByRun('run-1')).length, 1);
assert.equal((await logs.listByRun('run-x')).length, 0);

// Prisma placeholder：所有方法必须清晰抛错，避免误接
const stores = createPrismaStores({
  $connect: async () => undefined,
  $disconnect: async () => undefined,
});
await assert.rejects(() => stores.workflows.list(), /not-wired|尚未接线/i);
await assert.rejects(() => stores.assets.getById('x'), /not-wired|尚未接线/i);

// BullMQ dispatcher：抛出可读错误信息（含 redisUrl）
const dispatcher = new BullMqRunDispatcher({ redisUrl: 'redis://localhost:6379' });
await assert.rejects(
  () => dispatcher.dispatchRun({
    runId: 'r',
    workflowId: 'w',
    workflow: { id: 'w', name: 'w', nodes: [], edges: [] },
    definitions: {},
    executionPlan: { orderedNodes: [] },
    outputSnapshots: {},
    requestedAt: '2026-07-16T00:00:00Z',
  }),
  /redis:\/\/localhost:6379/,
);

// PrismaWorkflowRepository 只是骨架
const placeholderWorkflowRepo = new PrismaWorkflowRepository({
  $connect: async () => undefined,
  $disconnect: async () => undefined,
});
await assert.rejects(() => placeholderWorkflowRepo.list(), /尚未接线/);

console.log('persistence tests passed');
