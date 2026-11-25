// MongoDB (the same database as Lead FMS) is the system of record; an in-memory copy serves the charts
// (a few thousand rows).
import crypto from "node:crypto";
import { Enrollment, SyncLog } from "./models.js";
import { buildMeta } from "./lib/analytics.js";

const state = { rows: [], meta: buildMeta([]), lastSync: null, backend: "mongodb" };
export const getState = () => state;

const strip = ({ _id, __v, syncId, ...rest }) => rest;
function setRows(rows, lastSync) { state.rows = rows; state.meta = buildMeta(rows); state.lastSync = lastSync; }

export async function reload() {
  const docs = await Enrollment.find({}).sort({ date: 1 }).lean();
  const log = await SyncLog.findOne({ ok: true }).sort({ at: -1 }).lean();
  setRows(docs.map(strip), log ? { at: log.at, source: log.source, stats: log.stats } : null);
}

export async function replaceAll(rows, { source, stats }) {
  const syncId = crypto.randomUUID();
  const lastSync = { at: new Date().toISOString(), source, stats };
  // insert the new snapshot first, then drop the old one, so a failed sync never leaves the dashboard empty
  for (let i = 0; i < rows.length; i += 1000) {
    await Enrollment.insertMany(rows.slice(i, i + 1000).map((r) => ({ ...r, syncId })), { ordered: false });
  }
  await Enrollment.deleteMany({ syncId: { $ne: syncId } });
  await SyncLog.create({ syncId, source, ok: true, stats });
  setRows(rows, lastSync);
}

export async function logFailure(source, error) {
  await SyncLog.create({ syncId: crypto.randomUUID(), source, ok: false, error: String(error?.message || error) }).catch(() => {});
}
