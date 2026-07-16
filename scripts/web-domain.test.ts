import { strict as assert } from 'node:assert';
import {
  describeRejection,
  edgeRejectionMessages,
  validateEdgeAttempt,
} from '../apps/web/src/domain/edge-validation.js';
import { resolveSourceOutputKey, toWorkflow } from '../apps/web/src/domain/workflow-adapter.js';
import { describeCapabilityError } from '../apps/web/src/domain/capability-error.js';
import { describeNodeStatus, describeRunStatus, emptyRunState } from '../apps/web/src/domain/run-state.js';
import type { WorkflowEdge, WorkflowNode } from '../apps/web/src/types.js';

// ---- 边校验：happy path
{
  const nodes: WorkflowNode[] = [
    { id: 'a', title: 'a', type: '文本输入', nodeType: 'input.text', category: '输入', dataType: 'text', x: 0, y: 0, status: '未配置', inputSummary: '', outputSummary: '', resultSummary: '', description: '' },
    { id: 'b', title: 'b', type: 'AI 文本生成', nodeType: 'ai.text_generation', category: 'AI', dataType: 'ai', x: 100, y: 0, status: '未配置', inputSummary: '', outputSummary: '', resultSummary: '', description: '', inputPorts: [{ id: 'context', label: '上下文', dataType: 'text' }] },
  ];
  const rej = validateEdgeAttempt({
    candidate: { sourceNodeId: 'a', sourceOutputKey: 'text', targetNodeId: 'b', targetInputKey: 'context' },
    workflow: toWorkflow(nodes, [], { id: 't', name: 't' }),
  });
  assert.equal(rej, null);
}

// ---- 边校验：类型不兼容 → 结构化拒绝
{
  const nodes: WorkflowNode[] = [
    { id: 'a', title: 'a', type: '图片输入', nodeType: 'input.image', category: '输入', dataType: 'image', x: 0, y: 0, status: '未配置', inputSummary: '', outputSummary: '', resultSummary: '', description: '' },
    { id: 'b', title: 'b', type: 'AI 文本生成', nodeType: 'ai.text_generation', category: 'AI', dataType: 'ai', x: 100, y: 0, status: '未配置', inputSummary: '', outputSummary: '', resultSummary: '', description: '', inputPorts: [{ id: 'context', label: '上下文', dataType: 'text' }] },
  ];
  const rej = validateEdgeAttempt({
    candidate: { sourceNodeId: 'a', sourceOutputKey: 'images', targetNodeId: 'b', targetInputKey: 'context' },
    workflow: toWorkflow(nodes, [], { id: 't', name: 't' }),
  });
  assert.ok(rej);
  assert.equal(rej.code, 'type_incompatible');
  const message = describeRejection(rej);
  assert.ok(message.includes('目标接受'), `expected explanation, got: ${message}`);
}

// ---- 边校验：自连
{
  const nodes: WorkflowNode[] = [
    { id: 'a', title: 'a', type: '文本输入', nodeType: 'input.text', category: '输入', dataType: 'text', x: 0, y: 0, status: '未配置', inputSummary: '', outputSummary: '', resultSummary: '', description: '' },
  ];
  const rej = validateEdgeAttempt({
    candidate: { sourceNodeId: 'a', sourceOutputKey: 'text', targetNodeId: 'a', targetInputKey: 'context' },
    workflow: toWorkflow(nodes, [], { id: 't', name: 't' }),
  });
  assert.ok(rej);
  assert.equal(rej.code, 'self_connection_not_allowed');
}

// ---- 拒绝字典完整
for (const code of ['type_incompatible', 'would_create_cycle', 'target_input_occupied', 'target_port_unknown', 'source_port_unknown', 'self_connection_not_allowed', 'cardinality_violation', 'node_protocol_violation'] as const) {
  assert.ok(edgeRejectionMessages[code], `missing dict entry: ${code}`);
}

// ---- resolveSourceOutputKey：对应节点协议
{
  assert.equal(
    resolveSourceOutputKey({
      id: 'x',
      title: 'x',
      type: 'AI 图片生成',
      nodeType: 'ai.image_generation',
      category: 'AI',
      dataType: 'image',
      x: 0,
      y: 0,
      status: '未配置',
      inputSummary: '',
      outputSummary: '',
      resultSummary: '',
      description: '',
    }),
    'generatedImage',
  );
  // 无 nodeType 时降级到 'output'
  assert.equal(
    resolveSourceOutputKey({
      id: 'x',
      title: 'x',
      type: 'raw',
      category: '处理',
      dataType: 'text',
      x: 0,
      y: 0,
      status: '未配置',
      inputSummary: '',
      outputSummary: '',
      resultSummary: '',
      description: '',
    }),
    'output',
  );
}

// ---- toWorkflow 保留 configParams
{
  const nodes: WorkflowNode[] = [
    {
      id: 'a',
      title: 'a',
      type: '文本输入',
      nodeType: 'input.text',
      category: '输入',
      dataType: 'text',
      x: 0,
      y: 0,
      status: '未配置',
      inputSummary: '',
      outputSummary: '',
      resultSummary: '',
      description: '',
      configParams: { value: '样例文本' },
    },
  ];
  const wf = toWorkflow(nodes, [] as WorkflowEdge[], { id: 'wf-a', name: 'a' });
  assert.equal(wf.id, 'wf-a');
  assert.equal((wf.nodes[0]!.config.params as { value?: string }).value, '样例文本');
}

// ---- capability-error 与 run-state 文案字典
assert.ok(describeCapabilityError('timeout').includes('超时'));
assert.ok(describeCapabilityError(undefined));
assert.equal(describeRunStatus(emptyRunState), '待执行');
assert.equal(describeNodeStatus(undefined), '未配置');
assert.equal(describeNodeStatus({ nodeId: 'x', status: 'success', attemptCount: 0, resultVersionIds: [] }), '成功');

console.log('web domain tests passed');
