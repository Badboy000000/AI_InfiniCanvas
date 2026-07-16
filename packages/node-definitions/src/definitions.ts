import type { NodeDefinition } from '@ai-canvas/node-protocol';

/**
 * 第一版 MVP 内置节点定义。
 *
 * 严格遵守 [[节点协议设计]] 的 NodeDefinition schema：
 * - type 全局唯一
 * - 输入/输出端口 key 稳定，作为 Edge 的引用锚点
 * - AI 节点通过 executor.requiredCapabilities 声明抽象能力，不直连模型
 * - 图片拼接等 processor 节点使用 orderedInputs 表达顺序
 *
 * 这套定义会被 apps/api、apps/worker、apps/web 共同消费，是并行开发的合同基线。
 */

export const inputTextDefinition: NodeDefinition = {
  type: 'input.text',
  title: '文本输入',
  category: 'input',
  description: '输入或粘贴文本内容，作为工作流的原始素材。',
  inputs: [],
  outputs: [
    { key: 'text', label: '文本', dataType: 'markdown', cardinality: 'single' },
  ],
  configSchema: {
    fields: [
      { key: 'placeholder', label: '占位提示', type: 'text' },
      { key: 'value', label: '初始值', type: 'textarea' },
    ],
  },
  executor: { type: 'manual', executorKey: 'input.text.executor' },
  behavior: {
    autoRunnable: false,
    requiresHumanConfirmation: true,
    editableResult: true,
  },
  summary: { mode: 'executor' },
};

export const inputImageDefinition: NodeDefinition = {
  type: 'input.image',
  title: '图片输入',
  category: 'input',
  description: '上传单张或多张图片，作为下游 AI 节点的视觉素材。',
  inputs: [],
  outputs: [
    { key: 'images', label: '图片集合', dataType: 'image', cardinality: 'array' },
  ],
  configSchema: {
    fields: [
      { key: 'allowMultiple', label: '允许多图', type: 'boolean', defaultValue: true },
    ],
  },
  executor: { type: 'asset', executorKey: 'input.image.executor' },
  behavior: {
    autoRunnable: false,
    requiresHumanConfirmation: true,
    editableResult: true,
  },
};

export const aiTextGenerationDefinition: NodeDefinition = {
  type: 'ai.text_generation',
  title: 'AI 文本生成',
  category: 'ai',
  description: '基于上下文与提示词生成文本内容。',
  inputs: [
    {
      key: 'context',
      label: '上下文',
      acceptedTypes: ['text', 'markdown', 'json'],
      cardinality: 'single',
      required: true,
    },
    {
      key: 'references',
      label: '参考资料',
      acceptedTypes: ['text', 'markdown'],
      cardinality: 'array',
      required: false,
    },
  ],
  outputs: [
    { key: 'text', label: '生成文本', dataType: 'markdown', cardinality: 'single' },
  ],
  configSchema: {
    fields: [
      { key: 'task', label: '任务预设', type: 'select', defaultValue: 'ecommerce_product_analysis', options: [
        { label: '商品分析', value: 'ecommerce_product_analysis' },
        { label: '详情图方案策划', value: 'ecommerce_detail_plan' },
        { label: '文案生成', value: 'copywriting' },
      ] },
      { key: 'quality', label: '质量', type: 'select', defaultValue: 'balanced', options: [
        { label: '快速', value: 'fast' },
        { label: '均衡', value: 'balanced' },
        { label: '高质量', value: 'high' },
      ] },
    ],
  },
  resultSchema: {
    outputs: {
      text: { contentType: 'markdown' },
    },
  },
  executor: {
    type: 'ai',
    executorKey: 'ai.text_generation.executor',
    requiredCapabilities: [
      { capability: 'text.generate', task: 'ecommerce_product_analysis', quality: 'balanced', allowFallback: true },
    ],
  },
  behavior: {
    autoRunnable: true,
    supportsRetry: true,
    supportsStreaming: false,
    timeoutMs: 60000,
    failurePolicy: 'block_downstream',
  },
  summary: { mode: 'executor' },
};

