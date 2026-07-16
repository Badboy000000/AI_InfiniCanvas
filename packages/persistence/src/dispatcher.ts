import type { NodeDefinition } from '@ai-canvas/node-protocol';
import type { ExecutionPlan, Workflow, WorkflowOutputSnapshots } from '@ai-canvas/workflow-core';
import type { RunEvent } from '@ai-canvas/event-core';

/**
 * 派发/事件的抽象接口。
 *
 * `RunTask` 与 `RunEventInbox` 与 apps/api/src/contracts.ts 中的定义保持一致——
 * 因为 apps 不能相互依赖，形状必须靠 [[API 与 Worker 内部合同]] 与结构 typing 保证。
 *
 * 阶段 8 起 BullMQ / Redis Streams 落地时，实现类替换掉内存版即可。
 */

export type RunTask = {
  runId: string;
  workflowId: string;
  workflow: Workflow;
  definitions: Record<string, NodeDefinition>;
  executionPlan: ExecutionPlan;
  outputSnapshots: WorkflowOutputSnapshots;
  requestedAt: string;
};

export interface RunDispatcher {
  dispatchRun(task: RunTask): Promise<void>;
  cancelRun?(runId: string): Promise<void>;
}

export interface RunEventInbox {
  publish(event: RunEvent): void;
}

/**
 * BullMQ / Redis Streams 派发器骨架。
 *
 * 第一版不真实连接 Redis：
 * - 建立类骨架，明确构造函数签名和使用方式
 * - dispatchRun / cancelRun 抛出 `not_implemented` 错误
 * - 真实落地时替换掉 body 即可（预计通过 `bullmq` 依赖构造 `Queue`）
 *
 * 这么设计的原因是当前沙箱不能安装 bullmq/ioredis，
 * 但接口需要先固定，避免 apps/api 或 apps/worker 里事后出现二次改动。
 */
export type BullMqDispatcherOptions = {
  redisUrl: string;
  queueName?: string;
};

export class BullMqRunDispatcher implements RunDispatcher {
  constructor(public readonly options: BullMqDispatcherOptions) {}

  async dispatchRun(_task: RunTask): Promise<void> {
    throw new Error(
      `[persistence] BullMqRunDispatcher.dispatchRun 尚未实现；请在部署阶段接入 BullMQ Queue，或使用 InMemoryRunDispatcher。redisUrl=${this.options.redisUrl}`,
    );
  }

  async cancelRun(_runId: string): Promise<void> {
    throw new Error('[persistence] BullMqRunDispatcher.cancelRun 尚未实现');
  }
}
