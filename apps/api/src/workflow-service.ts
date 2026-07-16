import { randomUUID } from 'node:crypto';
import type { NodeDefinition } from '@ai-canvas/node-protocol';
import {
  compileExecutionPlan,
  tryValidateWorkflow,
  type Workflow,
  type WorkflowEdgeRejection,
} from '@ai-canvas/workflow-core';
import type { RunState } from '@ai-canvas/event-core';
import type { RunDispatcher, RunTask } from './contracts.js';
import type { WorkflowRepository } from './workflow-repository.js';
import type { RunStore } from './run-store.js';

export type WorkflowServiceOptions = {
  workflows: WorkflowRepository;
  runs: RunStore;
  dispatcher: RunDispatcher;
  definitionsProvider: () => NodeDefinition[];
  createId?: () => string;
};

/**
 * API 侧的工作流服务：只负责 CRUD + 校验 + 派发 Run，不执行节点。
 * 校验一律走 workflow-core 的 tryValidateWorkflow，拒绝对象结构化返回。
 */
export class WorkflowService {
  private readonly workflows: WorkflowRepository;
  private readonly runs: RunStore;
  private readonly dispatcher: RunDispatcher;
  private readonly definitionsProvider: () => NodeDefinition[];
  private readonly createId: () => string;

  constructor(options: WorkflowServiceOptions) {
    this.workflows = options.workflows;
    this.runs = options.runs;
    this.dispatcher = options.dispatcher;
    this.definitionsProvider = options.definitionsProvider;
    this.createId = options.createId ?? (() => randomUUID());
  }

  listDefinitions(): NodeDefinition[] {
    return this.definitionsProvider();
  }

  private definitionsRecord(): Record<string, NodeDefinition> {
    const definitions = this.definitionsProvider();
    const record: Record<string, NodeDefinition> = {};
    for (const definition of definitions) {
      record[definition.type] = definition;
    }
    return record;
  }

  async listWorkflows(): Promise<Workflow[]> {
    return this.workflows.list();
  }

  async getWorkflow(id: string): Promise<Workflow | undefined> {
    return this.workflows.get(id);
  }

  async saveWorkflow(workflow: Workflow): Promise<{ workflow?: Workflow; rejections: WorkflowEdgeRejection[] }> {
    const rejections = tryValidateWorkflow(workflow, this.definitionsRecord());
    if (rejections.length > 0) {
      return { rejections };
    }
    const persisted = await this.workflows.save(workflow);
    return { workflow: persisted, rejections: [] };
  }

  async validateWorkflow(id: string): Promise<{ rejections: WorkflowEdgeRejection[] } | undefined> {
    const workflow = await this.workflows.get(id);
    if (!workflow) return undefined;
    return { rejections: tryValidateWorkflow(workflow, this.definitionsRecord()) };
  }

  async deleteWorkflow(id: string): Promise<boolean> {
    return this.workflows.delete(id);
  }

  async createRun(workflowId: string): Promise<
    | { run: RunState; rejections?: undefined }
    | { rejections: WorkflowEdgeRejection[]; run?: undefined }
    | { notFound: true }
  > {
    const workflow = await this.workflows.get(workflowId);
    if (!workflow) return { notFound: true } as const;

    const definitions = this.definitionsRecord();
    const rejections = tryValidateWorkflow(workflow, definitions);
    if (rejections.length > 0) {
      return { rejections };
    }

    const executionPlan = compileExecutionPlan(workflow);
    const runId = this.createId();
    const state = this.runs.create(runId, workflow.id);

    const task: RunTask = {
      runId,
      workflowId: workflow.id,
      workflow,
      definitions,
      executionPlan,
      outputSnapshots: {},
      requestedAt: new Date().toISOString(),
    };

    // 派发失败不能污染 RunState —— 但第一版内存 dispatcher 基本不会失败。
    // 若失败，Worker 侧应上报 WorkflowRunFailed；API 不再自己补事件，避免与状态机争夺权威。
    await this.dispatcher.dispatchRun(task);

    return { run: state };
  }

  getRun(runId: string): RunState | undefined {
    return this.runs.get(runId);
  }

  async cancelRun(runId: string): Promise<RunState | undefined> {
    const state = this.runs.get(runId);
    if (!state) return undefined;
    if (this.dispatcher.cancelRun) {
      await this.dispatcher.cancelRun(runId);
    }
    return this.runs.get(runId);
  }
}
