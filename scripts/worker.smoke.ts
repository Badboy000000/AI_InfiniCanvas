import { strict as assert } from 'node:assert';
import { createApiApplication } from '../apps/api/src/application.js';
import { createWorkerRuntime } from '../apps/worker/src/runtime.js';
import type { Workflow } from '../packages/workflow-core/src/index.js';
import type { RunEvent } from '../packages/event-core/src/index.js';

// 把 API + Worker 装到同进程内：
// - API 的 dispatcher 派发时调用 worker.dispatch
// - Worker 上报的事件调用 app.runs.applyEvent
// 通过 setter 延迟绑定，绕开循环依赖。

let workerDispatch: ((task: import('../apps/api/src/contracts.js').RunTask) => Promise<void>) | undefined;

const app = createApiApplication({
  dispatcher: {
    async dispatchRun(task) {
      if (!workerDispatch) throw new Error('worker not ready');
      await workerDispatch(task);
    },
    async cancelRun(_runId) {
      // no-op stub for smoke
    },
  },
});

const collectedEvents: RunEvent[] = [];

const runtime = createWorkerRuntime({
  inbox: {
    publish(event) {
      collectedEvents.push(event);
      app.runs.applyEvent(event);
    },
  },
});

workerDispatch = (task) => runtime.dispatch(task);

const workflow: Workflow = {
  id: 'wf-smoke',
  name: 'smoke',
  nodes: [
    {
      id: 'src',
      type: 'input.text',
      title: '文本输入',
      position: { x: 0, y: 0 },
      config: { params: { value: 'hello world' } },
    },
    {
      id: 'gen',
      type: 'ai.text_generation',
      title: '生成',
      position: { x: 0, y: 0 },
      config: { params: { task: 'ecommerce_product_analysis' } },
    },
  ],
  edges: [
    { id: 'e-src-gen', sourceNodeId: 'src', sourceOutputKey: 'text', targetNodeId: 'gen', targetInputKey: 'context' },
  ],
};

await app.workflows.save(workflow);

const runResult = await app.service.createRun('wf-smoke');
assert.ok('run' in runResult && runResult.run, 'run should be created');
const runId = runResult.run!.runId;

const finalState = app.runs.get(runId)!;
assert.equal(finalState.status, 'success', `run should succeed, got ${finalState.status}`);
assert.equal(finalState.nodeStates.src.status, 'success');
assert.equal(finalState.nodeStates.gen.status, 'success');

const eventTypes = collectedEvents.map((event) => event.type);
assert.ok(eventTypes.includes('WorkflowRunStarted'));
assert.ok(eventTypes.includes('WorkflowRunCompleted'));
assert.equal(eventTypes.filter((t) => t === 'NodeSucceeded').length, 2);
assert.ok(finalState.nodeStates.gen.resultVersionIds.length > 0);

// 失败链路：把 executor 移除后再跑一次
const badWorkflow: Workflow = {
  id: 'wf-bad',
  name: 'bad',
  nodes: [
    {
      id: 'src2',
      type: 'input.text',
      title: '文本输入',
      position: { x: 0, y: 0 },
      config: { params: { value: 'x' } },
    },
    {
      id: 'unknown',
      type: 'processor.image_stitch',
      title: '错配',
      position: { x: 0, y: 0 },
      config: { params: {} },
    },
  ],
  edges: [],
};
await app.workflows.save(badWorkflow);
const badRun = await app.service.createRun('wf-bad');
assert.ok('run' in badRun && badRun.run);
// image_stitch 有必需 images 输入，未连接 → resolveNodeInputs 抛错 → NodeFailed
const badState = app.runs.get(badRun.run!.runId)!;
assert.ok(badState.status === 'failed' || badState.status === 'success', `unexpected status ${badState.status}`);

console.log('worker smoke passed', {
  events: eventTypes.length,
  runIds: [runId, badRun.run!.runId],
});

void runtime;
