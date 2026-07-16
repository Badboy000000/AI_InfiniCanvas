import { strict as assert } from 'node:assert';
import {
  createCapabilityError,
  createCapabilityRouter,
  normalizeCapabilityError,
  type CapabilityCallLog,
  type CapabilityRequest,
  type CapabilityResult,
  type ProviderAdapter,
} from '../packages/capability-core/src/index.js';

const request = (overrides: Partial<CapabilityRequest> = {}): CapabilityRequest => ({
  capability: 'text.generate',
  task: 'ecommerce_product_analysis',
  input: { title: 'Demo product' },
  trace: {
    workflowId: 'workflow-1',
    runId: 'run-1',
    nodeId: 'node-1',
    executorKey: 'product-analysis',
  },
  ...overrides,
});

const success = (adapterKey: string, model: string): CapabilityResult => ({
  status: 'success',
  output: { text: `${adapterKey} result` },
  usage: { inputTokens: 10, outputTokens: 5 },
  providerInfo: {
    provider: adapterKey.split('.')[0],
    model,
    adapterKey,
  },
});

const adapter = (
  key: string,
  handler: (request: CapabilityRequest) => CapabilityResult | Promise<CapabilityResult>,
): ProviderAdapter => ({
  key,
  supports: ['text.generate'],
  call: handler,
});

const routes = [
  {
    capability: 'text.generate' as const,
    task: 'ecommerce_product_analysis',
    primary: 'primary.text',
    fallbacks: ['fallback.text'],
    defaultQuality: 'balanced' as const,
    timeoutMs: 100,
    maxAttempts: 2,
    backoffMs: 10,
  },
  {
    capability: 'text.generate' as const,
    primary: 'default.text',
    defaultQuality: 'fast' as const,
    timeoutMs: 100,
    maxAttempts: 1,
  },
];

{
  const calls: string[] = [];
  const router = createCapabilityRouter({
    routes,
    adapters: [
      adapter('primary.text', (input) => {
        calls.push(`primary:${input.quality}`);
        return success('primary.text', 'primary-model');
      }),
      adapter('default.text', () => {
        calls.push('default');
        return success('default.text', 'default-model');
      }),
    ],
  });

  const result = await router.invoke(request());
  assert.equal(result.status, 'success');
  assert.deepEqual(calls, ['primary:balanced']);
  if (result.status === 'success') {
    assert.equal(result.providerInfo?.model, 'primary-model');
  }
}

{
  const calls: string[] = [];
  const router = createCapabilityRouter({
    routes,
    adapters: [
      adapter('default.text', () => {
        calls.push('default');
        return success('default.text', 'default-model');
      }),
    ],
  });

  const result = await router.invoke(request({ task: 'unconfigured_text_task' }));
  assert.equal(result.status, 'success');
  assert.deepEqual(calls, ['default']);
}

{
  const router = createCapabilityRouter({ routes: [], adapters: [] });
  const result = await router.invoke(request());
  assert.equal(result.status, 'failed');
  if (result.status === 'failed') {
    assert.equal(result.error.category, 'unsupported');
    assert.equal(result.error.retryable, false);
  }
}

{
  let attempts = 0;
  const sleeps: number[] = [];
  let time = 0;
  const router = createCapabilityRouter({
    routes,
    adapters: [
      adapter('primary.text', () => {
        attempts += 1;
        return attempts === 1
          ? {
              status: 'failed',
              error: createCapabilityError({
                code: 'rate_limited',
                message: 'try later',
                category: 'rate_limited',
                retryable: true,
              }),
            }
          : success('primary.text', 'primary-model');
      }),
    ],
    clock: {
      now: () => time++,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    },
  });

  const result = await router.invoke(
    request({ policy: { retry: { maxAttempts: 2, backoffMs: 25 } } }),
  );
  assert.equal(result.status, 'success');
  assert.equal(attempts, 2);
  assert.equal(sleeps.filter((ms) => ms === 25).length, 1);
}

{
  let attempts = 0;
  const router = createCapabilityRouter({
    routes,
    adapters: [
      adapter('primary.text', () => {
        attempts += 1;
        return {
          status: 'failed',
          error: createCapabilityError({
            code: 'invalid_input',
            message: 'invalid prompt',
            category: 'invalid_input',
          }),
        };
      }),
    ],
  });

  const result = await router.invoke(request());
  assert.equal(result.status, 'failed');
  assert.equal(attempts, 1);
}

