import React, { useState } from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import PageHeader from "../components/PageHeader.jsx";
import { api as mainApi } from "../api.js";
import { useLeads } from "../leads/LeadsContext.jsx";
import { FilterProvider, useFilters } from "./FilterContext.jsx";
import FilterBar from "./components/FilterBar.jsx";
import { SyncLine } from "./components/ui.jsx";
import Overview from "./pages/Overview.jsx";
import Programs from "./pages/Programs.jsx";
import BestPeriods from "./pages/BestPeriods.jsx";
import Team from "./pages/Team.jsx";
import "./sales-dashboard.css";

// Revenue side of the business, read from the Students Records → Dashboard sheet (admin only).
// Lives at /revenue/* inside the Sales FMS shell; four tabs, one shared filter bar.
const TABS = [
  ["", "Sales Overview", true],
  ["programs", "Program Performance"],
  ["best-periods", "Best Periods"],
  ["team", "Closer Performance"],
];

function Inner() {
  const { toast } = useLeads();
  const { meta, metaError, rev, refresh } = useFilters();
  const { pathname } = useLocation();
  const [syncing, setSyncing] = useState(false);

  const syncNow = async () => {
    setSyncing(true);
    try {
      const r = await mainApi.sdSync();
      toast(`Synced ${r.stats?.kept ?? ""} enrollments from the sheet`, "good");
      refresh();
    } catch (e) { toast(e.message, "bad"); }
    setSyncing(false);
  };

  return (
    <div className="page sd">
      <PageHeader
        title="Sales Dashboard"
        subtitle="Enrollments, revenue and collections from the Students Records sheet — refreshed every morning."
        meta={(
          <div className="sd-sync">
            <SyncLine meta={meta} />
            <button type="button" className="ld-btn" onClick={syncNow} disabled={syncing}>{syncing ? "Syncing…" : "⟳ Refresh now"}</button>
          </div>
        )}
      />

      <div className="sd-tabs" role="tablist" aria-label="Sales dashboard pages">
        {TABS.map(([to, label, end], i) => (
          <NavLink key={to} to={"/revenue" + (to ? "/" + to : "")} end={!!end} className={({ isActive }) => "sd-tab" + (isActive ? " sd-tab-on" : "")}>
            <span className="sd-num">{i + 1}</span>{label}
          </NavLink>
        ))}
      </div>

      {metaError && <div className="sd-notice sd-error">Cannot reach the dashboard API: {metaError.message}</div>}
      {meta && meta.rowCount === 0 && (
        <div className="sd-notice">
          No data yet. The first sync runs when the server starts{meta.lastError ? ` (last error: ${meta.lastError.message})` : ""}.
          Share the sheet with your Google service account (or as “Anyone with the link can view”), then press <b>Refresh now</b>.
        </div>
      )}

      <FilterBar showClosers={pathname.endsWith("/team")} />

      <Routes key={rev}>
        <Route index element={<Overview />} />
        <Route path="programs" element={<Programs />} />
        <Route path="best-periods" element={<BestPeriods />} />
        <Route path="team" element={<Team />} />
      </Routes>
    </div>
  );
}

export default function SalesDashboard() {
  return <FilterProvider><Inner /></FilterProvider>;
}
