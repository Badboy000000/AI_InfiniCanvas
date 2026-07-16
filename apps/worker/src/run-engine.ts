import { randomUUID } from 'node:crypto';
import { resolveNodeInputs, type WorkflowOutputSnapshots } from '@ai-canvas/workflow-core';
import type {
  NodeDefinition,
  NodeExecutionResult,
  NodeExecutor,
  NodeOutputPayload,
  NodeRuntimeServices,
} from '@ai-canvas/node-protocol';
import type { CapabilityRouter } from '@ai-canvas/capability-core';
import type { RunEvent, RunError } from '@ai-canvas/event-core';
import type { NodeExecutorRegistry } from './node-executor-registry.js';

/**
 * RunTask / RunEventInbox 契约与 apps/api/src/contracts.ts 保持一致。
 * 之所以在 worker 侧重新声明一份纯结构，是因为 packages/* 不允许依赖 apps/api，
 * 而 API 与 Worker 之间的契约本身也不属于任何单一 app。类型形状必须保持严格一致。
 */
export type WorkerRunTask = {
  runId: string;
  workflowId: string;
  workflow: import('@ai-canvas/workflow-core').Workflow;
  definitions: Record<string, NodeDefinition>;
  executionPlan: import('@ai-canvas/workflow-core').ExecutionPlan;
  outputSnapshots: WorkflowOutputSnapshots;
  requestedAt: string;
};

export type WorkerRunEventInbox = {
  publish(event: RunEvent): void;
};

export type WorkerRunEngineOptions = {
  registry: NodeExecutorRegistry;
  router: CapabilityRouter;
  inbox: WorkerRunEventInbox;
  createEventId?: () => string;
  createVersionId?: () => string;
  now?: () => Date;
};

