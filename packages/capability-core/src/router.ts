import { createCapabilityError, isRetryableCapabilityError, normalizeCapabilityError } from './errors.js';
import type {
  CapabilityAttemptLog,
  CapabilityCallLog,
  CapabilityClock,
  CapabilityError,
  CapabilityRequest,
  CapabilityResult,
  CapabilityRoute,
  CreateCapabilityRouterOptions,
  ProviderAdapter,
} from './types.js';

const defaultClock: CapabilityClock = {
  now: () => Date.now(),
  sleep: (ms) => (ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve()),
};

export function createCapabilityRouter({
  routes,
  adapters,
  logSink,
  clock = defaultClock,
  createId = createDefaultId,
}: CreateCapabilityRouterOptions) {
  const adapterMap = new Map(adapters.map((adapter) => [adapter.key, adapter]));

  return {
    async invoke(request: CapabilityRequest): Promise<CapabilityResult> {
      const startedAt = clock.now();
      const route = findRoute(routes, request);
      const attempts: CapabilityAttemptLog[] = [];

      if (!route) {
        const result = failedResult(
          createCapabilityError({
            code: 'unsupported_capability',
            message: `No capability route matches ${request.capability}:${request.task}`,
            category: 'unsupported',
          }),
        );
        await writeLog(
          logSink,
          createCallLog(createId(), request, undefined, result, attempts, startedAt, clock.now(), false),
        );
        return result;
      }

      const providerKeys = [route.primary, ...(route.fallbacks ?? [])];
      const allowFallback = request.policy?.allowFallback !== false;
      let fallbackUsed = false;
      let result: CapabilityResult | undefined;

      for (let providerIndex = 0; providerIndex < providerKeys.length; providerIndex += 1) {
        if (providerIndex > 0) {
          if (!allowFallback || !result || result.status !== 'failed' || !canFallback(result.error)) {
            break;
          }
          fallbackUsed = true;
        }

        const adapterKey = providerKeys[providerIndex];
        const adapter = adapterMap.get(adapterKey);
        if (!adapter || !adapter.supports.includes(request.capability)) {
          const missingAdapterResult = failedResult(
            createCapabilityError({
              code: 'unsupported_provider_adapter',
              message: `Adapter ${adapterKey} does not support ${request.capability}`,
              category: 'unsupported',
            }),
          );
          attempts.push(toAttemptLog(adapterKey, 1, 0, missingAdapterResult));
          if (result?.status !== 'failed') {
            result = missingAdapterResult;
          }
          continue;
        }

        result = await invokeAdapter(adapter, route, request, attempts, clock);
        if (result.status === 'success') {
          break;
        }
      }

      result ??= failedResult(
        createCapabilityError({
          code: 'provider_unavailable',
          message: `No provider adapter could handle ${request.capability}:${request.task}`,
          category: 'unsupported',
        }),
      );

      await writeLog(
        logSink,
        createCallLog(
          createId(),
          request,
          route,
          result,
          attempts,
          startedAt,
          clock.now(),
          fallbackUsed,
        ),
      );
      return result;
    },
  };
}

function findRoute(routes: CapabilityRoute[], request: CapabilityRequest): CapabilityRoute | undefined {
  return (
    routes.find((route) => route.capability === request.capability && route.task === request.task) ??
    routes.find((route) => route.capability === request.capability && route.task === undefined)
  );
}

