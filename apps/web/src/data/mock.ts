import type { InspectorSection, LibraryGroup, WorkflowEdge, WorkflowNode } from '../types';

export const libraryGroups: LibraryGroup[] = [
  {
    category: '输入',
    items: [
      { name: '文本 Brief', type: '文本输入', description: '输入主题、需求和场景目标。' },
      { name: '参考图', type: '图片输入', description: '放入风格参考与视觉锚点。' },
      { name: '品牌资料', type: '文件输入', description: '承接品牌语气、视觉规范和素材约束。' },
    ],
  },
  {
    category: '处理',
    items: [
      { name: '风格提取', type: '图像理解', description: '提取色彩、构图和气质关键词。' },
      { name: '提示词整理', type: '结构化整理', description: '合并主题、风格与约束，生成可执行输入。' },
      { name: '文案拆解', type: '文本处理', description: '压缩内容结构并生成主副标题。' },
    ],
  },
  {
    category: '生成',
    items: [
      { name: '海报生成', type: '图片生成', description: '根据结构化提示生成高视觉完成度主图。' },
      { name: '视频脚本', type: '脚本生成', description: '衍生短视频口播与镜头脚本。' },
      { name: '社媒文案', type: '文本生成', description: '针对不同渠道生成投放文案。' },
    ],
  },
  {
    category: '输出',
    items: [
      { name: '结果归档', type: '保存输出', description: '将结果沉淀到项目资产区。' },
      { name: '导出提案', type: '导出输出', description: '导出当前工作流的提案快照。' },
      { name: '分发发布', type: '发布输出', description: '将结果分发至目标渠道。' },
    ],
  },
];

export const nodes: WorkflowNode[] = [
  {
    id: 'brief',
    title: '海报主题',
    type: '文本输入',
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
  },
  {
    id: 'ref',
    title: '视觉参考',
    type: '图片输入',
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
  },
  {
    id: 'style',
    title: '风格提取',
    type: '图像理解',
    category: '处理',
    dataType: 'ai',
    x: 410,
    y: 292,
    status: '成功',
    inputSummary: '已接入：参考图',
    outputSummary: '6 个视觉关键词',
    resultSummary: '镜面、雾感、留白、轻雕塑、偏移排版',
    description: '从参考图中提取风格特征和画面语义。',
    inputPorts: [
      { id: 'in-0', label: '参考图', dataType: 'image' },
    ],
    metrics: ['6 traits', 'Color DNA'],
  },
  {
    id: 'prompt',
    title: '提示词整理',
    type: '结构化整理',
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
      { id: 'in-0', label: '主题内容', dataType: 'text' },
      { id: 'in-1', label: '风格特征', dataType: 'ai' },
    ],
    metrics: ['2 inputs', 'Prompt pack'],
  },
  {
    id: 'image',
    title: '海报生成',
    type: '图片生成',
    category: '生成',
    dataType: 'image',
    x: 812,
    y: 126,
    status: '待执行',
    inputSummary: '等待：提示词',
    outputSummary: '主视觉海报',
    resultSummary: '尚未执行',
    description: '生成可用于投放和提案展示的主图。',
    inputPorts: [
      { id: 'in-0', label: '提示词', dataType: 'text' },
      { id: 'in-1', label: '参考图', dataType: 'image' },
    ],
    metrics: ['1 image', 'Hero visual'],
  },
  {
    id: 'archive',
    title: '结果归档',
    type: '保存输出',
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
      { id: 'in-0', label: '结果', dataType: 'any' },
    ],
    metrics: ['Asset', 'Deliverable'],
  },
];

export const edges: WorkflowEdge[] = [
  { id: 'e1', from: 'brief', to: 'prompt', label: '主题内容', dataType: 'text', fromPort: 'output', toPort: 'in-0' },
  { id: 'e2', from: 'ref', to: 'style', label: '参考图', dataType: 'image', fromPort: 'output', toPort: 'in-0' },
  { id: 'e3', from: 'style', to: 'prompt', label: '风格特征', dataType: 'ai', fromPort: 'output', toPort: 'in-1' },
  { id: 'e4', from: 'prompt', to: 'image', label: '执行提示词', dataType: 'text', fromPort: 'output', toPort: 'in-0' },
  { id: 'e5', from: 'image', to: 'archive', label: '主视觉结果', dataType: 'image', fromPort: 'output', toPort: 'in-0' },
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
