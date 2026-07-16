import type { RunNodeState, RunState, RunStatus } from '@ai-canvas/event-core';

/**
 * 前端目前尚未接入 SSE，第一版提供一个空的 RunState 作为占位，避免节点卡片继续依赖 mock 状态字符串。
 * 阶段 10 起前端会通过 `EventSource('/api/runs/:runId/events')` 消费真实事件序列。
 */
export const emptyRunState: RunState = {
  runId: '',
  workflowId: '',
  status: 'pending',
  nodeStates: {},
  eventCount: 0,
};

const nodeStatusLabel: Record<RunNodeState['status'], string> = {
  idle: '未配置',
  waiting: '待执行',
  running: '运行中',
  success: '成功',
  failed: '失败',
  skipped: '已跳过',
  cancelled: '已取消',
};

const runStatusLabel: Record<RunStatus, string> = {
  pending: '待执行',
  running: '运行中',
  success: '成功',
  failed: '失败',
  cancelled: '已取消',
};

export function describeNodeStatus(state: RunNodeState | undefined): string {
  if (!state) return '未配置';
  return nodeStatusLabel[state.status];
}

export function describeRunStatus(state: RunState): string {
  return runStatusLabel[state.status];
}
