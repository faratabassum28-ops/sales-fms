import express from "express";
import { config } from "./config.js";
import { getState } from "./store.js";
import { runSync, lastError } from "./sync.js";
import { applyFilters, overview, programPerformance, bestPeriods, teamPerformance, GRANULARITIES } from "./lib/analytics.js";

// Mounted at /api/sales-dashboard behind requireAuth. Admins only: it shows revenue and every closer's numbers.
const router = express.Router();
router.use((req, res, next) => (req.user?.role === "admin" ? next() : res.status(403).json({ error: "Admins only" })));

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const list = (v) => (typeof v === "string" && v ? v.split("|").map((s) => s.trim()).filter(Boolean) : []);
const filtersFrom = (q) => ({
  from: ISO.test(q.from || "") ? q.from : undefined,
  to: ISO.test(q.to || "") ? q.to : undefined,
  programs: list(q.programs),
  closers: list(q.closers),
});
const todayInTz = () => new Intl.DateTimeFormat("en-CA", { timeZone: config.tz }).format(new Date());
const wrap = (fn) => (req, res) => {
  try { res.json(fn(req)); } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
};

router.get("/meta", wrap(() => {
  const { meta, lastSync, backend } = getState();
  return { ...meta, asOf: todayInTz(), tz: config.tz, backend, lastSync, lastError, granularities: GRANULARITIES };
}));
router.get("/overview", wrap((req) => {
  const asOf = ISO.test(req.query.asOf || "") ? req.query.asOf : todayInTz();
  return overview(getState().rows, filtersFrom(req.query), asOf);
}));
router.get("/programs", wrap((req) => programPerformance(getState().rows, filtersFrom(req.query))));
router.get("/best-periods", wrap((req) => bestPeriods(getState().rows, filtersFrom(req.query))));
router.get("/team", wrap((req) => teamPerformance(getState().rows, filtersFrom(req.query), req.query.granularity)));
router.get("/clean-rows", wrap((req) => {
  const rows = applyFilters(getState().rows, filtersFrom(req.query));
  return { total: rows.length, rows: rows.slice(0, Math.min(Number(req.query.limit) || 100, 2000)) };
}));

// "Refresh now" button
router.post("/sync", async (_req, res) => {
  const result = await runSync();
  res.status(result.ok ? 200 : 502).json(result);
});

export default router;
