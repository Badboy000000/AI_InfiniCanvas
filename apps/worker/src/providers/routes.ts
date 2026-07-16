import type { CapabilityRoute } from '@ai-canvas/capability-core';

/**
 * 第一版 mock 路由配置：所有能力都映射到 mock.local provider。
 */
export const mockRoutes: CapabilityRoute[] = [
  { capability: 'text.generate', primary: 'mock.local', defaultQuality: 'balanced', timeoutMs: 60000, maxAttempts: 2 },
  { capability: 'image.analyze', primary: 'mock.local', defaultQuality: 'balanced', timeoutMs: 60000, maxAttempts: 2 },
  { capability: 'image.generate', primary: 'mock.local', defaultQuality: 'balanced', timeoutMs: 120000, maxAttempts: 2 },
  { capability: 'image.edit', primary: 'mock.local', defaultQuality: 'balanced', timeoutMs: 120000, maxAttempts: 2 },
  { capability: 'layer.extract', primary: 'mock.local', defaultQuality: 'balanced', timeoutMs: 120000, maxAttempts: 1 },
  { capability: 'asset.transform', primary: 'mock.local', defaultQuality: 'fast', timeoutMs: 30000, maxAttempts: 2 },
];
