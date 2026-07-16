import type { NodeExecutor } from '@ai-canvas/node-protocol';

export interface NodeExecutorRegistry {
  register(executor: NodeExecutor): void;
  get(executorKey: string): NodeExecutor | undefined;
}

export function createNodeExecutorRegistry(initial: NodeExecutor[] = []): NodeExecutorRegistry {
  const map = new Map<string, NodeExecutor>();
  for (const executor of initial) {
    map.set(executor.executorKey, executor);
  }
  return {
    register(executor) {
      if (map.has(executor.executorKey)) {
        throw new Error(`Duplicate executor: ${executor.executorKey}`);
      }
      map.set(executor.executorKey, executor);
    },
    get(executorKey) {
      return map.get(executorKey);
    },
  };
}
