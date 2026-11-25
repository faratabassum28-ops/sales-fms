import React, { Suspense, useEffect, useState } from "react";
import { Routes, Route, NavLink, Navigate, useLocation } from "react-router-dom";
import LeadsLogo from "../components/LeadsLogo.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { avatarStyleFromString, initials } from "../utils/colorFromString.js";
import { lazyRetry } from "../utils/lazyRetry.js";
import PageLoader from "../components/PageLoader.jsx";
import RouteBoundary from "../components/RouteBoundary.jsx";
import { LeadsProvider, useLeads } from "./LeadsContext.jsx";
import ShortcutsHelp from "../components/ShortcutsHelp.jsx";
import { useSlashToFocusSearch } from "../hooks/useSlashToFocusSearch.js";
import { isDueToday, tasksOf } from "./leadUtils.js";
import "./leads.css";
import "./sales-theme.css";

const Board = lazyRetry(() => import("./pages/Board.jsx"));
const Reports = lazyRetry(() => import("./pages/Reports.jsx"));
const Dashboard = lazyRetry(() => import("./pages/Dashboard.jsx"));
const Tasks = lazyRetry(() => import("./pages/Tasks.jsx"));
const FollowUps = lazyRetry(() => import("./pages/FollowUps.jsx"));
const LeadList = lazyRetry(() => import("./pages/LeadList.jsx"));
const Activity = lazyRetry(() => import("./pages/Activity.jsx"));
const Performance = lazyRetry(() => import("./pages/Performance.jsx"));
const Team = lazyRetry(() => import("./pages/Team.jsx"));
const Settings = lazyRetry(() => import("./pages/Settings.jsx"));
const Account = lazyRetry(() => import("../pages/Account.jsx"));

// Pages are code-split; once the app is idle the rest are fetched in the background so moving
// between pages feels instant.
const prefetchPages = () => {
  import("./pages/Tasks.jsx"); import("./pages/FollowUps.jsx"); import("./pages/LeadList.jsx");
  import("./pages/Reports.jsx"); import("./pages/Performance.jsx");
};

const I = {
  board: "M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1ZM8 14h3",
  reports: "M4 19h16M7 16V9M12 16V5M17 16v-4",
  perf: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  dashboard: "M3 13h7V3H3v10Zm0 8h7v-6H3v6Zm11 0h7V11h-7v10Zm0-18v6h7V3h-7Z",
  tasks: "M9 11.2 6.8 9l-1.4 1.4L9 14l7-7-1.4-1.4L9 11.2ZM4 20h16",
  followups: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.100 4.200 2 2 0 0 1 4.100 2h3a2 2 0 0 1 2 1.700c.1 1 .4 1.900.7 2.800a2 2 0 0 1-.5 2.100L8.100 9.900a16 16 0 0 0 6 6l1.300-1.300a2 2 0 0 1 2.100-.5c.9.3 1.800.6 2.800.7a2 2 0 0 1 1.700 2Z",
  leads: "M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-3 0-8 1.5-8 4.5V21h16v-2.5c0-3-5-4.5-8-4.5Zm8.500-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  attfu: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM17 11l2 2 4-4",
  attend: "M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1.500a2 2 0 0 0 0 3V15a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1.500a2 2 0 0 0 0-3V9ZM10 7v10",
  activity: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  bookings: "M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4ZM3 6h18M16 10a4 4 0 0 1-8 0",
  payments: "M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7ZM3 10h18M7 15h3",
  team: "M12 12a4.800 4.800 0 1 0 0-9.600 4.800 4.800 0 0 0 0 9.600Zm0 2.400c-3.600 0-9.600 1.800-9.600 5.400V22h19.200v-2.200c0-3.600-6-5.400-9.600-5.400Z",
  settings: "M12 15.500a3.500 3.500 0 1 0 0-7 3.500 3.500 0 0 0 0 7ZM19.400 13a7.400 7.400 0 0 0 .1-1 7.400 7.400 0 0 0-.1-1l2-1.600-2-3.400-2.400 1a7.600 7.600 0 0 0-1.700-1l-.4-2.500H9.100l-.4 2.500a7.600 7.600 0 0 0-1.700 1l-2.400-1-2 3.400 2 1.600a7.400 7.400 0 0 0 0 2L2.600 15l2 3.400 2.400-1a7.600 7.600 0 0 0 1.700 1l.4 2.500h5.800l.4-2.500a7.600 7.600 0 0 0 1.700-1l2.400 1 2-3.400-2-1.600Z",
};

// Lead FMS: sidebar + routes. Admins see everything; callers see their own follow-ups,
// leads, history and reports — the server enforces the same split.
export default function LeadsApp() {
  return (
    <LeadsProvider>
      <Shell />
    </LeadsProvider>
  );
}

