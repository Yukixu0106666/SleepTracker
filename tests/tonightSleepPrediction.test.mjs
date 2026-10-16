import assert from 'node:assert/strict';
import test from 'node:test';
import { predictTonightSleep } from '../services/tonightSleepPrediction.ts';

function night(day, startHour, duration) {
  const start = new Date(Date.UTC(2026, 8, day, startHour));
  const end = new Date(start.getTime() + duration * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString(), duration };
}

test('requires at least three recorded nights before showing a forecast', () => {
  const result = predictTonightSleep([night(1, 23, 8), night(2, 23, 8)]);
  assert.equal(result.available, false);
  assert.equal(result.nightsAnalyzed, 2);
  assert.equal(result.nightsRequired, 3);
});

test('regular seven-to-nine-hour nights produce a positive forecast', () => {
  const result = predictTonightSleep([
    night(1, 23, 8), night(2, 23, 7.5), night(3, 23, 8.5), night(4, 23, 8),
  ]);
  assert.equal(result.available, true);
  assert.equal(result.label, 'good');
  assert.ok(result.probabilityGood > 0.7);
  assert.equal(result.goodNights, 4);
});

test('short and irregular recent sleep lowers the forecast', () => {
  const regular = predictTonightSleep([
    night(1, 23, 8), night(2, 23, 8), night(3, 23, 8),
  ]);
  const shortAndIrregular = predictTonightSleep([
    night(1, 18, 5), night(2, 23, 5.5), night(4, 3, 6),
  ]);
  assert.ok(shortAndIrregular.probabilityGood < regular.probabilityGood);
  assert.equal(shortAndIrregular.label, 'poor');
});

test('uses at most the latest seven nights and ignores daytime naps', () => {
  const sessions = Array.from({ length: 9 }, (_, index) => night(index + 1, 23, index < 2 ? 4 : 8));
  sessions.push(night(10, 13, 1));
  const result = predictTonightSleep(sessions);
  assert.equal(result.nightsAnalyzed, 7);
  assert.equal(result.goodNights, 7);
  assert.equal(result.confidence, 'high');
  assert.ok(result.probabilityGood <= 0.95);
});

