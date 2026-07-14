import { useEffect, useMemo, useRef, useState } from 'react';
import { ConnectionLine } from './ConnectionLine';
import { CanvasNode } from './CanvasNode';
import { findPortAtPosition, getOutputPortAnchor, getPortAnchor, isConnectionCompatible, wouldCreateCycle } from '../lib/ports';
import { computeWorldBounds, screenToWorld, zoomAtPoint, type Viewport } from '../lib/viewport';
import type { InputPortDef, LibraryGroup, WorkflowEdge, WorkflowNode } from '../types';

const NODE_WIDTH = 220;

const bottomTools = [
  { icon: '⌖', label: '选择', createType: null },
  { icon: '＋', label: '文本输入', createType: '文本输入' },
  { icon: '◫', label: '图片输入', createType: '图片输入' },
  { icon: '✦', label: 'AI 节点', createType: 'AI 节点' },
  { icon: '⤴', label: '输出节点', createType: '输出节点' },
  { icon: 'T', label: '文本', createType: null },
  { icon: '⟲', label: '连线', createType: null },
  { icon: '↻', label: '重试', createType: null },
  { icon: '◎', label: '定位', createType: null },
] as const;

type NodePreset = Pick<WorkflowNode, 'title' | 'type' | 'category' | 'resultSummary' | 'dataType' | 'inputPorts'>;

type ConnectionDragState = {
  fromNodeId: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  dataType: WorkflowNode['dataType'];
};

type HoveredPort = {
  nodeId: string;
  portId: string;
  port: InputPortDef;
  compatible: boolean;
};

function createNodeFromTool(toolLabel: string, index: number): WorkflowNode {
  const map: Record<string, NodePreset> = {
    文本输入: {
      title: '新文本节点',
      type: '文本输入',
      category: '输入',
      resultSummary: '双击后填写 brief 或说明',
      dataType: 'text',
      inputPorts: [],
    },
    图片输入: {
      title: '新图片节点',
      type: '图片输入',
      category: '输入',
      resultSummary: '点击后上传参考图',
      dataType: 'image',
      inputPorts: [],
    },
    'AI 节点': {
      title: '新 AI 节点',
      type: 'AI 节点',
      category: '生成',
      resultSummary: '等待接入上游输入',
      dataType: 'ai',
      inputPorts: [
        { id: 'in-0', label: '输入', dataType: 'text' },
      ],
    },
    输出节点: {
      title: '新输出节点',
      type: '输出节点',
      category: '输出',
      resultSummary: '用于归档或导出结果',
      dataType: 'file',
      inputPorts: [
        { id: 'in-0', label: '结果', dataType: 'any' as InputPortDef['dataType'] },
      ],
    },
  };

  const preset = map[toolLabel] ?? map['AI 节点'];
  return {
    id: `${toolLabel}-${index}`,
    title: preset.title,
    type: preset.type,
    category: preset.category,
    dataType: preset.dataType,
    x: 450 + (index % 3) * 120,
    y: 150 + (index % 4) * 90,
    width: NODE_WIDTH,
    status: '未配置',
    inputSummary: '等待连接',
    outputSummary: '待生成',
    resultSummary: preset.resultSummary,
    description: '这是一个新创建的原型节点。',
    inputPorts: preset.inputPorts,
  };
}

