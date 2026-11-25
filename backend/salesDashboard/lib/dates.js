// Date helpers. Everything is a plain "YYYY-MM-DD" string and all maths is done in UTC days,
// so server time zone can never shift an enrollment onto another day.

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const pad = (n) => String(n).padStart(2, '0');

export function isoFrom(y, m, d) {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  if (y < 2000 || y > 2100) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

export const toDays = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 864e5);
};
export const fromDays = (n) => {
  const dt = new Date(n * 864e5);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
};
export const addDays = (iso, n) => fromDays(toDays(iso) + n);
export const diffDays = (a, b) => toDays(a) - toDays(b);
export const dayOfWeek = (iso) => new Date(toDays(iso) * 864e5).getUTCDay(); // 0 = Sunday
export const dayName = (iso) => DAY_NAMES[dayOfWeek(iso)];
export const mondayOf = (iso) => addDays(iso, -((dayOfWeek(iso) + 6) % 7));
export const monthKey = (iso) => iso.slice(0, 7);
export const quarterKey = (iso) => `${iso.slice(0, 4)}-Q${Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1}`;
export const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
export const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const fullYear = (s) => {
  const n = Number(s);
  return n < 100 ? 2000 + n : n;
};

/**
 * Enrolled On Date comes in more than one format. Understands:
 *   "18 May 24 | 9:35pm"   "18 May 2024"   "18-May-24"
 *   "May 18, 2024"
 *   "2024-05-18"  "2024-05-18 21:35:00"
 *   "18/05/2024"  "18/05/2024 21:35"   (day first, Indian style)
 *   Google Sheets serial numbers (e.g. 45430.89)
 * Returns "YYYY-MM-DD" or null.
 */
export function parseDate(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s) return null;
  let m;

  if ((m = s.match(/^(\d{1,2})[\s\-/.]+([A-Za-z]{3,9})\.?,?[\s\-/.]+(\d{2,4})(?!\d)/))) {
    const mon = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
    if (mon >= 0) return isoFrom(fullYear(m[3]), mon + 1, Number(m[1]));
  }
  if ((m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{2,4})(?!\d)/))) {
    const mon = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
    if (mon >= 0) return isoFrom(fullYear(m[3]), mon + 1, Number(m[2]));
  }
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?!\d)/))) {
    return isoFrom(Number(m[1]), Number(m[2]), Number(m[3]));
  }
  if ((m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})(?!\d)/))) {
    let d = Number(m[1]);
    let mo = Number(m[2]);
    if (mo > 12 && d <= 12) [d, mo] = [mo, d];
    return isoFrom(fullYear(m[3]), mo, d);
  }
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    // Google Sheets / Excel serial: 25569 = 1970-01-01
    return fromDays(Math.floor(parseFloat(s)) - 25569);
  }
  return null;
}
