import { useEffect, useMemo, useState } from 'react';
import { CanvasStage } from './components/CanvasStage';
import { edges as initialEdges, libraryGroups, nodes } from './data/mock';
import type { Viewport } from './lib/viewport';
import { apiClient, ApiHttpError } from './lib/api-client';
import { subscribeRunEvents } from './lib/run-events';
import { toWorkflow } from './domain/workflow-adapter';
import { describeRejection } from './domain/edge-validation';
import { describeRunStatus } from './domain/run-state';
import type { WorkflowEdge, WorkflowNode } from './types';
import type { RunState } from '@ai-canvas/event-core';
import type { WorkflowEdgeRejection } from '@ai-canvas/workflow-core';

const CANVAS_WORKFLOW_ID = 'wf-web-canvas';

const nodeStatusMap: Record<string, WorkflowNode['status']> = {
  idle: '未配置',
  waiting: '待执行',
  running: '运行中',
  success: '成功',
  failed: '失败',
  skipped: '待执行',
  cancelled: '失败',
};

export default function App() {
  const seededNodes = useMemo(
    () => nodes.map((node) => ({ ...node, width: 220 })),
    [],
  );

  const [canvasNodes, setCanvasNodes] = useState<WorkflowNode[]>(seededNodes);
  const [canvasEdges, setCanvasEdges] = useState<WorkflowEdge[]>(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string>(seededNodes[1]?.id ?? seededNodes[0].id);
  const [viewport, setViewport] = useState<Viewport>({ scale: 1, x: 0, y: 0 });

  const [runState, setRunState] = useState<RunState | null>(null);
  const [runningRunId, setRunningRunId] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [apiReady, setApiReady] = useState<boolean>(false);

  // 探测 API 是否可达（不可达时降级为纯前端原型模式）
  useEffect(() => {
    let cancelled = false;
    apiClient
      .listNodeDefinitions()
      .then(() => {
        if (!cancelled) setApiReady(true);
      })
      .catch(() => {
        if (!cancelled) setApiReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 订阅 SSE
  useEffect(() => {
    if (!runningRunId) return;
    const unsubscribe = subscribeRunEvents({
      runId: runningRunId,
      onState: setRunState,
      onError: (error) => setRunError(error.message),
      onDone: () => setRunningRunId(null),
    });
    return unsubscribe;
  }, [runningRunId]);

  const displayNodes = useMemo(() => {
    if (!runState) return canvasNodes;
    return canvasNodes.map((node) => {
      const nodeState = runState.nodeStates[node.id];
      if (!nodeState) return node;
      const mapped = nodeStatusMap[nodeState.status] ?? node.status;
      return { ...node, status: mapped };
    });
  }, [canvasNodes, runState]);

  const selectedNode = useMemo(
    () => displayNodes.find((node) => node.id === selectedNodeId) ?? displayNodes[0],
    [displayNodes, selectedNodeId],
  );

  const handleRun = async () => {
    setRunError(null);
    const workflow = toWorkflow(canvasNodes, canvasEdges, {
      id: CANVAS_WORKFLOW_ID,
      name: '画布工作流',
    });
    try {
      const saveResult = await apiClient.saveWorkflow(workflow);
      if (!saveResult.ok) {
        const first = saveResult.rejections[0] as WorkflowEdgeRejection | undefined;
        setRunError(first ? describeRejection(first) : '工作流校验失败');
        return;
      }
      const run = await apiClient.createRun(CANVAS_WORKFLOW_ID);
      setRunState(run);
      setRunningRunId(run.runId);
    } catch (error) {
      if (error instanceof ApiHttpError) {
        setRunError(`API ${error.status}: ${error.message}`);
      } else {
        setRunError((error as Error).message);
      }
    }
  };

  return (
    <div className="app-shell canvas-mode-shell">
      <CanvasStage
        nodes={displayNodes}
        edges={canvasEdges}
        libraryGroups={libraryGroups}
        selectedNode={selectedNode}
        viewport={viewport}
        onSelectNode={setSelectedNodeId}
        onMoveNode={(nodeId, position) => {
          setCanvasNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, ...position } : node)));
        }}
        onCreateNode={(node) => {
          setCanvasNodes((prev) => [...prev, node]);
          setSelectedNodeId(node.id);
        }}
        onDeleteNode={(nodeId) => {
          setCanvasNodes((prev) => prev.filter((n) => n.id !== nodeId));
          setCanvasEdges((prev) => prev.filter((e) => e.from !== nodeId && e.to !== nodeId));
          setSelectedNodeId('');
        }}
        onCreateEdge={(edge) => {
          setCanvasEdges((prev) => {
            const filtered = prev.filter(
              (e) => !(e.to === edge.to && e.toPort === edge.toPort),
            );
            return [...filtered, edge];
          });
        }}
        onDeleteEdge={(edgeId) => {
          setCanvasEdges((prev) => prev.filter((e) => e.id !== edgeId));
        }}
        onViewportChange={setViewport}
      />

      <div className="run-control-panel">
        <button
          className="run-button"
          onClick={handleRun}
          disabled={!apiReady || runningRunId !== null}
          title={apiReady ? '将当前画布保存到 API 并触发运行' : 'API 未连接（离线原型模式）'}
        >
          {runningRunId ? '运行中…' : '运行工作流'}
        </button>
        {!apiReady && <span className="run-hint">离线原型模式（未连接 API）</span>}
        {apiReady && runState && <span className="run-hint">状态：{describeRunStatus(runState)}</span>}
        {runError && (
          <div className="run-error" role="alert">
            {runError}
          </div>
        )}
      </div>
    </div>
  );
}