{
  const calls: string[] = [];
  const logs: CapabilityCallLog[] = [];
  const router = createCapabilityRouter({
    routes,
    adapters: [
      adapter('primary.text', () => {
        calls.push('primary');
        return {
          status: 'failed',
          error: createCapabilityError({
            code: 'provider_unavailable',
            message: 'primary unavailable',
            category: 'provider_error',
            retryable: false,
          }),
        };
      }),
      adapter('fallback.text', () => {
        calls.push('fallback');
        return success('fallback.text', 'fallback-model');
      }),
    ],
    logSink: (log) => logs.push(log),
    createId: () => 'call-1',
  });

  const result = await router.invoke(request());
  assert.equal(result.status, 'success');
  assert.deepEqual(calls, ['primary', 'fallback']);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].id, 'call-1');
  assert.equal(logs[0].fallbackUsed, true);
  assert.equal(logs[0].adapterKey, 'fallback.text');
  assert.equal(logs[0].model, 'fallback-model');
  assert.equal(logs[0].quality, 'balanced');
  assert.deepEqual(
    logs[0].attempts.map((entry) => entry.adapterKey),
    ['primary.text', 'fallback.text'],
  );
}

{
  const calls: string[] = [];
  const router = createCapabilityRouter({
    routes,
    adapters: [
      adapter('primary.text', () => {
        calls.push('primary');
        return {
          status: 'failed',
          error: createCapabilityError({
            code: 'provider_unavailable',
            message: 'primary unavailable',
            category: 'provider_error',
            retryable: false,
          }),
        };
      }),
      adapter('fallback.text', () => {
        calls.push('fallback');
        return success('fallback.text', 'fallback-model');
      }),
    ],
  });

  const result = await router.invoke(request({ policy: { allowFallback: false } }));
  assert.equal(result.status, 'failed');
  assert.deepEqual(calls, ['primary']);
}

{
  const router = createCapabilityRouter({
    routes,
    adapters: [
      adapter('primary.text', () => ({
        status: 'failed',
        error: createCapabilityError({
          code: 'provider_down',
          message: 'primary unavailable',
          category: 'provider_error',
          retryable: false,
        }),
      })),
    ],
  });

  const result = await router.invoke(request());
  assert.equal(result.status, 'failed');
  if (result.status === 'failed') {
    assert.equal(result.error.code, 'provider_down');
  }
}

{
  const router = createCapabilityRouter({
    routes,
    adapters: [
      adapter('primary.text', () => ({
        status: 'failed',
        error: {
          code: 'invalid-provider-category',
          message: 'invalid category',
          category: 'not-a-category' as 'unknown',
          retryable: true,
        },
      })),
    ],
  });

  const result = await router.invoke(request({ policy: { allowFallback: false } }));
  assert.equal(result.status, 'failed');
  if (result.status === 'failed') {
    assert.equal(result.error.category, 'unknown');
  }
}

{
  const router = createCapabilityRouter({
    routes,
    adapters: [
      adapter('primary.text', () => {
        throw new Error('provider exploded');
      }),
    ],
  });

  const result = await router.invoke(request({ policy: { allowFallback: false } }));
  assert.equal(result.status, 'failed');
  if (result.status === 'failed') {
    assert.equal(result.error.category, 'provider_error');
    assert.equal(result.error.code, 'provider_exception');
  }

  const normalized = normalizeCapabilityError({ unexpected: true });
  assert.equal(normalized.category, 'unknown');
}

{
  const router = createCapabilityRouter({
    routes,
    adapters: [adapter('primary.text', () => new Promise(() => undefined))],
  });

  const result = await router.invoke(
    request({ policy: { timeoutMs: 5, retry: { maxAttempts: 1, backoffMs: 0 }, allowFallback: false } }),
  );
  assert.equal(result.status, 'failed');
  if (result.status === 'failed') {
    assert.equal(result.error.category, 'timeout');
    assert.equal(result.error.retryable, true);
  }
}

console.log('capability-core tests passed');
