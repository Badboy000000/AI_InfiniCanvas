import type { RunDispatcher, RunTask } from './contracts.js';

/**
 * 占位 Dispatcher：第一版 API 单独启动时使用，不做实际派发，只记录 pending 任务。
 * Worker 落地后由 apps/worker 提供真实实现（进程内注入），届时替换掉本占位。
 */
export class PlaceholderRunDispatcher implements RunDispatcher {
  public readonly pending: RunTask[] = [];

  async dispatchRun(task: RunTask): Promise<void> {
    this.pending.push(task);
  }

  async cancelRun(_runId: string): Promise<void> {
    // no-op
  }
}
