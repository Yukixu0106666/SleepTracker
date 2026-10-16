import assert from 'node:assert/strict';
import test from 'node:test';
import { predictTonightSleep } from '../services/tonightSleepPrediction.ts';

const profile = { age: '30', height: '170', weight: '65' };
const checkIn = { physicalActivityMinutes: '60', stressLevel: '4', heartRate: '68', steps: '8000' };

test('requires all pre-sleep inputs and profile fields', () => {
  const result = predictTonightSleep({ ...checkIn, stressLevel: '' }, profile);
  assert.equal(result.available, false);
  assert.deepEqual(result.missingInputs, ['stress']);
});

test('higher reported stress lowers the ML probability', () => {
  const lower = predictTonightSleep({ ...checkIn, stressLevel: '3' }, profile);
  const higher = predictTonightSleep({ ...checkIn, stressLevel: '8' }, profile);
  assert.equal(lower.available, true);
  assert.equal(higher.available, true);
  assert.ok(lower.probabilityGood > higher.probabilityGood);
});

test('more physical activity raises probability with other inputs fixed', () => {
  const lower = predictTonightSleep({ ...checkIn, physicalActivityMinutes: '20' }, profile);
  const higher = predictTonightSleep({ ...checkIn, physicalActivityMinutes: '90' }, profile);
  assert.equal(lower.available, true);
  assert.equal(higher.available, true);
  assert.ok(higher.probabilityGood > lower.probabilityGood);
});

test('returns a bounded result with ranked model factors', () => {
  const result = predictTonightSleep(checkIn, profile);
  assert.equal(result.available, true);
  assert.ok(result.probabilityGood >= 0 && result.probabilityGood <= 1);
  assert.equal(result.factors.length, 6);
  assert.ok(Math.abs(result.factors[0].contribution) >= Math.abs(result.factors[1].contribution));
});

test('recent valid sleep history personalizes the ML probability and ignores test sessions', () => {
  const goodHistory = Array.from({ length: 7 }, (_, index) => ({
    start: `2026-09-${String(index + 1).padStart(2, '0')}T23:00:00.000Z`,
    end: `2026-09-${String(index + 2).padStart(2, '0')}T07:00:00.000Z`, duration: 8,
  }));
  const poorHistory = goodHistory.map((session) => ({ ...session, duration: 5 }));
  const good = predictTonightSleep(checkIn, profile, goodHistory);
  const poor = predictTonightSleep(checkIn, profile, poorHistory);
  const ignored = predictTonightSleep(checkIn, profile, [{ ...goodHistory[0], duration: 0.05 }]);
  assert.equal(good.available, true);
  assert.equal(poor.available, true);
  assert.equal(ignored.available, true);
  assert.ok(good.probabilityGood > poor.probabilityGood);
  assert.equal(good.historyNights, 7);
  assert.equal(ignored.historyNights, 0);
});
