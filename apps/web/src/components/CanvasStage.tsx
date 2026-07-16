import { useEffect, useMemo, useRef, useState } from 'react';
import { ConnectionLine } from './ConnectionLine';
import { CanvasNode } from './CanvasNode';
import {
  findPortAtPosition,
  getMiniMapViewportRect,
  getOutputPortAnchor,
  getPortAnchor,
} from '../lib/ports';
import { computeWorldBounds, screenToWorld, toCanvasNodes, zoomAtPoint, type Viewport } from '../lib/viewport';
import { describeRejection, validateEdgeAttempt } from '../domain/edge-validation';
import { resolveSourceOutputKey, toWorkflow } from '../domain/workflow-adapter';
import type { InputPortDef, LibraryGroup, WorkflowEdge, WorkflowNode } from '../types';
import type { WorkflowEdgeRejection } from '@ai-canvas/workflow-core';

const NODE_WIDTH = 220;

type ToolConfig = {
  icon: string;
  label: string;
  createType: string | null;
};

const bottomTools: ToolConfig[] = [
  { icon: '⌖', label: '选择', createType: null },
  { icon: '＋', label: '文本输入', createType: '文本输入' },
  { icon: '◫', label: '图片输入', createType: '图片输入' },
  { icon: '✦', label: 'AI 节点', createType: 'AI 节点' },
  { icon: '⤴', label: '输出节点', createType: '输出节点' },
  { icon: 'T', label: '文本', createType: null },
  { icon: '⟲', label: '连线', createType: null },
  { icon: '↻', label: '重试', createType: null },
  { icon: '◎', label: '定位', createType: null },
];

