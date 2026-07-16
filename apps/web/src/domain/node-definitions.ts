import {
  builtInNodeDefinitions,
  createNodeDefinitionRegistry,
  getBuiltInNodeDefinition,
  type NodeDefinitionRegistry,
} from '@ai-canvas/node-definitions';
import type { NodeDefinition } from '@ai-canvas/node-protocol';

/**
 * apps/web 消费的唯一节点定义来源。
 * 阶段 10 起改为从 API `GET /api/node-definitions` 拉取；本文件保留接口不变。
 */
export const nodeDefinitionRegistry: NodeDefinitionRegistry = createNodeDefinitionRegistry();

export function listNodeDefinitions(): NodeDefinition[] {
  return builtInNodeDefinitions;
}

export function getNodeDefinition(type: string): NodeDefinition | undefined {
  return getBuiltInNodeDefinition(type);
}

/**
 * 把 NodeDefinition 的 category 映射到当前前端 UI 使用的中文分类。
 * 保持 UI 展示不受协议命名影响，同时消灭前端硬编码分类。
 */
export function displayCategory(category: NodeDefinition['category']): '输入' | '处理' | '生成' | '输出' | 'AI' {
  switch (category) {
    case 'input':
      return '输入';
    case 'processor':
      return '处理';
    case 'ai':
      return 'AI';
    case 'editor':
      return '处理';
    case 'export':
      return '输出';
    default:
      return '处理';
  }
}
