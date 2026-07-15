import { z } from 'zod';

export const dataTypeSchema = z.enum([
  'text',
  'markdown',
  'json',
  'image',
  'image_array',
  'file',
  'asset_ref',
  'layered_image',
  'long_image',
]);

export type DataType = z.infer<typeof dataTypeSchema>;

export const nodeCategorySchema = z.enum(['input', 'ai', 'processor', 'editor', 'export']);
export type NodeCategory = z.infer<typeof nodeCategorySchema>;

export const executorTypeSchema = z.enum(['manual', 'ai', 'code', 'asset', 'export']);
export type ExecutorType = z.infer<typeof executorTypeSchema>;

export const capabilityTypeSchema = z.enum([
  'text.generate',
  'image.analyze',
  'image.generate',
  'image.edit',
  'layer.extract',
  'asset.transform',
]);

export type CapabilityType = z.infer<typeof capabilityTypeSchema>;

export const inputPortSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  acceptedTypes: z.array(dataTypeSchema).min(1),
  cardinality: z.enum(['single', 'array']),
  required: z.boolean(),
});

export type InputPort = z.infer<typeof inputPortSchema>;

export const outputPortSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  dataType: dataTypeSchema,
  cardinality: z.enum(['single', 'array']),
});

export type OutputPort = z.infer<typeof outputPortSchema>;

export const configFieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['text', 'textarea', 'number', 'select', 'boolean', 'asset_picker', 'ordered_inputs']),
  required: z.boolean().optional(),
  defaultValue: z.unknown().optional(),
  options: z
    .array(
      z.object({
        label: z.string(),
        value: z.union([z.string(), z.number(), z.boolean()]),
      }),
    )
    .optional(),
  description: z.string().optional(),
});

export type ConfigField = z.infer<typeof configFieldSchema>;

export const configSchemaSchema = z.object({
  fields: z.array(configFieldSchema),
});

export type ConfigSchema = z.infer<typeof configSchemaSchema>;

export const nodeResultContentTypeSchema = z.enum([
  'text',
  'markdown',
  'json',
  'image',
  'image_array',
  'layered_image',
  'long_image',
  'file',
  'asset_ref',
]);

export type NodeResultContentType = z.infer<typeof nodeResultContentTypeSchema>;

export const assetTypeSchema = z.enum(['image', 'file', 'video', 'long_image']);
export type AssetType = z.infer<typeof assetTypeSchema>;

export const resultSchemaSchema = z.object({
  outputs: z.record(
    z.object({
      contentType: nodeResultContentTypeSchema,
      assetType: assetTypeSchema.optional(),
      schema: z.unknown().optional(),
    }),
  ),
});

export type ResultSchema = z.infer<typeof resultSchemaSchema>;

export const nodeUiSchemaSchema = z.object({
  icon: z.string().optional(),
  colorToken: z.string().optional(),
  cardFields: z.array(z.enum(['title', 'category', 'status', 'inputs', 'outputs', 'summary'])).optional(),
  detailLayout: z.array(z.enum(['basic', 'inputs', 'config', 'outputs', 'result'])).optional(),
});

export type NodeUiSchema = z.infer<typeof nodeUiSchemaSchema>;

export const capabilityRequirementSchema = z.object({
  capability: capabilityTypeSchema,
  task: z.string().min(1),
  quality: z.enum(['fast', 'balanced', 'high']).optional(),
  allowFallback: z.boolean().optional(),
});

export type CapabilityRequirement = z.infer<typeof capabilityRequirementSchema>;

export const executorSpecSchema = z.object({
  type: executorTypeSchema,
  executorKey: z.string().optional(),
  requiredCapabilities: z.array(capabilityRequirementSchema).optional(),
});

export type ExecutorSpec = z.infer<typeof executorSpecSchema>;

export const nodeBehaviorSchema = z.object({
  autoRunnable: z.boolean().optional(),
  requiresHumanConfirmation: z.boolean().optional(),
  editableResult: z.boolean().optional(),
  supportsRetry: z.boolean().optional(),
  supportsCache: z.boolean().optional(),
  supportsStreaming: z.boolean().optional(),
  timeoutMs: z.number().int().positive().optional(),
  failurePolicy: z.enum(['block_downstream', 'skip_downstream', 'continue_with_partial']).optional(),
});

export type NodeBehavior = z.infer<typeof nodeBehaviorSchema>;

export const summarySpecSchema = z.object({
  mode: z.enum(['template', 'executor']),
  template: z.string().optional(),
});

export type SummarySpec = z.infer<typeof summarySpecSchema>;

export const nodeErrorDefinitionSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  retryable: z.boolean(),
  category: z.enum(['validation', 'input_missing', 'capability_error', 'asset_error', 'timeout', 'user_required', 'unknown']),
});

export type NodeErrorDefinition = z.infer<typeof nodeErrorDefinitionSchema>;

export const nodeDefinitionSchema = z.object({
  type: z.string().min(1),
  title: z.string().min(1),
  category: nodeCategorySchema,
  description: z.string().optional(),
  inputs: z.array(inputPortSchema),
  outputs: z.array(outputPortSchema),
  configSchema: configSchemaSchema.optional(),
  resultSchema: resultSchemaSchema.optional(),
  uiSchema: nodeUiSchemaSchema.optional(),
  executor: executorSpecSchema,
  behavior: nodeBehaviorSchema.optional(),
  summary: summarySpecSchema.optional(),
  errors: z.array(nodeErrorDefinitionSchema).optional(),
});

export type NodeDefinition = z.infer<typeof nodeDefinitionSchema>;

export type NodeConfig = {
  params: Record<string, unknown>;
  orderedInputs?: Record<
    string,
    Array<{
      sourceNodeId: string;
      sourceOutputKey: string;
    }>
  >;
};

export type Node = {
  id: string;
  type: string;
  title: string;
  position: {
    x: number;
    y: number;
  };
  size?: {
    width: number;
    height: number;
  };
  config: NodeConfig;
};

export type ResolvedInputValue = {
  inputKey: string;
  value: unknown;
  sourceRefs: Array<{
    sourceNodeId: string;
    sourceOutputKey: string;
    versionId: string;
  }>;
};

export type NodeRuntimeServices = {
  assets: unknown;
  capabilities: unknown;
  logger: unknown;
};

export type NodeRunContext = {
  workflowId: string;
  runId: string;
  node: Node;
  definition: NodeDefinition;
  inputs: Record<string, ResolvedInputValue>;
  config: NodeConfig;
  services: NodeRuntimeServices;
};

export type NodeOutputPayload = {
  contentType: NodeResultContentType;
  content?: unknown;
  assetIds?: string[];
  summary?: string;
};

export type NodeExecutionError = {
  code: string;
  message: string;
  detail?: unknown;
  retryable?: boolean;
};

export type NodeExecutionResult = {
  status: 'success' | 'failed' | 'requires_user';
  outputs?: Record<string, NodeOutputPayload>;
  summary?: string;
  error?: NodeExecutionError;
  partialResult?: unknown;
  metadata?: {
    modelInfo?: {
      provider: string;
      model: string;
      params?: Record<string, unknown>;
    };
    promptVersion?: string;
  };
};

export type NodeExecutor = {
  executorKey: string;
  run(context: NodeRunContext): Promise<NodeExecutionResult>;
};
