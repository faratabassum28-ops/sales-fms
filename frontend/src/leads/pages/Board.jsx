import React, { useEffect, useMemo, useState } from "react";
import PageLoader from "../../components/PageLoader.jsx";
import { usePolling } from "../../hooks/usePolling.js";
import { api } from "../../api.js";
import { avatarStyleFromString, initials } from "../../utils/colorFromString.js";
import { useLeads } from "../LeadsContext.jsx";
import { Stats, Panel, Empty } from "../ui.jsx";

const todayLabel = () => new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
const pct = (a, b) => (a + b ? Math.round((a / (a + b)) * 100) : 100);

// Completion ring (done ÷ done + still waiting)
function Ring({ value, size = 112 }) {
  const r = (size - 14) / 2, c = 2 * Math.PI * r;
  return (
    <svg className="bd-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${value}% of today's calls done`}>
      <circle cx={size / 2} cy={size / 2} r={r} className="bd-ring-bg" />
      <circle cx={size / 2} cy={size / 2} r={r} className="bd-ring-fg" strokeDasharray={c} strokeDashoffset={c - (c * value) / 100} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dy=".1em" textAnchor="middle" className="bd-ring-num">{value}%</text>
      <text x="50%" y="50%" dy="1.9em" textAnchor="middle" className="bd-ring-sub">done</text>
    </svg>
  );
}

// Admin landing page: who is working on what today, escalations, and the nightly history.
export default function Board() {
  const { toast } = useLeads();
  const [d, setD] = useState(null), [h, setH] = useState([]);
  const load = () => { api.ldToday().then(setD).catch((e) => toast(e.message, "bad")); api.ldDaily(14).then(setH).catch(() => {}); };
  useEffect(load, []);
  usePolling(load, 60000);
  const rows = useMemo(() => (d ? [...d.rows].sort((a, b) => b.overdue - a.overdue || b.done - a.done) : []), [d]);
  if (!d) return <PageLoader />;
  const T = (k, rs = d.rows) => rs.reduce((s, r) => s + r[k], 0);
  const done = T("done"), due = T("due"), over = T("overdue"), esc = T("escalated"), cb = T("callbacks");
  const maxCalls = Math.max(1, ...h.map((x) => T("done", x.data.rows)));
  return (
    <div className="page">
      <section className="bd-hero">
        <div className="bd-hero-text">
          <span className="bd-eyebrow"><i className="ld-dot ld-dot-good" /> Live · refreshes every minute</span>
          <h1>Daily Board</h1>
          <p>{todayLabel()} — every new sales-sheet lead starts in FU1 and lands on a caller's Today Follow-ups.</p>
          <div className="bd-hero-stats">
            <div><b>{d.newToday}</b><span>new leads today</span></div>
            <div><b>{done}</b><span>calls done</span></div>
            <div><b>{due}</b><span>still waiting</span></div>
            <div className={over ? "warn" : ""}><b>{over}</b><span>overdue</span></div>
          </div>
        </div>
        <Ring value={pct(done, due)} />
      </section>

      <Stats items={[["New leads today", d.newToday, "accent"], ["Unassigned", d.unassigned, d.unassigned ? "neutral" : "", d.unassigned ? "needs a caller" : "all assigned"], ["Calls due today", due], ["Done today", done, "good"], ["Overdue", over, over ? "bad" : ""], ["Escalated", esc, esc ? "bad" : "", cb ? cb + " callbacks planned" : ""]]} />

      <div className="bd-grid">
        <Panel title="Caller floor" className="bd-floor-panel">
          {rows.length ? (
            <div className="bd-floor">
              {rows.map((r) => {
                const p = pct(r.done, r.due);
                return (
                  <article key={r.caller} className={"bd-caller" + (r.overdue ? " has-over" : "")}>
                    <header>
                      <span className="avatar" style={avatarStyleFromString(r.caller)}>{initials(r.caller)}</span>
                      <div><b>{r.caller}</b><span>{r.leads} leads</span></div>
                      <em className={p >= 100 ? "full" : p >= 50 ? "mid" : "low"}>{p}%</em>
                    </header>
                    <div className="ld-track ld-track-sm"><i className="ld-fill-good" style={{ width: p + "%" }} /></div>
                    <dl>
                      <div><dt>Due</dt><dd>{r.due}</dd></div>
                      <div><dt>Done</dt><dd>{r.done}</dd></div>
                      <div className={r.overdue ? "bad" : ""}><dt>Overdue</dt><dd>{r.overdue}</dd></div>
                      <div><dt>Callbacks</dt><dd>{r.callbacks}</dd></div>
                    </dl>
                  </article>
                );
              })}
            </div>
          ) : <Empty>No leads yet — add rows to the sales sheet or press “Sync sales sheet”.</Empty>}
        </Panel>

        <Panel title="Escalations" className="bd-esc-panel">
          {d.escalations.length ? (
            <ul className="bd-esc">
              {d.escalations.map((e, i) => (
                <li key={i}>
                  <span className="avatar" style={avatarStyleFromString(e.caller || "?")}>{initials(e.caller || "?")}</span>
                  <div><b>{e.name}</b><span>{e.caller} · {e.phone}</span></div>
                  <span className="ld-pill ld-pill-over">FU{e.step} · {e.hours}h late</span>
                </li>
              ))}
            </ul>
          ) : <Empty>Nothing escalated — the team is on top of it.</Empty>}
        </Panel>
      </div>

      <Panel title="Daily history" actions={<button type="button" className="ld-btn" onClick={async () => { await api.ldSnapshot(); load(); toast("Saved today's snapshot", "good"); }}>Save today now</button>}>
        <p className="ld-small" style={{ margin: "0 0 12px" }}>Saved automatically every night and kept forever.</p>
        {h.length ? (
          <div className="table-wrap ld-flush"><table className="table">
            <thead><tr><th>Date</th><th>New leads</th><th>Calls done</th><th></th><th>Overdue</th><th>Escalated</th></tr></thead>
            <tbody>{h.map((x) => { const dn = T("done", x.data.rows); return (
              <tr key={x.date}><td><b>{x.date}</b></td><td>{x.data.newToday}</td><td>{dn}</td>
                <td className="bd-spark"><i style={{ width: (dn / maxCalls) * 100 + "%" }} /></td>
                <td className={T("overdue", x.data.rows) ? "ld-bad" : ""}>{T("overdue", x.data.rows)}</td><td>{T("escalated", x.data.rows)}</td></tr>
            ); })}</tbody>
          </table></div>
        ) : <Empty>History starts after the first nightly save (or press “Save today now”).</Empty>}
      </Panel>
    </div>
  );
}
