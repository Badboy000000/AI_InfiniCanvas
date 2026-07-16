import type { Workflow } from '@ai-canvas/workflow-core';

/**
 * 内存工作流仓储。阶段 8 起会替换为 Prisma 实现，接口保持不变。
 */
export interface WorkflowRepository {
  list(): Promise<Workflow[]>;
  get(id: string): Promise<Workflow | undefined>;
  save(workflow: Workflow): Promise<Workflow>;
  delete(id: string): Promise<boolean>;
}

export class InMemoryWorkflowRepository implements WorkflowRepository {
  private readonly store = new Map<string, Workflow>();

  async list(): Promise<Workflow[]> {
    return Array.from(this.store.values()).map((workflow) => cloneWorkflow(workflow));
  }

  async get(id: string): Promise<Workflow | undefined> {
    const workflow = this.store.get(id);
    return workflow ? cloneWorkflow(workflow) : undefined;
  }

  async save(workflow: Workflow): Promise<Workflow> {
    const now = new Date().toISOString();
    const persisted: Workflow = {
      ...workflow,
      createdAt: workflow.createdAt ?? now,
      updatedAt: now,
    };
    this.store.set(persisted.id, cloneWorkflow(persisted));
    return cloneWorkflow(persisted);
  }

  async delete(id: string): Promise<boolean> {
    return this.store.delete(id);
  }
}

function cloneWorkflow(workflow: Workflow): Workflow {
  // 深拷贝避免调用方外部修改污染内存仓储。JSON 走一遍即可，因为 Workflow 只含结构化 JSON 值。
  return JSON.parse(JSON.stringify(workflow));
}
