import { tryValidateEdge, type EdgeCandidate, type Workflow, type WorkflowEdgeRejection } from '@ai-canvas/workflow-core';
import type { NodeDefinition } from '@ai-canvas/node-protocol';
import { nodeDefinitionRegistry } from './node-definitions.js';

/**
 * 通过 workflow-core 做权威连线校验。
 * 前端只把当前画布上的节点/边组装成 workflow-core 的结构入参，不再重复实现类型或成环判断。
 */
export function validateEdgeAttempt(input: {
  candidate: EdgeCandidate;
  workflow: Workflow;
  definitions?: Record<string, NodeDefinition>;
}): WorkflowEdgeRejection | null {
  return tryValidateEdge(
    input.candidate,
    input.workflow,
    input.definitions ?? nodeDefinitionRegistry.toRecord(),
  );
}

/**
 * 拒绝 code -> 用户可读文案。
 * 前端禁止基于自己的判断拼字符串，必须消费本字典。
 */
export const edgeRejectionMessages: Record<WorkflowEdgeRejection['code'], string> = {
  self_connection_not_allowed: '不允许把节点连回自身。',
  source_node_unknown: '来源节点不存在。',
  target_node_unknown: '目标节点不存在。',
  source_definition_missing: '来源节点类型的定义未加载，请刷新页面重试。',
  target_definition_missing: '目标节点类型的定义未加载，请刷新页面重试。',
  source_port_unknown: '来源节点缺少这个输出端口。',
  target_port_unknown: '目标节点缺少这个输入端口。',
  type_incompatible: '数据类型不匹配，无法把当前输出接到该输入。',
  target_input_occupied: '该输入端口已被其它连线占用，先删除已有连线再连接。',
  would_create_cycle: '连接后会形成环路，画布不允许出现循环依赖。',
  cardinality_violation: '端口的多/单值规则不允许这次连接。',
  node_protocol_violation: '违反节点协议规则，无法建立该连线。',
};

export function describeRejection(rejection: WorkflowEdgeRejection): string {
  const base = edgeRejectionMessages[rejection.code] ?? '这条连线不合法。';
  if (rejection.code === 'type_incompatible' && rejection.detail) {
    const accepted = rejection.detail.targetAcceptedTypes?.join(' / ');
    const source = rejection.detail.sourceDataType;
    return `${base} 目标接受 ${accepted}，来源提供 ${source}。`;
  }
  return base;
}