type NodePreset = Pick<WorkflowNode, 'title' | 'type' | 'category' | 'resultSummary' | 'dataType' | 'inputPorts' | 'nodeType'>;

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
      nodeType: 'input.text',
      category: '输入',
      resultSummary: '双击后填写 brief 或说明',
      dataType: 'text',
      inputPorts: [],
    },
    图片输入: {
      title: '新图片节点',
      type: '图片输入',
      nodeType: 'input.image',
      category: '输入',
      resultSummary: '点击后上传参考图',
      dataType: 'image',
      inputPorts: [],
    },
    'AI 节点': {
      title: '新 AI 节点',
      type: 'AI 文本生成',
      nodeType: 'ai.text_generation',
      category: 'AI',
      resultSummary: '等待接入上下文',
      dataType: 'ai',
      inputPorts: [
        { id: 'context', label: '上下文', dataType: 'text' },
        { id: 'references', label: '参考资料', dataType: 'text' },
      ],
    },
    输出节点: {
      title: '新输出节点',
      type: '图片导出',
      nodeType: 'export.image',
      category: '输出',
      resultSummary: '用于导出图片资产',
      dataType: 'file',
      inputPorts: [{ id: 'image', label: '待导出图片', dataType: 'image' }],
    },
  };

  const preset = map[toolLabel] ?? map['AI 节点'];
  return {
    id: `${toolLabel}-${index}`,
    title: preset.title,
    type: preset.type,
    nodeType: preset.nodeType,
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
  const [activeTool, setActiveTool] = useState<ToolConfig>(bottomTools[0]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [menuNodeId, setMenuNodeId] = useState<string | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [connectionDrag, setConnectionDrag] = useState<ConnectionDragState | null>(null);
  const [hoveredPort, setHoveredPort] = useState<HoveredPort | null>(null);
  const [activeRejection, setActiveRejection] = useState<WorkflowEdgeRejection | null>(null);
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

  const canvasNodes = useMemo(() => toCanvasNodes(nodes), [nodes]);
  const worldBounds = useMemo(() => computeWorldBounds(canvasNodes), [canvasNodes]);

  const selectedNodeIdRef = useRef(selectedNode?.id ?? '');
  selectedNodeIdRef.current = selectedNode?.id ?? '';

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') {
        return;
      }

      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const id = selectedNodeIdRef.current;
      if (!id) {
        return;
      }

      event.preventDefault();
      onDeleteNode(id);
      setMenuOpen(false);
      setMenuNodeId(null);
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

  /**
   * 通过 workflow-core 做权威连线校验。返回 null 表示可连；返回结构化拒绝对象则表示不可连。
   * 前端严禁基于自己的判断拼字符串，UI 只消费 rejection.code 映射到本地文案。
   */
  const validateConnection = (
    currentNodes: WorkflowNode[],
    currentEdges: WorkflowEdge[],
    fromNode: WorkflowNode,
    targetNodeId: string,
    targetInputKey: string,
  ): WorkflowEdgeRejection | null => {
    // 如果任意一端没有对齐到正式节点协议 type，走 workflow-core 校验会失败于 definition_missing。
    // 这里让画布保持向后兼容——旧原型节点在没有 nodeType 时保持原路可连（后续所有新节点都必带 nodeType）。
    if (!fromNode.nodeType) return null;
    const targetNode = currentNodes.find((candidate) => candidate.id === targetNodeId);
    if (!targetNode?.nodeType) return null;

    const workflow = toWorkflow(currentNodes, currentEdges);
    return validateEdgeAttempt({
      candidate: {
        sourceNodeId: fromNode.id,
        sourceOutputKey: resolveSourceOutputKey(fromNode),
        targetNodeId,
        targetInputKey,
      },
      workflow,
    });
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
        const fromNode = currentNodes.find((candidate) => candidate.id === fromNodeId);
        if (!fromNode) return;
        const rejection = validateConnection(currentNodes, currentEdges, fromNode, hit.nodeId, hit.portId);
        setHoveredPort({ nodeId: hit.nodeId, portId: hit.portId, port: hit.port, compatible: rejection === null });
        setActiveRejection(rejection);
      } else {
        setHoveredPort(null);
        setActiveRejection(null);
      }
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      const w = screenToWorldOnBoard(upEvent.clientX, upEvent.clientY);
      const currentNodes = latestNodes.current;
      const currentEdges = latestEdges.current;
      const hit = findPortAtPosition(currentNodes, w.x, w.y, fromNodeId);

      if (hit) {
        const fromNode = currentNodes.find((candidate) => candidate.id === fromNodeId);
        if (fromNode) {
          const rejection = validateConnection(currentNodes, currentEdges, fromNode, hit.nodeId, hit.portId);
          if (rejection === null) {
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
            setActiveRejection(null);
          } else {
            setActiveRejection(rejection);
            // 2 秒后自动消失，避免长期霸占屏幕
            setTimeout(() => setActiveRejection((current) => (current === rejection ? null : current)), 2500);
          }
        }
      } else {
        setActiveRejection(null);
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

      const { layout } = getMiniMapViewportRect({
        bounds: worldBounds,
        miniMapSize: { width: rect.width, height: rect.height },
        boardSize: {
          width: boardRef.current?.clientWidth ?? 1200,
          height: boardRef.current?.clientHeight ?? 700,
        },
        viewport: latestViewport.current,
      });

      const worldX = worldBounds.minX + (clickX - layout.offsetX) / layout.scaleRatio;
      const worldY = worldBounds.minY + (clickY - layout.offsetY) / layout.scaleRatio;

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

    const { layout, viewportRect } = getMiniMapViewportRect({
      bounds,
      miniMapSize: { width: miniMapSize.w, height: miniMapSize.h },
      boardSize: {
        width: boardRef.current?.clientWidth ?? 1200,
        height: boardRef.current?.clientHeight ?? 700,
      },
      viewport,
    });

    const nodeRects = canvasNodes.map((node) => ({
      id: node.id,
      x: (node.x - bounds.minX) * layout.scaleRatio + layout.offsetX,
      y: (node.y - bounds.minY) * layout.scaleRatio + layout.offsetY,
      w: (node.width ?? 220) * layout.scaleRatio,
      h: (node.height ?? 110) * layout.scaleRatio,
    }));

    return {
      nodeRects,
      vpRect: viewportRect,
      mapW: miniMapSize.w,
      mapH: miniMapSize.h,
    };
  }, [canvasNodes, miniMapSize, viewport, worldBounds]);

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
        if (nodeEl?.dataset.nodeId) {
          onSelectNode(nodeEl.dataset.nodeId);
        }
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

      <div ref={boardRef} className="canvas-board minimal-board" onWheel={handleWheel} onPointerDown={handleBoardPointerDown}>
        <div className="canvas-content-layer" style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})` }}>
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
                selected={node.id === selectedNode?.id}
                dragging={draggingNodeId === node.id}
                onPointerDown={(event) => handleNodePointerDown(event, node)}
                onOutputPortPointerDown={(event, candidate) => handleConnectionStart(event, candidate)}
                highlightPortId={hoveredPort?.nodeId === node.id ? hoveredPort.portId : null}
                highlightCompatible={hoveredPort?.nodeId === node.id ? hoveredPort.compatible : undefined}
              />
            </div>
          ))}
        </div>

        {menuOpen ? (
          <div className="right-click-menu-preview interactive" style={{ left: menuPos.x, top: menuPos.y }}>
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
                      const world = screenToWorldOnBoard(menuPos.x, menuPos.y);
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
        <div ref={miniMapRef} className="mini-map-grid" onPointerDown={handleMiniMapInteraction}>
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

      {activeRejection && (
        <div className="edge-rejection-toast" role="alert">
          <strong>无法连接：</strong>
          <span>{describeRejection(activeRejection)}</span>
        </div>
      )}
    </section>
  );
}
