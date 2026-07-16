import type { CapabilityError, CapabilityErrorCategory } from './types.js';

export type CreateCapabilityErrorInput = {
  code: string;
  message: string;
  category?: CapabilityErrorCategory;
  retryable?: boolean;
  detail?: unknown;
};

export const createCapabilityError = ({
  code,
  message,
  category = 'unknown',
  retryable = false,
  detail,
}: CreateCapabilityErrorInput): CapabilityError => ({
  code,
  message,
  category,
  retryable,
  detail,
});

export function normalizeCapabilityError(error: unknown): CapabilityError {
  if (isCapabilityError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return createCapabilityError({
      code: 'provider_exception',
      message: error.message,
      category: 'provider_error',
      retryable: true,
      detail: error,
    });
  }

  return createCapabilityError({
    code: 'unknown_provider_error',
    message: 'Provider call failed with an unknown error',
    category: 'unknown',
    detail: error,
  });
}

export function isRetryableCapabilityError(error: CapabilityError): boolean {
  return error.retryable && ['provider_error', 'timeout', 'rate_limited'].includes(error.category);
}

function isCapabilityError(value: unknown): value is CapabilityError {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<CapabilityError>;
  return (
    typeof candidate.code === 'string' &&
    typeof candidate.message === 'string' &&
    typeof candidate.retryable === 'boolean' &&
    isCapabilityErrorCategory(candidate.category)
  );
}

function isCapabilityErrorCategory(value: unknown): value is CapabilityErrorCategory {
  return (
    typeof value === 'string' &&
    ['provider_error', 'timeout', 'rate_limited', 'invalid_input', 'safety_blocked', 'unsupported', 'unknown'].includes(
      value,
    )
  );
}
