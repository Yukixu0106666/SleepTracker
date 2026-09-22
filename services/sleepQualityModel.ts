import type { SleepSession, UserProfile } from './dailyRecommendation';

export type SleepQualityFactor = {
  feature: 'duration' | 'age' | 'bmi';
  direction: 'positive' | 'negative';
  displayValue: string;
  contribution: number;
};

export type SleepQualityPrediction = {
  probabilityGood: number;
  score: number;
  label: 'good' | 'poor';
  factors: SleepQualityFactor[];
  modelVersion: string;
};

// Exported from a LogisticRegression pipeline trained on the repository dataset.
// Numeric inputs use StandardScaler; BMI is one-hot encoded. The compact mobile
// model uses only fields the app can collect and is separate from wellness advice.
const MODEL = {
  version: 'mobile-logreg-v1',
  intercept: 3.58680661,
  numeric: {
    age: { mean: 42.18449198, scale: 8.66153061, coefficient: 0.99083737 },
    duration: { mean: 7.13208556, scale: 0.79459231, coefficient: 4.98519326 },
  },
  bmi: {
    Normal: 0.16654946,
    Obese: -0.01199523,
    Overweight: -0.14939937,
  },
} as const;

function finiteNumber(value: string | undefined): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function bmiCategory(profile?: UserProfile): keyof typeof MODEL.bmi | undefined {
  const heightCm = finiteNumber(profile?.height);
  const weightKg = finiteNumber(profile?.weight);
  if (!heightCm || !weightKg) return undefined;
  const bmi = weightKg / ((heightCm / 100) ** 2);
  if (bmi < 25) return 'Normal';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
}

function sigmoid(value: number) {
  return 1 / (1 + Math.exp(-value));
}

export function predictSleepQuality(
  session: SleepSession,
  profile?: UserProfile,
): SleepQualityPrediction {
  const duration = Number.isFinite(session.duration) ? session.duration : MODEL.numeric.duration.mean;
  const age = finiteNumber(profile?.age);
  const category = bmiCategory(profile);

  const durationContribution = MODEL.numeric.duration.coefficient
    * ((duration - MODEL.numeric.duration.mean) / MODEL.numeric.duration.scale);
  const ageContribution = age === undefined
    ? 0
    : MODEL.numeric.age.coefficient * ((age - MODEL.numeric.age.mean) / MODEL.numeric.age.scale);
  // The training pipeline imputes a missing BMI category with its most common value.
  const bmiContribution = category ? MODEL.bmi[category] : MODEL.bmi.Normal;
  const probabilityGood = sigmoid(
    MODEL.intercept + durationContribution + ageContribution + bmiContribution,
  );

  const factors: SleepQualityFactor[] = [{
    feature: 'duration',
    direction: durationContribution >= 0 ? 'positive' : 'negative',
    displayValue: `${duration.toFixed(1)} h`,
    contribution: durationContribution,
  }];
  if (age !== undefined) {
    factors.push({
      feature: 'age',
      direction: ageContribution >= 0 ? 'positive' : 'negative',
      displayValue: `${Math.round(age)}`,
      contribution: ageContribution,
    });
  }
  if (category) {
    factors.push({
      feature: 'bmi',
      direction: bmiContribution >= 0 ? 'positive' : 'negative',
      displayValue: category,
      contribution: bmiContribution,
    });
  }

  return {
    probabilityGood,
    score: Math.round(probabilityGood * 100),
    label: probabilityGood >= 0.5 ? 'good' : 'poor',
    factors: factors.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)),
    modelVersion: MODEL.version,
  };
}

export const MOBILE_MODEL_VALIDATION = {
  macroF1: 0.9602,
  poorSleepRecall: 0.9744,
  rocAuc: 0.9926,
  folds: 5,
  rows: 374,
} as const;
