import { nodeDefinitionSchema, type NodeDefinition } from '@ai-canvas/node-protocol';
import { builtInNodeDefinitions } from './definitions.js';

export type NodeDefinitionRegistry = {
  list(): NodeDefinition[];
  get(type: string): NodeDefinition | undefined;
  toRecord(): Record<string, NodeDefinition>;
};

/**
 * 构造一个内存节点定义仓库。
 * 传入 `validate: true` 时，会对每个节点定义调用 nodeDefinitionSchema.parse 做运行时验证，
 * 用于在 API/Worker/Web 启动或 CI 中确保内置定义与正式协议一致。
 */
export function createNodeDefinitionRegistry(options: {
  definitions?: NodeDefinition[];
  validate?: boolean;
} = {}): NodeDefinitionRegistry {
  const source = options.definitions ?? builtInNodeDefinitions;
  const map = new Map<string, NodeDefinition>();

  for (const definition of source) {
    const finalDefinition = options.validate
      ? (nodeDefinitionSchema.parse(definition) as NodeDefinition)
      : definition;
    if (map.has(finalDefinition.type)) {
      throw new Error(`Duplicate NodeDefinition type: ${finalDefinition.type}`);
    }
    map.set(finalDefinition.type, finalDefinition);
  }

  return {
    list: () => Array.from(map.values()),
    get: (type: string) => map.get(type),
    toRecord: () => Object.fromEntries(map.entries()),
  };
}

/**
 * 便捷函数：按 type 从内置定义中查找节点定义。
 */
export function getBuiltInNodeDefinition(type: string): NodeDefinition | undefined {
  return builtInNodeDefinitions.find((definition) => definition.type === type);
}
