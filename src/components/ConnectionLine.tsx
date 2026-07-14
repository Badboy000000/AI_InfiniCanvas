import type { DataType } from '../types';

const typeColorMap: Record<DataType, string> = {
  text: 'var(--type-text)',
  image: 'var(--type-image)',
  video: 'var(--type-video)',
  file: 'var(--type-file)',
  ai: 'var(--type-ai)',
};

export function ConnectionLine({
  x1,
  y1,
  x2,
  y2,
  dataType,
  onClick,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label?: string;
  dataType: DataType;
  onClick?: () => void;
}) {
  const distance = Math.max(56, Math.abs(x2 - x1) * 0.42);
  const path = `M ${x1} ${y1} C ${x1 + distance} ${y1}, ${x2 - distance} ${y2}, ${x2} ${y2}`;

  return (
    <g
      className="connection-line"
      style={{ ['--line-color' as string]: typeColorMap[dataType] }}
      onClick={onClick}
    >
      <path className="connection-line-back" d={path} />
      <path className="connection-line-front" d={path} />
      <path className="connection-line-hit" d={path} />
      <circle className="connection-dot start" cx={x1} cy={y1} r="2.5" />
      <circle className="connection-dot end" cx={x2} cy={y2} r="2.5" />
    </g>
  );
}
