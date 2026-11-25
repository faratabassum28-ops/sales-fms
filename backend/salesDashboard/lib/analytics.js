// Step 2 + 3 of the brief: every number the four pages show.
// Rows come from clean.js. All money is in rupees (formatting to Lakh happens in the UI).

import {
  addDays, diffDays, mondayOf, daysInMonth, DAY_ORDER, pad,
} from './dates.js';

const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// ---------- primitives ----------
export function agg(rows) {
  let programFee = 0; let bookingAmount = 0; let amountReceived = 0; let amountDue = 0;
  for (const r of rows) {
    programFee += r.programFee;
    bookingAmount += r.bookingAmount;
    amountReceived += r.amountReceived;
    amountDue += r.amountDue;
  }
  const enrollments = rows.length; // [NEW] Enrollments = count of rows
  return {
    enrollments,
    programFee: r2(programFee),
    bookingAmount: r2(bookingAmount),
    amountReceived: r2(amountReceived),
    amountDue: r2(amountDue),
    collectionPct: programFee ? r2((amountReceived / programFee) * 100) : 0, // [NEW] Amount Received / Program Fee
    avgProgramFee: enrollments ? r2(programFee / enrollments) : 0, // [NEW] Program Fee / Enrollments
  };
}

export function groupBy(rows, keyFn) {
  const m = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return m;
}

// [NEW] Growth % = change compared with the previous period. null when there is nothing to compare with.
export function growth(cur, prev) {
  if (!prev) return cur ? null : 0;
  return r2(((cur - prev) / Math.abs(prev)) * 100);
}

const GRANULARITY_KEY = {
  daily: (r) => r.date,
  weekly: (r) => r.week,
  monthly: (r) => r.month,
  quarterly: (r) => r.quarter,
  yearly: (r) => String(r.year),
};
export const GRANULARITIES = Object.keys(GRANULARITY_KEY);

export function applyFilters(rows, { from, to, programs, closers } = {}) {
  const ps = programs?.length ? new Set(programs) : null;
  const cs = closers?.length ? new Set(closers) : null;
  return rows.filter((r) => (
    (!from || r.date >= from) && (!to || r.date <= to)
    && (!ps || ps.has(r.program)) && (!cs || cs.has(r.closedBy))
  ));
}

// pivot rows into [{key, <series>: {enrollments, programFee}}] for stacked / multi-line charts
function pivot(rows, keyFn, seriesFn, seriesList) {
  const byKey = groupBy(rows, keyFn);
  const keys = [...byKey.keys()].sort();
  const fee = []; const enr = [];
  for (const k of keys) {
    const f = { key: k }; const e = { key: k };
    for (const s of seriesList) { f[s] = 0; e[s] = 0; }
    for (const r of byKey.get(k)) {
      const s = seriesFn(r);
      f[s] = r2((f[s] || 0) + r.programFee);
      e[s] = (e[s] || 0) + 1;
    }
    fee.push(f); enr.push(e);
  }
  return { fee, enrollments: enr };
}

const sortedBy = (arr, fn) => [...arr].sort((a, b) => fn(b) - fn(a));

// ---------- meta ----------
export function buildMeta(rows) {
  const programs = sortedBy(
    [...groupBy(rows, (r) => r.program)].map(([name, rs]) => ({ name, fee: rs.reduce((a, r) => a + r.programFee, 0) })),
    (x) => x.fee,
  ).map((x) => x.name);
  const closers = sortedBy(
    [...groupBy(rows, (r) => r.closedBy)].map(([name, rs]) => ({ name, fee: rs.reduce((a, r) => a + r.programFee, 0) })),
    (x) => x.fee,
  ).map((x) => x.name);
  return {
    programs,
    closers,
    minDate: rows.length ? rows[0].date : null,
    maxDate: rows.length ? rows[rows.length - 1].date : null,
    rowCount: rows.length,
  };
}