export const aiImageAnalysisDefinition: NodeDefinition = {
  type: 'ai.image_analysis',
  title: 'AI 图片分析',
  category: 'ai',
  description: '理解图片内容，输出结构化 Markdown。',
  inputs: [
    { key: 'images', label: '图片', acceptedTypes: ['image', 'image_array'], cardinality: 'array', required: true },
    { key: 'context', label: '上下文', acceptedTypes: ['text', 'markdown'], cardinality: 'single', required: false },
  ],
  outputs: [
    { key: 'analysis', label: '分析结果', dataType: 'markdown', cardinality: 'single' },
  ],
  configSchema: {
    fields: [
      { key: 'task', label: '任务', type: 'select', defaultValue: 'product_image_analysis', options: [
        { label: '商品图分析', value: 'product_image_analysis' },
        { label: '风格提取', value: 'style_extract' },
      ] },
    ],
  },
  resultSchema: {
    outputs: { analysis: { contentType: 'markdown' } },
  },
  executor: {
    type: 'ai',
    executorKey: 'ai.image_analysis.executor',
    requiredCapabilities: [
      { capability: 'image.analyze', task: 'product_image_analysis', quality: 'balanced', allowFallback: true },
    ],
  },
  behavior: {
    autoRunnable: true,
    supportsRetry: true,
    timeoutMs: 60000,
    failurePolicy: 'block_downstream',
  },
};

export const aiImageGenerationDefinition: NodeDefinition = {
  type: 'ai.image_generation',
  title: 'AI 图片生成',
  category: 'ai',
  description: '根据生成上下文和参考图片生成图片。',
  inputs: [
    { key: 'generationContext', label: '生成上下文', acceptedTypes: ['text', 'markdown'], cardinality: 'single', required: true },
    { key: 'referenceImages', label: '参考图片', acceptedTypes: ['image', 'image_array'], cardinality: 'array', required: false },
  ],
  outputs: [
    { key: 'generatedImage', label: '生成图片', dataType: 'image', cardinality: 'single' },
  ],
  configSchema: {
    fields: [
      { key: 'preset', label: '生成预设', type: 'select', options: [
        { label: '电商详情页单屏', value: 'ecommerce_detail_screen_image_v1' },
      ] },
      { key: 'size', label: '尺寸', type: 'select', defaultValue: '750x1000', options: [
        { label: '750 x 1000', value: '750x1000' },
        { label: '1024 x 1024', value: '1024x1024' },
      ] },
      { key: 'quality', label: '质量', type: 'select', defaultValue: 'balanced', options: [
        { label: '快速', value: 'fast' },
        { label: '均衡', value: 'balanced' },
        { label: '高质量', value: 'high' },
      ] },
    ],
  },
  resultSchema: {
    outputs: {
      generatedImage: { contentType: 'image', assetType: 'image' },
    },
  },
  executor: {
    type: 'ai',
    executorKey: 'ai.image_generation.executor',
    requiredCapabilities: [
      { capability: 'image.generate', task: 'ecommerce_detail_screen', quality: 'balanced', allowFallback: true },
    ],
  },
  behavior: {
    autoRunnable: true,
    supportsRetry: true,
    timeoutMs: 120000,
    failurePolicy: 'block_downstream',
  },
  summary: { mode: 'executor' },
};

export const processorContextAssemblerDefinition: NodeDefinition = {
  type: 'processor.context_assembler',
  title: '参数组装',
  category: 'processor',
  description: '将上游 Markdown/文本组装为下游 AI 节点的上下文。',
  inputs: [
    { key: 'primary', label: '主上下文', acceptedTypes: ['text', 'markdown'], cardinality: 'single', required: true },
    { key: 'extras', label: '附加内容', acceptedTypes: ['text', 'markdown'], cardinality: 'array', required: false },
  ],
  outputs: [
    { key: 'context', label: '组装结果', dataType: 'markdown', cardinality: 'single' },
  ],
  configSchema: {
    fields: [
      { key: 'template', label: '组装模板', type: 'textarea', description: '支持 {{primary}} 和 {{extras}} 占位符' },
    ],
  },
  executor: { type: 'code', executorKey: 'processor.context_assembler.executor' },
  behavior: {
    autoRunnable: true,
    supportsCache: true,
    failurePolicy: 'block_downstream',
  },
};

