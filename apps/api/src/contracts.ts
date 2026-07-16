import type { NodeDefinition } from '@ai-canvas/node-protocol';
import type {
  ExecutionPlan,
  Workflow,
  WorkflowOutputSnapshots,
} from '@ai-canvas/workflow-core';
import type { RunEvent, RunState } from '@ai-canvas/event-core';

/**
 * API↔Worker 内部合同的核心传输对象。
 * 详见知识库 [[API 与 Worker 内部合同]]。
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

/** API 派发运行任务给 Worker 的抽象口。 */
export interface RunDispatcher {
  dispatchRun(task: RunTask): Promise<void>;
  /** 请求取消一次运行；第一版可以尽力而为，允许 Worker 忽略未开始的节点。 */
  cancelRun?(runId: string): Promise<void>;
}

/** Worker 把事件上报给 API 的抽象口。 */
export interface RunEventInbox {
  publish(event: RunEvent): void;
}

/** 前端 SSE 流的首帧，额外附带一次完整状态快照，便于秒级同步。 */
export type RunStateSnapshotFrame = {
  type: 'RunStateSnapshot';
  state: RunState;
};

export type RunStreamFrame = RunStateSnapshotFrame | RunEvent;