export function CanvasStage({
  nodes,
  edges,
  libraryGroups,
  selectedNode,
  viewport,
  onSelectNode,
  onMoveNode,
  onCreateNode,
  onDeleteNode,
  onCreateEdge,
  onDeleteEdge,
  onViewportChange,
}: {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  libraryGroups: LibraryGroup[];
  selectedNode: WorkflowNode;
  viewport: Viewport;
  onSelectNode: (id: string) => void;
  onMoveNode: (id: string, position: { x: number; y: number }) => void;
  onCreateNode: (node: WorkflowNode) => void;
  onDeleteNode: (nodeId: string) => void;
  onCreateEdge: (edge: WorkflowEdge) => void;
  onDeleteEdge: (edgeId: string) => void;
  onViewportChange: (vp: Viewport) => void;
}) {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [activeTool, setActiveTool] = useState<(typeof bottomTools)[number]>(bottomTools[0]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [menuNodeId, setMenuNodeId] = useState<string | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [connectionDrag, setConnectionDrag] = useState<ConnectionDragState | null>(null);
  const [hoveredPort, setHoveredPort] = useState<HoveredPort | null>(null);
  const miniMapRef = useRef<HTMLDivElement | null>(null);
  const [miniMapSize, setMiniMapSize] = useState({ w: 102, h: 80 });
  const latestNodes = useRef(nodes);
  latestNodes.current = nodes;
  const latestEdges = useRef(edges);
  latestEdges.current = edges;
  const latestViewport = useRef(viewport);
  latestViewport.current = viewport;

  useEffect(() => {
    const el = miniMapRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setMiniMapSize({ w: rect.width, h: rect.height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const worldBounds = useMemo(() => computeWorldBounds(nodes), [nodes]);

  const selectedNodeIdRef = useRef(selectedNode?.id ?? '');
  selectedNodeIdRef.current = selectedNode?.id ?? '';

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        const target = event.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
        const id = selectedNodeIdRef.current;
        if (id) {
          event.preventDefault();
          onDeleteNode(id);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onDeleteNode]);

  const screenToWorldOnBoard = (clientX: number, clientY: number) => {
    const board = boardRef.current;
    if (!board) return { x: 0, y: 0 };
    const rect = board.getBoundingClientRect();
    return screenToWorld(clientX - rect.left, clientY - rect.top, latestViewport.current);
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const board = boardRef.current;
    if (!board) return;
    const rect = board.getBoundingClientRect();
    const anchorX = event.clientX - rect.left;
    const anchorY = event.clientY - rect.top;
    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    onViewportChange(zoomAtPoint(latestViewport.current, anchorX, anchorY, delta));
  };

  const handleBoardPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.button !== 1) return;
    if (event.target !== event.currentTarget && !(event.target as HTMLElement).classList.contains('canvas-grid')) return;
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const vpStart = { ...latestViewport.current };
    let moved = false;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
      onViewportChange({ ...vpStart, x: vpStart.x + dx, y: vpStart.y + dy });
    };

    const handlePointerUp = () => {
      if (!moved) {
        onSelectNode('');
      }
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  const handleNodePointerDown = (event: React.PointerEvent<HTMLElement>, node: WorkflowNode) => {
    event.preventDefault();
    event.stopPropagation();
    onSelectNode(node.id);

    const board = boardRef.current;
    if (!board) return;

    const rect = board.getBoundingClientRect();
    const vp = latestViewport.current;
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    const world = screenToWorld(screenX, screenY, vp);
    const offsetX = world.x - node.x;
    const offsetY = world.y - node.y;

    setDraggingNodeId(node.id);
    event.currentTarget.setPointerCapture(event.pointerId);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const sx = moveEvent.clientX - rect.left;
      const sy = moveEvent.clientY - rect.top;
      const w = screenToWorld(sx, sy, latestViewport.current);
      onMoveNode(node.id, { x: Math.max(24, w.x - offsetX), y: Math.max(24, w.y - offsetY) });
    };

    const stopDragging = () => {
      setDraggingNodeId((current) => (current === node.id ? null : current));
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopDragging);
      window.removeEventListener('pointercancel', stopDragging);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopDragging);
    window.addEventListener('pointercancel', stopDragging);
  };

  const handleConnectionStart = (event: React.PointerEvent<HTMLSpanElement>, node: WorkflowNode) => {
    event.preventDefault();
    event.stopPropagation();
    const fromNodeId = node.id;
    const fromDataType = node.dataType;
    const anchor = getOutputPortAnchor(node);

    const world = screenToWorldOnBoard(event.clientX, event.clientY);
    setConnectionDrag({
      fromNodeId,
      startX: anchor.x,
      startY: anchor.y,
      currentX: world.x,
      currentY: world.y,
      dataType: fromDataType,
    });

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const w = screenToWorldOnBoard(moveEvent.clientX, moveEvent.clientY);
      setConnectionDrag((prev) => (prev ? { ...prev, currentX: w.x, currentY: w.y } : null));

      const currentNodes = latestNodes.current;
      const currentEdges = latestEdges.current;
      const hit = findPortAtPosition(currentNodes, w.x, w.y, fromNodeId);
      if (hit) {
        const fromNode = currentNodes.find((n) => n.id === fromNodeId);
        if (!fromNode) return;
        const compatible = isConnectionCompatible(fromNode, hit.port) &&
          !wouldCreateCycle(currentEdges, fromNodeId, hit.nodeId);
        setHoveredPort({ nodeId: hit.nodeId, portId: hit.portId, port: hit.port, compatible });
      } else {
        setHoveredPort(null);
      }
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      const w = screenToWorldOnBoard(upEvent.clientX, upEvent.clientY);
      const currentNodes = latestNodes.current;
      const currentEdges = latestEdges.current;
      const hit = findPortAtPosition(currentNodes, w.x, w.y, fromNodeId);

      if (hit) {
        const fromNode = currentNodes.find((n) => n.id === fromNodeId);
        if (fromNode) {
          const compatible = isConnectionCompatible(fromNode, hit.port) &&
            !wouldCreateCycle(currentEdges, fromNodeId, hit.nodeId);
          if (compatible) {
            const newEdge: WorkflowEdge = {
              id: `e-${fromNodeId}-${hit.nodeId}-${hit.portId}-${Date.now()}`,
              from: fromNodeId,
              to: hit.nodeId,
              label: '',
              dataType: fromDataType,
              fromPort: 'output',
              toPort: hit.portId,
            };
            onCreateEdge(newEdge);
          }
        }
      }

      setConnectionDrag(null);
      setHoveredPort(null);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  const handleMiniMapInteraction = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();

    const moveTo = (clientX: number, clientY: number) => {
      const clickX = clientX - rect.left;
      const clickY = clientY - rect.top;
      const worldW = worldBounds.maxX - worldBounds.minX;
      const worldH = worldBounds.maxY - worldBounds.minY;
      if (worldW <= 0 || worldH <= 0) return;

      const mapW = rect.width;
      const mapH = rect.height;
      const scaleRatio = Math.min(mapW / worldW, mapH / worldH);
      const offsetX = (mapW - worldW * scaleRatio) / 2;
      const offsetY = (mapH - worldH * scaleRatio) / 2;
      const worldX = worldBounds.minX + (clickX - offsetX) / scaleRatio;
      const worldY = worldBounds.minY + (clickY - offsetY) / scaleRatio;

      const board = boardRef.current;
      if (!board) return;
      const boardRect = board.getBoundingClientRect();
      const vp = latestViewport.current;
      onViewportChange({
        ...vp,
        x: boardRect.width / 2 - worldX * vp.scale,
        y: boardRect.height / 2 - worldY * vp.scale,
      });
    };

    moveTo(event.clientX, event.clientY);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      moveTo(moveEvent.clientX, moveEvent.clientY);
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  const miniMapData = useMemo(() => {
    const bounds = worldBounds;
    const worldW = bounds.maxX - bounds.minX;
    const worldH = bounds.maxY - bounds.minY;
    if (worldW <= 0 || worldH <= 0) return null;

    const mapW = miniMapSize.w;
    const mapH = miniMapSize.h;
    const scaleRatio = Math.min(mapW / worldW, mapH / worldH);
    const offsetX = (mapW - worldW * scaleRatio) / 2;
    const offsetY = (mapH - worldH * scaleRatio) / 2;

    const nodeRects = nodes.map((n) => ({
      id: n.id,
      x: (n.x - bounds.minX) * scaleRatio + offsetX,
      y: (n.y - bounds.minY) * scaleRatio + offsetY,
      w: (n.width ?? 220) * scaleRatio,
      h: 110 * scaleRatio,
    }));

    const board = boardRef.current;
    const boardW = board?.clientWidth ?? 1200;
    const boardH = board?.clientHeight ?? 700;

    const vpWorldX1 = -viewport.x / viewport.scale;
    const vpWorldY1 = -viewport.y / viewport.scale;
    const vpWorldX2 = vpWorldX1 + boardW / viewport.scale;
    const vpWorldY2 = vpWorldY1 + boardH / viewport.scale;

    const vpRect = {
      x: (vpWorldX1 - bounds.minX) * scaleRatio + offsetX,
      y: (vpWorldY1 - bounds.minY) * scaleRatio + offsetY,
      w: (vpWorldX2 - vpWorldX1) * scaleRatio,
      h: (vpWorldY2 - vpWorldY1) * scaleRatio,
    };

    return { nodeRects, vpRect, mapW, mapH };
  }, [nodes, worldBounds, viewport, miniMapSize]);

  return (
    <section
      className="canvas-app minimal-canvas-app"
      onContextMenu={(event) => {
        event.preventDefault();
        const target = event.target as HTMLElement;
        const nodeEl = target.closest('[data-node-id]') as HTMLElement | null;
        setMenuNodeId(nodeEl?.dataset.nodeId ?? null);
        setMenuPos({ x: event.clientX, y: event.clientY });
        setMenuOpen(true);
      }}
      onPointerDown={(event) => {
        if (event.button === 0 && menuOpen) {
          const target = event.target as HTMLElement;
          if (!target.closest('.right-click-menu-preview')) {
            setMenuOpen(false);
          }
        }
      }}
    >
      <div className="minimal-topbar">
        <div className="topbar-left">
          <button className="tiny-circle">◔</button>
          <strong>Untitled</strong>
          <span>⌄</span>
        </div>
        <div className="topbar-right">
          <span className="zoom-display">{Math.round(viewport.scale * 100)}%</span>
        </div>
      </div>

      <div className="port-type-legend">
        <div className="legend-title">端口类型</div>
        <div className="legend-items">
          <span className="legend-item"><span className="legend-dot text" />文本</span>
          <span className="legend-item"><span className="legend-dot image" />图片</span>
          <span className="legend-item"><span className="legend-dot ai" />AI</span>
          <span className="legend-item"><span className="legend-dot video" />视频</span>
          <span className="legend-item"><span className="legend-dot file" />文件</span>
          <span className="legend-item"><span className="legend-dot any" />通用</span>
        </div>
      </div>

      <div
        ref={boardRef}
        className="canvas-board minimal-board"
        onWheel={handleWheel}
        onPointerDown={handleBoardPointerDown}
      >
        <div
          className="canvas-content-layer"
          style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})` }}
        >
          <div className="canvas-grid subtle-grid" />
          <svg className="edge-layer minimal-edge-layer">
            {edges.map((edge) => {
              const from = nodeMap.get(edge.from);
              const to = nodeMap.get(edge.to);
              if (!from || !to) return null;
              const start = getPortAnchor(from, edge.fromPort, 'right');
              const end = getPortAnchor(to, edge.toPort, 'left');
              return (
                <ConnectionLine
                  key={edge.id}
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  label=""
                  dataType={edge.dataType}
                  onClick={() => onDeleteEdge(edge.id)}
                />
              );
            })}
            {connectionDrag && (
              <ConnectionLine
                x1={connectionDrag.startX}
                y1={connectionDrag.startY}
                x2={connectionDrag.currentX}
                y2={connectionDrag.currentY}
                label=""
                dataType={connectionDrag.dataType}
              />
            )}
          </svg>

          {nodes.map((node) => (
            <div key={node.id} data-node-id={node.id} onClick={() => onSelectNode(node.id)}>
              <CanvasNode
                node={node}
                selected={node.id === selectedNode.id}
                dragging={draggingNodeId === node.id}
                onPointerDown={(event) => handleNodePointerDown(event, node)}
                onOutputPortPointerDown={(event, n) => handleConnectionStart(event, n)}
                highlightPortId={hoveredPort?.nodeId === node.id ? hoveredPort.portId : null}
                highlightCompatible={hoveredPort?.nodeId === node.id ? hoveredPort.compatible : undefined}
              />
            </div>
          ))}
        </div>

        {menuOpen ? (
          <div
            className="right-click-menu-preview interactive"
            style={{ left: menuPos.x, top: menuPos.y }}
          >
            {menuNodeId ? (
              <>
                <div className="menu-title">节点操作</div>
                <button
                  className="menu-delete"
                  onClick={() => {
                    onDeleteNode(menuNodeId);
                    setMenuOpen(false);
                    setMenuNodeId(null);
                  }}
                >
                  删除此节点
                </button>
              </>
            ) : (
              <>
                <div className="menu-title">右键创建</div>
                {['文本输入', '图片输入', 'AI 节点', '输出节点'].map((name, index) => (
                  <button
                    key={name}
                    onClick={() => {
                      const rect = boardRef.current!.getBoundingClientRect();
                      const world = screenToWorldOnBoard(
                        menuPos.x - rect.left,
                        menuPos.y - rect.top,
                      );
                      const newNode = createNodeFromTool(name, nodes.length + index);
                      newNode.x = world.x;
                      newNode.y = world.y;
                      onCreateNode(newNode);
                      setMenuOpen(false);
                    }}
                  >
                    {name}
                  </button>
                ))}
              </>
            )}
          </div>
        ) : null}
      </div>

      <div className="mini-map-card">
        <div className="mini-map-title">缩略导航</div>
        <div
          ref={miniMapRef}
          className="mini-map-grid"
          onPointerDown={handleMiniMapInteraction}
        >
          {miniMapData && (
            <>
              {miniMapData.nodeRects.map((rect) => (
                <div
                  key={rect.id}
                  className="mini-map-node"
                  style={{
                    left: `${rect.x}px`,
                    top: `${rect.y}px`,
                    width: `${Math.max(2, rect.w)}px`,
                    height: `${Math.max(2, rect.h)}px`,
                  }}
                />
              ))}
              <div
                className="mini-map-viewport"
                style={{
                  left: `${miniMapData.vpRect.x}px`,
                  top: `${miniMapData.vpRect.y}px`,
                  width: `${miniMapData.vpRect.w}px`,
                  height: `${miniMapData.vpRect.h}px`,
                }}
              />
            </>
          )}
        </div>
        <div className="mini-map-meta">
          <span>◎</span>
          <span>{Math.round(viewport.scale * 100)}%</span>
        </div>
      </div>

      <div className="bottom-centered-toolbar">
        {bottomTools.map((tool, index) => (
          <button
            key={tool.label}
            className={`bottom-tool ${activeTool.label === tool.label ? 'active' : ''}`}
            onMouseEnter={() => setActiveTool(tool)}
            onClick={() => {
              setActiveTool(tool);
              if (tool.createType) {
                onCreateNode(createNodeFromTool(tool.label, nodes.length + index));
              }
            }}
          >
            <span>{tool.icon}</span>
            <span className="tool-tooltip">{tool.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
