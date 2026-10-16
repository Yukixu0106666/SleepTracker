import type { SleepSession } from './dailyRecommendation';

const MINIMUM_NIGHTS = 3;
const MAXIMUM_NIGHTS = 7;

type TonightSleepPredictionBase = {
  nightsAnalyzed: number;
  nightsRequired: number;
  modelVersion: string;
};

export type TonightSleepPrediction = TonightSleepPredictionBase & (
  | { available: false }
  | {
      available: true;
      probabilityGood: number;
      score: number;
      label: 'good' | 'poor';
      confidence: 'low' | 'medium' | 'high';
      goodNights: number;
      averageDuration: number;
      bedtimeVariationMinutes: number;
    }
);

type NightRecord = {
  date: string;
  duration: number;
  bedtimeMinutes: number;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function localDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function normalizedBedtimeMinutes(date: Date) {
  const minutes = date.getHours() * 60 + date.getMinutes();
  return minutes < 12 * 60 ? minutes + 24 * 60 : minutes;
}

function recentNightRecords(sessions: SleepSession[]): NightRecord[] {
  const grouped = new Map<string, NightRecord>();

  sessions.forEach((session) => {
    const start = new Date(session.start);
    const end = new Date(session.end);
    if (
      !Number.isFinite(session.duration) || session.duration <= 0 || session.duration > 16 ||
      Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())
    ) return;

    const startHour = start.getHours();
    const likelyNightSleep = session.duration >= 3 || startHour >= 18 || startHour < 6;
    if (!likelyNightSleep) return;

    const date = localDateKey(end);
    const bedtimeMinutes = normalizedBedtimeMinutes(start);
    const existing = grouped.get(date);
    if (existing) {
      existing.duration = Math.min(16, existing.duration + session.duration);
      existing.bedtimeMinutes = Math.min(existing.bedtimeMinutes, bedtimeMinutes);
    } else {
      grouped.set(date, { date, duration: session.duration, bedtimeMinutes });
    }
  });

  return [...grouped.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-MAXIMUM_NIGHTS);
}

export function predictTonightSleep(sessions: SleepSession[]): TonightSleepPrediction {
  const nights = recentNightRecords(sessions);
  const shared = {
    nightsAnalyzed: nights.length,
    nightsRequired: MINIMUM_NIGHTS,
    modelVersion: 'recent-patterns-v1',
  };

  if (nights.length < MINIMUM_NIGHTS) return { available: false, ...shared };

  const goodNights = nights.filter(({ duration }) => duration >= 7 && duration <= 9).length;
  // Beta(1, 1) smoothing prevents tiny histories from producing 0% or 100% forecasts.
  const smoothedGoodNightRate = (goodNights + 1) / (nights.length + 2);
  const averageDuration = nights.reduce((total, night) => total + night.duration, 0) / nights.length;
  const averageBedtime = nights.reduce((total, night) => total + night.bedtimeMinutes, 0) / nights.length;
  const bedtimeVariationMinutes = nights.reduce(
    (total, night) => total + Math.abs(night.bedtimeMinutes - averageBedtime),
    0,
  ) / nights.length;
  const regularityScore = clamp(1 - bedtimeVariationMinutes / 180, 0, 1);
  const probabilityGood = clamp(0.8 * smoothedGoodNightRate + 0.2 * regularityScore, 0.05, 0.95);
  const score = Math.round(probabilityGood * 100);

  return {
    available: true,
    ...shared,
    probabilityGood,
    score,
    label: probabilityGood >= 0.5 ? 'good' : 'poor',
    confidence: nights.length >= 7 ? 'high' : nights.length >= 5 ? 'medium' : 'low',
    goodNights,
    averageDuration,
    bedtimeVariationMinutes: Math.round(bedtimeVariationMinutes),
  };
}

