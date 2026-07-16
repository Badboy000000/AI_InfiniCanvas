import type {
  AssetStore,
  CapabilityCallLogStore,
  NodeResultVersionStore,
  RunStore,
  WorkflowRepository,
} from './repositories.js';
import type { RunDispatcher } from './dispatcher.js';

/**
 * Prisma 实现骨架。
 *
 * 第一版沙箱无法安装 @prisma/client 也无法启动 Postgres，因此本文件只保留：
 * - 构造函数签名（接收一个已经注入的 Prisma Client 实例）
 * - 每个方法抛出 `prisma_not_wired` 错误，把预期实现方式作为注释保留
 *
 * 真实部署时替换 body 即可。所有接口签名与内存实现一致，
 * 从 InMemory 切换到 Prisma 只需在 apps/api 的组装点更换构造函数。
 */

// 只声明结构而非直接引用 @prisma/client 类型，避免第一版必须安装该依赖。
type MinimalPrismaClient = {
  $connect: () => Promise<void>;
  $disconnect: () => Promise<void>;
};

export class PrismaWorkflowRepository implements WorkflowRepository {
  constructor(protected readonly prisma: MinimalPrismaClient) {}

  async list() {
    throw notWired('PrismaWorkflowRepository.list');
    return [];
  }

  async get(_id: string) {
    throw notWired('PrismaWorkflowRepository.get');
    return undefined;
  }

  async save(_workflow: any): Promise<any> {
    throw notWired('PrismaWorkflowRepository.save');
  }

  async delete(_id: string) {
    throw notWired('PrismaWorkflowRepository.delete');
    return false;
  }
}

export class PrismaRunStore implements RunStore {
  constructor(protected readonly prisma: MinimalPrismaClient) {}

  create(): any {
    throw notWired('PrismaRunStore.create');
  }

  get() {
    throw notWired('PrismaRunStore.get');
    return undefined;
  }

  getEvents(): any[] {
    throw notWired('PrismaRunStore.getEvents');
  }

  applyEvent(): any {
    throw notWired('PrismaRunStore.applyEvent');
  }

  subscribe(): () => void {
    throw notWired('PrismaRunStore.subscribe');
  }
}

export class PrismaNodeResultVersionStore implements NodeResultVersionStore {
  constructor(protected readonly prisma: MinimalPrismaClient) {}
  async save() { throw notWired('PrismaNodeResultVersionStore.save'); }
  async listByNode(): Promise<any[]> { throw notWired('PrismaNodeResultVersionStore.listByNode'); }
  async getById() { throw notWired('PrismaNodeResultVersionStore.getById'); return undefined; }
}

export class PrismaAssetStore implements AssetStore {
  constructor(protected readonly prisma: MinimalPrismaClient) {}
  async save() { throw notWired('PrismaAssetStore.save'); }
  async getById() { throw notWired('PrismaAssetStore.getById'); return undefined; }
}

export class PrismaCapabilityCallLogStore implements CapabilityCallLogStore {
  constructor(protected readonly prisma: MinimalPrismaClient) {}
  async append() { throw notWired('PrismaCapabilityCallLogStore.append'); }
  async listByRun(): Promise<any[]> { throw notWired('PrismaCapabilityCallLogStore.listByRun'); }
}

/**
 * 组装 helper：一次性构造全部 Prisma 实现。
 * 阶段 8 之后 apps/api 的入口通过 env 切换 InMemory ↔ Prisma。
 */
export function createPrismaStores(prisma: MinimalPrismaClient) {
  return {
    workflows: new PrismaWorkflowRepository(prisma),
    runs: new PrismaRunStore(prisma),
    resultVersions: new PrismaNodeResultVersionStore(prisma),
    assets: new PrismaAssetStore(prisma),
    capabilityLogs: new PrismaCapabilityCallLogStore(prisma),
  };
}

/**
 * 未实现占位 RunDispatcher（阶段 8 保留结构，实际接入 BullMQ 见 dispatcher.ts::BullMqRunDispatcher）。
 */
export class PrismaRunDispatcherPlaceholder implements RunDispatcher {
  async dispatchRun() { throw notWired('PrismaRunDispatcherPlaceholder.dispatchRun'); }
  async cancelRun() { throw notWired('PrismaRunDispatcherPlaceholder.cancelRun'); }
}

function notWired(name: string): Error {
  return new Error(`[persistence] ${name} 尚未接线到 Prisma。请在部署阶段接入 @prisma/client 并替换本方法实现。`);
}
