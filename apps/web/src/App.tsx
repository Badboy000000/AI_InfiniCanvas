import { useMemo, useState } from 'react';
import { CanvasStage } from './components/CanvasStage';
import { edges as initialEdges, libraryGroups, nodes } from './data/mock';
import type { Viewport } from './lib/viewport';
import type { WorkflowEdge, WorkflowNode } from './types';

export default function App() {
  const seededNodes = useMemo(
    () => nodes.map((node) => ({ ...node, width: 220 })),
    [],
  );

  const [canvasNodes, setCanvasNodes] = useState<WorkflowNode[]>(seededNodes);
  const [canvasEdges, setCanvasEdges] = useState<WorkflowEdge[]>(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string>(seededNodes[1]?.id ?? seededNodes[0].id);
  const [viewport, setViewport] = useState<Viewport>({ scale: 1, x: 0, y: 0 });

  const selectedNode = useMemo(
    () => canvasNodes.find((node) => node.id === selectedNodeId) ?? canvasNodes[0],
    [canvasNodes, selectedNodeId],
  );

  return (
    <div className="app-shell canvas-mode-shell">
      <CanvasStage
        nodes={canvasNodes}
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
    </div>
  );
}