async function invokeAdapter(
  adapter: ProviderAdapter,
  route: CapabilityRoute,
  request: CapabilityRequest,
  attempts: CapabilityAttemptLog[],
  clock: CapabilityClock,
): Promise<CapabilityResult> {
  const maxAttempts = request.policy?.retry?.maxAttempts ?? route.maxAttempts;
  const backoffMs = request.policy?.retry?.backoffMs ?? route.backoffMs ?? 0;
  const timeoutMs = request.policy?.timeoutMs ?? route.timeoutMs;
  const routedRequest: CapabilityRequest = {
    ...request,
    quality: request.quality ?? route.defaultQuality,
  };
  let lastResult: CapabilityResult | undefined;

  for (let attempt = 1; attempt <= Math.max(1, maxAttempts); attempt += 1) {
    const startedAt = clock.now();
    lastResult = await callWithTimeout(adapter, routedRequest, timeoutMs, clock);
    attempts.push(toAttemptLog(adapter.key, attempt, clock.now() - startedAt, lastResult));

    if (lastResult.status === 'success' || !isRetryableCapabilityError(lastResult.error) || attempt >= maxAttempts) {
      return lastResult;
    }

    await clock.sleep(backoffMs);
  }

  return (
    lastResult ??
    failedResult(
      createCapabilityError({
        code: 'provider_unavailable',
        message: `Adapter ${adapter.key} did not return a result`,
        category: 'provider_error',
        retryable: true,
      }),
    )
  );
}

async function callWithTimeout(
  adapter: ProviderAdapter,
  request: CapabilityRequest,
  timeoutMs: number,
  clock: CapabilityClock,
): Promise<CapabilityResult> {
  const timeoutError = failedResult(
    createCapabilityError({
      code: 'provider_timeout',
      message: `Adapter ${adapter.key} exceeded the ${timeoutMs}ms timeout`,
      category: 'timeout',
      retryable: true,
    }),
  );

  try {
    const result = await Promise.race([
      adapter.call(request),
      clock.sleep(timeoutMs).then(() => timeoutError),
    ]);

    if (result.status === 'failed') {
      return { ...result, error: normalizeCapabilityError(result.error) };
    }

    return result;
  } catch (error) {
    return failedResult(normalizeCapabilityError(error));
  }
}

function canFallback(error: CapabilityError): boolean {
  return ['provider_error', 'timeout', 'rate_limited'].includes(error.category);
}

function failedResult(error: CapabilityError): CapabilityResult {
  return { status: 'failed', error };
}

function toAttemptLog(
  adapterKey: string,
  attempt: number,
  latencyMs: number,
  result: CapabilityResult,
): CapabilityAttemptLog {
  return {
    adapterKey,
    attempt,
    status: result.status,
    latencyMs,
    errorCode: result.status === 'failed' ? result.error.code : undefined,
    errorCategory: result.status === 'failed' ? result.error.category : undefined,
  };
}

function createCallLog(
  id: string,
  request: CapabilityRequest,
  route: CapabilityRoute | undefined,
  result: CapabilityResult,
  attempts: CapabilityAttemptLog[],
  startedAt: number,
  finishedAt: number,
  fallbackUsed: boolean,
): CapabilityCallLog {
  const lastAttempt = attempts[attempts.length - 1];
  const providerInfo = result.providerInfo;
  const adapterKey = providerInfo?.adapterKey ?? lastAttempt?.adapterKey ?? 'unrouted';

  return {
    id,
    workflowId: request.trace.workflowId,
    runId: request.trace.runId,
    nodeId: request.trace.nodeId,
    executorKey: request.trace.executorKey,
    capability: request.capability,
    task: request.task,
    provider: providerInfo?.provider ?? adapterKey,
    model: providerInfo?.model,
    adapterKey,
    status: result.status,
    latencyMs: finishedAt - startedAt,
    quality: request.quality ?? route?.defaultQuality,
    promptVersion: request.promptVersion,
    preset: request.preset,
    usage: result.usage,
    errorCode: result.status === 'failed' ? result.error.code : undefined,
    errorCategory: result.status === 'failed' ? result.error.category : undefined,
    retryCount: Math.max(0, attempts.length - new Set(attempts.map((attempt) => attempt.adapterKey)).size),
    fallbackUsed,
    attempts,
    createdAt: new Date(finishedAt).toISOString(),
  };
}

async function writeLog(
  logSink: CreateCapabilityRouterOptions['logSink'],
  log: CapabilityCallLog,
): Promise<void> {
  if (logSink) {
    await logSink(log);
  }
}

function createDefaultId(): string {
  return `capability-call-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
