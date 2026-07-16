import { strict as assert } from 'node:assert';
import {
  builtInNodeDefinitions,
  createNodeDefinitionRegistry,
  getBuiltInNodeDefinition,
} from '../packages/node-definitions/src/index.js';
import { nodeDefinitionSchema } from '../packages/node-protocol/src/index.js';

// 每个内置节点定义都必须通过节点协议 schema
for (const definition of builtInNodeDefinitions) {
  nodeDefinitionSchema.parse(definition);
}

// type 应唯一
const seen = new Set<string>();
for (const definition of builtInNodeDefinitions) {
  assert.ok(!seen.has(definition.type), `duplicate type: ${definition.type}`);
  seen.add(definition.type);
}

// MVP 必需的类型必须都存在
const requiredTypes = [
  'input.text',
  'input.image',
  'ai.text_generation',
  'ai.image_analysis',
  'ai.image_generation',
  'processor.context_assembler',
  'processor.image_stitch',
  'editor.text',
  'export.image',
];
for (const type of requiredTypes) {
  assert.ok(getBuiltInNodeDefinition(type), `missing definition: ${type}`);
}

// registry 基础行为
const registry = createNodeDefinitionRegistry({ validate: true });
assert.equal(registry.list().length, builtInNodeDefinitions.length);
assert.ok(registry.get('ai.image_generation'));
assert.equal(registry.get('not-exist'), undefined);
const record = registry.toRecord();
assert.ok(record['input.text']);

// 重复注册应抛错
assert.throws(() => {
  createNodeDefinitionRegistry({
    definitions: [
      getBuiltInNodeDefinition('input.text')!,
      getBuiltInNodeDefinition('input.text')!,
    ],
  });
}, /Duplicate NodeDefinition type/);

console.log('node-definitions tests passed');
