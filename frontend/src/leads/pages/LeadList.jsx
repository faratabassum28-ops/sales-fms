import React, { useMemo, useState } from "react";
import PageHeader from "../../components/PageHeader.jsx";
import PageLoader from "../../components/PageLoader.jsx";
import SearchInput from "../../components/SearchInput.jsx";
import { api } from "../../api.js";
import { useLeads } from "../LeadsContext.jsx";
import { LBL, delay, downloadCsv, fmt, fuCount, state } from "../leadUtils.js";
import WorkshopBar from "../WorkshopBar.jsx";

// The sheet view: Lead Qualification + Follow-Up 1/2/3, exactly like the old Google Sheet.
export default function LeadList() {
  const { lqLeads: leads, loaded, cfg, callers, now, admin, setModal, load, toast, inWs, openLead, workshops, regOf } = useLeads();
  const [q, setQ] = useState(""), [flt, setFlt] = useState("all"), [doer, setDoer] = useState("all");
  const [sel, setSel] = useState({}), [to, setTo] = useState(""), [add, setAdd] = useState(null), [lim, setLim] = useState(200);
  const [del, setDel] = useState(null); // delete dialog: { sheet: bool, busy: bool }

  const needle = q.trim().toLowerCase();
  const rows = useMemo(
    () => leads.filter((l) =>
      inWs(l) && (doer === "all" || (doer === "none" ? !l.assignedTo : l.assignedTo === doer)) &&
      (!needle || [l.name, admin ? l.phone : "", admin ? l.email : "", l.city, l.workshop].join(" ").toLowerCase().includes(needle)) &&
      (flt === "all" || l.fus.some((f) => state(f, now) === flt))),
    [leads, doer, needle, flt, now, inWs]
  );
  if (!loaded) return <PageLoader />;
  const nFu = fuCount(cfg, leads), steps = Array.from({ length: nFu }, (_, i) => i + 1), gc = (n) => "g" + (((n - 1) % 3) + 1);
  const ids = Object.keys(sel).filter((k) => sel[k]);
  const assign = async () => {
    try { await api.ldBulkAssign(ids, to); setSel({}); await load(); toast(`Assigned ${ids.length} lead${ids.length === 1 ? "" : "s"} to ${to}`, "good"); }
    catch (e) { toast(e.message, "bad"); }
  };
  const doDelete = async () => {
    setDel((d) => ({ ...d, busy: true }));
    try {
      const r = await api.ldBulkDelete(ids, del.sheet);
      setSel({}); setDel(null); await load();
      const sh = r.sheet || {};
      toast(`Deleted ${r.count} lead${r.count === 1 ? "" : "s"}${sh.removed ? ` and ${sh.removed} sheet row${sh.removed === 1 ? "" : "s"}` : ""}`, "good");
      if (sh.error) toast("Leads deleted, but the sheet rows could not be removed: " + sh.error, "bad");
      else if (sh.skipped) toast(`${sh.skipped} phone number${sh.skipped === 1 ? " is" : "s are"} used by another registration, so its sheet row was kept`, "good");
    } catch (e) { setDel(null); toast(e.message, "bad"); }
  };
  const saveLead = async () => {
    try { await api.ldAddLead(add); setAdd(null); await load(); toast("Lead added", "good"); }
    catch (e) { toast(e.message, "bad"); }
  };
  return (
    <div className="page">
      <PageHeader title="Sales" subtitle="Every lead from the sales sheet, with each follow-up step and its outcome"
        meta={<div className="ld-actions"><span className="chip"><strong>{rows.length}</strong> leads</span>
          <button type="button" className="ld-btn" onClick={() => downloadCsv("leads.csv", [["Lead", ...(admin ? ["Phone"] : []), "Caller", "Workshop", "City", ...steps.map((n) => "FU" + n)], ...rows.map((l) => [l.name, ...(admin ? [l.phone] : []), l.assignedTo, l.workshop, l.city, ...steps.map((n) => l.fus[n - 1]?.status || "")])])}>⬇ CSV</button>
          {admin && <button type="button" className="ld-btn ld-btn-solid" onClick={() => setAdd({})}>＋ Add lead</button>}</div>} />
      <div className="toolbar">
        <SearchInput value={q} onChange={setQ} placeholder={admin ? "Search name, phone, city, workshop…" : "Search name, city or workshop…"} />
        <div className="filter-row">
          {admin && <select value={doer} onChange={(e) => setDoer(e.target.value)}><option value="all">All callers</option><option value="none">Unassigned</option>{callers.map((d) => <option key={d}>{d}</option>)}</select>}
          <select value={flt} onChange={(e) => setFlt(e.target.value)}><option value="all">All follow-ups</option><option value="over">Has overdue</option><option value="wait">Has upcoming</option><option value="done">Has done</option></select>
        </div>
      </div>
      {del && (
        <div className="modal-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget && !del.busy) setDel(null); }}>
          <div className="modal ld-del" role="dialog" aria-modal="true" aria-label="Delete leads">
            <h3>Delete {ids.length} lead{ids.length === 1 ? "" : "s"}?</h3>
            <p className="ld-small">Their follow-ups and call history are deleted too. This cannot be undone.</p>
            <label className="ld-del-check">
              <input type="checkbox" checked={del.sheet} onChange={(e) => setDel({ ...del, sheet: e.target.checked })} />
              <span><b>Also remove them from the Google Sheet</b><br /><span className="ld-small">Recommended. A row left in the sheet would be imported again at the next sync.</span></span>
            </label>
            <div className="ld-actions" style={{ justifyContent: "flex-end", marginTop: 16 }}>
              <button type="button" className="ld-btn" disabled={del.busy} onClick={() => setDel(null)}>Cancel</button>
              <button type="button" className="ld-btn ld-btn-danger" disabled={del.busy} onClick={doDelete}>{del.busy ? "Deleting…" : `Delete ${ids.length}`}</button>
            </div>
          </div>
        </div>
      )}
      <WorkshopBar items={leads} />
      {ids.length > 0 && (
        <div className="ld-bulk"><b>{ids.length} selected</b>
          <select value={to} onChange={(e) => setTo(e.target.value)}><option value="">Assign to…</option>{callers.map((c) => <option key={c}>{c}</option>)}</select>
          <button type="button" className="ld-btn ld-btn-solid" disabled={!to} onClick={assign}>Assign</button>
          <button type="button" className="ld-btn" onClick={() => setSel({})}>Clear</button>
          <button type="button" className="ld-btn ld-btn-danger" onClick={() => setDel({ sheet: true, busy: false })}>🗑 Delete {ids.length}</button></div>
      )}
      <div className="table-wrap">
        <table className="table ld-sheet">
          <thead>
            <tr><th colSpan={admin ? 15 : 12} className="g0">Lead Qualification</th>{steps.map((n) => <th key={n} colSpan={5} className={gc(n)}>Follow-Up {n}{cfg?.plan?.[n - 1] ? ` · planned ${cfg.plan[n - 1].time}` : ""}</th>)}</tr>
            <tr>
              {admin && <th><input type="checkbox" aria-label="Select all shown" onChange={(e) => setSel(e.target.checked ? Object.fromEntries(rows.slice(0, lim).map((l) => [l._id, 1])) : {})} /></th>}
              {["Timestamp", "Lead Name", ...(admin ? ["Phone", "Email"] : []), "Assigned To", "Workshop", "Workshop Date", "Current Status", "Level", "Profession", "City"].map((h) => <th key={h}>{h}</th>)}
              {steps.flatMap((n) => ["Planned", "Actual", "Status", "Action", "Delay"].map((h) => <th key={n + h} className={gc(n)}>{h}</th>))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, lim).map((l) => {
              const cur = [...l.fus].reverse().find((f) => f.status)?.status || "—";
              return (
                <tr key={l._id}>
                  {admin && <td><input type="checkbox" checked={!!sel[l._id]} onChange={(e) => setSel({ ...sel, [l._id]: e.target.checked })} aria-label={"Select " + l.name} /></td>}
                  <td>{fmt(l.ts)}</td><td><button type="button" className="ld-namebtn" onClick={() => openLead(l)} title="See this lead's history"><b>{l.name}</b></button>{regOf(l).of > 1 && <span className="ld-reg" title="This person registered more than once — each registration is its own row">#{regOf(l).n} of {regOf(l).of}</span>}</td>{admin && <><td>{l.phone}</td><td>{l.email}</td></>}
                  <td>{l.assignedTo || <span className="ld-pill ld-pill-over">Unassigned</span>}</td>
                  <td>{l.workshop ? <span className="ld-ws">{l.workshop}</span> : "—"}</td>
                  <td>{l.utwDate || "—"}</td>
                  <td>{cur}</td><td>{l.level}</td><td>{l.profession}</td><td>{l.city}</td>
                  {steps.map((n) => {
                    const i = n - 1, f = l.fus[i];
                    if (!f) return <React.Fragment key={i}><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td></React.Fragment>;
                    const s = state(f, now), d = delay(f, now);
                    return (
                      <React.Fragment key={i}>
                        <td>{fmt(f.planned)}</td><td>{fmt(f.actual)}</td>
                        <td><span className={"ld-pill ld-pill-" + s}>{f.status || (f.skipped && !f.planned ? "—" : LBL[s])}</span></td>
                        <td><button type="button" className="link-btn" onClick={() => setModal({ l, n: i + 1 })}>📝 Update</button></td>
                        <td className={d ? "ld-bad" : ""}>{d || "—"}</td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={30} className="empty-state">No leads match.</td></tr>}
          </tbody>
        </table>
      </div>
      {rows.length > lim && (
        <div className="ld-more"><span className="ld-small">Showing {lim} of {rows.length}</span>
          <button type="button" className="ld-btn" onClick={() => setLim(lim + 300)}>Show 300 more</button>
          <button type="button" className="ld-btn" onClick={() => setLim(rows.length)}>Show all</button></div>
      )}
      {add && (
        <div className="modal-scrim" onClick={() => setAdd(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><div><h3>Add lead</h3><p className="modal-sub">All follow-ups in your schedule are planned automatically.</p></div><button type="button" className="modal-x" onClick={() => setAdd(null)}>×</button></div>
            {["name", "phone", "email", "city", "profession", "level", "workshop"].map((k) => (
              <label className="modal-field" key={k}>{k[0].toUpperCase() + k.slice(1)}{["name", "phone"].includes(k) ? " *" : ""}
                <input list={k === "workshop" ? "ld-add-ws" : undefined} value={add[k] || ""} onChange={(e) => setAdd({ ...add, [k]: e.target.value })} /></label>
            ))}
            <datalist id="ld-add-ws">{workshops.map((w) => <option key={w.name} value={w.name} />)}</datalist>
            <label className="modal-field">Caller
              <select value={add.assignedTo || ""} onChange={(e) => setAdd({ ...add, assignedTo: e.target.value })}><option value="">Auto-assign / unassigned</option>{callers.map((c) => <option key={c}>{c}</option>)}</select></label>
            <div className="modal-actions"><button type="button" className="btn-ghost" onClick={() => setAdd(null)}>Cancel</button><button type="button" className="ld-btn ld-btn-solid" onClick={saveLead}>Save lead</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
