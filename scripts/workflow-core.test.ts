import {
  compileExecutionPlan,
  resolveNodeInputs,
  tryValidateEdge,
  tryValidateWorkflow,
  validateEdges,
  type Edge,
  type Workflow,
  type WorkflowEdgeRejection,
} from '../packages/workflow-core/src/index.js';
import type { NodeDefinition, Node } from '../packages/node-protocol/src/index.js';
import { strict as assert } from 'node:assert';

const inputDefinition: NodeDefinition = {
  type: 'input.text',
  title: '文本输入',
  category: 'input',
  inputs: [],
  outputs: [{ key: 'text', label: '文本', dataType: 'text', cardinality: 'single' }],
  executor: { type: 'manual' },
};

const processorDefinition: NodeDefinition = {
  type: 'processor.concat',
  title: '拼接',
  category: 'processor',
  inputs: [
    { key: 'primary', label: '主输入', acceptedTypes: ['text'], cardinality: 'single', required: true },
    { key: 'references', label: '参考输入', acceptedTypes: ['text'], cardinality: 'array', required: false },
  ],
  outputs: [{ key: 'result', label: '结果', dataType: 'text', cardinality: 'single' }],
  executor: { type: 'code', executorKey: 'concat' },
};

const definitions: Record<string, NodeDefinition> = {
  'input.text': inputDefinition,
  'processor.concat': processorDefinition,
};

const textNode = (id: string): Node => ({
  id,
  type: 'input.text',
  title: id,
  position: { x: 0, y: 0 },
  config: { params: {} },
});

const processorNode: Node = {
  id: 'processor',
  type: 'processor.concat',
  title: 'processor',
  position: { x: 0, y: 0 },
  config: {
    params: {},
    orderedInputs: {
      references: [
        { sourceNodeId: 'ref-b', sourceOutputKey: 'text' },
        { sourceNodeId: 'ref-a', sourceOutputKey: 'text' },
      ],
    },
  },
};

const workflow: Workflow = {
  id: 'wf',
  name: 'wf',
  nodes: [textNode('primary'), textNode('ref-a'), textNode('ref-b'), processorNode],
  edges: [
    { id: 'e1', sourceNodeId: 'primary', sourceOutputKey: 'text', targetNodeId: 'processor', targetInputKey: 'primary' },
    { id: 'e2', sourceNodeId: 'ref-a', sourceOutputKey: 'text', targetNodeId: 'processor', targetInputKey: 'references' },
    { id: 'e3', sourceNodeId: 'ref-b', sourceOutputKey: 'text', targetNodeId: 'processor', targetInputKey: 'references' },
  ],
};

validateEdges(workflow, definitions);
const plan = compileExecutionPlan(workflow);
assert.deepEqual(plan.executionGroups, [['primary', 'ref-a', 'ref-b'], ['processor']]);

const resolved = resolveNodeInputs({
  workflow,
  nodeId: 'processor',
  definitions,
  outputSnapshots: {
    primary: { text: { value: 'main', versionId: 'ver-main' } },
    'ref-a': { text: { value: 'A', versionId: 'ver-a' } },
    'ref-b': { text: { value: 'B', versionId: 'ver-b' } },
  },
});

assert.equal(resolved.primary.value, 'main');
assert.deepEqual(resolved.references.value, ['B', 'A']);
assert.deepEqual(
  resolved.references.sourceRefs.map((item) => item.sourceNodeId),
  ['ref-b', 'ref-a'],
);

const missingInputWorkflow: Workflow = {
  ...workflow,
  edges: workflow.edges.filter((edge) => edge.targetInputKey !== 'primary'),
};

assert.throws(
  () =>
    resolveNodeInputs({
      workflow: missingInputWorkflow,
      nodeId: 'processor',
      definitions,
      outputSnapshots: {
        'ref-a': { text: { value: 'A', versionId: 'ver-a' } },
        'ref-b': { text: { value: 'B', versionId: 'ver-b' } },
      },
    }),
  /Missing required input 'primary'/,
);

const cycleEdges: Edge[] = [
  { id: 'c1', sourceNodeId: 'a', sourceOutputKey: 'text', targetNodeId: 'b', targetInputKey: 'primary' },
  { id: 'c2', sourceNodeId: 'b', sourceOutputKey: 'result', targetNodeId: 'a', targetInputKey: 'primary' },
];
assert.throws(
  () =>
    compileExecutionPlan({
      id: 'cycle',
      name: 'cycle',
      nodes: [textNode('a'), { ...processorNode, id: 'b' }],
      edges: cycleEdges,
    }),
  /Cycle detected/,
);

// ---- WorkflowEdgeRejection 结构化拒绝对象测试 ----

const imageInputDefinition: NodeDefinition = {
  type: 'input.image',
  title: '图片输入',
  category: 'input',
  inputs: [],
  outputs: [{ key: 'images', label: '图片', dataType: 'image', cardinality: 'array' }],
  executor: { type: 'asset' },
};

const rejectionDefinitions: Record<string, NodeDefinition> = {
  'input.text': inputDefinition,
  'processor.concat': processorDefinition,
  'input.image': imageInputDefinition,
};

