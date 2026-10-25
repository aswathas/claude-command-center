import { useState } from 'react';
import type { DayRow } from '../lib/api';
import { full, longDate } from '../lib/format';

type Props = {
  days: DayRow[];
  height?: number;
};

/**
 * Tokens per day. The mark is the hit target: each bar carries its own
 * pointer and focus tooltip, and the baseline stays anchored while the data
 * end carries the 4px radius.
 */
export function DailyBars({ days, height = 132 }: Props) {
  const [hover, setHover] = useState<{ x: number; y: number; day: DayRow } | null>(null);
  const max = Math.max(1, ...days.map((d) => d.total));

  if (!days.length) {
    return <div className="chart__empty">No activity in this window.</div>;
  }

  return (
    <div className="chart" style={{ position: 'relative' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 2,
          height,
          borderBottom: '1px solid var(--line)',
        }}
      >
        {days.map((day) => {
          const pct = (day.total / max) * 100;
          return (
            <div
              key={day.date}
              tabIndex={0}
              role="button"
              aria-label={`${longDate(day.date)}: ${full(day.total)} tokens`}
              style={{
                flex: 1,
                minWidth: 3,
                height: `${Math.max(pct, day.total ? 1.5 : 0.6)}%`,
                background: day.total ? 'var(--brass)' : 'var(--seq-0)',
                borderRadius: '4px 4px 0 0',
                cursor: 'pointer',
                transition: 'background var(--dur) var(--ease)',
              }}
              onPointerEnter={(e) => setHover({ x: e.clientX, y: e.clientY, day })}
              onPointerMove={(e) => setHover({ x: e.clientX, y: e.clientY, day })}
              onPointerLeave={() => setHover(null)}
              onFocus={(e) => {
                const r = (e.target as HTMLElement).getBoundingClientRect();
                setHover({ x: r.left + r.width / 2, y: r.top, day });
              }}
              onBlur={() => setHover(null)}
            />
          );
        })}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 6,
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--step--1)',
          color: 'var(--ink-3)',
        }}
      >
        <span>{days[0] ? longDate(days[0].date) : ''}</span>
        <span>{days[days.length - 1] ? longDate(days[days.length - 1].date) : ''}</span>
      </div>

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
            <span className="tooltip__key" style={{ background: 'var(--brass)' }} />
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
        </div>
      )}
    </div>
  );
}
