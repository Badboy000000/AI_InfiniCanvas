import type { Workflow } from '@ai-canvas/workflow-core';
import type { RunEvent, RunState } from '@ai-canvas/event-core';
import type { CapabilityCallLog } from '@ai-canvas/capability-core';

/**
 * 数据层第一版仓储抽象。
 *
 * 内存实现随 apps/api 落地（`InMemoryWorkflowRepository` / `InMemoryRunStore`）。
 * Prisma 实现骨架见本包 `prisma-*.ts` 文件——真实连库属于阶段 11 之后的部署事项，
 * 但接口必须与内存实现保持一致，避免协议漂移。
 */

export interface WorkflowRepository {
  list(): Promise<Workflow[]>;
  get(id: string): Promise<Workflow | undefined>;
  save(workflow: Workflow): Promise<Workflow>;
  delete(id: string): Promise<boolean>;
}

export type RunSubscriber = (event: RunEvent) => void;

export interface RunStore {
  create(runId: string, workflowId: string): RunState;
  get(runId: string): RunState | undefined;
  getEvents(runId: string): RunEvent[];
  applyEvent(event: RunEvent): RunState;
  subscribe(runId: string, subscriber: RunSubscriber): () => void;
}

/**
 * NodeResultVersion 与 Asset 是节点执行留痕。
 * 第一版 apps/api 只保存 RunState 里的 resultVersionIds，
 * 完整版本内容与资产的持久化由本仓储承担（阶段 8 内存实现，阶段 11+ 落库）。
 */

export type NodeResultVersionRecord = {
  id: string;
  workflowId: string;
  nodeId: string;
  runId?: string;
  outputKey: string;
  versionNumber: number;
  sourceType: 'ai_generated' | 'user_edited' | 'regenerated' | 'code_generated' | 'imported';
  parentVersionId?: string;
  contentType: 'text' | 'markdown' | 'json' | 'image' | 'image_array' | 'layered_image' | 'long_image' | 'file' | 'asset_ref';
  content?: unknown;
  assetIds?: string[];
  summary?: string;
  inputSnapshot?: unknown;
  modelInfo?: {
    provider: string;
    model: string;
    params?: Record<string, unknown>;
  };
  promptVersion?: string;
  createdBy: 'system' | 'user';
  createdAt: string;
};

export interface NodeResultVersionStore {
  save(record: NodeResultVersionRecord): Promise<void>;
  listByNode(workflowId: string, nodeId: string, outputKey?: string): Promise<NodeResultVersionRecord[]>;
  getById(id: string): Promise<NodeResultVersionRecord | undefined>;
}

export type AssetRecord = {
  id: string;
  type: 'image' | 'file' | 'video' | 'long_image';
  url: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export interface AssetStore {
  save(asset: AssetRecord): Promise<void>;
  getById(id: string): Promise<AssetRecord | undefined>;
}

export interface CapabilityCallLogStore {
  append(log: CapabilityCallLog): Promise<void>;
  listByRun(runId: string): Promise<CapabilityCallLog[]>;
}
