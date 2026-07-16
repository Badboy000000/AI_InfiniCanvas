import type { NodeExecutor, NodeExecutionResult } from '@ai-canvas/node-protocol';

export const contextAssemblerExecutor: NodeExecutor = {
  executorKey: 'processor.context_assembler.executor',
  async run(context): Promise<NodeExecutionResult> {
    const template = String(context.config.params?.template ?? '{{primary}}\n\n{{extras}}');
    const primary = String(context.inputs.primary?.value ?? '');
    const extrasRaw = context.inputs.extras?.value;
    const extras = Array.isArray(extrasRaw) ? extrasRaw.map(String).join('\n\n') : String(extrasRaw ?? '');
    const output = template.replace('{{primary}}', primary).replace('{{extras}}', extras);
    return {
      status: 'success',
      outputs: {
        context: {
          contentType: 'markdown',
          content: output,
          summary: output.slice(0, 60),
        },
      },
    };
  },
};

export const imageStitchExecutor: NodeExecutor = {
  executorKey: 'processor.image_stitch.executor',
  async run(context): Promise<NodeExecutionResult> {
    const raw = context.inputs.images?.value;
    const flatten = (value: unknown): string[] => {
      if (Array.isArray(value)) return value.flatMap(flatten);
      if (typeof value === 'string') return [value];
      return [];
    };
    const assetIds = flatten(raw);
    const direction = String(context.config.params?.direction ?? 'vertical');
    const stitchedId = `stitched:${direction}:${assetIds.join(',')}`;
    return {
      status: 'success',
      outputs: {
        stitchedImage: {
          contentType: 'long_image',
          content: { direction, assetIds },
          assetIds: [stitchedId],
          summary: `拼接 ${assetIds.length} 张图（${direction}）`,
        },
      },
    };
  },
};

export const exportImageExecutor: NodeExecutor = {
  executorKey: 'export.image.executor',
  async run(context): Promise<NodeExecutionResult> {
    const format = String(context.config.params?.format ?? 'jpg');
    const quality = Number(context.config.params?.quality ?? 90);
    const upstream = context.inputs.image?.value;
    const upstreamAsset = (context.inputs.image?.sourceRefs[0] as unknown as { versionId?: string })?.versionId ?? 'unknown';
    const exportedId = `export:${format}:${quality}:${upstreamAsset}`;
    return {
      status: 'success',
      outputs: {
        exportedAsset: {
          contentType: 'asset_ref',
          content: { format, quality, upstream },
          assetIds: [exportedId],
          summary: `导出 ${format} @${quality}`,
        },
      },
    };
  },
};
