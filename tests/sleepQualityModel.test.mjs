import assert from 'node:assert/strict';
import test from 'node:test';
import { predictSleepQuality } from '../services/sleepQualityModel.ts';

const session = duration => ({
  start: '2026-01-01T23:00:00.000Z',
  end: '2026-01-02T07:00:00.000Z',
  duration,
});

test('longer sleep produces a higher good-sleep probability', () => {
  const short = predictSleepQuality(session(5.5), { age: '30', height: '170', weight: '65' });
  const long = predictSleepQuality(session(8), { age: '30', height: '170', weight: '65' });
  assert.ok(long.probabilityGood > short.probabilityGood);
  assert.equal(short.label, 'poor');
  assert.equal(long.label, 'good');
});

test('missing optional profile fields still returns a bounded estimate', () => {
  const result = predictSleepQuality(session(7));
  assert.ok(result.probabilityGood >= 0 && result.probabilityGood <= 1);
  assert.equal(result.factors.length, 1);
  assert.equal(result.factors[0].feature, 'duration');
});
