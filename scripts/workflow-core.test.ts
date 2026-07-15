import { compileExecutionPlan, resolveNodeInputs, validateEdges, type Edge, type Workflow } from '../packages/workflow-core/src/index.js';
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

console.log('workflow-core tests passed');
