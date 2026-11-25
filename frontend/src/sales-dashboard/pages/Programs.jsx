import { useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useApi } from '../api.js';
import { useFilters } from '../FilterContext.jsx';
import { Card, ChartTip, CollectPill, NewBadge, Status, Switch } from '../components/ui.jsx';
import {
  fmtMetric, fmtMonth, int, lakh, lakhShort, PALETTE, pct,
} from '../format.js';

const MET = [{ key: 'programFee', label: 'Program Fee' }, { key: 'enrollments', label: 'Enrollments' }];

export default function Programs() {
  const { filters } = useFilters();
  const { data, loading, error } = useApi('/programs', { from: filters.from, to: filters.to, programs: filters.programs });
  const [metric, setMetric] = useState('programFee');
  const maxFee = Math.max(1, ...(data?.table || []).map((r) => r.programFee));

  return (
    <>
      <Status loading={loading} error={error} empty={!data} />
      {data && (
        <div className={loading ? 'sd-fading' : ''}>
          <Card title="By Program" subtitle="Selected date range">
            <div className="sd-table-wrap">
              <table className="sd-tbl">
                <thead>
                  <tr>
                    <th>Program</th>
                    <th className="sd-r">Enrollments <NewBadge /></th>
                    <th className="sd-r">Program Fee</th>
                    <th className="sd-r">Booking Amount</th>
                    <th className="sd-r">Amount Received</th>
                    <th className="sd-r">Amount Due</th>
                    <th className="sd-r">Collection % <NewBadge /></th>
                    <th className="sd-r">Avg Program Fee <NewBadge /></th>
                    <th className="sd-r">Pymt Status: Received</th>
                    <th className="sd-r">Pymt Status: Due</th>
                  </tr>
                </thead>
                <tbody>
                  {data.table.map((r) => (
                    <tr key={r.program}>
                      <td className="sd-strong">{r.program}</td>
                      <td className="sd-r">{int(r.enrollments)}</td>
                      <td className="sd-r sd-bar-cell" style={{ '--w': `${(r.programFee / maxFee) * 100}%` }}><span>{lakh(r.programFee)}</span></td>
                      <td className="sd-r">{lakh(r.bookingAmount)}</td>
                      <td className="sd-r">{lakh(r.amountReceived)}</td>
                      <td className="sd-r">{lakh(r.amountDue)}</td>
                      <td className="sd-r"><CollectPill value={r.collectionPct} /></td>
                      <td className="sd-r">{lakh(r.avgProgramFee)}</td>
                      <td className="sd-r">{int(r.pymtReceived)}</td>
                      <td className="sd-r">{int(r.pymtDue)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>{data.total.program}</td>
                    <td className="sd-r">{int(data.total.enrollments)}</td>
                    <td className="sd-r">{lakh(data.total.programFee)}</td>
                    <td className="sd-r">{lakh(data.total.bookingAmount)}</td>
                    <td className="sd-r">{lakh(data.total.amountReceived)}</td>
                    <td className="sd-r">{lakh(data.total.amountDue)}</td>
                    <td className="sd-r">{pct(data.total.collectionPct)}</td>
                    <td className="sd-r">{lakh(data.total.avgProgramFee)}</td>
                    <td className="sd-r">{int(data.total.pymtReceived)}</td>
                    <td className="sd-r">{int(data.total.pymtDue)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          <Card
            title="Month-wise by Program"
            subtitle="Stacked"
            right={<Switch options={MET} value={metric} onChange={setMetric} />}
          >
            <div className="sd-chart">
              <ResponsiveContainer width="100%" height={380}>
                <BarChart data={data.monthlyByProgram[metric]} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="key" tickFormatter={fmtMonth} minTickGap={24} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(v) => (metric === 'enrollments' ? int(v) : lakhShort(v))} width={58} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: 'var(--accent-light)' }} content={<ChartTip labelFmt={fmtMonth} valueFmt={(v) => fmtMetric(metric, v)} />} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: 12 }} />
                  {data.programs.map((p, i) => (
                    <Bar isAnimationActive={false} key={p} dataKey={p} stackId="a" fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