// ---------- Page 1: Sales Overview ----------
function periodWindows(asOf) {
  const y = Number(asOf.slice(0, 4)); const mo = Number(asOf.slice(5, 7));
  const weekStart = mondayOf(asOf);
  const monthStart = `${y}-${pad(mo)}-01`;
  const yearStart = `${y}-01-01`;
  const prevMonthY = mo === 1 ? y - 1 : y; const prevMonthM = mo === 1 ? 12 : mo - 1;
  const prevMonthStart = `${prevMonthY}-${pad(prevMonthM)}-01`;
  const prevMonthEnd = `${prevMonthY}-${pad(prevMonthM)}-${pad(daysInMonth(prevMonthY, prevMonthM))}`;
  const like = (start, prevStart, prevCap) => {
    // previous period, same number of elapsed days (like-for-like), never past its own end
    const n = diffDays(asOf, start); // days elapsed - 1
    const end = addDays(prevStart, n);
    return { from: prevStart, to: prevCap && end > prevCap ? prevCap : end };
  };
  return {
    today: { label: 'Today', from: asOf, to: asOf, prev: { from: addDays(asOf, -1), to: addDays(asOf, -1) }, vs: 'Yesterday' },
    week: { label: 'This Week', from: weekStart, to: asOf, prev: like(weekStart, addDays(weekStart, -7), addDays(weekStart, -1)), vs: 'Last week' },
    month: { label: 'This Month', from: monthStart, to: asOf, prev: like(monthStart, prevMonthStart, prevMonthEnd), vs: 'Last month' },
    year: { label: 'This Year', from: yearStart, to: asOf, prev: like(yearStart, `${y - 1}-01-01`, `${y - 1}-12-31`), vs: 'Last year' },
  };
}

export function overview(rows, { programs, from, to }, asOf) {
  const base = applyFilters(rows, { programs });
  const win = periodWindows(asOf);

  const cards = {};
  for (const [key, w] of Object.entries(win)) {
    const cur = agg(base.filter((r) => r.date >= w.from && r.date <= w.to));
    const prev = agg(base.filter((r) => r.date >= w.prev.from && r.date <= w.prev.to));
    cards[key] = {
      label: w.label, from: w.from, to: w.to, prevFrom: w.prev.from, prevTo: w.prev.to, vs: w.vs,
      current: { enrollments: cur.enrollments, programFee: cur.programFee, amountReceived: cur.amountReceived, amountDue: cur.amountDue },
      previous: { enrollments: prev.enrollments, programFee: prev.programFee, amountReceived: prev.amountReceived, amountDue: prev.amountDue },
      growth: {
        enrollments: growth(cur.enrollments, prev.enrollments),
        programFee: growth(cur.programFee, prev.programFee),
        amountReceived: growth(cur.amountReceived, prev.amountReceived),
        amountDue: growth(cur.amountDue, prev.amountDue),
      },
    };
  }

  // daily trend, last 60 days ending today
  const start = addDays(asOf, -59);
  const byDate = groupBy(base.filter((r) => r.date >= start && r.date <= asOf), (r) => r.date);
  const trend60 = [];
  for (let i = 0; i < 60; i += 1) {
    const d = addDays(start, i);
    const a = agg(byDate.get(d) || []);
    trend60.push({ date: d, enrollments: a.enrollments, programFee: a.programFee, amountReceived: a.amountReceived, amountDue: a.amountDue });
  }

  // monthly bars follow the date range picker
  const ranged = applyFilters(rows, { programs, from, to });
  const monthly = [...groupBy(ranged, (r) => r.month)].sort(([a], [b]) => (a < b ? -1 : 1)).map(([month, rs]) => {
    const a = agg(rs);
    return { month, enrollments: a.enrollments, programFee: a.programFee, amountReceived: a.amountReceived, amountDue: a.amountDue };
  });

  // Pymt Status ("Received" / "Due") exactly as in the sheet
  const pymtStatus = [...groupBy(ranged, (r) => r.pymtStatus || '(blank)')].map(([status, rs]) => ({ status, ...agg(rs) }))
    .sort((a, b) => b.enrollments - a.enrollments);

  return { asOf, cards, trend60, monthly, pymtStatus, totals: agg(ranged) };
}

// ---------- Page 2: Program Performance ----------
export function programPerformance(rows, { from, to, programs }) {
  const ranged = applyFilters(rows, { from, to, programs });
  const programList = sortedBy(
    [...groupBy(ranged, (r) => r.program)].map(([name, rs]) => ({ name, fee: rs.reduce((a, r) => a + r.programFee, 0) })),
    (x) => x.fee,
  ).map((x) => x.name);

  const table = programList.map((p) => {
    const rs = ranged.filter((r) => r.program === p);
    const received = rs.filter((r) => r.pymtStatus === 'Received').length;
    const due = rs.filter((r) => r.pymtStatus === 'Due').length;
    return { program: p, ...agg(rs), pymtReceived: received, pymtDue: due };
  });
  const total = {
    program: 'Total', ...agg(ranged),
    pymtReceived: ranged.filter((r) => r.pymtStatus === 'Received').length,
    pymtDue: ranged.filter((r) => r.pymtStatus === 'Due').length,
  };

  const stacked = pivot(ranged, (r) => r.month, (r) => r.program, programList);
  return { programs: programList, table, total, monthlyByProgram: { programFee: stacked.fee, enrollments: stacked.enrollments } };
}

