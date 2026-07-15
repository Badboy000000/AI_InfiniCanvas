export type NodeCategory = '输入' | '处理' | '生成' | '输出';
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
    description: string;
  }>;
};

export type InspectorSection = {
  title: string;
  items: string[];
};
