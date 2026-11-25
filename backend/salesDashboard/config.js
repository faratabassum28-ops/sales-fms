import path from "node:path";
import { fileURLToPath } from "node:url";

// Sales Dashboard settings. Every variable starts with SD_ so it cannot clash with the Lead FMS settings.
// Only SD_GOOGLE_SERVICE_ACCOUNT_JSON (or the sheet shared as "Anyone with the link") is needed to go live.
const here = path.dirname(fileURLToPath(import.meta.url));
const bool = (v, d = false) => (v === undefined || v === "" ? d : /^(1|true|yes|on)$/i.test(v));
const env = (k, d = "") => (process.env[k] ?? d);

export const config = {
  enabled: bool(env("SD_ENABLED"), true),
  tz: env("SD_TZ_NAME", env("TZ_NAME", "Asia/Kolkata")),

  dataSource: env("SD_DATA_SOURCE", "auto").trim(),          // auto | sheets-api | sheets-csv | csv-file | sample
  sheetId: env("SD_SHEET_ID", "1t_2yP18ErFwfqMWhW2C3yZb1POIxObBK8dhqyQTBOnE").trim(),
  sheetTab: env("SD_SHEET_TAB", "Dashboard").trim(),
  serviceAccountJson: env("SD_GOOGLE_SERVICE_ACCOUNT_JSON").trim(),
  serviceAccountFile: path.resolve(here, env("SD_GOOGLE_SERVICE_ACCOUNT_FILE", "./data/service-account.json")),
  csvFile: env("SD_CSV_FILE") ? path.resolve(here, env("SD_CSV_FILE")) : "",

  dedupeKeep: env("SD_DEDUPE_KEEP", "first").toLowerCase() === "last" ? "last" : "first",
  syncCron: env("SD_SYNC_CRON", "0 6 * * *"),                  // 06:00 every day in SD_TZ_NAME
  syncOnBoot: bool(env("SD_SYNC_ON_BOOT"), true),
  sampleFile: path.join(here, "data", "sample-dashboard.csv"),
};
