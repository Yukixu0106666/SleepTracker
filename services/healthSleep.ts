export type HealthSleepSample = {
  startDate: Date;
  endDate: Date;
  value: number;
};

// HealthKit can return an in-bed interval, an overall asleep interval, sleep
// stages, and overlapping samples from multiple sources for the same night.
const ASLEEP_VALUES = new Set([1, 3, 4, 5]);

export function calculateSleepMinutes(
  samples: readonly HealthSleepSample[],
  rangeStart: Date,
  rangeEnd: Date,
): number {
  const rangeStartMs = rangeStart.getTime();
  const rangeEndMs = rangeEnd.getTime();
  if (!Number.isFinite(rangeStartMs) || !Number.isFinite(rangeEndMs) || rangeEndMs <= rangeStartMs) {
    return 0;
  }

  const intervals = samples
    .filter((sample) => ASLEEP_VALUES.has(sample.value))
    .map((sample) => ({
      start: Math.max(sample.startDate.getTime(), rangeStartMs),
      end: Math.min(sample.endDate.getTime(), rangeEndMs),
    }))
    .filter(({ start, end }) => Number.isFinite(start) && Number.isFinite(end) && end > start)
    .sort((left, right) => left.start - right.start || left.end - right.end);

  let totalMs = 0;
  let mergedStart: number | undefined;
  let mergedEnd: number | undefined;

  for (const interval of intervals) {
    if (mergedStart === undefined || mergedEnd === undefined) {
      mergedStart = interval.start;
      mergedEnd = interval.end;
    } else if (interval.start <= mergedEnd) {
      mergedEnd = Math.max(mergedEnd, interval.end);
    } else {
      totalMs += mergedEnd - mergedStart;
      mergedStart = interval.start;
      mergedEnd = interval.end;
    }
  }

  if (mergedStart !== undefined && mergedEnd !== undefined) {
    totalMs += mergedEnd - mergedStart;
  }

  return totalMs / 60_000;
}
