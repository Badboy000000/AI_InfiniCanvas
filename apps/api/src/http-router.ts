import { IncomingMessage, ServerResponse } from 'node:http';
import type { WorkflowService } from './workflow-service.js';
import type { RunStore } from './run-store.js';
import type { Workflow } from '@ai-canvas/workflow-core';

/**
 * 第一版 API：为了保证并行开发不被外部依赖拖住，
 * 采用 node:http + 手写路由实现。所有 HTTP 契约严格对齐 [[API 与 Worker 内部合同]]。
 * 后续可以替换为 NestJS，路由契约保持不变。
 */

type Handler = (context: HandlerContext) => Promise<void> | void;

type HandlerContext = {
  req: IncomingMessage;
  res: ServerResponse;
  params: Record<string, string>;
  body: unknown;
};

type Route = {
  method: string;
  pattern: RegExp;
  paramKeys: string[];
  handler: Handler;
};

export type CreateApiRouterOptions = {
  service: WorkflowService;
  runs: RunStore;
};

export function createApiRouter(options: CreateApiRouterOptions) {
  const { service, runs } = options;
  const routes: Route[] = [];

  const addRoute = (method: string, path: string, handler: Handler) => {
    const paramKeys: string[] = [];
    const regexSource = path.replace(/:([A-Za-z0-9_]+)/g, (_, key: string) => {
      paramKeys.push(key);
      return '([^/]+)';
    });
    routes.push({
      method: method.toUpperCase(),
      pattern: new RegExp(`^${regexSource}$`),
      paramKeys,
      handler,
    });
  };

  const respondJson = (res: ServerResponse, status: number, body: unknown) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(body));
  };

  const respondError = (res: ServerResponse, status: number, code: string, message: string, detail?: unknown) => {
    respondJson(res, status, { code, message, detail });
  };

  // ---------- Routes ----------

  addRoute('GET', '/api/node-definitions', ({ res }) => {
    respondJson(res, 200, { definitions: service.listDefinitions() });
  });

  addRoute('GET', '/api/workflows', async ({ res }) => {
    respondJson(res, 200, { workflows: await service.listWorkflows() });
  });

  addRoute('POST', '/api/workflows', async ({ res, body }) => {
    const workflow = body as Workflow;
    if (!workflow || typeof workflow.id !== 'string') {
      respondError(res, 400, 'invalid_payload', 'workflow payload must include a string id');
      return;
    }
    const result = await service.saveWorkflow(workflow);
    if (result.rejections.length > 0) {
      respondJson(res, 422, { rejections: result.rejections });
      return;
    }
    respondJson(res, 200, { workflow: result.workflow });
  });

  addRoute('GET', '/api/workflows/:id', async ({ res, params }) => {
    const workflow = await service.getWorkflow(params.id);
    if (!workflow) {
      respondError(res, 404, 'workflow_not_found', `workflow ${params.id} not found`);
      return;
    }
    respondJson(res, 200, { workflow });
  });

  addRoute('PUT', '/api/workflows/:id', async ({ res, params, body }) => {
    const workflow = body as Workflow;
    if (!workflow || workflow.id !== params.id) {
      respondError(res, 400, 'invalid_payload', 'workflow.id must match url id');
      return;
    }
    const result = await service.saveWorkflow(workflow);
    if (result.rejections.length > 0) {
      respondJson(res, 422, { rejections: result.rejections });
      return;
    }
    respondJson(res, 200, { workflow: result.workflow });
  });

  addRoute('DELETE', '/api/workflows/:id', async ({ res, params }) => {
    const deleted = await service.deleteWorkflow(params.id);
    if (!deleted) {
      respondError(res, 404, 'workflow_not_found', `workflow ${params.id} not found`);
      return;
    }
    res.statusCode = 204;
    res.end();
  });

  addRoute('POST', '/api/workflows/:id/validate', async ({ res, params }) => {
    const result = await service.validateWorkflow(params.id);
    if (!result) {
      respondError(res, 404, 'workflow_not_found', `workflow ${params.id} not found`);
      return;
    }
    respondJson(res, 200, { rejections: result.rejections });
  });

  addRoute('POST', '/api/workflows/:id/runs', async ({ res, params }) => {
    const result = await service.createRun(params.id);
    if ('notFound' in result) {
      respondError(res, 404, 'workflow_not_found', `workflow ${params.id} not found`);
      return;
    }
    if (result.rejections && result.rejections.length > 0) {
      respondJson(res, 422, { rejections: result.rejections });
      return;
    }
    respondJson(res, 200, { run: result.run });
  });

  addRoute('GET', '/api/runs/:runId', ({ res, params }) => {
    const run = service.getRun(params.runId);
    if (!run) {
      respondError(res, 404, 'run_not_found', `run ${params.runId} not found`);
      return;
    }
    respondJson(res, 200, { run });
  });

  addRoute('POST', '/api/runs/:runId/cancel', async ({ res, params }) => {
    const run = await service.cancelRun(params.runId);
    if (!run) {
      respondError(res, 404, 'run_not_found', `run ${params.runId} not found`);
      return;
    }
    respondJson(res, 200, { run });
  });

  addRoute('GET', '/api/runs/:runId/events', ({ req, res, params }) => {
    const runId = params.runId;
    const initialState = service.getRun(runId);
    if (!initialState) {
      respondError(res, 404, 'run_not_found', `run ${runId} not found`);
      return;
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const send = (payload: unknown) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    // 首帧快照
    send({ type: 'RunStateSnapshot', state: initialState });
    // 已发生事件重放
    for (const event of runs.getEvents(runId)) {
      send(event);
    }

    const unsubscribe = runs.subscribe(runId, (event) => {
      send(event);
      const finished = event.type === 'WorkflowRunCompleted' || event.type === 'WorkflowRunFailed' || event.type === 'WorkflowRunCancelled';
      if (finished) {
        setTimeout(() => {
          unsubscribe();
          res.end();
        }, 0);
      }
    });

    req.on('close', () => {
      unsubscribe();
    });
  });

  // ---------- Dispatcher ----------

  return async function handleRequest(req: IncomingMessage, res: ServerResponse) {
    try {
      const method = (req.method ?? 'GET').toUpperCase();
      const rawUrl = req.url ?? '/';
      const url = new URL(rawUrl, 'http://localhost');
      const pathname = url.pathname;

      const route = routes.find((candidate) => candidate.method === method && candidate.pattern.test(pathname));
      if (!route) {
        respondError(res, 404, 'not_found', `no route matches ${method} ${pathname}`);
        return;
      }

      const match = route.pattern.exec(pathname)!;
      const params: Record<string, string> = {};
      route.paramKeys.forEach((key, index) => {
        params[key] = decodeURIComponent(match[index + 1]);
      });

      let body: unknown = undefined;
      if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
        body = await readJsonBody(req);
      }

      await route.handler({ req, res, params, body });
    } catch (error) {
      if (!res.headersSent) {
        respondError(res, 500, 'internal_error', (error as Error).message);
      } else {
        try {
          res.end();
        } catch {
          // ignore
        }
      }
    }
  };
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return undefined;
  const text = Buffer.concat(chunks).toString('utf-8');
  if (!text.trim()) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('invalid json body');
  }
}
