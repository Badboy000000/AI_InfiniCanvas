import type {
  CapabilityRequest,
  CapabilityResult,
  ProviderAdapter,
} from '@ai-canvas/capability-core';

/**
 * 第一版 mock provider adapter：不接入真实模型 SDK。
 * 覆盖第一版能力路由第一版策略中所有能力类型。
 *
 * 输出为可预测、可断言的字符串或对象结构，用于开发期端到端联调。
 * 真实 provider 接入属于阶段 10/11 或后续任务。
 */
export const mockProviderAdapter: ProviderAdapter = {
  key: 'mock.local',
  supports: ['text.generate', 'image.analyze', 'image.generate', 'image.edit', 'layer.extract', 'asset.transform'],
  async call(request: CapabilityRequest): Promise<CapabilityResult> {
    const output = buildMockOutput(request);
    return {
      status: 'success',
      output,
      usage: {
        inputTokens: 32,
        outputTokens: 64,
        durationMs: 10,
      },
      providerInfo: {
        provider: 'mock',
        model: `mock-${request.capability}`,
        adapterKey: 'mock.local',
      },
    };
  },
};

function buildMockOutput(request: CapabilityRequest): unknown {
  const previewInput = typeof request.input === 'string' ? request.input : JSON.stringify(request.input ?? '');
  const preview = previewInput.slice(0, 40);
  switch (request.capability) {
    case 'text.generate':
      return `[mock:${request.task}] ${preview}`;
    case 'image.analyze':
      return `[mock:image.analyze] 描述：${preview || '（无输入）'}`;
    case 'image.generate':
      return { assetId: `mock-image-${request.task}-${Date.now()}`, meta: { preset: request.preset ?? null } };
    case 'image.edit':
      return { assetId: `mock-image-edit-${request.task}-${Date.now()}` };
    case 'layer.extract':
      return {
        baseImageAssetId: `mock-base-${request.task}`,
        textLayers: [],
      };
    case 'asset.transform':
      return { assetId: `mock-asset-${request.task}` };
    default:
      return preview;
  }
}
