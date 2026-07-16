import { createCapabilityRouter, type CapabilityRouter } from '@ai-canvas/capability-core';
import { createNodeExecutorRegistry, type NodeExecutorRegistry } from './node-executor-registry.js';
import { mockProviderAdapter } from './providers/mock.js';
import { mockRoutes } from './providers/routes.js';
import { editorTextExecutor, inputImageExecutor, inputTextExecutor } from './executors/manual-executors.js';
import { contextAssemblerExecutor, exportImageExecutor, imageStitchExecutor } from './executors/code-executors.js';
import { createAiExecutors } from './executors/ai-executors.js';
import { createWorkerRunEngine, type WorkerRunEngineOptions, type WorkerRunEventInbox, type WorkerRunTask } from './run-engine.js';

export type WorkerRuntime = {
  registry: NodeExecutorRegistry;
  router: CapabilityRouter;
  dispatch(task: WorkerRunTask): Promise<void>;
  cancel(runId: string): void;
};

/**
 * 组装 Worker 运行时：默认注入 mock provider + 全部 MVP 内置 executor。
 * apps/api 可以直接注入 dispatch 作为 RunDispatcher.dispatchRun 实现，
 * 并把 inbox 指向 InMemoryRunStore.applyEvent，从而形成 API↔Worker 同进程内存链路。
 */
export function createWorkerRuntime(options: {
  inbox: WorkerRunEventInbox;
  extraRunEngineOptions?: Omit<WorkerRunEngineOptions, 'inbox' | 'registry' | 'router'>;
}): WorkerRuntime {
  const router = createCapabilityRouter({
    routes: mockRoutes,
    adapters: [mockProviderAdapter],
  });

  const registry = createNodeExecutorRegistry([
    inputTextExecutor,
    inputImageExecutor,
    editorTextExecutor,
    contextAssemblerExecutor,
    imageStitchExecutor,
    exportImageExecutor,
    ...createAiExecutors(router),
  ]);

  const engine = createWorkerRunEngine({
    registry,
    router,
    inbox: options.inbox,
    ...options.extraRunEngineOptions,
  });

  return {
    registry,
    router,
    async dispatch(task) {
      // 第一版内存派发：直接同步（await）跑一遍。真实 BullMQ 接入后走队列。
      await engine.execute(task);
    },
    cancel(runId) {
      engine.cancel(runId);
    },
  };
}
