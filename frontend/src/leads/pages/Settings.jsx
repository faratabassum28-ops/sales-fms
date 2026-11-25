import React, { useCallback, useEffect, useState } from "react";
import PageHeader from "../../components/PageHeader.jsx";
import PageLoader from "../../components/PageLoader.jsx";
import { api } from "../../api.js";
import { useLeads } from "../LeadsContext.jsx";
import { fmt } from "../leadUtils.js";
import { Panel } from "../ui.jsx";

const MAX_FU = 10;
const csv = (s) => s.split(",").map((x) => x.trim()).filter(Boolean);
const Check = ({ checked, onChange, children }) => <label className="ld-check"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {children}</label>;
const Field = ({ label, hint, children }) => <label className="ld-field"><span className="ld-label">{label}</span>{children}{hint && <span className="ld-small">{hint}</span>}</label>;

// Intake sheet, follow-up schedule, statuses and automations.
export default function Settings() {
  const { cfg, load, sync, toast, leads, workshops } = useLeads();
  if (!cfg) return <PageLoader />;
  return <Form key={JSON.stringify(cfg.plan) + JSON.stringify(cfg.assign) + cfg.intakeSheet + cfg.sheetUrl + cfg.sheetToken} cfg={cfg} load={load} sync={sync} toast={toast} leads={leads} workshops={workshops} />;
}

