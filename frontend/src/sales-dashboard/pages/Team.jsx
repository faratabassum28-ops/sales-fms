import { useState } from 'react';
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useApi } from '../api.js';
import { useFilters } from '../FilterContext.jsx';
import { Card, ChartTip, NewBadge, Status, Switch } from '../components/ui.jsx';
import {
  colorFor, fmtMetric, fmtPeriod, int, lakh, lakhShort, pct,
} from '../format.js';

const GRAN = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'quarterly', label: 'Quarterly' },
  { key: 'yearly', label: 'Yearly' },
];
const MET = [{ key: 'programFee', label: 'Program Fee' }, { key: 'enrollments', label: 'Enrollments' }];

function NotTaggedCard({ nt }) {
  const ok = nt.pct <= nt.target;
  return (
    <Card className={`sd-callout ${ok ? 'sd-ok' : 'sd-warn'}`}>
      <p className="sd-eyebrow">Not Tagged % <NewBadge /></p>
      <p className="sd-big">{pct(nt.pct)}</p>
      <p className="sd-what">Target: {nt.target}% {ok ? '— on target' : '— needs tagging'}</p>
      <p className="sd-muted">{int(nt.enrollments)} of {int(nt.total)} enrollments have a blank Closed By · {lakh(nt.programFee)} Program Fee</p>
    </Card>
  );
}

export default function Team() {
  const { filters } = useFilters();
  const [gran, setGran] = useState('monthly');
  const [metric, setMetric] = useState('programFee');
  const { data, loading, error } = useApi('/team', {
    from: filters.from, to: filters.to, programs: filters.programs, closers: filters.closers, granularity: gran,
  });
  const maxFee = Math.max(1, ...(data?.leaderboard || []).map((r) => r.programFee));
  const metricSwitch = <Switch options={MET} value={metric} onChange={setMetric} />;

  return (
    <>
      <div className="sd-toolbar">
        <span className="sd-muted">View</span>
        <Switch options={GRAN} value={gran} onChange={setGran} />
      </div>
      <Status loading={loading} error={error} empty={!data} />
      {data && (
        <div className={loading ? 'sd-fading' : ''}>
          <div className="sd-grid sd-two-one">
            <Card title="Leaderboard by Closed By" subtitle="Selected date range, ranked by Program Fee">
              <div className="sd-table-wrap">
                <table className="sd-tbl">
                  <thead>
                    <tr>
                      <th>#</th><th>Closed By</th>
                      <th className="sd-r">Enrollments <NewBadge /></th>
                      <th className="sd-r">Program Fee</th>
                      <th className="sd-r">Amount Received</th>
                      <th className="sd-r">Amount Due</th>
                      <th className="sd-r">Avg Program Fee <NewBadge /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.leaderboard.map((r) => (
                      <tr key={r.closedBy}>
                        <td><span className={`sd-rank sd-rank-${r.rank <= 3 ? r.rank : 'n'}`}>{r.rank}</span></td>
                        <td className="sd-strong"><span className="sd-dot" style={{ background: colorFor(r.closedBy, data.closers) }} />{r.closedBy}</td>
                        <td className="sd-r">{int(r.enrollments)}</td>
                        <td className="sd-r sd-bar-cell" style={{ '--w': `${(r.programFee / maxFee) * 100}%` }}><span>{lakh(r.programFee)}</span></td>
                        <td className="sd-r">{lakh(r.amountReceived)}</td>
                        <td className="sd-r">{lakh(r.amountDue)}</td>
                        <td className="sd-r">{lakh(r.avgProgramFee)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <NotTaggedCard nt={data.notTagged} />
          </div>

          <Card
            title={`Trend per closer – ${GRAN.find((g) => g.key === gran).label}`}
            subtitle="One line per Closed By value"
            right={metricSwitch}
          >
            <div className="sd-chart">
              <ResponsiveContainer width="100%" height={340}>
                <LineChart data={data.trend[metric]} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="key" tickFormatter={(k) => fmtPeriod(k, gran)} minTickGap={32} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(v) => (metric === 'enrollments' ? int(v) : lakhShort(v))} width={58} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ stroke: 'var(--line-strong)' }} content={<ChartTip labelFmt={(k) => fmtPeriod(k, gran)} valueFmt={(v) => fmtMetric(metric, v)} />} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: 12 }} />
                  {data.closers.map((c) => (
                    <Line isAnimationActive={false} key={c} type="monotone" dataKey={c} stroke={colorFor(c, data.closers)} strokeWidth={2.5} dot={false} activeDot={{ r: 5 }}
                      strokeDasharray={c === 'Not Tagged' ? '5 4' : undefined} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Who sells what" subtitle="Closed By × Program" right={metricSwitch}>
            <div className="sd-table-wrap">
              <table className="sd-tbl">
                <thead>
                  <tr>
                    <th>Closed By</th>
                    {data.programs.map((p) => <th key={p} className="sd-r">{p}</th>)}
                    <th className="sd-r">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.matrix.map((r) => (
                    <tr key={r.closedBy}>
                      <td><span className="sd-dot" style={{ background: colorFor(r.closedBy, data.closers) }} />{r.closedBy}</td>
                      {data.programs.map((p) => (
                        <td key={p} className="sd-r">{r.cells[p][metric] ? fmtMetric(metric, r.cells[p][metric]) : '–'}</td>
                      ))}
                      <td className="sd-r sd-strong">{fmtMetric(metric, r.total[metric])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title={`${GRAN.find((g) => g.key === gran).label} breakdown`} subtitle="Most recent 30 periods" right={metricSwitch}>
            <div className="sd-table-wrap sd-tall">
              <table className="sd-tbl">
                <thead>
                  <tr>
                    <th>Period</th>
                    {data.closers.map((c) => <th key={c} className="sd-r">{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[...data.trend[metric]].reverse().slice(0, 30).map((row) => (
                    <tr key={row.key}>
                      <td>{fmtPeriod(row.key, gran)}</td>
                      {data.closers.map((c) => <td key={c} className="sd-r">{row[c] ? fmtMetric(metric, row[c]) : '–'}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