export function createWorkerRunEngine(options: WorkerRunEngineOptions) {
  const {
    registry,
    router,
    inbox,
    createEventId = () => randomUUID(),
    createVersionId = () => randomUUID(),
    now = () => new Date(),
  } = options;

  const cancelled = new Set<string>();

  const publish = (event: RunEvent) => {
    inbox.publish(event);
  };

  const emitBase = (task: WorkerRunTask) => ({
    runId: task.runId,
    workflowId: task.workflowId,
  });

  const nowIso = () => now().toISOString();

  return {
    cancel(runId: string) {
      cancelled.add(runId);
    },

    async execute(task: WorkerRunTask): Promise<void> {
      publish({
        ...emitBase(task),
        type: 'WorkflowRunStarted',
        eventId: createEventId(),
        occurredAt: nowIso(),
      });

      const outputSnapshots: WorkflowOutputSnapshots = JSON.parse(JSON.stringify(task.outputSnapshots ?? {}));

      const runtimeServices: NodeRuntimeServices = {
        assets: {},
        capabilities: router,
        logger: console,
      };

      try {
        for (const nodeId of task.executionPlan.orderedNodes) {
          if (cancelled.has(task.runId)) {
            publish({
              ...emitBase(task),
              type: 'WorkflowRunCancelled',
              eventId: createEventId(),
              occurredAt: nowIso(),
              reason: 'cancelled by caller',
            });
            return;
          }

          const node = task.workflow.nodes.find((candidate) => candidate.id === nodeId);
          if (!node) {
            const error = failure('node_missing', `Node ${nodeId} missing in workflow`);
            publish({
              ...emitBase(task),
              type: 'WorkflowRunFailed',
              eventId: createEventId(),
              occurredAt: nowIso(),
              error,
            });
            return;
          }

          const definition = task.definitions[node.type];
          if (!definition) {
            const error = failure('definition_missing', `Definition for ${node.type} not registered`);
            publish({
              ...emitBase(task),
              type: 'NodeFailed',
              eventId: createEventId(),
              occurredAt: nowIso(),
              nodeId,
              attempt: 1,
              error,
            });
            publish({
              ...emitBase(task),
              type: 'WorkflowRunFailed',
              eventId: createEventId(),
              occurredAt: nowIso(),
              error,
            });
            return;
          }

          publish({
            ...emitBase(task),
            type: 'NodeQueued',
            eventId: createEventId(),
            occurredAt: nowIso(),
            nodeId,
          });

          const executor = definition.executor.executorKey ? registry.get(definition.executor.executorKey) : undefined;
          if (!executor) {
            const error = failure('executor_missing', `Executor ${definition.executor.executorKey ?? '<unset>'} not registered`);
            publish({
              ...emitBase(task),
              type: 'NodeStarted',
              eventId: createEventId(),
              occurredAt: nowIso(),
              nodeId,
              attempt: 1,
            });
            publish({
              ...emitBase(task),
              type: 'NodeFailed',
              eventId: createEventId(),
              occurredAt: nowIso(),
              nodeId,
              attempt: 1,
              error,
            });
            publish({
              ...emitBase(task),
              type: 'WorkflowRunFailed',
              eventId: createEventId(),
              occurredAt: nowIso(),
              error,
            });
            return;
          }

          const attempt = 1;
          publish({
            ...emitBase(task),
            type: 'NodeStarted',
            eventId: createEventId(),
            occurredAt: nowIso(),
            nodeId,
            attempt,
          });

          let result: NodeExecutionResult;
          try {
            const inputs = resolveNodeInputs({
              workflow: task.workflow,
              nodeId,
              definitions: task.definitions,
              outputSnapshots,
            });
            const inputsForExecutor = Object.fromEntries(
              Object.entries(inputs).map(([key, value]) => [key, { inputKey: key, value: value.value, sourceRefs: value.sourceRefs }]),
            );
            result = await executor.run({
              workflowId: task.workflowId,
              runId: task.runId,
              node,
              definition,
              inputs: inputsForExecutor,
              config: node.config,
              services: runtimeServices,
            });
          } catch (error) {
            result = {
              status: 'failed',
              error: {
                code: 'executor_exception',
                message: (error as Error).message,
              },
            };
          }

          if (result.status === 'success') {
            const versionIds = collectOutputVersions(result.outputs, node.id, outputSnapshots, createVersionId);
            publish({
              ...emitBase(task),
              type: 'NodeSucceeded',
              eventId: createEventId(),
              occurredAt: nowIso(),
              nodeId,
              attempt,
              resultVersionIds: versionIds,
            });
          } else if (result.status === 'requires_user') {
            publish({
              ...emitBase(task),
              type: 'NodeSkipped',
              eventId: createEventId(),
              occurredAt: nowIso(),
              nodeId,
              reason: 'requires_user',
            });
          } else {
            const runError: RunError = {
              code: result.error?.code ?? 'unknown',
              message: result.error?.message ?? 'unknown error',
              category: 'unknown',
              retryable: result.error?.retryable ?? false,
              detail: result.error?.detail,
            };
            publish({
              ...emitBase(task),
              type: 'NodeFailed',
              eventId: createEventId(),
              occurredAt: nowIso(),
              nodeId,
              attempt,
              error: runError,
              partialResult: result.partialResult,
            });
            publish({
              ...emitBase(task),
              type: 'WorkflowRunFailed',
              eventId: createEventId(),
              occurredAt: nowIso(),
              error: runError,
            });
            return;
          }
        }

        publish({
          ...emitBase(task),
          type: 'WorkflowRunCompleted',
          eventId: createEventId(),
          occurredAt: nowIso(),
        });
      } finally {
        cancelled.delete(task.runId);
      }
    },
  };
}

function failure(code: string, message: string): RunError {
  return { code, message, category: 'unknown', retryable: false };
}

function collectOutputVersions(
  outputs: Record<string, NodeOutputPayload> | undefined,
  nodeId: string,
  outputSnapshots: WorkflowOutputSnapshots,
  createVersionId: () => string,
): string[] {
  const versionIds: string[] = [];
  if (!outputs) return versionIds;
  const nodeMap = outputSnapshots[nodeId] ?? {};
  for (const [outputKey, payload] of Object.entries(outputs)) {
    const versionId = createVersionId();
    nodeMap[outputKey] = {
      value: payload.content ?? payload.assetIds ?? null,
      versionId,
    };
    versionIds.push(versionId);
  }
  outputSnapshots[nodeId] = nodeMap;
  return versionIds;
}
