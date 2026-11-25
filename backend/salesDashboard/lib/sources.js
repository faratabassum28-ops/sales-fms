// Where the raw Dashboard tab comes from. Returns a matrix: header row + data rows.

import fs from 'node:fs/promises';
import { parse } from 'csv-parse/sync';
import { JWT } from 'google-auth-library';
import { config } from '../config.js';

const parseCsv = (text) => parse(text, { relax_column_count: true, skip_empty_lines: false, bom: true });

async function loadServiceAccount() {
  if (config.serviceAccountJson) return JSON.parse(config.serviceAccountJson);
  try {
    return JSON.parse(await fs.readFile(config.serviceAccountFile, 'utf8'));
  } catch {
    return null;
  }
}

async function fromSheetsApi(creds) {
  const client = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.sheetId}/values/${encodeURIComponent(config.sheetTab)}`
    + '?valueRenderOption=FORMATTED_VALUE&majorDimension=ROWS';
  const res = await client.request({ url });
  return res.data.values || [];
}

async function fromPublicCsv() {
  const url = `https://docs.google.com/spreadsheets/d/${config.sheetId}/gviz/tv?tqx=out:csv&sheet=${encodeURIComponent(config.sheetTab)}`;
  const res = await fetch(url, { redirect: 'follow' });
  const text = await res.text();
  if (!res.ok || /^\s*<(!doctype|html)/i.test(text)) {
    throw new Error('Could not read the sheet as CSV. Either share it as "Anyone with the link can view", '
      + 'or set GOOGLE_SERVICE_ACCOUNT_JSON and share the sheet with that service account.');
  }
  return parseCsv(text);
}

export async function fetchDashboardMatrix() {
  let mode = config.dataSource;
  let creds = null;
  if (mode === 'auto' || mode === 'sheets-api') {
    creds = await loadServiceAccount();
    if (mode === 'auto') mode = creds ? 'sheets-api' : 'sheets-csv';
  }

  switch (mode) {
    case 'sample':
      return { mode, matrix: parseCsv(await fs.readFile(config.sampleFile, 'utf8')) };
    case 'csv-file':
      if (!config.csvFile) throw new Error('DATA_SOURCE=csv-file needs CSV_FILE to be set.');
      return { mode, matrix: parseCsv(await fs.readFile(config.csvFile, 'utf8')) };
    case 'sheets-api':
      if (!creds) throw new Error('DATA_SOURCE=sheets-api needs GOOGLE_SERVICE_ACCOUNT_JSON or data/service-account.json.');
      return { mode, matrix: await fromSheetsApi(creds) };
    case 'sheets-csv':
      return { mode, matrix: await fromPublicCsv() };
    default:
      throw new Error(`Unknown DATA_SOURCE "${config.dataSource}".`);
  }
}
