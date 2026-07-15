import type { RunError, RunErrorCategory } from './types.js';

export type CreateRunErrorInput = {
  code: string;
  message: string;
  detail?: unknown;
  category?: RunErrorCategory;
  retryable?: boolean;
};

export const createRunError = ({
  code,
  message,
  detail,
  category = 'unknown',
  retryable = false,
}: CreateRunErrorInput): RunError => ({
  code,
  message,
  detail,
  category,
  retryable,
});
