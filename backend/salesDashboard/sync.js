import cron from 'node-cron';
import { config } from './config.js';
import { fetchDashboardMatrix } from './lib/sources.js';
import { cleanDashboard } from './lib/clean.js';
import { replaceAll, logFailure, reload, getState } from './store.js';

let running = null;
export let lastError = null;

/** Pull the Dashboard tab, apply the DB_Clean rules, replace the stored rows. Safe to call twice at once. */
export function runSync() {
  if (running) return running;
  running = (async () => {
    let source = config.dataSource;
    try {
      const { mode, matrix } = await fetchDashboardMatrix();
      source = mode;
      const { rows, stats } = cleanDashboard(matrix, { dedupeKeep: config.dedupeKeep });
      if (!rows.length) throw new Error('Cleaning left 0 rows - refusing to replace the stored data.');
      await replaceAll(rows, { source: mode, stats });
      lastError = null;
      console.log(`[sales-dashboard] ${mode}: kept ${stats.kept} of ${stats.totalRows} rows`, stats.skipped);
      return { ok: true, source: mode, stats };
    } catch (err) {
      lastError = { at: new Date().toISOString(), message: err.message };
      console.error('[sales-dashboard] sync failed:', err.message);
      await logFailure(source, err);
      return { ok: false, error: err.message };
    } finally {
      running = null;
    }
  })();
  return running;
}

export function scheduleDailySync() {
  if (!cron.validate(config.syncCron)) {
    console.warn(`[sales-dashboard] invalid SYNC_CRON "${config.syncCron}", daily refresh disabled`);
    return;
  }
  cron.schedule(config.syncCron, () => { runSync(); }, { timezone: config.tz });
  console.log(`[sales-dashboard] daily refresh scheduled: "${config.syncCron}" (${config.tz})`);
}

// Called once from server.js after MongoDB is connected.
export async function startSalesDashboard() {
  if (!config.enabled) { console.log("[sales-dashboard] disabled (SD_ENABLED=0)"); return; }
  try {
    await reload();
    scheduleDailySync();
    if (config.syncOnBoot || getState().rows.length === 0) runSync();
  } catch (e) { console.error("[sales-dashboard] start failed:", e.message); }
}
