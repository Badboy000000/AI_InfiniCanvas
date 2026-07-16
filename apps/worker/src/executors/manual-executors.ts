import type { NodeExecutor, NodeExecutionResult } from '@ai-canvas/node-protocol';

/**
 * Manual executor 通用实现：直接把节点 config.params.value 或 config.params 当作输出。
 * 覆盖 input.text / editor.text 等由用户手工输入的节点。
 */
function manualPassThroughExecutor(
  executorKey: string,
  outputKey: string,
  contentType: 'text' | 'markdown' | 'image_array',
  configValueKey: string,
): NodeExecutor {
  return {
    executorKey,
    async run(context): Promise<NodeExecutionResult> {
      const raw = (context.config.params?.[configValueKey] as unknown) ?? '';
      return {
        status: 'success',
        outputs: {
          [outputKey]: {
            contentType,
            content: raw,
            summary: typeof raw === 'string' ? raw.slice(0, 40) : `${outputKey} manual output`,
          },
        },
      };
    },
  };
}

export const inputTextExecutor: NodeExecutor = manualPassThroughExecutor(
  'input.text.executor',
  'text',
  'markdown',
  'value',
);

export const editorTextExecutor: NodeExecutor = {
  executorKey: 'editor.text.executor',
  async run(context) {
    // 编辑节点默认沿用上游 draft 作为确认结果；用户在前端编辑后前端会覆盖 config.params.confirmedText
    const confirmed = context.config.params?.confirmedText;
    const draft = context.inputs.draft?.value;
    const value = typeof confirmed === 'string' && confirmed.length > 0 ? confirmed : (draft ?? '');
    return {
      status: 'success',
      outputs: {
        confirmedText: {
          contentType: 'markdown',
          content: value,
          summary: typeof value === 'string' ? value.slice(0, 40) : 'confirmed text',
        },
      },
    };
  },
};

export const inputImageExecutor: NodeExecutor = {
  executorKey: 'input.image.executor',
  async run(context) {
    const rawAssets = context.config.params?.assetIds;
    const assetIds = Array.isArray(rawAssets) ? rawAssets.map((id) => String(id)) : [];
    return {
      status: 'success',
      outputs: {
        images: {
          contentType: 'image_array',
          content: assetIds,
          assetIds,
          summary: `${assetIds.length} 张图片`,
        },
      },
    };
  },
};
