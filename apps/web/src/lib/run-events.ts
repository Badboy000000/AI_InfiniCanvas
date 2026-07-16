import { reduceRunEvent, type RunEvent, type RunState } from '@ai-canvas/event-core';
import { runEventsUrl } from './api-client.js';

/**
 * SSE 客户端：订阅 `/api/runs/:runId/events`，
 * 把服务端首帧 `RunStateSnapshot` 与后续 RunEvent 归约成本地 RunState。
 *
 * 使用 fetch 流式读取而非 EventSource，主要原因：
 * 1. EventSource 不支持自定义 headers（未来接鉴权时更方便）
 * 2. fetch + AbortController 便于统一取消
 */

export type RunEventStreamOptions = {
  runId: string;
  onState: (state: RunState) => void;
  onEvent?: (event: RunEvent) => void;
  onError?: (error: Error) => void;
  onDone?: () => void;
  signal?: AbortSignal;
};

type SseFrame =
  | { type: 'RunStateSnapshot'; state: RunState }
  | RunEvent;

export function subscribeRunEvents(options: RunEventStreamOptions): () => void {
  const controller = new AbortController();
  const abortListener = () => controller.abort();
  options.signal?.addEventListener('abort', abortListener);

  let state: RunState | null = null;

  (async () => {
    try {
      const response = await fetch(runEventsUrl(options.runId), {
        headers: { Accept: 'text/event-stream' },
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        throw new Error(`SSE ${options.runId} failed: ${response.status}`);
      }
      const decoder = new TextDecoder();
      const reader = response.body.getReader();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx = buffer.indexOf('\n\n');
        while (idx >= 0) {
          const raw = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          idx = buffer.indexOf('\n\n');
          const dataLine = raw.split('\n').find((line) => line.startsWith('data:'));
          if (!dataLine) continue;
          const payload = dataLine.slice(5).trim();
          if (!payload) continue;
          const frame = JSON.parse(payload) as SseFrame;
          if ('type' in frame && frame.type === 'RunStateSnapshot') {
            state = frame.state;
            options.onState(state);
            continue;
          }
          const event = frame as RunEvent;
          if (!state) {
            // 未收到 snapshot 就有事件，直接以事件构造初始状态兜底
            state = {
              runId: event.runId,
              workflowId: event.workflowId,
              status: 'pending',
              nodeStates: {},
              eventCount: 0,
            };
          }
          try {
            state = reduceRunEvent(state, event);
          } catch (error) {
            options.onError?.(error as Error);
            continue;
          }
          options.onEvent?.(event);
          options.onState(state);
          if (event.type === 'WorkflowRunCompleted' || event.type === 'WorkflowRunFailed' || event.type === 'WorkflowRunCancelled') {
            options.onDone?.();
            controller.abort();
            return;
          }
        }
      }
    } catch (error) {
      if ((error as { name?: string }).name !== 'AbortError') {
        options.onError?.(error as Error);
      }
    } finally {
      options.signal?.removeEventListener('abort', abortListener);
    }
  })();

  return () => controller.abort();
}
