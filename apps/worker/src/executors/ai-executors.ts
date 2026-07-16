import type {
  CapabilityRequirement,
  NodeExecutor,
  NodeExecutionResult,
  NodeResultContentType,
} from '@ai-canvas/node-protocol';
import type { CapabilityRouter } from '@ai-canvas/capability-core';

type AiExecutorSpec = {
  executorKey: string;
  outputKey: string;
  outputContentType: NodeResultContentType;
  inputBuilder: (context: Parameters<NodeExecutor['run']>[0]) => unknown;
  capabilityFallback: CapabilityRequirement;
  outputTransformer?: (raw: unknown) => {
    content?: unknown;
    assetIds?: string[];
    summary?: string;
  };
};

function createAiExecutor(spec: AiExecutorSpec, router: CapabilityRouter): NodeExecutor {
  return {
    executorKey: spec.executorKey,
    async run(context): Promise<NodeExecutionResult> {
      const requirement = context.definition.executor.requiredCapabilities?.[0] ?? spec.capabilityFallback;
      const result = await router.invoke({
        capability: requirement.capability,
        task: requirement.task,
        input: spec.inputBuilder(context),
        quality: requirement.quality,
        preset: typeof context.config.params?.preset === 'string' ? String(context.config.params.preset) : undefined,
        trace: {
          workflowId: context.workflowId,
          runId: context.runId,
          nodeId: context.node.id,
          executorKey: spec.executorKey,
        },
        policy: {
          allowFallback: requirement.allowFallback,
        },
      });

      if (result.status === 'failed') {
        return {
          status: 'failed',
          error: {
            code: result.error.code,
            message: result.error.message,
            detail: result.error.detail,
            retryable: result.error.retryable,
          },
        };
      }

      const transformed = spec.outputTransformer?.(result.output) ?? {
        content: result.output,
        summary: typeof result.output === 'string' ? result.output.slice(0, 60) : `${requirement.capability} 结果`,
      };

      return {
        status: 'success',
        outputs: {
          [spec.outputKey]: {
            contentType: spec.outputContentType,
            content: transformed.content,
            assetIds: transformed.assetIds,
            summary: transformed.summary,
          },
        },
        metadata: result.providerInfo
          ? {
              modelInfo: {
                provider: result.providerInfo.provider,
                model: result.providerInfo.model ?? 'unknown',
                params: result.providerInfo.params,
              },
            }
          : undefined,
      };
    },
  };
}

export function createAiExecutors(router: CapabilityRouter): NodeExecutor[] {
  return [
    createAiExecutor(
      {
        executorKey: 'ai.text_generation.executor',
        outputKey: 'text',
        outputContentType: 'markdown',
        inputBuilder: (context) => ({
          context: context.inputs.context?.value,
          references: context.inputs.references?.value,
          task: context.config.params?.task,
        }),
        capabilityFallback: {
          capability: 'text.generate',
          task: 'ecommerce_product_analysis',
          quality: 'balanced',
          allowFallback: true,
        },
      },
      router,
    ),
    createAiExecutor(
      {
        executorKey: 'ai.image_analysis.executor',
        outputKey: 'analysis',
        outputContentType: 'markdown',
        inputBuilder: (context) => ({
          images: context.inputs.images?.value,
          context: context.inputs.context?.value,
          task: context.config.params?.task,
        }),
        capabilityFallback: {
          capability: 'image.analyze',
          task: 'product_image_analysis',
          quality: 'balanced',
          allowFallback: true,
        },
      },
      router,
    ),
    createAiExecutor(
      {
        executorKey: 'ai.image_generation.executor',
        outputKey: 'generatedImage',
        outputContentType: 'image',
        inputBuilder: (context) => ({
          generationContext: context.inputs.generationContext?.value,
          referenceImages: context.inputs.referenceImages?.value,
          preset: context.config.params?.preset,
          size: context.config.params?.size,
          quality: context.config.params?.quality,
        }),
        capabilityFallback: {
          capability: 'image.generate',
          task: 'ecommerce_detail_screen',
          quality: 'balanced',
          allowFallback: true,
        },
        outputTransformer: (raw) => {
          if (raw && typeof raw === 'object' && 'assetId' in raw) {
            const assetId = String((raw as { assetId: unknown }).assetId);
            return { content: raw, assetIds: [assetId], summary: `图片：${assetId}` };
          }
          return { content: raw, summary: '图片生成结果' };
        },
      },
      router,
    ),
  ];
}
