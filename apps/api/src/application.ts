import { builtInNodeDefinitions } from '@ai-canvas/node-definitions';
import { createApiRouter } from './http-router.js';
import { PlaceholderRunDispatcher } from './placeholder-dispatcher.js';
import { InMemoryRunStore } from './run-store.js';
import { InMemoryWorkflowRepository } from './workflow-repository.js';
import { WorkflowService } from './workflow-service.js';
import type { RunDispatcher } from './contracts.js';

export type ApiApplication = ReturnType<typeof createApiApplication>;

export type CreateApiApplicationOptions = {
  dispatcher?: RunDispatcher;
};

/**
 * 组装 API 应用的所有依赖。返回值仅包含最小必要的 handler 和内部状态引用，
 * 便于测试直接构造 IncomingMessage/ServerResponse 或者主入口挂到 http.createServer。
 */
export function createApiApplication(options: CreateApiApplicationOptions = {}) {
  const workflows = new InMemoryWorkflowRepository();
  const runs = new InMemoryRunStore();
  const dispatcher = options.dispatcher ?? new PlaceholderRunDispatcher();
  const service = new WorkflowService({
    workflows,
    runs,
    dispatcher,
    definitionsProvider: () => builtInNodeDefinitions,
  });

  const handler = createApiRouter({ service, runs });

  return { handler, workflows, runs, service, dispatcher };
}
