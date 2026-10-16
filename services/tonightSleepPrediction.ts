import type { SleepSession, UserProfile } from './dailyRecommendation';

export type TonightCheckIn = { physicalActivityMinutes: string; stressLevel: string; heartRate: string; steps: string };
export type TonightPredictionFeature = 'age' | 'activity' | 'stress' | 'heartRate' | 'steps' | 'bmi';
export type TonightPredictionFactor = { feature: TonightPredictionFeature; displayValue: string; direction: 'positive' | 'negative'; contribution: number };
type PredictionBase = { modelVersion: string; missingInputs: TonightPredictionFeature[] };
export type TonightSleepPrediction = PredictionBase & (
  | { available: false }
  | { available: true; probabilityGood: number; score: number; label: 'good' | 'poor'; factors: TonightPredictionFactor[]; historyNights: number; recentGoodNights: number; recentAverageDuration?: number; historyInfluence: number }
);

// Exported from tonight_sleep_quality_model.py. Sleep duration is excluded so
// every input is available before the user goes to bed.
const MODEL = {
  version: 'pre-sleep-logreg-v1', intercept: 3.95315225772495,
  numeric: {
    age: { mean: 42.18449197860963, scale: 8.661530606217877, coefficient: 1.0701309972220652 },
    activity: { mean: 59.17112299465241, scale: 20.802936349731223, coefficient: 1.2707091596122873 },
    stress: { mean: 5.385026737967914, scale: 1.772152494715317, coefficient: -3.8243243419832207 },
    heartRate: { mean: 70.16577540106952, scale: 4.1301428563339595, coefficient: -1.2364047621882024 },
    steps: { mean: 6816.844919786096, scale: 1615.7512424734216, coefficient: -0.742863318087857 },
  },
  bmi: { Normal: 0.9800127425003244, Obese: 0.28452947303981074, Overweight: -1.2720200010417806 },
} as const;

function numberInRange(value: string | undefined, minimum: number, maximum: number) {
  const parsed = Number(value);
  return value?.trim() && Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : undefined;
}

function profileBmi(profile?: UserProfile): { category: keyof typeof MODEL.bmi; value: number } | undefined {
  const height = numberInRange(profile?.height, 80, 250);
  const weight = numberInRange(profile?.weight, 20, 350);
  if (height === undefined || weight === undefined) return undefined;
  const value = weight / ((height / 100) ** 2);
  return { value, category: value < 25 ? 'Normal' : value < 30 ? 'Overweight' : 'Obese' };
}

const contribution = (value: number, config: { mean: number; scale: number; coefficient: number }) =>
  config.coefficient * ((value - config.mean) / config.scale);
const sigmoid = (value: number) => 1 / (1 + Math.exp(-value));

function historySignal(sessions: SleepSession[]) {
  const grouped = new Map<string, { duration: number; bedtime: number }>();
  sessions.forEach((session) => {
    const start = new Date(session.start);
    const end = new Date(session.end);
    if (!Number.isFinite(session.duration) || session.duration < 2 || session.duration > 14 || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
    const startHour = start.getHours();
    if (session.duration < 4 && startHour >= 6 && startHour < 18) return;
    const date = [end.getFullYear(), end.getMonth() + 1, end.getDate()].join('-');
    const rawBedtime = startHour * 60 + start.getMinutes();
    const bedtime = rawBedtime < 12 * 60 ? rawBedtime + 24 * 60 : rawBedtime;
    const existing = grouped.get(date);
    if (existing) {
      existing.duration = Math.min(14, existing.duration + session.duration);
      existing.bedtime = Math.min(existing.bedtime, bedtime);
    } else grouped.set(date, { duration: session.duration, bedtime });
  });
  const nights = [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right)).slice(-7).map(([, value]) => value);
  if (!nights.length) return { nights: 0, goodNights: 0, probability: 0.5, influence: 0 };
  const goodNights = nights.filter(({ duration }) => duration >= 7 && duration <= 9).length;
  const averageDuration = nights.reduce((sum, night) => sum + night.duration, 0) / nights.length;
  const smoothedGoodRate = (goodNights + 1) / (nights.length + 2);
  const averageBedtime = nights.reduce((sum, night) => sum + night.bedtime, 0) / nights.length;
  const variation = nights.length > 1
    ? nights.reduce((sum, night) => sum + Math.abs(night.bedtime - averageBedtime), 0) / nights.length
    : 90;
  const regularity = Math.max(0, Math.min(1, 1 - variation / 180));
  return {
    nights: nights.length, goodNights, averageDuration,
    probability: 0.8 * smoothedGoodRate + 0.2 * regularity,
    influence: 0.3 * Math.min(1, nights.length / 7),
  };
}

