import { useMemo, useState } from 'react';
import type { DayRow } from '../lib/api';
import { compact, full, longDate } from '../lib/format';

const CELL = 13;
const GAP = 3;
const STEP = CELL + GAP;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const RAMP = [
  'var(--seq-0)',
  'var(--seq-1)',
  'var(--seq-2)',
  'var(--seq-3)',
  'var(--seq-4)',
  'var(--seq-5)',
  'var(--seq-6)',
  'var(--seq-7)',
];

type Props = {
  days: DayRow[];
  weeks?: number;
  onSelect?: (day: DayRow) => void;
};

/**
 * Calendar heatmap. Magnitude is a sequential single-hue ramp (never a
 * rainbow); every cell is its own hit target and carries the same value in
 * its tooltip and in the table view below the chart.
 */
export function Heatmap({ days, weeks = 26, onSelect }: Props) {
  const [hover, setHover] = useState<{ x: number; y: number; day: DayRow } | null>(null);

  const { cells, monthLabels, max, todayKey } = useMemo(() => {
    const byDate = new Map(days.map((d) => [d.date, d]));
    const today = new Date();
    const todayKey = today.toISOString().slice(0, 10);
    const end = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    // Start on the Monday of the first week so columns are whole weeks.
    const start = new Date(end.getTime() - (weeks * 7 - 1) * 86400000);
    const startMonday = new Date(start.getTime() - ((start.getUTCDay() + 6) % 7) * 86400000);

    const cells: { key: string; x: number; y: number; day: DayRow | null }[] = [];
    const monthLabels: { x: number; label: string }[] = [];
    let max = 0;

    const cursor = new Date(startMonday);
    let week = 0;
    while (cursor <= end || week === 0) {
      for (let d = 0; d < 7; d += 1) {
        const key = cursor.toISOString().slice(0, 10);
        const day = byDate.get(key) ?? null;
        if (day) max = Math.max(max, day.total);
        cells.push({ key, x: week * STEP, y: d * STEP, day });
        // Label a month on the column where the month actually begins, so
        // labels never collide with the tail of the previous month.
        if (cursor.getUTCDate() === 1) {
          monthLabels.push({ x: week * STEP, label: MONTHS[cursor.getUTCMonth()] });
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
      week += 1;
      if (cursor > end) break;
    }

    return { cells, monthLabels, max, todayKey };
  }, [days, weeks]);

  const stepFor = (total: number) => {
    if (!total) return 0;
    const scaled = Math.sqrt(total / (max || 1));
    return Math.min(7, Math.max(1, Math.ceil(scaled * 7)));
  };

  const width = (cells.length / 7) * STEP;
  const height = 7 * STEP;

  return (
    <div className="heat">
      <svg
        width={width}
        height={height + 16}
        role="img"
        aria-label={`Token usage by day for the last ${weeks} weeks`}
        style={{ maxWidth: '100%' }}
      >
        {monthLabels.map((m) => (
          <text
            key={m.label + m.x}
            x={m.x}
            y={10}
            fill="var(--ink-3)"
            fontSize="10"
            fontFamily="var(--font-mono)"
          >
            {m.label}
          </text>
        ))}
        {cells.map((cell) => {
          const total = cell.day?.total ?? 0;
          const fill = RAMP[stepFor(total)];
          const isToday = cell.key === todayKey;
          return (
            <g
              key={cell.key}
              className="heat__cell"
              tabIndex={cell.day ? 0 : -1}
              role={cell.day ? 'button' : undefined}
              aria-label={
                cell.day
                  ? `${longDate(cell.key)}: ${full(total)} tokens`
                  : `${longDate(cell.key)}: no activity`
              }
              onPointerEnter={(e) =>
                cell.day && setHover({ x: e.clientX, y: e.clientY, day: cell.day })
              }
              onPointerMove={(e) =>
                cell.day && setHover({ x: e.clientX, y: e.clientY, day: cell.day })
              }
              onPointerLeave={() => setHover(null)}
              onFocus={(e) => {
                if (!cell.day) return;
                const r = (e.target as SVGGElement).getBoundingClientRect();
                setHover({ x: r.left + r.width / 2, y: r.top, day: cell.day });
              }}
              onBlur={() => setHover(null)}
              onClick={() => cell.day && onSelect?.(cell.day)}
            >
              <rect
                x={cell.x}
                y={cell.y + 14}
                width={CELL}
                height={CELL}
                rx={2}
                fill={fill}
                stroke={isToday ? 'var(--accent)' : 'transparent'}
                strokeWidth={isToday ? 1.5 : 0}
              />
            </g>
          );
        })}
      </svg>

      {hover && (
        <div
          className="tooltip"
          style={{
            position: 'fixed',
            left: Math.min(hover.x + 14, window.innerWidth - 240),
            top: Math.max(10, hover.y - 12),
          }}
        >
          <div className="tooltip__title">{longDate(hover.day.date)}</div>
          <div className="tooltip__row">
            <span className="tooltip__value">{full(hover.day.total)}</span>
            <span className="tooltip__name">tokens</span>
          </div>
          <div className="tooltip__row">
            <span className="tooltip__value">{full(hover.day.input)}</span>
            <span className="tooltip__name">input</span>
          </div>
          <div className="tooltip__row">
            <span className="tooltip__value">{full(hover.day.output)}</span>
            <span className="tooltip__name">output</span>
          </div>
          <div className="tooltip__row">
            <span className="tooltip__value">{full(hover.day.cacheRead + hover.day.cacheWrite)}</span>
            <span className="tooltip__name">cache</span>
          </div>
          <div className="tooltip__row">
            <span className="tooltip__value">{compact(hover.day.sessions)}</span>
            <span className="tooltip__name">sessions</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function HeatLegend() {
  return (
    <span className="ramp">
      <span>Less</span>
      <span className="ramp__scale">
        {RAMP.map((color) => (
          <span key={color} className="ramp__step" style={{ background: color }} />
        ))}
      </span>
      <span>More</span>
    </span>
  );
}

export { DAYS as HEATMAP_DAY_LABELS };