function Shell() {
  const { user, logout, isLeadAdmin: admin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { leads, who, now, busy, sync, cfg } = useLeads();
  useSlashToFocusSearch();
  useEffect(() => { const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1200)); idle(prefetchPages); }, []);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("ld-sidebar-collapsed") === "1");
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggleCollapsed = () => setCollapsed((v) => { localStorage.setItem("ld-sidebar-collapsed", v ? "0" : "1"); return !v; });

  const overdue = tasksOf(leads, who, cfg).filter((t) => new Date(t.f.planned) < now).length;
  const eod = new Date(now); eod.setHours(23, 59, 59, 999);
  const pending = tasksOf(leads, who, cfg).filter((t) => new Date(t.f.planned) <= eod);
  const todayCount = pending.filter(isDueToday).length, followCount = pending.length - todayCount;
  // Sales FMS: every lead lands in FU1 straight from the sheet — no Day 1 / Day 2 attendee stages.
  const links = [
    { section: admin ? "Command centre" : "My work" },
    ...(admin ? [{ to: "/board", label: "Daily Board", icon: "board" }] : []),
    ...(admin ? [{ to: "/performance", label: "Team Performance", icon: "perf" }] : []),
    ...(admin ? [{ to: "/reports", label: "Reports", icon: "reports" }] : []),
    { to: "/tasks", label: "Today Follow-ups", icon: "tasks", badge: todayCount },
    { to: "/followups", label: "Delayed Follow-ups", icon: "followups", badge: followCount, tone: "bad" },
    { section: "Pipeline" },
    { to: "/leads", label: "Sales", icon: "leads" },
    ...(!admin ? [{ to: "/reports", label: "My Reports", icon: "reports" }] : []),
    ...(admin ? [{ section: "Admin" }, { to: "/team", label: "Team", icon: "team" }, { to: "/settings", label: "Settings", icon: "settings" }] : []),
  ];
  const { pathname } = useLocation();
  const home = admin ? "board" : "tasks";
  const guard = (el) => (admin ? el : <Navigate to={"/" + home} replace />);

  return (
    <div className={"layout" + (collapsed ? " sidebar-collapsed" : "")}>
      <button type="button" className="mobile-menu-btn" aria-label="Toggle menu" onClick={() => setMobileOpen((v) => !v)}>
        <svg viewBox="0 0 24 24" width="20" height="20"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" /></svg>
      </button>
      {mobileOpen && <div className="sidebar-scrim" onClick={() => setMobileOpen(false)} />}

      <aside className={"sidebar" + (mobileOpen ? " mobile-open" : "")}>
        <div className="sidebar-top">
          <div className="brand">
            <LeadsLogo size={36} />
            {!collapsed && (
              <div className="brand-text">
                <div className="brand-title">Sales FMS</div>
                <div className="brand-sub">Follow-up console</div>
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
            <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme" title="Toggle theme">{theme === "dark" ? "☀" : "☾"}</button>
            <button type="button" className="collapse-btn" onClick={toggleCollapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
              <svg viewBox="0 0 24 24" width="16" height="16" style={{ transform: collapsed ? "rotate(180deg)" : "none" }}>
                <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            </button>
          </div>
        </div>

        <nav>
          {links.map((l, k) => {
            if (l.section) return collapsed ? <div key={"s" + k} className="nav-sep" /> : <div key={"s" + k} className="nav-section">{l.section}</div>;
            const icon = (
              <span className="nav-icon-wrap">
                <svg className="nav-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={I[l.icon]} /></svg>
                {l.badge > 0 && collapsed && <span className="nav-icon-dot" aria-hidden="true" />}
              </span>
            );
            const badge = l.badge > 0 && !collapsed && <span className={"nav-badge" + (l.tone ? " nav-badge-" + l.tone : "")}>{l.badge > 99 ? "99+" : l.badge}</span>;
            return (
              <NavLink key={l.to + l.label} to={l.to} title={collapsed ? l.label : undefined}
                className={({ isActive }) => "nav-link" + (isActive ? " active" : "")} onClick={() => setMobileOpen(false)}>
                {icon}
                {!collapsed && <span className="nav-label">{l.label}</span>}
                {badge}
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-user">
          <NavLink to="/account" className="sidebar-user-link" title={collapsed ? user.name : undefined} onClick={() => setMobileOpen(false)}>
            <span className="avatar" style={avatarStyleFromString(user.name)}>{initials(user.name)}</span>
            {!collapsed && (
              <div className="sidebar-user-info">
                <div className="sidebar-user-name">{user.name}</div>
                <div className="sidebar-user-role">{admin ? "Admin" : "Sales caller"}</div>
              </div>
            )}
          </NavLink>
          <button type="button" className="sidebar-logout" onClick={logout} title="Sign out">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      <main className="content">
        <RouteBoundary>
          <Suspense fallback={<PageLoader />}>
            <div className="ld-topbar">
              {admin
                ? <NavLink to="/followups" className={"ld-overdue" + (overdue ? " has" : "")}><i className="ld-dot" />{overdue} overdue</NavLink>
                : <NavLink to="/tasks" className="ld-overdue ld-overdue-calm">Today Follow-ups</NavLink>}
              {admin && <button type="button" className="ld-btn ld-btn-solid" disabled={busy} onClick={sync}>{busy ? "Importing…" : "⟳ Sync sales sheet"}</button>}
            </div>
            <Routes>
              <Route index element={<Navigate to={home} replace />} />
              <Route path="board" element={guard(<Board />)} />
              <Route path="performance" element={guard(<Performance />)} />
              <Route path="reports" element={<Reports />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="tasks" element={<Tasks />} />
              <Route path="followups" element={<FollowUps />} />
              <Route path="leads" element={<LeadList />} />
              <Route path="activity" element={<Activity />} />
              <Route path="team" element={guard(<Team />)} />
              <Route path="settings" element={guard(<Settings />)} />
              <Route path="account" element={<Account />} />
              <Route path="*" element={<Navigate to={"/" + home} replace />} />
            </Routes>
          </Suspense>
        </RouteBoundary>
      </main>
      <ShortcutsHelp />
    </div>
  );
}
