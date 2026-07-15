export type RunStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';

export type RunNodeStatus = 'idle' | 'waiting' | 'running' | 'success' | 'failed' | 'skipped' | 'cancelled';

export type RunErrorCategory =
  | 'validation'
  | 'input_missing'
  | 'capability_error'
  | 'asset_error'
  | 'timeout'
  | 'user_required'
  | 'cancelled'
  | 'unknown';

export type RunError = {
  code: string;
  message: string;
  detail?: unknown;
  category: RunErrorCategory;
  retryable: boolean;
};

export type RunNodeState = {
  nodeId: string;
  status: RunNodeStatus;
  attemptCount: number;
  startedAt?: string;
  finishedAt?: string;
  resultVersionIds: string[];
  error?: RunError;
  partialResult?: unknown;
  skipReason?: string;
};

export type RunState = {
  runId: string;
  workflowId: string;
  status: RunStatus;
  startedAt?: string;
  finishedAt?: string;
  nodeStates: Record<string, RunNodeState>;
  eventCount: number;
  lastEventAt?: string;
  lastError?: RunError;
};

export type RunEventBase = {
  runId: string;
  workflowId: string;
  eventId: string;
  occurredAt: string;
};

export type WorkflowRunStartedEvent = RunEventBase & {
  type: 'WorkflowRunStarted';
};

export type NodeQueuedEvent = RunEventBase & {
  type: 'NodeQueued';
  nodeId: string;
};

export type NodeStartedEvent = RunEventBase & {
  type: 'NodeStarted';
  nodeId: string;
  attempt: number;
};

export type NodeSucceededEvent = RunEventBase & {
  type: 'NodeSucceeded';
  nodeId: string;
  attempt: number;
  resultVersionIds: string[];
};

export type NodeFailedEvent = RunEventBase & {
  type: 'NodeFailed';
  nodeId: string;
  attempt: number;
  error: RunError;
  partialResult?: unknown;
};

export type NodeRetryScheduledEvent = RunEventBase & {
  type: 'NodeRetryScheduled';
  nodeId: string;
  nextAttempt: number;
  reason: RunError;
};

export type NodeSkippedEvent = RunEventBase & {
  type: 'NodeSkipped';
  nodeId: string;
  reason: string;
};

export type WorkflowRunCompletedEvent = RunEventBase & {
  type: 'WorkflowRunCompleted';
};

export type WorkflowRunFailedEvent = RunEventBase & {
  type: 'WorkflowRunFailed';
  error: RunError;
};

export type WorkflowRunCancelledEvent = RunEventBase & {
  type: 'WorkflowRunCancelled';
  reason?: string;
};

export type RunEvent =
  | WorkflowRunStartedEvent
  | NodeQueuedEvent
  | NodeStartedEvent
  | NodeSucceededEvent
  | NodeFailedEvent
  | NodeRetryScheduledEvent
  | NodeSkippedEvent
  | WorkflowRunCompletedEvent
  | WorkflowRunFailedEvent
  | WorkflowRunCancelledEvent;
