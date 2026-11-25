import { useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useApi } from '../api.js';
import { useFilters } from '../FilterContext.jsx';
import { Card, ChartTip, Growth, NewBadge, Status, Switch } from '../components/ui.jsx';
import {
  METRICS, fmtDate, fmtMetric, fmtMonth, fmtShortDate, int, lakh, lakhShort, PALETTE, pct,
} from '../format.js';

const MINI = [
  { key: 'enrollments', label: 'Enrollments', fmt: int },
  { key: 'amountReceived', label: 'Received', fmt: lakh },
  { key: 'amountDue', label: 'Due', fmt: lakh, invert: true },
];

// One period (Today / This week / This month / This year): the headline number first, the rest underneath.
function PeriodCard({ c }) {
  const cur = c.current;
  const range = c.from === c.to ? fmtDate(c.from) : `${fmtShortDate(c.from)} – ${fmtDate(c.to)}`;
  const vs = (k) => `${c.vs} (${fmtDate(c.prevFrom)}${c.prevFrom === c.prevTo ? '' : ` – ${fmtDate(c.prevTo)}`})`;
  const coll = cur.programFee ? Math.min(100, Math.round((cur.amountReceived / cur.programFee) * 100)) : null;
  return (
    <section className="sd-card sd-period">
      <header>
        <div><h3>{c.label}</h3><p className="sd-muted">{range}</p></div>
        <Growth value={c.growth.programFee} vs={vs()} />
      </header>
      <div className="sd-period-big">{lakh(cur.programFee)}<small>Program Fee</small></div>
      <div className="sd-meter" title="Amount Received ÷ Program Fee"><i style={{ width: `${coll ?? 0}%` }} /></div>
      <p className="sd-meter-label">{coll === null ? 'Nothing sold yet' : `${coll}% collected`}</p>
      <dl className="sd-mini">
        {MINI.map((r) => (
          <div key={r.key}>
            <dt>{r.label}</dt>
            <dd>{r.fmt(cur[r.key])}</dd>
            <Growth value={c.growth[r.key]} invert={r.invert} vs={vs()} />
          </div>
        ))}
      </dl>
    </section>
  );
}

const tick = (metric) => (v) => (metric === 'enrollments' ? int(v) : lakhShort(v));
const AXIS = { tickLine: false, axisLine: false };

export default function Overview() {
  const { filters } = useFilters();
  const { data, loading, error } = useApi('/overview', { programs: filters.programs, from: filters.from, to: filters.to });
  const [metric, setMetric] = useState('programFee');
  const m = METRICS.find((x) => x.key === metric);
  const metricSwitch = <Switch options={METRICS} value={metric} onChange={setMetric} />;
  const tip = (labelFmt) => <Tooltip cursor={{ stroke: 'var(--line-strong)' }} content={<ChartTip labelFmt={labelFmt} nameFmt={() => m.label} valueFmt={(v) => fmtMetric(metric, v)} />} />;

  return (
    <>
      <Status loading={loading} error={error} empty={!data} />
      {data && (
        <div className={loading ? 'sd-fading' : ''}>
          <div className="sd-grid sd-four">
            {['today', 'week', 'month', 'year'].map((k) => <PeriodCard key={k} c={data.cards[k]} />)}
          </div>
          <p className="sd-muted sd-note">
            Each card compares the period so far with the same stretch of the one before (Growth % <NewBadge />). Cards follow the Program filter and always count up to today ({fmtDate(data.asOf)}).
          </p>

          <div className="sd-grid sd-two">
            <Card title="Daily trend" subtitle={`Last 60 days · ${fmtShortDate(data.trend60[0].date)} – ${fmtDate(data.asOf)}`} right={metricSwitch}>
              <div className="sd-chart">
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={data.trend60} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="sd-area" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={PALETTE[0]} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={PALETTE[0]} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={fmtShortDate} minTickGap={36} {...AXIS} />
                    <YAxis tickFormatter={tick(metric)} width={58} {...AXIS} />
                    {tip(fmtDate)}
                    <Area isAnimationActive={false} type="monotone" dataKey={metric} stroke={PALETTE[0]} strokeWidth={2.5} fill="url(#sd-area)" dot={false} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="Month by month" subtitle="Follows the date range above · latest month highlighted" right={metricSwitch}>
              <div className="sd-chart">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={data.monthly} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tickFormatter={fmtMonth} minTickGap={24} {...AXIS} />
                    <YAxis tickFormatter={tick(metric)} width={58} {...AXIS} />
                    {tip(fmtMonth)}
                    <Bar isAnimationActive={false} dataKey={metric} radius={[6, 6, 0, 0]}>
                      {data.monthly.map((row, i) => <Cell key={row.month} fill={i === data.monthly.length - 1 ? PALETTE[0] : PALETTE[1]} fillOpacity={i === data.monthly.length - 1 ? 1 : 0.7} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card title="Payments at a glance" subtitle="Pymt Status values exactly as in the sheet, for the selected date range">
            <div className="sd-status">
              {data.pymtStatus.map((s) => (
                <div key={s.status} className={`sd-status-item ${/received/i.test(s.status) ? 'sd-s-good' : /due/i.test(s.status) ? 'sd-s-warn' : ''}`}>
                  <span className="sd-status-name">{s.status}</span>
                  <strong>{int(s.enrollments)}</strong>
                  <span className="sd-muted">enrollments · {lakh(s.programFee)} Program Fee</span>
                </div>
              ))}
              <div className="sd-status-item sd-s-accent">
                <span className="sd-status-name">Collection % <NewBadge /></span>
                <strong>{pct(data.totals.collectionPct)}</strong>
                <span className="sd-muted">Avg Program Fee {lakh(data.totals.avgProgramFee)}</span>
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
