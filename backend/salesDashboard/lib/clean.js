// Step 1 of the brief (the "DB_Clean" logic), done in code instead of sheet formulas.
// Headers are matched by their exact text, never by column position, and are never renamed.

import { parseDate, mondayOf, monthKey, quarterKey, dayName } from './dates.js';

// Exactly as written in the Dashboard tab.
export const HEADERS = [
  'S No', 'Enrolled On Date', 'First Name', 'Email', 'Phone', 'Program', 'Booking Amount', 'Paid Through',
  'Program Fee', 'Pymt Status', 'Amount Received', 'Amount Due', 'Closed By', 'Balance Received',
  'Old Balance', 'Difference', 'Duplicate Email', 'Duplicate Phone', 'Enrolled Date', 'Payment Status',
  'LEAD SOURCE', 'Campaign', 'Adset', 'Ads', 'Blocklist',
];

// The dashboard cannot work without these.
const REQUIRED = [
  'Enrolled On Date', 'First Name', 'Program', 'Booking Amount', 'Program Fee', 'Pymt Status',
  'Amount Received', 'Amount Due', 'Closed By', 'Duplicate Email', 'Duplicate Phone', 'Blocklist',
];

export const NOT_TAGGED = 'Not Tagged'; // [NEW] shown on the dashboard only, never written to the source sheet

const isErrorCell = (v) => /^#(N\/A|REF!|VALUE!|ERROR!|DIV\/0!|NAME\?|NUM!|NULL!)/i.test(v);
const clean = (v) => {
  const s = String(v ?? '').trim();
  return isErrorCell(s) ? '' : s;
};

export function toNumber(v) {
  const s = String(v ?? '').replace(/[₹,\s]/g, '').replace(/^\((.*)\)$/, '-$1');
  if (!s || isErrorCell(s)) return 0;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

// Blocklist column: any real value (e.g. "Yes", "Blocked", "TRUE") marks the row. #N/A, blank, FALSE, No, 0 do not.
export const isBlocklisted = (v) => {
  const s = clean(v);
  return s !== '' && !/^(false|no|n|0)$/i.test(s);
};

// Test entries: "Test", "test user", "Demo", "dummy" in First Name, or a test@ style e-mail.
export const isTestEntry = (name, email) =>
  /(^|\s)(test|testing|demo|dummy)(\s|\d|$)/i.test(name) || /(^|[._-])test\d*@/i.test(email || '');

/**
 * @param {string[][]} matrix  header row + data rows, as returned by the Sheets API / CSV
 * @param {{dedupeKeep?: 'first'|'last'}} opts
 */
export function cleanDashboard(matrix, { dedupeKeep = 'first' } = {}) {
  if (!Array.isArray(matrix) || matrix.length < 2) throw new Error('The Dashboard tab came back empty.');

  const header = matrix[0].map((h) => String(h ?? '').trim());
  const idx = new Map();
  header.forEach((h, i) => { if (h && !idx.has(h)) idx.set(h, i); });

  const missing = REQUIRED.filter((h) => !idx.has(h));
  if (missing.length) {
    throw new Error(`Dashboard tab is missing expected column(s): ${missing.join(', ')}. ` +
      'Headers are matched exactly, so check they were not renamed.');
  }
  const val = (row, h) => (idx.has(h) ? String(row[idx.get(h)] ?? '') : '');

  const stats = {
    totalRows: matrix.length - 1,
    kept: 0,
    skipped: { emptyRow: 0, noFirstName: 0, blocklist: 0, testEntry: 0, badDate: 0, duplicate: 0 },
  };

  const candidates = [];
  for (let i = 1; i < matrix.length; i += 1) {
    const row = matrix[i] || [];
    if (row.every((c) => String(c ?? '').trim() === '' || String(c).trim() === '0' || isErrorCell(String(c).trim()))) {
      stats.skipped.emptyRow += 1; continue;
    }
    const firstName = clean(val(row, 'First Name'));
    if (!firstName) { stats.skipped.noFirstName += 1; continue; }
    if (isBlocklisted(val(row, 'Blocklist'))) { stats.skipped.blocklist += 1; continue; }
    if (isTestEntry(firstName, clean(val(row, 'Email')))) { stats.skipped.testEntry += 1; continue; }

    const date = parseDate(val(row, 'Enrolled On Date')) || parseDate(val(row, 'Enrolled Date'));
    if (!date) { stats.skipped.badDate += 1; continue; }

    candidates.push({ row, date, firstName });
  }

  // Count each enrollment once, using the sheet's own Duplicate Email / Duplicate Phone keys
  // (email+Program, phone+Program). A row is a repeat if either key was already seen.
  const ordered = dedupeKeep === 'last' ? [...candidates].reverse() : candidates;
  const seenEmail = new Set();
  const seenPhone = new Set();
  const unique = [];
  for (const c of ordered) {
    const ke = clean(val(c.row, 'Duplicate Email')).toLowerCase();
    const kp = clean(val(c.row, 'Duplicate Phone')).toLowerCase();
    if ((ke && seenEmail.has(ke)) || (kp && seenPhone.has(kp))) { stats.skipped.duplicate += 1; continue; }
    if (ke) seenEmail.add(ke);
    if (kp) seenPhone.add(kp);
    unique.push(c);
  }
  if (dedupeKeep === 'last') unique.reverse();

  const rows = unique.map(({ row, date }) => {
    const raw = {};
    for (const h of HEADERS) if (idx.has(h)) raw[h] = val(row, h); // untouched copy, exact headers
    const closedBy = clean(val(row, 'Closed By'));
    return {
      sNo: clean(val(row, 'S No')),
      raw,
      // helper columns [NEW]
      date,
      week: mondayOf(date), // week starting Monday
      month: monthKey(date),
      quarter: quarterKey(date),
      year: Number(date.slice(0, 4)),
      day: dayName(date),
      // normalised copies used by the charts
      program: clean(val(row, 'Program')) || '(blank)',
      pymtStatus: clean(val(row, 'Pymt Status')),
      closedBy: closedBy || NOT_TAGGED,
      notTagged: closedBy === '',
      programFee: toNumber(val(row, 'Program Fee')),
      bookingAmount: toNumber(val(row, 'Booking Amount')),
      amountReceived: toNumber(val(row, 'Amount Received')),
      amountDue: toNumber(val(row, 'Amount Due')),
    };
  });

  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  stats.kept = rows.length;
  return { rows, stats };
}
