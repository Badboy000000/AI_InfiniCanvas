import { createInitialRunState, reduceRunEvent, type RunEvent, type RunState } from '@ai-canvas/event-core';

/**
 * 内存运行状态存储。
 *
 * 保存三样东西：
 * 1. 当前归约后的 RunState（用于 GET /api/runs/:runId）
 * 2. 已发生的事件序列（用于 SSE 连接建立时的完整回放）
 * 3. 每个 runId 的订阅者列表（用于把 Worker 上报的新事件推给 SSE 客户端）
 *
 * 阶段 8 起换成 Postgres + Redis PubSub 后，接口保持不变。
 */

export type RunSubscriber = (event: RunEvent) => void;

type RunRecord = {
  state: RunState;
  events: RunEvent[];
  subscribers: Set<RunSubscriber>;
};

export interface RunStore {
  create(runId: string, workflowId: string): RunState;
  get(runId: string): RunState | undefined;
  getEvents(runId: string): RunEvent[];
  applyEvent(event: RunEvent): RunState;
  subscribe(runId: string, subscriber: RunSubscriber): () => void;
}

export class InMemoryRunStore implements RunStore {
  private readonly runs = new Map<string, RunRecord>();

  create(runId: string, workflowId: string): RunState {
    if (this.runs.has(runId)) {
      throw new Error(`Run ${runId} already exists`);
    }
    const state = createInitialRunState(runId, workflowId);
    this.runs.set(runId, { state, events: [], subscribers: new Set() });
    return state;
  }

  get(runId: string): RunState | undefined {
    return this.runs.get(runId)?.state;
  }

  getEvents(runId: string): RunEvent[] {
    return this.runs.get(runId)?.events.slice() ?? [];
  }

  applyEvent(event: RunEvent): RunState {
    const record = this.runs.get(event.runId);
    if (!record) {
      throw new Error(`Run ${event.runId} not found`);
    }

    record.state = reduceRunEvent(record.state, event);
    record.events.push(event);

    for (const subscriber of record.subscribers) {
      try {
        subscriber(event);
      } catch {
        // 单个订阅者异常不应影响状态转移与其他订阅者
      }
    }

    return record.state;
  }

  subscribe(runId: string, subscriber: RunSubscriber): () => void {
    const record = this.runs.get(runId);
    if (!record) {
      throw new Error(`Run ${runId} not found`);
    }
    record.subscribers.add(subscriber);
    return () => {
      record.subscribers.delete(subscriber);
    };
  }
}
