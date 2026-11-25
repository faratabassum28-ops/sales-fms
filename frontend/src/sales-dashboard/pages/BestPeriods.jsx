import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useApi } from '../api.js';
import { useFilters } from '../FilterContext.jsx';
import { Card, Status } from '../components/ui.jsx';
import Heatmap from '../components/Heatmap.jsx';
import {
  MONTH_NAMES, fmtDate, fmtMonth, int, lakh, lakhShort, PALETTE, weekday,
} from '../format.js';

function Callout({ title, label, c }) {
  return (
    <Card className="sd-callout">
      <p className="sd-eyebrow">Best {title}</p>
      {c ? (
        <>
          <p className="sd-big">{lakh(c.programFee)}</p>
          <p className="sd-what">{label(c.key)}</p>
          <p className="sd-muted">{int(c.enrollments)} enrollments · {lakh(c.amountReceived)} Amount Received</p>
        </>
      ) : <p className="sd-muted">No data</p>}
    </Card>
  );
}

export default function BestPeriods() {
  const { filters } = useFilters();
  const { data, loading, error } = useApi('/best-periods', { from: filters.from, to: filters.to, programs: filters.programs });

  return (
    <>
      <Status loading={loading} error={error} empty={!data} />
      {data && (
        <div className={loading ? 'sd-fading' : ''}>
          <div className="sd-grid sd-four">
            <Callout title="Day" c={data.callouts.day} label={(k) => `${weekday(k)}, ${fmtDate(k)}`} />
            <Callout title="Week" c={data.callouts.week} label={(k) => `Week of ${fmtDate(k)}`} />
            <Callout title="Month" c={data.callouts.month} label={fmtMonth} />
            <Callout title="Quarter" c={data.callouts.quarter} label={(k) => `${k.slice(5)} ${k.slice(0, 4)}`} />
          </div>
          <p className="sd-muted sd-note">Callouts, heatmap and year-over-year look at all time (Program filter applies). Day of week follows the date range.</p>

          <Card title="Program Fee by Month × Year" subtitle="Darker = higher">
            <Heatmap heatmap={data.heatmap} />
          </Card>

          <div className="sd-grid sd-two">
            <Card title="Program Fee by Day of week" subtitle="Selected date range">
              <div className="sd-chart">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.dayOfWeek} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" tickFormatter={(d) => d.slice(0, 3)} />
                    <YAxis tickFormatter={lakhShort} width={56} />
                    <Tooltip formatter={(v, _n, p) => [`${lakh(v)} · ${int(p.payload.enrollments)} enrollments`, 'Program Fee']} />
                    <Bar isAnimationActive={false} dataKey="programFee" fill={PALETTE[2]} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="Same month, year over year" subtitle="Program Fee">
              <div className="sd-chart">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.yoy.programFee} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tickFormatter={(m) => MONTH_NAMES[m - 1]} />
                    <YAxis tickFormatter={lakhShort} width={56} />
                    <Tooltip labelFormatter={(m) => MONTH_NAMES[m - 1]} formatter={(v, name) => [lakh(v), name]} />
                    <Legend />
                    {data.yoy.years.map((y, i) => (
                      <Bar isAnimationActive={false} key={y} dataKey={String(y)} name={String(y)} fill={PALETTE[i % PALETTE.length]} radius={[2, 2, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