const emptyWorkflow: Workflow = {
  id: 'wf-rej',
  name: 'wf-rej',
  nodes: [
    textNode('primary'),
    textNode('ref-a'),
    { ...processorNode },
    { id: 'img', type: 'input.image', title: 'img', position: { x: 0, y: 0 }, config: { params: {} } },
  ],
  edges: [],
};

function expectRejection(
  rejection: WorkflowEdgeRejection | null,
  code: WorkflowEdgeRejection['code'],
): asserts rejection is WorkflowEdgeRejection {
  assert.ok(rejection, `expected rejection ${code}`);
  assert.equal(rejection.code, code);
}

// self connection
{
  const rej = tryValidateEdge(
    {
      sourceNodeId: 'primary',
      sourceOutputKey: 'text',
      targetNodeId: 'primary',
      targetInputKey: 'primary',
    },
    emptyWorkflow,
    rejectionDefinitions,
  );
  expectRejection(rej, 'self_connection_not_allowed');
}

// unknown port
{
  const rej = tryValidateEdge(
    {
      sourceNodeId: 'primary',
      sourceOutputKey: 'not-exist',
      targetNodeId: 'processor',
      targetInputKey: 'primary',
    },
    emptyWorkflow,
    rejectionDefinitions,
  );
  expectRejection(rej, 'source_port_unknown');
}

{
  const rej = tryValidateEdge(
    {
      sourceNodeId: 'primary',
      sourceOutputKey: 'text',
      targetNodeId: 'processor',
      targetInputKey: 'not-exist',
    },
    emptyWorkflow,
    rejectionDefinitions,
  );
  expectRejection(rej, 'target_port_unknown');
}

// type incompatible
{
  const rej = tryValidateEdge(
    {
      sourceNodeId: 'img',
      sourceOutputKey: 'images',
      targetNodeId: 'processor',
      targetInputKey: 'primary',
    },
    emptyWorkflow,
    rejectionDefinitions,
  );
  expectRejection(rej, 'type_incompatible');
  assert.deepEqual(rej.detail?.targetAcceptedTypes, ['text']);
  assert.equal(rej.detail?.sourceDataType, 'image');
}

// target input occupied (single)
{
  const occupiedWorkflow: Workflow = {
    ...emptyWorkflow,
    edges: [
      { id: 'existing', sourceNodeId: 'primary', sourceOutputKey: 'text', targetNodeId: 'processor', targetInputKey: 'primary' },
    ],
  };
  const rej = tryValidateEdge(
    {
      sourceNodeId: 'ref-a',
      sourceOutputKey: 'text',
      targetNodeId: 'processor',
      targetInputKey: 'primary',
    },
    occupiedWorkflow,
    rejectionDefinitions,
  );
  expectRejection(rej, 'target_input_occupied');
  assert.equal(rej.detail?.existingEdgeId, 'existing');
  // same edgeId 更新自身不算占用
  const selfUpdate = tryValidateEdge(
    {
      edgeId: 'existing',
      sourceNodeId: 'primary',
      sourceOutputKey: 'text',
      targetNodeId: 'processor',
      targetInputKey: 'primary',
    },
    occupiedWorkflow,
    rejectionDefinitions,
  );
  assert.equal(selfUpdate, null);
}

// would create cycle
{
  const cycleWorkflow: Workflow = {
    ...emptyWorkflow,
    nodes: [
      { ...processorNode, id: 'a' },
      { ...processorNode, id: 'b' },
    ],
    edges: [
      { id: 'ab', sourceNodeId: 'a', sourceOutputKey: 'result', targetNodeId: 'b', targetInputKey: 'primary' },
    ],
  };
  const rej = tryValidateEdge(
    {
      sourceNodeId: 'b',
      sourceOutputKey: 'result',
      targetNodeId: 'a',
      targetInputKey: 'primary',
    },
    cycleWorkflow,
    rejectionDefinitions,
  );
  expectRejection(rej, 'would_create_cycle');
}

// happy path
{
  const rej = tryValidateEdge(
    {
      sourceNodeId: 'primary',
      sourceOutputKey: 'text',
      targetNodeId: 'processor',
      targetInputKey: 'primary',
    },
    emptyWorkflow,
    rejectionDefinitions,
  );
  assert.equal(rej, null);
}

// tryValidateWorkflow: 汇总多个问题
{
  const brokenWorkflow: Workflow = {
    ...emptyWorkflow,
    edges: [
      { id: 'ok', sourceNodeId: 'primary', sourceOutputKey: 'text', targetNodeId: 'processor', targetInputKey: 'primary' },
      { id: 'dup', sourceNodeId: 'ref-a', sourceOutputKey: 'text', targetNodeId: 'processor', targetInputKey: 'primary' },
      { id: 'bad-type', sourceNodeId: 'img', sourceOutputKey: 'images', targetNodeId: 'processor', targetInputKey: 'primary' },
    ],
  };
  const rejections = tryValidateWorkflow(brokenWorkflow, rejectionDefinitions);
  const codes = new Set(rejections.map((r) => r.code));
  assert.ok(codes.has('target_input_occupied'));
  assert.ok(codes.has('type_incompatible'));
}

console.log('workflow-core tests passed');