export function predictTonightSleep(checkIn: TonightCheckIn, profile?: UserProfile, sessions: SleepSession[] = []): TonightSleepPrediction {
  const age = numberInRange(profile?.age, 13, 100);
  const bmi = profileBmi(profile);
  const activity = numberInRange(checkIn.physicalActivityMinutes, 0, 300);
  const stress = numberInRange(checkIn.stressLevel, 1, 10);
  const heartRate = numberInRange(checkIn.heartRate, 30, 220);
  const steps = numberInRange(checkIn.steps, 0, 100000);
  const missingInputs: TonightPredictionFeature[] = [];
  if (age === undefined) missingInputs.push('age');
  if (!bmi) missingInputs.push('bmi');
  if (activity === undefined) missingInputs.push('activity');
  if (stress === undefined) missingInputs.push('stress');
  if (heartRate === undefined) missingInputs.push('heartRate');
  if (steps === undefined) missingInputs.push('steps');
  const shared = { modelVersion: MODEL.version, missingInputs };
  if (missingInputs.length || age === undefined || !bmi || activity === undefined || stress === undefined || heartRate === undefined || steps === undefined) {
    return { available: false, ...shared };
  }

  const values = [
    { feature: 'age' as const, displayValue: `${Math.round(age)}`, value: contribution(age, MODEL.numeric.age) },
    { feature: 'activity' as const, displayValue: `${Math.round(activity)} min`, value: contribution(activity, MODEL.numeric.activity) },
    { feature: 'stress' as const, displayValue: `${stress.toFixed(0)}/10`, value: contribution(stress, MODEL.numeric.stress) },
    { feature: 'heartRate' as const, displayValue: `${Math.round(heartRate)} bpm`, value: contribution(heartRate, MODEL.numeric.heartRate) },
    { feature: 'steps' as const, displayValue: `${Math.round(steps)}`, value: contribution(steps, MODEL.numeric.steps) },
    { feature: 'bmi' as const, displayValue: `${bmi.value.toFixed(1)} (${bmi.category})`, value: MODEL.bmi[bmi.category] },
  ];
  const modelProbability = sigmoid(MODEL.intercept + values.reduce((sum, item) => sum + item.value, 0));
  const history = historySignal(sessions);
  const probabilityGood = (1 - history.influence) * modelProbability + history.influence * history.probability;
  return {
    available: true, ...shared, probabilityGood, score: Math.round(probabilityGood * 100),
    label: probabilityGood >= 0.5 ? 'good' : 'poor',
    historyNights: history.nights, recentGoodNights: history.goodNights,
    recentAverageDuration: history.averageDuration, historyInfluence: history.influence,
    factors: values.map(({ feature, displayValue, value }) => ({
      feature, displayValue, contribution: value, direction: value >= 0 ? 'positive' as const : 'negative' as const,
    })).sort((left, right) => Math.abs(right.contribution) - Math.abs(left.contribution)),
  };
}

export const TONIGHT_MODEL_VALIDATION = { macroF1: 0.9755, poorSleepRecall: 0.9915, rocAuc: 0.9890, folds: 5, rows: 374, groups: 75 } as const;