export const processorImageStitchDefinition: NodeDefinition = {
  type: 'processor.image_stitch',
  title: '图片拼接',
  category: 'processor',
  description: '按用户指定顺序将多张图片拼接成长图。',
  inputs: [
    { key: 'images', label: '待拼接图片', acceptedTypes: ['image', 'image_array'], cardinality: 'array', required: true },
  ],
  outputs: [
    { key: 'stitchedImage', label: '拼接长图', dataType: 'long_image', cardinality: 'single' },
  ],
  configSchema: {
    fields: [
      { key: 'orderedInputs.images', label: '图片顺序', type: 'ordered_inputs', required: true },
      { key: 'direction', label: '拼接方向', type: 'select', defaultValue: 'vertical', options: [
        { label: '纵向', value: 'vertical' },
        { label: '横向', value: 'horizontal' },
      ] },
      { key: 'gap', label: '间距', type: 'number', defaultValue: 0 },
    ],
  },
  resultSchema: {
    outputs: { stitchedImage: { contentType: 'long_image', assetType: 'long_image' } },
  },
  executor: { type: 'code', executorKey: 'processor.image_stitch.executor' },
  behavior: {
    autoRunnable: true,
    supportsRetry: true,
    supportsCache: true,
    failurePolicy: 'block_downstream',
  },
};

export const editorTextDefinition: NodeDefinition = {
  type: 'editor.text',
  title: '文本编辑',
  category: 'editor',
  description: '人工确认并编辑上游文本结果，输出用户确认版本。',
  inputs: [
    { key: 'draft', label: '待编辑文本', acceptedTypes: ['text', 'markdown'], cardinality: 'single', required: true },
  ],
  outputs: [
    { key: 'confirmedText', label: '确认文本', dataType: 'markdown', cardinality: 'single' },
  ],
  executor: { type: 'manual', executorKey: 'editor.text.executor' },
  behavior: {
    autoRunnable: false,
    requiresHumanConfirmation: true,
    editableResult: true,
  },
  summary: { mode: 'executor' },
};

export const exportImageDefinition: NodeDefinition = {
  type: 'export.image',
  title: '图片导出',
  category: 'export',
  description: '按指定格式和尺寸导出最终图片资产。',
  inputs: [
    { key: 'image', label: '待导出图片', acceptedTypes: ['image', 'long_image', 'layered_image'], cardinality: 'single', required: true },
  ],
  outputs: [
    { key: 'exportedAsset', label: '导出资产', dataType: 'asset_ref', cardinality: 'single' },
  ],
  configSchema: {
    fields: [
      { key: 'format', label: '格式', type: 'select', defaultValue: 'jpg', options: [
        { label: 'JPG', value: 'jpg' },
        { label: 'PNG', value: 'png' },
        { label: 'WEBP', value: 'webp' },
      ] },
      { key: 'quality', label: '画质', type: 'number', defaultValue: 90 },
    ],
  },
  resultSchema: {
    outputs: { exportedAsset: { contentType: 'asset_ref' } },
  },
  executor: { type: 'export', executorKey: 'export.image.executor' },
  behavior: {
    autoRunnable: true,
    supportsRetry: true,
    failurePolicy: 'block_downstream',
  },
};

/** 第一版 MVP 完整内置节点定义列表。 */
export const builtInNodeDefinitions: NodeDefinition[] = [
  inputTextDefinition,
  inputImageDefinition,
  aiTextGenerationDefinition,
  aiImageAnalysisDefinition,
  aiImageGenerationDefinition,
  processorContextAssemblerDefinition,
  processorImageStitchDefinition,
  editorTextDefinition,
  exportImageDefinition,
];
