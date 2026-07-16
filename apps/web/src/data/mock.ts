import type { InspectorSection, LibraryGroup, WorkflowEdge, WorkflowNode } from '../types';

export const libraryGroups: LibraryGroup[] = [
  {
    category: '输入',
    items: [
      { name: '文本输入', type: '文本输入', nodeType: 'input.text', description: '输入或粘贴文本内容，作为工作流原始素材。' },
      { name: '图片输入', type: '图片输入', nodeType: 'input.image', description: '上传单张或多张图片作为视觉素材。' },
    ],
  },
  {
    category: '处理',
    items: [
      { name: '参数组装', type: '参数组装', nodeType: 'processor.context_assembler', description: '把多份上游内容组装成下游可消费的上下文。' },
      { name: '图片拼接', type: '图片拼接', nodeType: 'processor.image_stitch', description: '按指定顺序拼接多张图片。' },
      { name: '文本编辑', type: '文本编辑', nodeType: 'editor.text', description: '人工确认并编辑上游文本结果。' },
    ],
  },
  {
    category: 'AI',
    items: [
      { name: 'AI 文本生成', type: 'AI 文本生成', nodeType: 'ai.text_generation', description: '基于上下文和提示词生成文本。' },
      { name: 'AI 图片分析', type: 'AI 图片分析', nodeType: 'ai.image_analysis', description: '理解图片内容并输出结构化描述。' },
      { name: 'AI 图片生成', type: 'AI 图片生成', nodeType: 'ai.image_generation', description: '根据上下文和参考图生成图片。' },
    ],
  },
  {
    category: '输出',
    items: [
      { name: '图片导出', type: '图片导出', nodeType: 'export.image', description: '按指定格式导出最终图片资产。' },
    ],
  },
];

export const nodes: WorkflowNode[] = [
  {
    id: 'brief',
    title: '海报主题',
    type: '文本输入',
    nodeType: 'input.text',
    category: '输入',
    dataType: 'text',
    x: 80,
    y: 84,
    status: '成功',
    inputSummary: '输入起点',
    outputSummary: '品牌活动主题',
    resultSummary: '春季快闪活动 × 轻盈未来感',
    description: '为整个流程提供主题、受众和传播目标。',
    inputPorts: [],
    metrics: ['主题', '00后', '春季 campaign'],
    configParams: { value: '春季快闪活动 × 轻盈未来感 · 主题：00后 · 目标：品牌焕新' },
  },
  {
    id: 'ref',
    title: '视觉参考',
    type: '图片输入',
    nodeType: 'input.image',
    category: '输入',
    dataType: 'image',
    x: 130,
    y: 310,
    status: '成功',
    inputSummary: '输入起点',
    outputSummary: '3 张参考图',
    resultSummary: '柔和奶油白 / 金属银 / 彩色透明层',
    description: '提供构图、材质和色彩参考。',
    inputPorts: [],
    metrics: ['3 refs', 'Editorial', 'Soft gloss'],
    configParams: { allowMultiple: true, assetIds: ['demo-product-1', 'demo-reference-1'] },
  },
  {
    id: 'style',
    title: '风格提取',
    type: 'AI 图片分析',
    nodeType: 'ai.image_analysis',
    category: 'AI',
    dataType: 'ai',
    x: 410,
    y: 292,
    status: '成功',
    inputSummary: '已接入：参考图',
    outputSummary: '6 个视觉关键词',
    resultSummary: '镜面、雾感、留白、轻雕塑、偏移排版',
    description: '从参考图中提取风格特征和画面语义。',
    inputPorts: [
      { id: 'images', label: '图片', dataType: 'image' },
      { id: 'context', label: '上下文', dataType: 'text' },
    ],
    metrics: ['6 traits', 'Color DNA'],
  },
  {
    id: 'prompt',
    title: '提示词整理',
    type: '参数组装',
    nodeType: 'processor.context_assembler',
    category: '处理',
    dataType: 'text',
    x: 458,
    y: 100,
    status: '运行中',
    inputSummary: '已接入：主题、风格',
    outputSummary: '结构化提示词',
    resultSummary: '主体 / 材质 / 构图 / 光感 已合并',
    description: '把主题、风格与品牌约束重组成可执行输入。',
    inputPorts: [
      { id: 'primary', label: '主上下文', dataType: 'text' },
      { id: 'extras', label: '附加内容', dataType: 'text' },
    ],
    metrics: ['2 inputs', 'Prompt pack'],
    configParams: { template: '# 主题\n{{primary}}\n\n# 附加\n{{extras}}' },
  },
  {
    id: 'image',
    title: '海报生成',
    type: 'AI 图片生成',
    nodeType: 'ai.image_generation',
    category: 'AI',
    dataType: 'image',
    x: 812,
    y: 126,
    status: '待执行',
    inputSummary: '等待：提示词',
    outputSummary: '主视觉海报',
    resultSummary: '尚未执行',
    description: '生成可用于投放和提案展示的主图。',
    inputPorts: [
      { id: 'generationContext', label: '生成上下文', dataType: 'text' },
      { id: 'referenceImages', label: '参考图片', dataType: 'image' },
    ],
    metrics: ['1 image', 'Hero visual'],
    configParams: { preset: 'ecommerce_detail_screen_image_v1', size: '750x1000', quality: 'balanced' },
  },
  {
    id: 'archive',
    title: '结果归档',
    type: '图片导出',
    nodeType: 'export.image',
    category: '输出',
    dataType: 'file',
    x: 1120,
    y: 148,
    status: '未配置',
    inputSummary: '等待：海报结果',
    outputSummary: '资产归档',
    resultSummary: '目标目录未设置',
    description: '将结果沉淀到资产与提案目录。',
    inputPorts: [
      { id: 'image', label: '待导出图片', dataType: 'image' },
    ],
    metrics: ['Asset', 'Deliverable'],
    configParams: { format: 'jpg', quality: 92 },
  },
];

export const edges: WorkflowEdge[] = [
  { id: 'e1', from: 'brief', to: 'prompt', label: '主题内容', dataType: 'text', fromPort: 'output', toPort: 'primary' },
  { id: 'e2', from: 'ref', to: 'style', label: '参考图', dataType: 'image', fromPort: 'output', toPort: 'images' },
  { id: 'e4', from: 'prompt', to: 'image', label: '执行提示词', dataType: 'text', fromPort: 'output', toPort: 'generationContext' },
  { id: 'e5', from: 'image', to: 'archive', label: '主视觉结果', dataType: 'image', fromPort: 'output', toPort: 'image' },
];

export const inspectorSections: InspectorSection[] = [
  {
    title: '输入角色',
    items: ['主题内容：来自「海报主题」', '风格参考：来自「风格提取」', '品牌约束：暂未接入'],
  },
  {
    title: '节点配置',
    items: ['输出风格：策展感轻未来', '构图密度：中低', '生成数量：3 版方向'],
  },
  {
    title: '输出说明',
    items: ['输出类型：结构化提示词', '适用下游：图片生成 / 视频脚本 / 社媒文案'],
  },
  {
    title: '结果预览',
    items: ['主体强调透明材质与留白', '建议采用错位标题与大面积留白', '主色应控制在奶油白、银灰、珊瑚点缀'],
  },
];

export const consoleEvents = [
  { time: '09:42', state: 'ready', text: '画布已载入 6 个节点，工作流结构合法。' },
  { time: '09:43', state: 'running', text: '提示词整理已开始合并主题与风格输入。' },
  { time: '09:43', state: 'waiting', text: '海报生成正在等待上游结构化提示词。' },
];
