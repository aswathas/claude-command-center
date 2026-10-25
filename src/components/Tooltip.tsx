import { useCallback, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

type Props = {
  title?: string;
  rows: { name: string; value: string; color?: string }[];
  children: (open: (point: { x: number; y: number }) => void) => ReactNode;
};

/**
 * Value-first tooltip. Rows lead with the number and follow with the series
 * name, the inverse of a legend, because the reader already knows the series
 * and wants the figure.
 */
export function Tooltip({ title, rows, children }: Props) {
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const open = useCallback((p: { x: number; y: number }) => setPoint(p), []);
  const close = useCallback(() => setPoint(null), []);

  const style: CSSProperties | undefined = point
    ? {
        left: Math.min(point.x + 14, window.innerWidth - 260),
        top: Math.max(12, point.y - 18),
      }
    : undefined;

  return (
    <div
      ref={ref}
      onPointerLeave={close}
      onBlur={close}
      style={{ position: 'relative', display: 'contents' }}
    >
      {children(open)}
      {point && (
        <div className="tooltip" style={style} role="tooltip">
          {title && <div className="tooltip__title">{title}</div>}
          {rows.map((row) => (
            <div className="tooltip__row" key={row.name}>
              {row.color && <span className="tooltip__key" style={{ background: row.color }} />}
              <span className="tooltip__value">{row.value}</span>
              <span className="tooltip__name">{row.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
