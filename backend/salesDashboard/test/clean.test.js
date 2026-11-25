import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDate, mondayOf, quarterKey, dayName } from '../lib/dates.js';
import { cleanDashboard, HEADERS, NOT_TAGGED } from '../lib/clean.js';

test('parseDate handles both Enrolled On Date formats and friends', () => {
  assert.equal(parseDate('18 May 24 | 9:35pm'), '2024-05-18');
  assert.equal(parseDate('1 Jan 24 | 12:0am'), '2024-01-01');
  assert.equal(parseDate('18 May 2024'), '2024-05-18');
  assert.equal(parseDate('18/05/2024 21:35'), '2024-05-18');
  assert.equal(parseDate('2024-05-18 21:35:00'), '2024-05-18');
  assert.equal(parseDate('45430.89'), '2024-05-18');
  assert.equal(parseDate('garbage'), null);
  assert.equal(parseDate('31 Feb 24'), null);
});

test('Monday weeks, quarters and day names match the existing DB_Clean tab', () => {
  assert.equal(mondayOf('2024-05-18'), '2024-05-13'); // Saturday 18 May 2024 -> Monday 13/05/2024
  assert.equal(mondayOf('2024-01-01'), '2024-01-01');
  assert.equal(quarterKey('2024-05-18'), '2024-Q2');
  assert.equal(dayName('2024-05-18'), 'Saturday');
});

const mk = (o) => HEADERS.map((h) => o[h] ?? '');
const base = (o) => mk({
  'S No': '1', 'Enrolled On Date': '18 May 24 | 9:35pm', 'First Name': 'Jalpa', Email: 'a@x.com', Phone: '111', Program: 'Reiki - L1/L2',
  'Booking Amount': '5000', 'Program Fee': '21000', 'Pymt Status': 'Received', 'Amount Received': '21000', 'Amount Due': '0',
  'Duplicate Email': 'a@x.comReiki - L1/L2', 'Duplicate Phone': '111Reiki - L1/L2', Blocklist: '#N/A', ...o,
});

test('cleaning rules: blocklist, test, no first name, duplicates, Not Tagged', () => {
  const m = [
    HEADERS,
    base({}),
    base({ 'S No': '2' }), // duplicate of 1
    base({ 'S No': '3', 'First Name': '', Email: 'b@x.com', 'Duplicate Email': 'b', 'Duplicate Phone': 'b' }),
    base({ 'S No': '4', 'First Name': 'Test User', 'Duplicate Email': 'c', 'Duplicate Phone': 'c' }),
    base({ 'S No': '5', Blocklist: 'Yes', 'Duplicate Email': 'd', 'Duplicate Phone': 'd' }),
    base({ 'S No': '6', 'Enrolled On Date': 'nope', 'Enrolled Date': '', 'Duplicate Email': 'e', 'Duplicate Phone': 'e' }),
    base({ 'S No': '7', 'Duplicate Email': 'f', 'Duplicate Phone': 'f', 'Closed By': 'Bhumika', 'Enrolled On Date': '19/05/2024 10:00' }),
    mk({ 'Amount Due': '0', 'Balance Received': '0' }), // trailing blank row
  ];
  const { rows, stats } = cleanDashboard(m);
  assert.equal(rows.length, 2);
  assert.deepEqual(stats.skipped, { emptyRow: 1, noFirstName: 1, blocklist: 1, testEntry: 1, badDate: 1, duplicate: 1 });
  assert.equal(rows[0].closedBy, NOT_TAGGED);
  assert.equal(rows[0].raw['Closed By'], ''); // source value untouched
  assert.equal(rows[1].closedBy, 'Bhumika');
  assert.equal(rows[0].week, '2024-05-13');
  assert.equal(rows[0].program, 'Reiki - L1/L2');
});

test('renamed header is reported, not silently ignored', () => {
  const bad = HEADERS.map((h) => (h === 'Program Fee' ? 'Fee' : h));
  assert.throws(() => cleanDashboard([bad, base({})]), /Program Fee/);
});
