import { strict as assert } from 'node:assert';
import { createRunError, reduceRunEvent, reduceRunEvents, type RunEvent } from '../packages/event-core/src/index.js';

const runId = 'run-1';
const workflowId = 'workflow-1';

const eventBase = (eventId: string, occurredAt: string) => ({
  runId,
  workflowId,
  eventId,
  occurredAt,
});

const retryableError = createRunError({
  code: 'provider_timeout',
  message: 'provider timed out',
  category: 'timeout',
  retryable: true,
});

const fatalError = createRunError({
  code: 'node_failed',
  message: 'node failed',
  category: 'capability_error',
});

const successEvents: RunEvent[] = [
  { type: 'WorkflowRunStarted', ...eventBase('e1', '2026-07-15T10:00:00.000Z') },
  { type: 'NodeQueued', nodeId: 'node-a', ...eventBase('e2', '2026-07-15T10:00:01.000Z') },
  { type: 'NodeStarted', nodeId: 'node-a', attempt: 1, ...eventBase('e3', '2026-07-15T10:00:02.000Z') },
  {
    type: 'NodeSucceeded',
    nodeId: 'node-a',
    attempt: 1,
    resultVersionIds: ['rv-1'],
    ...eventBase('e4', '2026-07-15T10:00:03.000Z'),
  },
  { type: 'WorkflowRunCompleted', ...eventBase('e5', '2026-07-15T10:00:04.000Z') },
];

const successState = reduceRunEvents(runId, workflowId, successEvents);
assert.equal(successState.status, 'success');
assert.equal(successState.startedAt, '2026-07-15T10:00:00.000Z');
assert.equal(successState.finishedAt, '2026-07-15T10:00:04.000Z');
assert.equal(successState.eventCount, 5);
assert.equal(successState.nodeStates['node-a'].status, 'success');
assert.equal(successState.nodeStates['node-a'].attemptCount, 1);
assert.deepEqual(successState.nodeStates['node-a'].resultVersionIds, ['rv-1']);

const retryState = reduceRunEvents(runId, workflowId, [
  { type: 'WorkflowRunStarted', ...eventBase('r1', '2026-07-15T11:00:00.000Z') },
  { type: 'NodeQueued', nodeId: 'node-b', ...eventBase('r2', '2026-07-15T11:00:01.000Z') },
  { type: 'NodeStarted', nodeId: 'node-b', attempt: 1, ...eventBase('r3', '2026-07-15T11:00:02.000Z') },
  {
    type: 'NodeFailed',
    nodeId: 'node-b',
    attempt: 1,
    error: retryableError,
    partialResult: { delta: 'partial' },
    ...eventBase('r4', '2026-07-15T11:00:03.000Z'),
  },
  {
    type: 'NodeRetryScheduled',
    nodeId: 'node-b',
    nextAttempt: 2,
    reason: retryableError,
    ...eventBase('r5', '2026-07-15T11:00:04.000Z'),
  },
  { type: 'NodeStarted', nodeId: 'node-b', attempt: 2, ...eventBase('r6', '2026-07-15T11:00:05.000Z') },
  {
    type: 'NodeSucceeded',
    nodeId: 'node-b',
    attempt: 2,
    resultVersionIds: ['rv-2'],
    ...eventBase('r7', '2026-07-15T11:00:06.000Z'),
  },
  { type: 'WorkflowRunCompleted', ...eventBase('r8', '2026-07-15T11:00:07.000Z') },
]);
assert.equal(retryState.status, 'success');
assert.equal(retryState.nodeStates['node-b'].status, 'success');
assert.equal(retryState.nodeStates['node-b'].attemptCount, 2);
assert.deepEqual(retryState.nodeStates['node-b'].resultVersionIds, ['rv-2']);

const skippedState = reduceRunEvents(runId, workflowId, [
  { type: 'WorkflowRunStarted', ...eventBase('s1', '2026-07-15T12:00:00.000Z') },
  { type: 'NodeQueued', nodeId: 'node-c', ...eventBase('s2', '2026-07-15T12:00:01.000Z') },
  {
    type: 'NodeSkipped',
    nodeId: 'node-c',
    reason: 'upstream failed',
    ...eventBase('s3', '2026-07-15T12:00:02.000Z'),
  },
  {
    type: 'WorkflowRunFailed',
    error: fatalError,
    ...eventBase('s4', '2026-07-15T12:00:03.000Z'),
  },
]);
assert.equal(skippedState.status, 'failed');
assert.equal(skippedState.nodeStates['node-c'].status, 'skipped');
assert.equal(skippedState.nodeStates['node-c'].skipReason, 'upstream failed');
assert.equal(skippedState.lastError?.code, 'node_failed');

let cancelledState = reduceRunEvent(
  reduceRunEvents(runId, workflowId, [
    { type: 'WorkflowRunStarted', ...eventBase('c1', '2026-07-15T13:00:00.000Z') },
    { type: 'NodeQueued', nodeId: 'node-d', ...eventBase('c2', '2026-07-15T13:00:01.000Z') },
    { type: 'NodeStarted', nodeId: 'node-d', attempt: 1, ...eventBase('c3', '2026-07-15T13:00:02.000Z') },
  ]),
  { type: 'WorkflowRunCancelled', reason: 'user cancelled', ...eventBase('c4', '2026-07-15T13:00:03.000Z') },
);
assert.equal(cancelledState.status, 'cancelled');
assert.equal(cancelledState.nodeStates['node-d'].status, 'cancelled');
assert.equal(cancelledState.nodeStates['node-d'].error?.category, 'cancelled');
assert.equal(cancelledState.lastError?.message, 'user cancelled');

assert.throws(
  () =>
    reduceRunEvents(runId, workflowId, [
      { type: 'WorkflowRunStarted', ...eventBase('x1', '2026-07-15T14:00:00.000Z') },
      { type: 'WorkflowRunCompleted', ...eventBase('x2', '2026-07-15T14:00:01.000Z') },
      { type: 'NodeQueued', nodeId: 'node-x', ...eventBase('x3', '2026-07-15T14:00:02.000Z') },
    ]),
  /run is finished/,
);

console.log('event-core tests passed');
