import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanDashboard, HEADERS } from '../lib/clean.js';
import {
  agg, growth, overview, programPerformance, bestPeriods, teamPerformance,
} from '../lib/analytics.js';

const mk = (o) => HEADERS.map((h) => o[h] ?? '');
let n = 0;
const row = (date, program, fee, received, closedBy = '') => {
  n += 1;
  return mk({
    'S No': String(n), 'Enrolled On Date': date, 'First Name': `Name${n}`, Email: `e${n}@x.com`, Phone: `9${n}`,
    Program: program, 'Booking Amount': String(received), 'Program Fee': String(fee), 'Pymt Status': received >= fee ? 'Received' : 'Due',
    'Amount Received': String(received), 'Amount Due': String(fee - received), 'Closed By': closedBy,
    'Duplicate Email': `e${n}${program}`, 'Duplicate Phone': `9${n}${program}`,
  });
};

const { rows } = cleanDashboard([HEADERS,
  row('10 Nov 26 | 9:00am', 'Tarot - Mastery', 10000, 10000, 'Bhumika'),
  row('24 Nov 26 | 9:00am', 'Tarot - Mastery', 10000, 6000, 'Bhumika'),
  row('24 Nov 26 | 9:30am', 'Reiki - L1/L2', 20000, 20000),
  row('23 Nov 26 | 9:30am', 'Reiki - L1/L2', 20000, 20000, 'Rahul'),
  row('24 Nov 25 | 9:30am', 'Reiki - L1/L2', 20000, 20000, 'Rahul'),
]);

test('agg: Enrollments, Collection %, Avg Program Fee', () => {
  const a = agg(rows);
  assert.equal(a.enrollments, 5);
  assert.equal(a.programFee, 80000);
  assert.equal(a.amountReceived, 76000);
  assert.equal(a.amountDue, 4000);
  assert.equal(a.collectionPct, 95);
  assert.equal(a.avgProgramFee, 16000);
});

test('growth', () => {
  assert.equal(growth(150, 100), 50);
  assert.equal(growth(50, 100), -50);
  assert.equal(growth(5, 0), null);
  assert.equal(growth(0, 0), 0);
});

test('overview cards compare with the previous period', () => {
  const o = overview(rows, {}, '2026-11-24');
  assert.equal(o.cards.today.current.enrollments, 2);
  assert.equal(o.cards.today.previous.enrollments, 1); // yesterday
  assert.equal(o.cards.today.growth.enrollments, 100);
  assert.equal(o.cards.month.current.enrollments, 4);
  assert.equal(o.cards.year.current.enrollments, 4);
  assert.equal(o.cards.year.previous.enrollments, 1); // 1 Jan - 24 Nov 2025 like-for-like
  assert.equal(o.trend60.length, 60);
  assert.equal(o.trend60.at(-1).enrollments, 2);
  assert.equal(o.monthly.length, 2);
});

test('programs, best periods and team', () => {
  const p = programPerformance(rows, {});
  assert.equal(p.table.find((r) => r.program === 'Reiki - L1/L2').enrollments, 3);
  assert.equal(p.total.enrollments, 5);

  const b = bestPeriods(rows, {});
  assert.equal(b.callouts.day.key, '2026-11-24');
  assert.equal(b.callouts.month.key, '2026-11');
  assert.deepEqual(b.heatmap.years, [2025, 2026]);
  assert.equal(b.yoy.programFee[10][2025], 20000);
  assert.equal(b.dayOfWeek.length, 7);

  const t = teamPerformance(rows, {}, 'weekly');
  assert.equal(t.notTagged.enrollments, 1);
  assert.equal(t.notTagged.pct, 20);
  assert.equal(t.leaderboard.find((r) => r.closedBy === 'Not Tagged').enrollments, 1);
  assert.equal(t.matrix.length, t.closers.length);

  const only = teamPerformance(rows, { closers: ['Rahul'] }, 'daily');
  assert.equal(only.leaderboard.length, 1);
  assert.equal(only.notTagged.total, 5); // Not Tagged % ignores the Closed By filter
});
