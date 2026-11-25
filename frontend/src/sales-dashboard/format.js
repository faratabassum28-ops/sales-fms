const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTH_NAMES = MONTHS;

export const int = (n) => Math.round(Number(n) || 0).toLocaleString('en-IN');

// ₹ amounts are shown in Lakh format everywhere: 1 Lakh = 1,00,000
export const lakh = (n) => {
  const v = (Number(n) || 0) / 1e5;
  const d = Math.abs(v) >= 1 || v === 0 ? 2 : 3; // small amounts keep a third decimal so they don't all read 0.10 L
  return `₹${v.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d })} L`;
};
export const lakhShort = (n) => `${+((Number(n) || 0) / 1e5).toFixed(1)}L`;
export const rupees = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

export const pct = (n) => (n === null || n === undefined ? '—' : `${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 1 })}%`);

export const fmtDate = (iso) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
export const fmtShortDate = (iso) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;
export const fmtMonth = (key) => `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
export const weekday = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'long', timeZone: 'UTC' });

export function fmtPeriod(key, gran) {
  switch (gran) {
    case 'daily': return fmtDate(key);
    case 'weekly': return `Week of ${fmtDate(key)}`;
    case 'monthly': return fmtMonth(key);
    case 'quarterly': return `${key.slice(5)} ${key.slice(0, 4)}`;
    default: return key;
  }
}

export const METRICS = [
  { key: 'programFee', label: 'Program Fee', money: true },
  { key: 'amountReceived', label: 'Amount Received', money: true },
  { key: 'amountDue', label: 'Amount Due', money: true },
  { key: 'enrollments', label: 'Enrollments', money: false },
];
export const fmtMetric = (key, v) => (key === 'enrollments' ? int(v) : lakh(v));

export const PALETTE = ['#0d9488', '#6366f1', '#f59e0b', '#0ea5e9', '#ef4444', '#8b5cf6', '#10b981', '#f97316', '#64748b'];
export const NOT_TAGGED_COLOR = '#9ca3af';
export function colorFor(name, list) {
  if (name === 'Not Tagged') return NOT_TAGGED_COLOR;
  const i = list.filter((n) => n !== 'Not Tagged').indexOf(name);
  return PALETTE[(i < 0 ? 0 : i) % PALETTE.length];
}
