import React, { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "../../components/PageHeader.jsx";
import PageLoader from "../../components/PageLoader.jsx";
import { api } from "../../api.js";
import { avatarStyleFromString, initials } from "../../utils/colorFromString.js";
import { useLeads } from "../LeadsContext.jsx";
import { Stats, Panel, Empty } from "../ui.jsx";

// ---- India-time calendar helpers (same approach as Team Performance) ----
const IST = 330 * 60000;
const ymd = (ms) => new Date(ms + IST).toISOString().slice(0, 10);
const addDays = (s, n) => ymd(new Date(s + "T00:00:00Z").getTime() - IST + n * 864e5);
const monday = (s) => addDays(s, -((new Date(s + "T00:00:00Z").getUTCDay() + 6) % 7));
const PRESETS = [
  ["today", "Today", (t) => [t, t]],
  ["yesterday", "Yesterday", (t) => [addDays(t, -1), addDays(t, -1)]],
  ["week", "This week", (t) => [monday(t), t]],
  ["month", "This month", (t) => [t.slice(0, 8) + "01", t]],
  ["last30", "Last 30 days", (t) => [addDays(t, -29), t]],
];
const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const lakh = (n) => (n >= 1e5 ? "₹" + (n / 1e5).toFixed(2) + " L" : inr(n));
const pc = (v) => (v == null ? "—" : v + "%");
const hrs = (h) => (h == null ? "—" : h < 1 ? Math.round(h * 60) + " min" : h + " h");

// the stages a lead can be in, in the order of a healthy pipeline (left → right)
const STAGES = [
  ["untouched", "Not called yet", "#94a3b8"],
  ["noAnswer", "No answer", "#f59e0b"],
  ["callback", "Callback / later", "#6366f1"],
  ["badNumber", "Wrong / invalid number", "#a16207"],
  ["notInterested", "Not interested", "#ef4444"],
  ["connected", "Connected", "#10b981"],
];
const HEALTH = { good: ["On track", "good"], attention: ["Needs attention", "bad"], idle: ["No leads", "idle"] };

function Funnel({ r }) {
  if (!r.total) return <div className="as-funnel as-funnel-empty" />;
  return (
    <div className="as-funnel" role="img" aria-label="Where this person's leads are">
      {STAGES.map(([k, label, c]) => r[k] > 0 && <i key={k} title={`${label}: ${r[k]}`} style={{ width: (r[k] / r.total) * 100 + "%", background: c }} />)}
    </div>
  );
}

// 14-day assignment sparkline (CSS bars)
function Spark({ values }) {
  const v = values?.length ? values : Array(14).fill(0), mx = Math.max(1, ...v);
  return <span className="as-spark" aria-hidden="true">{v.map((n, i) => <i key={i} style={{ height: 3 + (n / mx) * 21 + "px", opacity: n ? 1 : 0.28 }} />)}</span>;
}

function PersonCard({ r, share, hasRevenue }) {
  const [label, tone] = HEALTH[r.health];
  return (
    <article className={"as-card as-" + tone}>
      <header>
        <span className="avatar" style={avatarStyleFromString(r.name)}>{initials(r.name)}</span>
        <div><b>{r.name}</b><small>{r.admin ? "Admin" : "Caller"} · {share}% of all assigned leads</small></div>
        <span className={"as-pill as-pill-" + tone}>{label}</span>
      </header>

      <div className="as-nums">
        <div><strong>{r.inRange}</strong><span>assigned in period</span></div>
        <div><strong>{r.total}</strong><span>total owned</span></div>
        <div className="as-spark-wrap"><Spark values={r.spark} /><span>last 14 days</span></div>
      </div>

      <Funnel r={r} />
      <ul className="as-legend">
        {STAGES.map(([k, label, c]) => <li key={k} className={r[k] ? "" : "zero"}><i style={{ background: c }} />{label}<b>{r[k]}</b></li>)}
      </ul>

      <dl className="as-metrics">
        <div><dt>Contacted</dt><dd>{pc(r.contactPct)}</dd></div>
        <div><dt>Connect rate</dt><dd>{pc(r.connectPct)}</dd></div>
        <div><dt>Hot leads</dt><dd>{r.hot}</dd></div>
        <div><dt>1st call in</dt><dd>{hrs(r.avgFirstCallH)}</dd></div>
        {hasRevenue && <div><dt>Closed</dt><dd>{r.closed ? r.closed.enrollments : "—"}</dd></div>}
      </dl>

      {(r.overdue > 0 || r.stale > 0) && (
        <footer>
          {r.overdue > 0 && <span className="as-alert">⏰ {r.overdue} overdue call{r.overdue === 1 ? "" : "s"}</span>}
          {r.stale > 0 && <span className="as-alert">📵 {r.stale} untouched for 24 h+</span>}
        </footer>
      )}
    </article>
  );
}

// Admin: assignment tracker — who got how many leads, how far each has got, and what came of them.
export default function Assignments() {
  const { toast } = useLeads();
  const [range, setRange] = useState(null), [preset, setPreset] = useState("today"), [d, setD] = useState(null), [sort, setSort] = useState("inRange");
  const load = useCallback((r) => {
    api.ldAssignments(r?.[0] || "", r?.[1] || "").then((x) => { setD(x); setRange((p) => p || [x.from, x.to]); }).catch((e) => toast(e.message, "bad"));
  }, []);
  useEffect(() => { load(null); }, [load]);
  const pick = (k, fn) => { const r = fn(d?.today || ymd(Date.now())); setPreset(k); setRange(r); setD(null); load(r); };
  const custom = (i, v) => { if (!v) return; const r = i ? [range[0], v] : [v, range[1]]; if (r[1] < r[0]) r[i ? 0 : 1] = v; setPreset("custom"); setRange(r); setD(null); load(r); };

  const rows = useMemo(() => (d ? d.rows.map((r) => ({ ...r, closedN: r.closed?.enrollments ?? null })).sort((a, b) => (b[sort] ?? -1) - (a[sort] ?? -1) || b.total - a.total) : []), [d, sort]);
  if (!d) return (<div className="page"><PageHeader title="Assignment Tracker" subtitle="Who got how many leads, how far each has got, and how they are turning out" /><PageLoader /></div>);
  const t = d.team, u = d.unassigned, active = d.rows.filter((r) => r.total > 0);
  const hasRevenue = d.revenueMatched > 0;
  const maxDay = Math.max(1, ...d.daily.map((x) => x.assigned));
  const th = (k, label, cls = "n") => <th className={cls + (sort === k ? " as-sorted" : "")}><button type="button" onClick={() => setSort(k)} title="Sort high → low">{label}{sort === k ? " ↓" : ""}</button></th>;

  return (
    <div className="page">
      <PageHeader title="Assignment Tracker" subtitle="Who got how many leads, how far each has got, and how they are turning out" />
      <div className="pf-bar">
        {PRESETS.map(([k, label, fn]) => <button key={k} type="button" className={"pf-pill" + (preset === k ? " on" : "")} onClick={() => pick(k, fn)}>{label}</button>)}
        <span className="pf-dates">From <input type="date" value={range?.[0] || ""} max={d.today} onChange={(e) => custom(0, e.target.value)} />
          To <input type="date" value={range?.[1] || ""} max={d.today} onChange={(e) => custom(1, e.target.value)} /></span>
        <span className="pf-meta"><span>{d.from === d.to ? d.from : `${d.from} → ${d.to}`} (IST)</span>
          <button type="button" className="ld-btn" onClick={() => { setD(null); load(range); }}>Refresh</button></span>
      </div>

      <Stats items={[
        ["Assigned in period", t.inRange, "accent", `${t.today} today`],
        ["Total with callers", t.total, "", `${active.length} active ${active.length === 1 ? "person" : "people"}`],
        ["Waiting for an owner", u.total, u.total ? "neutral" : "", u.total ? "assign from the Sales page" : "everything is assigned"],
        ["Contacted", pc(t.contactPct), "good", `${t.contacted} of ${t.total} leads called`],
        ["Connect rate", pc(t.connectPct), "good", `${t.connected} connected`],
        ["Overdue now", t.overdue, t.overdue ? "bad" : "", t.stale ? `${t.stale} leads untouched 24 h+` : "no stale leads"],
      ]} />

      <div className="as-grid">
        {rows.filter((r) => r.total > 0 || r.inRange > 0).map((r) => <PersonCard key={r.name} r={r} hasRevenue={hasRevenue} share={t.total ? Math.round((r.total / t.total) * 100) : 0} />)}
        {!active.length && <Empty>No leads are assigned to anyone yet. New sheet rows are shared out automatically; you can also assign from the Sales page.</Empty>}
      </div>

      <Panel title="Side by side" className="as-table-panel">
        <p className="ld-small" style={{ margin: "0 0 10px" }}>Click a column heading to sort. “Total” and the stage columns cover every lead the person currently owns; “In period” counts leads assigned within the dates above.</p>
        <div className="table-wrap ld-flush"><table className="table as-table">
          <thead><tr>
            <th>Person</th>{th("inRange", "In period")}{th("total", "Total")}{th("untouched", "Not called")}{th("contactPct", "Contacted")}{th("connectPct", "Connect rate")}
            {th("hot", "Hot")}{th("warm", "Warm")}{th("cold", "Cold")}{th("overdue", "Overdue")}
            {hasRevenue && <>{th("closedN", "Closed")}<th className="n">Revenue</th></>}
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td><div className="pf-person"><span className="avatar" style={avatarStyleFromString(r.name)}>{initials(r.name)}</span><div><b>{r.name}</b><small>{HEALTH[r.health][0]}</small></div></div></td>
                <td className="n"><b>{r.inRange}</b></td><td className="n">{r.total}</td>
                <td className={"n " + (r.untouched ? "" : "pf-mute")}>{r.untouched}</td>
                <td className="n">{pc(r.contactPct)}</td><td className="n">{pc(r.connectPct)}</td>
                <td className="n">{r.hot}</td><td className="n">{r.warm}</td><td className="n">{r.cold}</td>
                <td className={"n " + (r.overdue ? "pf-no" : "pf-mute")}>{r.overdue}</td>
                {hasRevenue && <><td className="n">{r.closed ? r.closed.enrollments : "—"}</td><td className="n">{r.closed ? lakh(r.closed.programFee) : "—"}</td></>}
              </tr>
            ))}
            <tr className="team"><td>Team</td><td className="n">{t.inRange}</td><td className="n">{t.total}</td><td className="n">{t.untouched}</td><td className="n">{pc(t.contactPct)}</td><td className="n">{pc(t.connectPct)}</td>
              <td className="n">{t.hot}</td><td className="n">{t.warm}</td><td className="n">{t.cold}</td><td className="n">{t.overdue}</td>
              {hasRevenue && <><td className="n">{d.rows.reduce((s, r) => s + (r.closed?.enrollments || 0), 0)}</td><td className="n">{lakh(d.rows.reduce((s, r) => s + (r.closed?.programFee || 0), 0))}</td></>}
            </tr>
          </tbody>
        </table></div>
        {!hasRevenue && <p className="ld-small" style={{ margin: "10px 0 0" }}>Revenue closed per person appears here when the “Closed By” names in the Sales Dashboard sheet match your callers’ names.</p>}
      </Panel>

      <Panel title="Leads assigned per day" className="as-days-panel">
        <div className="as-days">
          {d.daily.map((x) => (
            <div key={x.date} className={"as-day" + (x.date === d.today ? " today" : "")} title={`${x.date}: ${x.assigned} assigned`}>
              <span className="as-day-n">{x.assigned || ""}</span>
              <i style={{ height: 6 + (x.assigned / maxDay) * 110 + "px", opacity: x.assigned ? 1 : 0.25 }} />
              <small>{x.date.slice(8)}/{x.date.slice(5, 7)}</small>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
