import type { CapabilityErrorCategory } from '@ai-canvas/capability-core';

/**
 * CapabilityError.category → 用户可读文案。
 * 前端严禁泄露 provider 名字或 SDK 内部错误细节；出错时只展示分类文案。
 */
export const capabilityErrorMessages: Record<CapabilityErrorCategory, string> = {
  provider_error: 'AI 能力服务暂时不可用，请稍后重试。',
  timeout: 'AI 能力调用超时，请稍后重试或简化输入。',
  rate_limited: 'AI 能力调用被限流，请稍后重试。',
  invalid_input: '当前输入不满足 AI 能力的要求，请检查配置。',
  safety_blocked: '当前内容被安全策略拒绝，请调整输入。',
  unsupported: '当前工作流用到了尚不支持的能力，请更换节点或稍后再试。',
  unknown: 'AI 能力调用失败，请稍后重试。',
};

export function describeCapabilityError(category: CapabilityErrorCategory | undefined): string {
  if (!category) return capabilityErrorMessages.unknown;
  return capabilityErrorMessages[category] ?? capabilityErrorMessages.unknown;
}
