import { createRunError } from './errors.js';
import type { RunEvent, RunNodeState, RunState } from './types.js';

const createInitialNodeState = (nodeId: string): RunNodeState => ({
  nodeId,
  status: 'idle',
  attemptCount: 0,
  resultVersionIds: [],
});

const getNodeState = (state: RunState, nodeId: string): RunNodeState => state.nodeStates[nodeId] ?? createInitialNodeState(nodeId);

const withMetadata = (state: RunState, event: RunEvent): RunState => ({
  ...state,
  eventCount: state.eventCount + 1,
  lastEventAt: event.occurredAt,
});

const assertRunNotFinished = (state: RunState, event: RunEvent) => {
  if (state.status === 'success' || state.status === 'failed' || state.status === 'cancelled') {
    throw new Error(`Cannot apply ${event.type} after run is finished`);
  }
};

const assertNodeTransition = (node: RunNodeState, allowed: RunNodeState['status'][], event: RunEvent) => {
  if (!allowed.includes(node.status)) {
    throw new Error(`Cannot apply ${event.type} when node '${node.nodeId}' is ${node.status}`);
  }
};

export const createInitialRunState = (runId: string, workflowId: string): RunState => ({
  runId,
  workflowId,
  status: 'pending',
  nodeStates: {},
  eventCount: 0,
});

export const reduceRunEvent = (state: RunState, event: RunEvent): RunState => {
  if (state.runId !== event.runId || state.workflowId !== event.workflowId) {
    throw new Error('Event does not belong to the target run');
  }

  switch (event.type) {
    case 'WorkflowRunStarted': {
      if (state.status !== 'pending') {
        throw new Error('WorkflowRunStarted can only be applied when run is pending');
      }

      return withMetadata(
        {
          ...state,
          status: 'running',
          startedAt: event.occurredAt,
        },
        event,
      );
    }

    case 'NodeQueued': {
      assertRunNotFinished(state, event);
      const nodeState = getNodeState(state, event.nodeId);
      assertNodeTransition(nodeState, ['idle', 'waiting'], event);

      return withMetadata(
        {
          ...state,
          nodeStates: {
            ...state.nodeStates,
            [event.nodeId]: {
              ...nodeState,
              status: 'waiting',
              error: undefined,
              partialResult: undefined,
              skipReason: undefined,
            },
          },
        },
        event,
      );
    }

    case 'NodeStarted': {
      assertRunNotFinished(state, event);
      const nodeState = getNodeState(state, event.nodeId);
      assertNodeTransition(nodeState, ['idle', 'waiting'], event);

      return withMetadata(
        {
          ...state,
          nodeStates: {
            ...state.nodeStates,
            [event.nodeId]: {
              ...nodeState,
              status: 'running',
              attemptCount: event.attempt,
              startedAt: nodeState.startedAt ?? event.occurredAt,
              finishedAt: undefined,
              error: undefined,
              partialResult: undefined,
              skipReason: undefined,
            },
          },
        },
        event,
      );
    }

    case 'NodeSucceeded': {
      assertRunNotFinished(state, event);
      const nodeState = getNodeState(state, event.nodeId);
      assertNodeTransition(nodeState, ['running'], event);

      return withMetadata(
        {
          ...state,
          nodeStates: {
            ...state.nodeStates,
            [event.nodeId]: {
              ...nodeState,
              status: 'success',
              attemptCount: event.attempt,
              finishedAt: event.occurredAt,
              resultVersionIds: event.resultVersionIds,
              error: undefined,
              partialResult: undefined,
              skipReason: undefined,
            },
          },
        },
        event,
      );
    }

    case 'NodeFailed': {
      assertRunNotFinished(state, event);
      const nodeState = getNodeState(state, event.nodeId);
      assertNodeTransition(nodeState, ['running'], event);

      return withMetadata(
        {
          ...state,
          nodeStates: {
            ...state.nodeStates,
            [event.nodeId]: {
              ...nodeState,
              status: 'failed',
              attemptCount: event.attempt,
              finishedAt: event.occurredAt,
              error: event.error,
              partialResult: event.partialResult,
            },
          },
          lastError: event.error,
        },
        event,
      );
    }

    case 'NodeRetryScheduled': {
      assertRunNotFinished(state, event);
      const nodeState = getNodeState(state, event.nodeId);
      assertNodeTransition(nodeState, ['failed'], event);

      return withMetadata(
        {
          ...state,
          nodeStates: {
            ...state.nodeStates,
            [event.nodeId]: {
              ...nodeState,
              status: 'waiting',
              attemptCount: event.nextAttempt - 1,
              finishedAt: undefined,
              error: event.reason,
            },
          },
          lastError: event.reason,
        },
        event,
      );
    }

    case 'NodeSkipped': {
      assertRunNotFinished(state, event);
      const nodeState = getNodeState(state, event.nodeId);
      assertNodeTransition(nodeState, ['idle', 'waiting'], event);

      return withMetadata(
        {
          ...state,
          nodeStates: {
            ...state.nodeStates,
            [event.nodeId]: {
              ...nodeState,
              status: 'skipped',
              finishedAt: event.occurredAt,
              skipReason: event.reason,
            },
          },
        },
        event,
      );
    }

    case 'WorkflowRunCompleted': {
      assertRunNotFinished(state, event);
      return withMetadata(
        {
          ...state,
          status: 'success',
          finishedAt: event.occurredAt,
        },
        event,
      );
    }

    case 'WorkflowRunFailed': {
      assertRunNotFinished(state, event);
      return withMetadata(
        {
          ...state,
          status: 'failed',
          finishedAt: event.occurredAt,
          lastError: event.error,
        },
        event,
      );
    }

    case 'WorkflowRunCancelled': {
      assertRunNotFinished(state, event);
      const cancellationError = createRunError({
        code: 'run_cancelled',
        message: event.reason ?? 'Run cancelled',
        category: 'cancelled',
      });

      const nodeStates = Object.fromEntries(
        Object.entries(state.nodeStates).map(([nodeId, nodeState]) => {
          if (nodeState.status === 'waiting' || nodeState.status === 'running') {
            return [
              nodeId,
              {
                ...nodeState,
                status: 'cancelled',
                finishedAt: event.occurredAt,
                error: cancellationError,
              },
            ];
          }

          return [nodeId, nodeState];
        }),
      );

      return withMetadata(
        {
          ...state,
          status: 'cancelled',
          finishedAt: event.occurredAt,
          nodeStates,
          lastError: cancellationError,
        },
        event,
      );
    }
  }
};

export const reduceRunEvents = (runId: string, workflowId: string, events: RunEvent[]): RunState =>
  events.reduce((state, event) => reduceRunEvent(state, event), createInitialRunState(runId, workflowId));
