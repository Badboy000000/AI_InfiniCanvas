import { createApiApplication, type ApiApplication } from '../apps/api/src/application.js';
import { createWorkerRuntime } from '../apps/worker/src/runtime.js';

/**
 * 在同一个进程里把 apps/api 与 apps/worker 装到一起：
 * - API 的 RunDispatcher 直接调用 Worker.dispatch
 * - Worker 的 inbox 把 RunEvent 写回 API 的 RunStore
 *
 * 阶段 8 起 BullMQ / Redis 派发就绪后，只需替换本函数返回的 dispatcher
 * 与 inbox，[[API 与 Worker 内部合同]] 定义的接口保持不变。
 *
 * 本 helper 供 apps/api 主入口与 MVP smoke 测试共享，避免两处重复布线。
 */
export function wireApiWithInProcessWorker(): ApiApplication {
  let workerDispatch: ((task: import('../apps/api/src/contracts.js').RunTask) => Promise<void>) | undefined;
  let workerCancel: ((runId: string) => void) | undefined;

  const app = createApiApplication({
    dispatcher: {
      async dispatchRun(task) {
        if (!workerDispatch) throw new Error('worker not ready');
        await workerDispatch(task);
      },
      async cancelRun(runId) {
        workerCancel?.(runId);
      },
    },
  });

  const runtime = createWorkerRuntime({
    inbox: {
      publish(event) {
        app.runs.applyEvent(event);
      },
    },
  });

  workerDispatch = (task) => runtime.dispatch(task);
  workerCancel = (runId) => runtime.cancel(runId);

  return app;
}
