import { compact, full } from '../lib/format';

export function BarList({
  rows,
  colorFor,
}: {
  rows: { label: string; value: number; sub?: string; color?: string }[];
  colorFor: (index: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="barlist">
      {rows.map((row, index) => (
        <div className="barlist__row" key={row.label}>
          <span className="barlist__name" title={row.label}>
            {row.label}
          </span>
          <span className="barlist__track">
            <span
              className="barlist__fill"
              style={{ width: `${Math.max(2, (row.value / max) * 100)}%`, background: row.color || colorFor(index) }}
            />
          </span>
          <span className="barlist__value" title={full(row.value)}>
            {compact(row.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function DataTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <div className="tablewrap"><table className="table">
      <thead>
        <tr>
          {headers.map((h) => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j} className={typeof cell === 'number' ? 'table__num' : undefined}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table></div>
  );
}
