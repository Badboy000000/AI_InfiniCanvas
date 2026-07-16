import type { CapabilityType } from '@ai-canvas/node-protocol';

export type { CapabilityRequirement, CapabilityType } from '@ai-canvas/node-protocol';
export { capabilityTypeSchema } from '@ai-canvas/node-protocol';

export type CapabilityQuality = 'fast' | 'balanced' | 'high';

export type CapabilityErrorCategory =
  | 'provider_error'
  | 'timeout'
  | 'rate_limited'
  | 'invalid_input'
  | 'safety_blocked'
  | 'unsupported'
  | 'unknown';

export type CapabilityError = {
  code: string;
  message: string;
  retryable: boolean;
  category: CapabilityErrorCategory;
  detail?: unknown;
};

export type CapabilityTrace = {
  workflowId: string;
  runId: string;
  nodeId: string;
  executorKey: string;
};

export type CapabilityRequest = {
  capability: CapabilityType;
  task: string;
  input: unknown;
  quality?: CapabilityQuality;
  constraints?: Record<string, unknown>;
  preset?: string;
  promptVersion?: string;
  trace: CapabilityTrace;
  policy?: {
    timeoutMs?: number;
    retry?: {
      maxAttempts: number;
      backoffMs: number;
    };
    allowFallback?: boolean;
  };
};

export type CapabilityUsage = {
  inputTokens?: number;
  outputTokens?: number;
  imageCount?: number;
  durationMs?: number;
  costEstimate?: number;
};

export type CapabilityProviderInfo = {
  provider: string;
  model?: string;
  endpoint?: string;
  adapterKey: string;
  params?: Record<string, unknown>;
};

export type CapabilityRawReference = {
  requestLogId?: string;
  responseLogId?: string;
};

export type CapabilityResult =
  | {
      status: 'success';
      output: unknown;
      usage?: CapabilityUsage;
      providerInfo?: CapabilityProviderInfo;
      rawRef?: CapabilityRawReference;
    }
  | {
      status: 'failed';
      error: CapabilityError;
      output?: unknown;
      usage?: CapabilityUsage;
      providerInfo?: CapabilityProviderInfo;
      rawRef?: CapabilityRawReference;
    };

export type ProviderAdapter = {
  key: string;
  supports: CapabilityType[];
  call(request: CapabilityRequest): Promise<CapabilityResult>;
};

export type CapabilityRoute = {
  capability: CapabilityType;
  task?: string;
  primary: string;
  fallbacks?: string[];
  defaultQuality: CapabilityQuality;
  timeoutMs: number;
  maxAttempts: number;
  backoffMs?: number;
};

export type CapabilityAttemptLog = {
  adapterKey: string;
  status: CapabilityResult['status'];
  attempt: number;
  latencyMs: number;
  errorCode?: string;
  errorCategory?: CapabilityErrorCategory;
};

export type CapabilityCallLog = {
  id: string;
  workflowId: string;
  runId: string;
  nodeId: string;
  executorKey: string;
  capability: CapabilityType;
  task: string;
  provider: string;
  model?: string;
  adapterKey: string;
  status: CapabilityResult['status'];
  latencyMs: number;
  quality?: CapabilityQuality;
  promptVersion?: string;
  preset?: string;
  usage?: CapabilityUsage;
  errorCode?: string;
  errorCategory?: CapabilityErrorCategory;
  retryCount: number;
  fallbackUsed: boolean;
  attempts: CapabilityAttemptLog[];
  createdAt: string;
};

export type CapabilityCallLogSink = (log: CapabilityCallLog) => void | Promise<void>;

export type CapabilityClock = {
  now(): number;
  sleep(ms: number): Promise<void>;
};

export type CapabilityRouter = {
  invoke(request: CapabilityRequest): Promise<CapabilityResult>;
};

export type CreateCapabilityRouterOptions = {
  routes: CapabilityRoute[];
  adapters: ProviderAdapter[];
  logSink?: CapabilityCallLogSink;
  clock?: CapabilityClock;
  createId?: () => string;
};
