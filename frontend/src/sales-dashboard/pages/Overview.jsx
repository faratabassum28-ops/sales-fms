import { useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useApi } from '../api.js';
import { useFilters } from '../FilterContext.jsx';
import { Card, Growth, NewBadge, Status, Switch } from '../components/ui.jsx';
import {
  METRICS, fmtDate, fmtMetric, fmtMonth, fmtShortDate, int, lakh, lakhShort, PALETTE, pct,
} from '../format.js';

const ROWS = [
  { key: 'enrollments', label: 'Enrollments', isNew: true, fmt: int },
  { key: 'programFee', label: 'Program Fee', fmt: lakh },
  { key: 'amountReceived', label: 'Amount Received', fmt: lakh },
  { key: 'amountDue', label: 'Amount Due', fmt: lakh, invert: true },
];

function PeriodCard({ c }) {
  const range = c.from === c.to ? fmtDate(c.from) : `${fmtShortDate(c.from)} – ${fmtDate(c.to)}`;
  return (
    <Card title={c.label} subtitle={range} className="sd-kpi-card">
      <dl className="sd-kpis">
        {ROWS.map((r) => (
          <div key={r.key} className="sd-kpi">
            <dt>{r.label}{r.isNew && <NewBadge />}</dt>
            <dd>{r.fmt(c.current[r.key])}</dd>
            <Growth value={c.growth[r.key]} invert={r.invert} vs={`${c.vs} (${fmtDate(c.prevFrom)}${c.prevFrom === c.prevTo ? '' : ` – ${fmtDate(c.prevTo)}`})`} />
          </div>
        ))}
      </dl>
    </Card>
  );
}

const tick = (metric) => (v) => (metric === 'enrollments' ? int(v) : lakhShort(v));

export default function Overview() {
  const { filters } = useFilters();
  const { data, loading, error } = useApi('/overview', { programs: filters.programs, from: filters.from, to: filters.to });
  const [metric, setMetric] = useState('programFee');
  const m = METRICS.find((x) => x.key === metric);
  const metricSwitch = <Switch options={METRICS} value={metric} onChange={setMetric} />;

  return (
    <>
      <Status loading={loading} error={error} empty={!data} />
      {data && (
        <div className={loading ? 'sd-fading' : ''}>
          <div className="sd-grid sd-four">
            {['today', 'week', 'month', 'year'].map((k) => <PeriodCard key={k} c={data.cards[k]} />)}
          </div>
          <p className="sd-muted sd-note">
            Cards compare each period so far with the same stretch of the previous one (Growth % <NewBadge />). They follow the Program filter and always count up to today ({fmtDate(data.asOf)}).
          </p>

          <div className="sd-grid sd-two">
            <Card title="Daily trend – last 60 days" subtitle={`${fmtDate(data.trend60[0].date)} – ${fmtDate(data.asOf)}`} right={metricSwitch}>
              <div className="sd-chart">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.trend60} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={fmtShortDate} minTickGap={28} />
                    <YAxis tickFormatter={tick(metric)} width={56} />
                    <Tooltip labelFormatter={fmtDate} formatter={(v) => [fmtMetric(metric, v), m.label]} />
                    <Line isAnimationActive={false} type="monotone" dataKey={metric} stroke={PALETTE[0]} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="Monthly" subtitle="Follows the date range above" right={metricSwitch}>
              <div className="sd-chart">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.monthly} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tickFormatter={fmtMonth} minTickGap={24} />
                    <YAxis tickFormatter={tick(metric)} width={56} />
                    <Tooltip labelFormatter={fmtMonth} formatter={(v) => [fmtMetric(metric, v), m.label]} />
                    <Bar isAnimationActive={false} dataKey={metric} fill={PALETTE[1]} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card title="Pymt Status" subtitle="Values exactly as in the sheet, for the selected date range">
            <div className="sd-chips">
              {data.pymtStatus.map((s) => (
                <div key={s.status} className="sd-chip">
                  <strong>{s.status}</strong>
                  <span>{int(s.enrollments)} enrollments</span>
                  <span>{lakh(s.programFee)} Program Fee</span>
                </div>
              ))}
              <div className="sd-chip">
                <strong>Collection %</strong><NewBadge />
                <span>{pct(data.totals.collectionPct)}</span>
                <span>Avg Program Fee {lakh(data.totals.avgProgramFee)}</span>
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
