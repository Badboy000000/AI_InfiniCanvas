export type NodeCategory = '输入' | '处理' | '生成' | '输出' | 'AI';
export type DataType = 'text' | 'image' | 'video' | 'file' | 'ai';
export type DataTypeOrAny = DataType | 'any';

export type InputPortDef = {
  id: string;
  label: string;
  dataType: DataTypeOrAny;
};

export type WorkflowNode = {
  id: string;
  title: string;
  type: string;
  /**
   * 正式节点协议 type（如 'input.text' / 'ai.image_generation'）。
   * 若为空，表示当前节点尚未与正式协议对齐，只用于原型渲染。
   * 阶段 9 及后续开发新增节点必须填写。
   */
  nodeType?: string;
  category: NodeCategory;
  dataType: DataType;
  x: number;
  y: number;
  width?: number;
  status: '未配置' | '待执行' | '运行中' | '成功' | '失败';
  inputSummary: string;
  outputSummary: string;
  resultSummary: string;
  description: string;
  inputPorts?: InputPortDef[];
  metrics?: string[];
  /** 节点 config.params，用于串到 workflow-core / worker executor。 */
  configParams?: Record<string, unknown>;
};

export type WorkflowEdge = {
  id: string;
  from: string;
  to: string;
  label: string;
  dataType: DataType;
  fromPort: 'output';
  toPort: string;
};

export type LibraryGroup = {
  category: NodeCategory;
  items: Array<{
    name: string;
    type: string;
    /** 对应 @ai-canvas/node-definitions 的正式协议 type。 */
    nodeType?: string;
    description: string;
  }>;
};

export type InspectorSection = {
  title: string;
  items: string[];
};