function Form({ cfg, load, sync, toast, leads, workshops }) {
  const [c, setC] = useState(cfg), [st, setSt] = useState(cfg.statuses.join(", ")), [rs, setRs] = useState(cfg.retryStatuses.join(", ")), [cs, setCs] = useState(cfg.closeStatuses.join(", "));
  const [saving, setSaving] = useState(false);
  const [log, setLog] = useState(null), [clearing, setClearing] = useState(false);
  const clearOld = async () => {
    if (!window.confirm("Close ALL calls planned before today that are still not done? This cannot be undone.")) return;
    setClearing(true);
    try { const r = await api.ldClearDelayed(); await load(); toast(`Fresh start done — ${r.leads} old pending calls closed`, "good"); }
    catch (e) { toast(e.message, "bad"); }
    setClearing(false);
  };
  const loadLog = useCallback(() => api.ldImportLog().then(setLog).catch(() => setLog([])), []);
  useEffect(() => { loadLog(); }, [loadLog]);
  // every "import" click ends with the log refreshed — also when the import failed (that is logged too)
  const importNow = async () => { try { await sync(); } finally { await loadLog(); } };
  // follow-up steps (FU1…FU10)
  const [toAll, setToAll] = useState(true);
  const edit = (key, i, k, v) => setC({ ...c, [key]: c[key].map((p, j) => (j === i ? { ...p, [k]: v } : p)) });
  const addStep = (key) => setC({ ...c, [key]: [...c[key], { days: (+c[key][c[key].length - 1]?.days || 0) + 1, time: c[key][c[key].length - 1]?.time || "11:00" }] });
  const dropStep = (key) => setC({ ...c, [key]: c[key].slice(0, -1) });
  const grew = c.plan.length !== cfg.plan.length;
  const full = () => ({ ...c, statuses: csv(st), retryStatuses: csv(rs), closeStatuses: csv(cs), applyToExisting: toAll });
  const save = async (after) => {
    setSaving(true);
    try {
      const r = await api.ldSaveConfig(full()); await load();
      toast(r.addedToLeads ? `Settings saved — follow-ups updated on ${r.addedToLeads} existing leads` : "Settings saved", "good");
      if (after) await after();
    }
    catch (e) { toast(e.message, "bad"); }
    setSaving(false);
  };
  const [test, setTest] = useState(null);
  const newKey = async () => { try { setC({ ...c, sheetToken: (await api.ldSheetKey()).token }); toast("Key made — press Save settings", "good"); } catch (e) { toast(e.message, "bad"); } };
  const copyScript = async () => {
    try { await navigator.clipboard.writeText((await api.ldSheetScript()).code); toast("Script copied — paste it in Apps Script", "good"); }
    catch (e) { toast(e.message.includes("Generate") ? e.message : "Couldn't copy — " + e.message, "bad"); }
  };
  // <input type="datetime-local"> works in local time: convert to / from the saved ISO moment
  const localVal = (iso) => { if (!iso) return ""; const d = new Date(iso); return isNaN(d) ? "" : new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); };
  const runTest = async () => { setTest(null); try { setTest(await api.ldSheetTest({ sheetUrl: c.sheetUrl, sheetToken: c.sheetToken, intakeSheet: c.intakeSheet })); } catch (e) { setTest({ ok: false, error: e.message }); } };
  return (
    <div className="page">
      <PageHeader title="Settings" subtitle="Connect the sales sheet, set the follow-up schedule, assignment and automations" meta={<button type="button" className="ld-btn ld-btn-solid" disabled={saving} onClick={() => save()}>{saving ? "Saving…" : "Save settings"}</button>} />

      <Panel title="📥 Sales sheet → FU1">
        <p className="ld-small" style={{ marginTop: 0 }}>
          <b>The sales team types:</b> Lead Name · Lead Email · Lead Phone · Assigned To · <b>Workshop Date</b> · <b>Workshop Name</b> · <b>WhatsApp Link</b> (Timestamp fills itself).
          Every row goes straight to <b>FU1</b>. A new workshop name gets its own filter on every page automatically.<br />
          <b>The website fills back</b> on the same row: Interest Level · Profession · City · Call Status — as soon as a caller updates the lead.
        </p>
        <div className="ld-steps">
          <div><b>1.</b> Make a secret key <button type="button" className="ld-btn" onClick={newKey}>🔑 Generate key</button> then <b>Save settings</b>.</div>
          <div><b>2.</b> Create a <b>new blank Google Sheet</b> → <i>Extensions → Apps Script</i> → paste the script → run <code>setupSalesSheet</code> (builds the Leads and _Team tabs), then <code>setupInstantSync</code>, then <i>Deploy → New deployment → Web app</i> (Execute as <i>Me</i>, access <i>Anyone</i>) and copy the Web app URL.
            <div className="ld-actions" style={{ marginTop: 8 }}><button type="button" className="ld-btn" disabled={!cfg.sheetToken} onClick={copyScript}>📋 Copy Apps Script</button></div></div>
          <div><b>3.</b> Paste the Web app URL below, save, and press <b>Test connection</b>.</div>
        </div>
        <Field label="Secret key"><input className="ld-input" value={c.sheetToken || ""} onChange={(e) => setC({ ...c, sheetToken: e.target.value.trim() })} placeholder="Press “Generate key”" /></Field>
        <Field label="Google Apps Script Web app URL" hint="Looks like https://script.google.com/macros/s/…/exec. Your sheet stays private — only this link + the secret key can read it.">
          <input className="ld-input" value={c.sheetUrl || ""} placeholder="https://script.google.com/macros/s/…/exec" onChange={(e) => setC({ ...c, sheetUrl: e.target.value })} />
        </Field>
        {test && <div className={"ld-callout " + (test.ok ? "good" : "bad")}>{test.ok
          ? <>✅ Connected — {test.leadsInSheet} lead rows found.{test.missing.length > 0 && <> Missing columns: <b>{test.missing.join(", ")}</b>.</>}</>
          : <>⚠ {test.error}</>}</div>}
        {cfg.lastSync && <p className="ld-small">Last import: {fmt(cfg.lastSync.at)} — {cfg.lastSync.ok ? `${cfg.lastSync.added} new, ${cfg.lastSync.updated} updated` : <span className="ld-bad">{cfg.lastSync.error}</span>}. New rows arrive within seconds (and the site checks the sheet every minute as a backup); every new lead starts in <b>FU1, due now</b>; new rows never duplicate (a lead is matched by phone number, or by email if the phone is new) and blank cells never erase data.</p>}
        <p className="ld-small">Leads with a blank “Assigned To” are shared out by the <b>Automatic assignment</b> panel below.</p>
        <div className="ld-actions" style={{ marginTop: 12 }}>
          <button type="button" className="ld-btn" disabled={saving} onClick={runTest}>Test connection</button>
          <button type="button" className="ld-btn ld-btn-solid" disabled={saving} onClick={() => save(importNow)}>Save &amp; import now</button>
        </div>
        <details style={{ marginTop: 14 }}>
          <summary className="ld-small" style={{ cursor: "pointer" }}>Older option: read-only link (no write-back)</summary>
          <Field label="Google Sheet link" hint="Share as “Anyone with the link – Viewer”. Used only when the Web app URL above is empty. Level / Profession / City cannot be written back this way.">
            <input className="ld-input" value={c.intakeSheet} placeholder="https://docs.google.com/spreadsheets/d/…" onChange={(e) => setC({ ...c, intakeSheet: e.target.value })} />
          </Field>
        </details>
      </Panel>



      <AssignPanel c={c} setC={setC} leads={leads} saving={saving} onReshare={(q) => save(async () => {
        try { const r = await api.ldReshare(q); await load(); toast(r.moved ? `Shared out again — ${r.moved} of ${r.total} open leads moved` : `Nothing to move — all ${r.total} open leads are already split by the ratio`, "good"); }
        catch (e) { toast(e.message, "bad"); }
      })} />

      <Panel title="Follow-up schedule">
        <p className="ld-small" style={{ marginTop: 0 }}>Days after the lead arrives, and the time of day (India time). Add up to {MAX_FU} follow-ups — each one shows up on Today / Delayed Follow-ups as soon as it is due.</p>
        <PlanRows rows={c.plan} label="FU" onEdit={(i, k, v) => edit("plan", i, k, v)} onAdd={() => addStep("plan")} onDrop={() => dropStep("plan")} />
        {grew && <Check checked={toAll} onChange={setToAll}><span>Also add the new follow-up to <b>all existing leads</b> (steps already in the past are scheduled for the next working slot; auto-closed leads stay closed)</span></Check>}
        <div className="ld-row" style={{ marginTop: 10 }}>Working hours
          <input className="ld-input ld-narrow" type="time" value={c.workStart} onChange={(e) => setC({ ...c, workStart: e.target.value })} aria-label="Work start" /> to
          <input className="ld-input ld-narrow" type="time" value={c.workEnd} onChange={(e) => setC({ ...c, workEnd: e.target.value })} aria-label="Work end" /></div>
        <Check checked={c.skipSunday} onChange={(v) => setC({ ...c, skipSunday: v })}>Skip Sundays</Check>
      </Panel>

      <Panel title="Call status options">
        <Field label="Comma separated" hint="These become the one-tap buttons callers see."><input className="ld-input" value={st} onChange={(e) => setSt(e.target.value)} /></Field>
      </Panel>

      <Panel title="⚡ Automations">
        <Field label="Auto-retry: statuses that pull the next follow-up forward"><input className="ld-input" value={rs} onChange={(e) => setRs(e.target.value)} /></Field>
        <Field label="…retry after (hours)"><input className="ld-input ld-narrow" type="number" min="1" value={c.retryHours} onChange={(e) => setC({ ...c, retryHours: +e.target.value })} /></Field>
        <Field label="Auto-close: statuses that cancel the remaining follow-ups (Connected always does, for that follow-up track)"><input className="ld-input" value={cs} onChange={(e) => setCs(e.target.value)} /></Field>
        <Field label="Escalate to admin when a follow-up is overdue by (hours)"><input className="ld-input ld-narrow" type="number" min="1" value={c.escalateHours} onChange={(e) => setC({ ...c, escalateHours: +e.target.value })} /></Field>
        <Field label="WhatsApp message template" hint="Use {name} and {caller}."><input className="ld-input" value={c.waTemplate} onChange={(e) => setC({ ...c, waTemplate: e.target.value })} /></Field>
      </Panel>



      <Panel title="🧹 Fresh start">
        <p className="ld-small" style={{ marginTop: 0 }}>Closes every call that was planned before today and is still not done, so nothing is left over as "delayed". Each lead's next call (today or later) still comes up as normal. This cannot be undone.</p>
        <button type="button" className="ld-btn ld-btn-remove" disabled={clearing} onClick={clearOld}>{clearing ? "Clearing…" : "Clear all old pending calls"}</button>
      </Panel>

      <Panel title="📜 Import log">
        <p className="ld-small" style={{ marginTop: 0 }}>Every time someone imports from the sheet — when, who, and how many leads. The automatic 5-minute check is listed only when it brought in or changed leads.</p>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>When</th><th>Who</th><th>Type</th><th>New leads</th><th>Updated</th><th>Rows in sheet</th><th>Result</th></tr></thead>
            <tbody>
              {(log || []).map((r) => (
                <tr key={r._id}>
                  <td>{new Date(r.at).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}</td>
                  <td><b>{r.by || "—"}</b>{r.byEmail && <div className="ld-small">{r.byEmail}</div>}</td>
                  <td>{r.trigger === "manual" ? "Manual" : "Automatic"}</td>
                  <td><b>{r.added ?? 0}</b></td>
                  <td>{r.updated ?? 0}{r.byEmailMatched > 0 && <div className="ld-small">{r.byEmailMatched} matched by email</div>}</td>
                  <td>{r.rows ?? 0}</td>
                  <td className="ld-logres">{r.ok ? <span className="ld-pill ld-pill-done">Done</span> : <span className="ld-bad">Failed — {r.error}</span>}{r.note && <div className="ld-small">{r.note}</div>}</td>
                </tr>
              ))}
              {log && !log.length && <tr><td colSpan={7} className="empty-state">No imports yet — press “Save &amp; import now”.</td></tr>}
              {!log && <tr><td colSpan={7} className="empty-state">Loading…</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

// one editable list of follow-up steps with "+ Add follow-up" (max 10) and "Remove last"
function PlanRows({ rows, label, onEdit, onAdd, onDrop }) {
  return (
    <>
      {rows.map((p, i) => (
        <div className="ld-row" key={i}>
          <b className="ld-fu-label">{label}{i + 1}</b>
          <input className="ld-input ld-narrow" type="number" min="0" max="365" value={p.days} onChange={(e) => onEdit(i, "days", e.target.value === "" ? "" : +e.target.value)} aria-label={`${label}${i + 1} days`} /> days at
          <input className="ld-input ld-narrow" type="time" value={p.time} onChange={(e) => onEdit(i, "time", e.target.value)} aria-label={`${label}${i + 1} time`} />
        </div>
      ))}
      <div className="ld-actions" style={{ margin: "4px 0 12px" }}>
        <button type="button" className="ld-btn ld-btn-add" disabled={rows.length >= MAX_FU} onClick={onAdd}>＋ Add follow-up</button>
        {rows.length > 1 && <button type="button" className="ld-btn ld-btn-remove" onClick={onDrop}>Remove last</button>}
        <span className="ld-small">{rows.length} of {MAX_FU}</span>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Automatic assignment: how new leads from the sales sheet are handed to callers.
// Off / Manual / Auto, who takes part, their share, and who is present today.
// ---------------------------------------------------------------------------
const QUEUES = [
  ["new", "New leads", "Leads that arrive from the sheet with a blank “Assigned To” — they go straight to FU1"],
];
const HINT = {
  new: { off: "Nothing is shared automatically. New leads keep the sheet's Assigned To, or stay unassigned.", manual: "New leads without an Assigned To wait for an admin to assign them (Leads → select → Assign).", auto: "New leads without an Assigned To are shared out by the ratio below, among the people who are present." },
};
function AssignPanel({ c, setC, leads, saving, onReshare }) {
  const [team, setTeam] = useState(null);
  useEffect(() => { api.ldTeam().then(setTeam).catch(() => setTeam([])); }, []);
  const A = c.assign;
  const people = (team || []).filter((p) => p.active && p.leadName).filter((p, i, a) => a.findIndex((x) => x.leadName.toLowerCase() === p.leadName.toLowerCase()) === i);
  const setQ = (k, patch) => setC({ ...c, assign: { ...A, queues: { ...A.queues, [k]: { ...A.queues[k], ...patch } } } });
  // everyone on the team, merged with what is saved. A column that was never set up starts with every caller ticked.
  const rowsOf = (k) => {
    const saved = A.queues[k].people || [];
    return people.map((p) => saved.find((s) => s.name.toLowerCase() === p.leadName.toLowerCase()) || { name: p.leadName, on: !saved.length && p.role === "caller", share: 1, present: true });
  };
  const roleOf = (n) => people.find((p) => p.leadName.toLowerCase() === n.toLowerCase())?.role;
  const edit = (k, name, patch) => setQ(k, { people: rowsOf(k).map((r) => (r.name === name ? { ...r, ...patch } : r)) });
  // open work per person in each column: nobody has called yet
  const open = (k, name) => {
    const n = name.toLowerCase();
    return (leads || []).filter((l) => k === "new" ? !(l.fus || []).some((f) => f.actual) && (l.assignedTo || "").toLowerCase() === n
      : l["day" + k[1]] && !(l[`d${k[1]}Fus`] || []).some((f) => f.actual) && ((l[`d${k[1]}Assigned`] || l.assignedTo || "").toLowerCase() === n)).length;
  };
  return (
    <Panel title="👥 Automatic assignment">
      <p className="ld-small" style={{ marginTop: 0 }}>Decide how work is handed out. <b>Share</b> is a weight (2 = twice as many as 1), and un-ticking <b>Present</b> stops new work for that person today — for example when they are on leave. Leads an admin assigned by hand are never moved.</p>
      {QUEUES.map(([k, title, sub]) => {
        const q = A.queues[k], rows = rowsOf(k), act = q.mode === "auto" ? rows.filter((r) => r.on && r.present && r.share > 0) : [], tot = act.reduce((s, r) => s + r.share, 0);
        return (
          <div className="ld-aq" key={k}>
            <div className="ld-aq-head">
              <div><b>{title}</b> <span className="ld-small">· {sub}</span></div>
              <div className="ld-seg" role="group" aria-label={title + " mode"}>
                {[["off", "Off"], ["manual", "Manual"], ["auto", "Auto"]].map(([m, t]) => <button key={m} type="button" className={q.mode === m ? "on" : ""} onClick={() => setQ(k, { mode: m, people: rowsOf(k) })}>{t}</button>)}
              </div>
            </div>
            <p className="ld-small ld-aq-hint">{HINT[k][q.mode]}</p>
            {team === null && <div className="ld-small">Loading people…</div>}
            {q.mode !== "off" && rows.map((r) => (
              <div key={r.name} className={"ld-aq-row" + (r.on ? " on" : "")}>
                <label className="ld-aq-who"><input type="checkbox" checked={r.on} disabled={q.mode !== "auto"} onChange={(e) => edit(k, r.name, { on: e.target.checked })} /> <b>{r.name}</b> <span className="ld-small">· {roleOf(r.name) === "admin" ? "admin" : "caller"}</span></label>
                {q.mode === "auto" && r.on && (
                  <>
                    <label className="ld-small">Share <input className="ld-input ld-share" type="number" min="1" max="100" value={r.share} onChange={(e) => edit(k, r.name, { share: e.target.value === "" ? "" : +e.target.value })} onBlur={(e) => !(+e.target.value >= 1) && edit(k, r.name, { share: 1 })} /></label>
                    <label className="ld-check" style={{ margin: 0 }}><input type="checkbox" checked={r.present} onChange={(e) => edit(k, r.name, { present: e.target.checked })} /> Present</label>
                    <span className="ld-count" title="Open now">{open(k, r.name)}</span>
                  </>
                )}
              </div>
            ))}
            {q.mode === "auto" && <div className="ld-aq-ratio">{act.length ? <>Ratio: {act.map((r) => `${r.name} ${Math.round((r.share / tot) * 100)}%`).join(" · ")}</> : <span className="ld-bad">Nobody is ticked and present — new work will stay unassigned.</span>}</div>}
            <div className="ld-actions" style={{ marginTop: 10 }}>
              <button type="button" className="ld-btn" disabled={saving || q.mode !== "auto" || !act.length} onClick={() => onReshare(k)} title="Saves these settings, then re-deals the open work of this column">Share out again</button>
            </div>
          </div>
        );
      })}
      <p className="ld-small">Press <b>Save settings</b> to apply. Callers are matched by their <b>caller name</b> (Team page).</p>
    </Panel>
  );
}
