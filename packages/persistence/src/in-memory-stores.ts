import type {
  AssetRecord,
  AssetStore,
  CapabilityCallLogStore,
  NodeResultVersionRecord,
  NodeResultVersionStore,
} from './repositories.js';
import type { CapabilityCallLog } from '@ai-canvas/capability-core';

/**
 * 第一版内存实现，作为 apps/api 与 apps/worker 共享的默认后端。
 * Prisma 实现替换掉这些类时，接口保持不变。
 */

export class InMemoryNodeResultVersionStore implements NodeResultVersionStore {
  private readonly records = new Map<string, NodeResultVersionRecord>();

  async save(record: NodeResultVersionRecord): Promise<void> {
    this.records.set(record.id, { ...record });
  }

  async listByNode(workflowId: string, nodeId: string, outputKey?: string): Promise<NodeResultVersionRecord[]> {
    return Array.from(this.records.values()).filter(
      (record) =>
        record.workflowId === workflowId &&
        record.nodeId === nodeId &&
        (outputKey === undefined || record.outputKey === outputKey),
    );
  }

  async getById(id: string): Promise<NodeResultVersionRecord | undefined> {
    const record = this.records.get(id);
    return record ? { ...record } : undefined;
  }
}

export class InMemoryAssetStore implements AssetStore {
  private readonly records = new Map<string, AssetRecord>();

  async save(asset: AssetRecord): Promise<void> {
    this.records.set(asset.id, { ...asset });
  }

  async getById(id: string): Promise<AssetRecord | undefined> {
    const record = this.records.get(id);
    return record ? { ...record } : undefined;
  }
}

export class InMemoryCapabilityCallLogStore implements CapabilityCallLogStore {
  private readonly logs: CapabilityCallLog[] = [];

  async append(log: CapabilityCallLog): Promise<void> {
    this.logs.push({ ...log });
  }

  async listByRun(runId: string): Promise<CapabilityCallLog[]> {
    return this.logs.filter((log) => log.runId === runId).map((log) => ({ ...log }));
  }
}
