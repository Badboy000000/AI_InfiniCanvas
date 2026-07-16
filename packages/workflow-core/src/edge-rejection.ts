import type { NodeDefinition } from '../../node-protocol/src/index.js';
import type { Edge, Workflow } from './types.js';
import { wouldCreateWorkflowCycle } from './input-resolver.js';

/**
 * 结构化连线拒绝原因，见 [[核心数据模型设计]] 与 [[工程化落地技术开发要求]]。
 * workflow-core 是唯一权威判定入口，前端与 API 都必须消费同一份结构化结果。
 */
export type WorkflowEdgeRejectionCode =
  | 'type_incompatible'
  | 'would_create_cycle'
  | 'target_input_occupied'
  | 'target_port_unknown'
  | 'source_port_unknown'
  | 'source_node_unknown'
  | 'target_node_unknown'
  | 'source_definition_missing'
  | 'target_definition_missing'
  | 'self_connection_not_allowed'
  | 'cardinality_violation'
  | 'node_protocol_violation';

export type WorkflowEdgeRejectionDetail = {
  sourceDataType?: string;
  targetAcceptedTypes?: string[];
  existingSourceNodeId?: string;
  existingSourceOutputKey?: string;
  existingEdgeId?: string;
  targetCardinality?: 'single' | 'array';
  message?: string;
};

export type WorkflowEdgeRejection = {
  code: WorkflowEdgeRejectionCode;
  reason: string;
  sourceNodeId: string;
  sourceOutputKey: string;
  targetNodeId: string;
  targetInputKey: string;
  edgeId?: string;
  detail?: WorkflowEdgeRejectionDetail;
};

export type EdgeCandidate = {
  edgeId?: string;
  sourceNodeId: string;
  sourceOutputKey: string;
  targetNodeId: string;
  targetInputKey: string;
};

/**
 * 判定一条候选连线是否能加入到当前 workflow，若不能则返回结构化拒绝对象。
 *
 * - 已存在的 edges 用作占用与成环判定的上下文（不包含 candidate 本身）。
 * - 若 candidate 已经在 workflow.edges 中，可通过 edgeId 传入以排除自身占用。
 */
export function tryValidateEdge(
  candidate: EdgeCandidate,
  workflow: Workflow,
  definitions: Record<string, NodeDefinition>,
): WorkflowEdgeRejection | null {
  const {
    sourceNodeId,
    sourceOutputKey,
    targetNodeId,
    targetInputKey,
    edgeId,
  } = candidate;

  const base = {
    sourceNodeId,
    sourceOutputKey,
    targetNodeId,
    targetInputKey,
    edgeId,
  };

  if (sourceNodeId === targetNodeId) {
    return {
      ...base,
      code: 'self_connection_not_allowed',
      reason: '不允许把节点连接到自身',
    };
  }

  const sourceNode = workflow.nodes.find((node) => node.id === sourceNodeId);
  if (!sourceNode) {
    return {
      ...base,
      code: 'source_node_unknown',
      reason: `未找到来源节点 ${sourceNodeId}`,
    };
  }

  const targetNode = workflow.nodes.find((node) => node.id === targetNodeId);
  if (!targetNode) {
    return {
      ...base,
      code: 'target_node_unknown',
      reason: `未找到目标节点 ${targetNodeId}`,
    };
  }

  const sourceDefinition = definitions[sourceNode.type];
  if (!sourceDefinition) {
    return {
      ...base,
      code: 'source_definition_missing',
      reason: `未找到来源节点类型 ${sourceNode.type} 的节点定义`,
    };
  }

  const targetDefinition = definitions[targetNode.type];
  if (!targetDefinition) {
    return {
      ...base,
      code: 'target_definition_missing',
      reason: `未找到目标节点类型 ${targetNode.type} 的节点定义`,
    };
  }

  const outputPort = sourceDefinition.outputs.find((port) => port.key === sourceOutputKey);
  if (!outputPort) {
    return {
      ...base,
      code: 'source_port_unknown',
      reason: `来源节点 ${sourceNodeId} 不存在输出端口 ${sourceOutputKey}`,
    };
  }

  const inputPort = targetDefinition.inputs.find((port) => port.key === targetInputKey);
  if (!inputPort) {
    return {
      ...base,
      code: 'target_port_unknown',
      reason: `目标节点 ${targetNodeId} 不存在输入端口 ${targetInputKey}`,
    };
  }

  if (!inputPort.acceptedTypes.includes(outputPort.dataType)) {
    return {
      ...base,
      code: 'type_incompatible',
      reason: `目标输入端口 ${targetInputKey} 不接受数据类型 ${outputPort.dataType}`,
      detail: {
        sourceDataType: outputPort.dataType,
        targetAcceptedTypes: [...inputPort.acceptedTypes],
      },
    };
  }

  if (inputPort.cardinality === 'single') {
    const existing = workflow.edges.find(
      (edge) =>
        edge.targetNodeId === targetNodeId &&
        edge.targetInputKey === targetInputKey &&
        edge.id !== edgeId,
    );
    if (existing) {
      return {
        ...base,
        code: 'target_input_occupied',
        reason: `目标输入端口 ${targetInputKey} 只接受单一上游，已被占用`,
        detail: {
          existingSourceNodeId: existing.sourceNodeId,
          existingSourceOutputKey: existing.sourceOutputKey,
          existingEdgeId: existing.id,
          targetCardinality: inputPort.cardinality,
        },
      };
    }
  }

  const otherEdges = workflow.edges.filter((edge) => edge.id !== edgeId);
  if (wouldCreateWorkflowCycle(otherEdges, sourceNodeId, targetNodeId)) {
    return {
      ...base,
      code: 'would_create_cycle',
      reason: `这条连线会导致工作流出现环路`,
    };
  }

  return null;
}

