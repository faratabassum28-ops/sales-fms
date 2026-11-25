import { MONTH_NAMES, lakhShort, lakh, int } from '../format.js';

// Month x Year heatmap of Program Fee
export default function Heatmap({ heatmap }) {
  const { years, cells, max } = heatmap;
  const byKey = new Map(cells.map((c) => [`${c.year}-${c.month}`, c]));
  return (
    <div className="sd-heat-wrap">
      <table className="sd-heat">
        <thead>
          <tr><th>Year</th>{MONTH_NAMES.map((m) => <th key={m}>{m}</th>)}</tr>
        </thead>
        <tbody>
          {years.map((y) => (
            <tr key={y}>
              <th>{y}</th>
              {MONTH_NAMES.map((_, i) => {
                const c = byKey.get(`${y}-${i + 1}`);
                const v = c?.programFee || 0;
                const a = max ? v / max : 0;
                return (
                  <td
                    key={i}
                    title={c ? `${MONTH_NAMES[i]} ${y}: ${lakh(v)} · ${int(c.enrollments)} enrollments` : `${MONTH_NAMES[i]} ${y}: no enrollments`}
                    style={{ background: v ? `rgba(13,148,136,${0.08 + a * 0.92})` : 'transparent', color: a > 0.55 ? '#fff' : 'inherit' }}
                  >
                    {v ? lakhShort(v) : '–'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
