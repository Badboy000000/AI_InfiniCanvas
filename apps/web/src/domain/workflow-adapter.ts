import type { Node as ProtocolNode } from '@ai-canvas/node-protocol';
import type { Edge, Workflow } from '@ai-canvas/workflow-core';
import type { InputPortDef, WorkflowEdge, WorkflowNode } from '../types.js';
import { getNodeDefinition } from './node-definitions.js';

/**
 * apps/web 的 UI View-Model 与 workflow-core / node-protocol 的正式结构之间的适配层。
 * UI 层继续用 WorkflowNode/WorkflowEdge 保持交互稳定，
 * 但校验和后续 API 交互一律走本文件转换出的 Workflow 结构。
 *
 * 关键契约：
 * - WorkflowNode.nodeType 存正式 NodeDefinition.type，如果尚未升级到协议节点，可为空字符串
 * - WorkflowEdge.fromPort 目前一律是 'output'，因此在协议侧固定映射为 NodeDefinition.outputs[0].key
 *   （节点原型输出端口只有一个）；产品化对齐阶段将逐步接入多输出场景。
 */

export function toProtocolNode(node: WorkflowNode): ProtocolNode {
  return {
    id: node.id,
    type: node.nodeType ?? node.type,
    title: node.title,
    position: { x: node.x, y: node.y },
    config: { params: {} },
  };
}

export function toProtocolEdge(edge: WorkflowEdge, sourceOutputKey: string): Edge {
  return {
    id: edge.id,
    sourceNodeId: edge.from,
    sourceOutputKey,
    targetNodeId: edge.to,
    targetInputKey: edge.toPort,
  };
}

export function resolveSourceOutputKey(node: WorkflowNode | undefined): string {
  if (!node) return 'output';
  const definition = node.nodeType ? getNodeDefinition(node.nodeType) : undefined;
  return definition?.outputs[0]?.key ?? 'output';
}

export function toWorkflow(nodes: WorkflowNode[], edges: WorkflowEdge[]): Workflow {
  const protocolNodes = nodes.map(toProtocolNode);
  const protocolEdges: Edge[] = edges.map((edge) => {
    const sourceNode = nodes.find((candidate) => candidate.id === edge.from);
    return toProtocolEdge(edge, resolveSourceOutputKey(sourceNode));
  });
  return {
    id: 'canvas-draft',
    name: 'canvas-draft',
    nodes: protocolNodes,
    edges: protocolEdges,
  };
}

export function upgradeUiInputPortsFromDefinition(nodeType: string): InputPortDef[] | undefined {
  const definition = getNodeDefinition(nodeType);
  if (!definition) return undefined;
  return definition.inputs.map((input, index) => ({
    id: input.key,
    label: input.label,
    dataType: mapAcceptedTypesToUi(input.acceptedTypes) ?? 'text',
    _order: index,
  })) as InputPortDef[];
}

function mapAcceptedTypesToUi(types: string[]): InputPortDef['dataType'] | undefined {
  if (types.includes('image') || types.includes('image_array')) return 'image';
  if (types.includes('markdown') || types.includes('text')) return 'text';
  if (types.includes('json')) return 'text';
  if (types.includes('file') || types.includes('asset_ref') || types.includes('long_image') || types.includes('layered_image')) return 'file';
  return undefined;
}