// ---------- Page 3: Best Periods ----------
function best(rows, keyFn) {
  let top = null;
  for (const [key, rs] of groupBy(rows, keyFn)) {
    const a = agg(rs);
    if (!top || a.programFee > top.programFee) top = { key, programFee: a.programFee, enrollments: a.enrollments, amountReceived: a.amountReceived };
  }
  return top;
}

export function bestPeriods(rows, { from, to, programs }) {
  const allTime = applyFilters(rows, { programs }); // heatmap, callouts and YoY look at all time
  const ranged = applyFilters(rows, { from, to, programs }); // day-of-week follows the date range

  const years = [...new Set(allTime.map((r) => r.year))].sort();
  const cells = [];
  for (const [key, rs] of groupBy(allTime, (r) => r.month)) {
    const a = agg(rs);
    cells.push({ year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)), programFee: a.programFee, enrollments: a.enrollments });
  }
  const heatmap = { years, cells, max: cells.reduce((m, c) => Math.max(m, c.programFee), 0) };

  const callouts = {
    day: best(allTime, (r) => r.date),
    week: best(allTime, (r) => r.week),
    month: best(allTime, (r) => r.month),
    quarter: best(allTime, (r) => r.quarter),
  };

  const byDay = groupBy(ranged, (r) => r.day);
  const dayOfWeek = DAY_ORDER.map((d) => {
    const a = agg(byDay.get(d) || []);
    return { day: d, programFee: a.programFee, enrollments: a.enrollments };
  });

  // same month, year over year: one row per calendar month, one column per year
  const yoy = Array.from({ length: 12 }, (_, i) => {
    const o = { month: i + 1 };
    for (const y of years) o[y] = 0;
    return o;
  });
  const yoyEnr = Array.from({ length: 12 }, (_, i) => {
    const o = { month: i + 1 };
    for (const y of years) o[y] = 0;
    return o;
  });
  for (const c of cells) { yoy[c.month - 1][c.year] = c.programFee; yoyEnr[c.month - 1][c.year] = c.enrollments; }

  return { heatmap, callouts, dayOfWeek, yoy: { years, programFee: yoy, enrollments: yoyEnr } };
}

// ---------- Page 4: Sales Team Performance ----------
export function teamPerformance(rows, { from, to, programs, closers }, granularity = 'monthly') {
  const gran = GRANULARITY_KEY[granularity] ? granularity : 'monthly';
  const scoped = applyFilters(rows, { from, to, programs }); // before the Closed By filter
  const ranged = closers?.length ? scoped.filter((r) => closers.includes(r.closedBy)) : scoped;

  const closerList = sortedBy(
    [...groupBy(ranged, (r) => r.closedBy)].map(([name, rs]) => ({ name, fee: rs.reduce((a, r) => a + r.programFee, 0) })),
    (x) => x.fee,
  ).map((x) => x.name);
  const programList = sortedBy(
    [...groupBy(ranged, (r) => r.program)].map(([name, rs]) => ({ name, fee: rs.reduce((a, r) => a + r.programFee, 0) })),
    (x) => x.fee,
  ).map((x) => x.name);

  const leaderboard = closerList.map((c, i) => ({ rank: i + 1, closedBy: c, ...agg(ranged.filter((r) => r.closedBy === c)) }));

  const matrix = closerList.map((c) => {
    const rs = ranged.filter((r) => r.closedBy === c);
    const cells = {};
    for (const p of programList) {
      const sub = rs.filter((r) => r.program === p);
      cells[p] = { enrollments: sub.length, programFee: r2(sub.reduce((a, r) => a + r.programFee, 0)) };
    }
    return { closedBy: c, cells, total: agg(rs) };
  });

  const trend = pivot(ranged, GRANULARITY_KEY[gran], (r) => r.closedBy, closerList);

  const nt = scoped.filter((r) => r.notTagged);
  const notTagged = {
    enrollments: nt.length,
    total: scoped.length,
    pct: scoped.length ? r2((nt.length / scoped.length) * 100) : 0, // [NEW] Not Tagged %, target 0%
    programFee: r2(nt.reduce((a, r) => a + r.programFee, 0)),
    target: 0,
  };

  return {
    granularity: gran,
    closers: closerList,
    programs: programList,
    leaderboard,
    matrix,
    trend: { programFee: trend.fee, enrollments: trend.enrollments },
    notTagged,
    totals: agg(ranged),
  };
}
