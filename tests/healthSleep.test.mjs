import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateSleepMinutes } from '../services/healthSleep.ts';

const date = (hour, minute = 0) => new Date(Date.UTC(2026, 0, hour < 12 ? 2 : 1, hour, minute));
const sample = (value, startHour, endHour, startMinute = 0, endMinute = 0) => ({
  value,
  startDate: date(startHour, startMinute),
  endDate: date(endHour, endMinute),
});

test('ignores in-bed and awake samples and merges overlapping asleep stages', () => {
  const samples = [
    sample(0, 22, 8), // inBed
    sample(1, 23, 7), // asleep/unspecified
    sample(3, 23, 1), // core
    sample(4, 1, 3), // deep
    sample(5, 3, 6), // REM
    sample(2, 4, 4, 0, 30), // awake
  ];

  assert.equal(calculateSleepMinutes(samples, date(22), date(8)), 8 * 60);
});

test('does not double-count overlapping samples from multiple sources', () => {
  const samples = [
    sample(1, 23, 7),
    sample(1, 23, 6, 30, 30),
  ];

  assert.equal(calculateSleepMinutes(samples, date(22), date(8)), 8 * 60);
});

test('clips sleep intervals to the requested time range', () => {
  const samples = [sample(1, 22, 8)];

  assert.equal(calculateSleepMinutes(samples, date(23), date(7)), 8 * 60);
});
