import type { NodeDefinition } from '@ai-canvas/node-protocol';
import type { Workflow, WorkflowEdgeRejection } from '@ai-canvas/workflow-core';
import type { RunState } from '@ai-canvas/event-core';

const API_BASE = '/api';

/**
 * apps/web 与 apps/api 之间的最小 HTTP 客户端。
 * 所有 4xx 错误都携带 body 便于上层判断（尤其 422 的结构化拒绝）。
 */

export class ApiHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message: string,
  ) {
    super(message);
    this.name = 'ApiHttpError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: init?.body ? { 'content-type': 'application/json', ...(init?.headers ?? {}) } : init?.headers,
    ...init,
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : undefined;
  if (!response.ok) {
    throw new ApiHttpError(response.status, body, `API ${path} failed with ${response.status}`);
  }
  return body as T;
}

export type SaveWorkflowResult =
  | { ok: true; workflow: Workflow }
  | { ok: false; rejections: WorkflowEdgeRejection[] };

export const apiClient = {
  async listNodeDefinitions(): Promise<NodeDefinition[]> {
    const { definitions } = await request<{ definitions: NodeDefinition[] }>('/node-definitions');
    return definitions;
  },

  async saveWorkflow(workflow: Workflow): Promise<SaveWorkflowResult> {
    try {
      const body = await request<{ workflow: Workflow }>('/workflows', {
        method: 'POST',
        body: JSON.stringify(workflow),
      });
      return { ok: true, workflow: body.workflow };
    } catch (error) {
      if (error instanceof ApiHttpError && error.status === 422) {
        const payload = error.body as { rejections?: WorkflowEdgeRejection[] };
        return { ok: false, rejections: payload.rejections ?? [] };
      }
      throw error;
    }
  },

  async validateWorkflow(id: string): Promise<WorkflowEdgeRejection[]> {
    const body = await request<{ rejections: WorkflowEdgeRejection[] }>(`/workflows/${encodeURIComponent(id)}/validate`, {
      method: 'POST',
    });
    return body.rejections;
  },

  async createRun(workflowId: string): Promise<RunState> {
    const body = await request<{ run: RunState }>(`/workflows/${encodeURIComponent(workflowId)}/runs`, {
      method: 'POST',
    });
    return body.run;
  },

  async getRun(runId: string): Promise<RunState> {
    const body = await request<{ run: RunState }>(`/runs/${encodeURIComponent(runId)}`);
    return body.run;
  },
};

export const runEventsUrl = (runId: string) => `${API_BASE}/runs/${encodeURIComponent(runId)}/events`;
