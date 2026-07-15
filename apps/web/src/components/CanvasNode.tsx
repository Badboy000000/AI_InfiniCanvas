import { getInputPortY, OUTPUT_PORT_Y } from '../lib/ports';
import type { DataTypeOrAny, WorkflowNode } from '../types';

const statusClassMap: Record<WorkflowNode['status'], string> = {
  未配置: 'muted',
  待执行: 'pending',
  运行中: 'running',
  成功: 'success',
  失败: 'danger',
};

const typeLabel: Record<DataTypeOrAny, string> = {
  text: '文本',
  image: '图片',
  video: '视频',
  file: '文件',
  ai: 'AI',
  any: '通用',
};

const typeAccentMap: Record<WorkflowNode['dataType'], string> = {
  text: 'var(--type-text)',
  image: 'var(--type-image)',
  video: 'var(--type-video)',
  file: 'var(--type-file)',
  ai: 'var(--type-ai)',
};

export function CanvasNode({
  node,
  selected = false,
  dragging = false,
  onPointerDown,
  onOutputPortPointerDown,
  onInputPortEnter,
  onInputPortLeave,
  highlightPortId,
  highlightCompatible,
}: {
  node: WorkflowNode;
  selected?: boolean;
  dragging?: boolean;
  onPointerDown?: (event: React.PointerEvent<HTMLElement>) => void;
  onOutputPortPointerDown?: (event: React.PointerEvent<HTMLSpanElement>, node: WorkflowNode) => void;
  onInputPortEnter?: (nodeId: string, portId: string) => void;
  onInputPortLeave?: () => void;
  highlightPortId?: string | null;
  highlightCompatible?: boolean;
}) {
  const inputPorts = node.inputPorts ?? [];
  const accent = typeAccentMap[node.dataType];

  return (
    <article
      className={`canvas-node minimal-node ${selected ? 'selected' : ''} ${dragging ? 'dragging' : ''}`}
      style={{ left: node.x, top: node.y, width: node.width ?? 220, ['--node-accent' as string]: accent }}
      onPointerDown={onPointerDown}
    >
      <div className="node-ports node-ports-input" aria-hidden="true">
        {inputPorts.map((port, index) => {
          const centerY = getInputPortY(index, inputPorts.length);
          const isHighlighted = highlightPortId === port.id;
          return (
            <span
              key={port.id}
              className={`node-handle input ${port.dataType} ${isHighlighted ? (highlightCompatible ? 'port-valid' : 'port-invalid') : ''}`}
              style={{ top: `${centerY}px` }}
              title={`输入：${port.label}（${typeLabel[port.dataType]}）`}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerEnter={() => onInputPortEnter?.(node.id, port.id)}
              onPointerLeave={() => onInputPortLeave?.()}
            />
          );
        })}
      </div>
      <div className="node-ports node-ports-output" aria-hidden="true">
        <span
          className={`node-handle output ${node.dataType}`}
          style={{ top: `${OUTPUT_PORT_Y}px` }}
          title={`输出：${typeLabel[node.dataType]}（拖拽创建连线）`}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerDownCapture={(e) => onOutputPortPointerDown?.(e, node)}
        />
      </div>
      <div className="node-card-top">
        <div>
          <span className="node-category">{node.category}</span>
          <h3>{node.title}</h3>
        </div>
        <span className={`node-status ${statusClassMap[node.status]}`}>{node.status}</span>
      </div>
      <p className="node-type">{node.type}</p>
      <div className="node-result compact">{node.resultSummary}</div>
    </article>
  );
}