/**
 * 批量校验一个 workflow 中的所有连线，返回全部结构化拒绝对象。
 * 未通过校验时返回非空数组；空数组表示当前 workflow 的所有连线在结构层面合法。
 */
export function tryValidateWorkflow(
  workflow: Workflow,
  definitions: Record<string, NodeDefinition>,
): WorkflowEdgeRejection[] {
  const rejections: WorkflowEdgeRejection[] = [];
  const seenSingleTargets = new Map<string, Edge>();

  for (const edge of workflow.edges) {
    // 先做基础存在性/类型判定
    const rejection = tryValidateEdge(
      {
        edgeId: edge.id,
        sourceNodeId: edge.sourceNodeId,
        sourceOutputKey: edge.sourceOutputKey,
        targetNodeId: edge.targetNodeId,
        targetInputKey: edge.targetInputKey,
      },
      workflow,
      definitions,
    );

    if (rejection) {
      rejections.push(rejection);
      continue;
    }

    // 已存在的边之间检查 single cardinality 占用冲突：
    // tryValidateEdge 会排除 edgeId 自身，但如果多条边同时消费同一个 single 输入口，
    // 这里再补一次一致性检测。
    const targetNode = workflow.nodes.find((node) => node.id === edge.targetNodeId);
    if (!targetNode) continue;
    const targetDefinition = definitions[targetNode.type];
    if (!targetDefinition) continue;
    const inputPort = targetDefinition.inputs.find((port) => port.key === edge.targetInputKey);
    if (!inputPort || inputPort.cardinality !== 'single') continue;

    const key = `${edge.targetNodeId}:${edge.targetInputKey}`;
    const existing = seenSingleTargets.get(key);
    if (existing) {
      rejections.push({
        edgeId: edge.id,
        sourceNodeId: edge.sourceNodeId,
        sourceOutputKey: edge.sourceOutputKey,
        targetNodeId: edge.targetNodeId,
        targetInputKey: edge.targetInputKey,
        code: 'target_input_occupied',
        reason: `目标输入端口 ${edge.targetInputKey} 只接受单一上游，已被占用`,
        detail: {
          existingSourceNodeId: existing.sourceNodeId,
          existingSourceOutputKey: existing.sourceOutputKey,
          existingEdgeId: existing.id,
          targetCardinality: 'single',
        },
      });
    } else {
      seenSingleTargets.set(key, edge);
    }
  }

  return rejections;
}
