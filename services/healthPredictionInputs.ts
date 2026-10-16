import {
  getMostRecentQuantitySample,
  isHealthDataAvailableAsync,
  queryStatisticsForQuantity,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';
import { Platform } from 'react-native';
import type { TonightCheckIn } from './tonightSleepPrediction';

const READ_TYPES = [
  'HKQuantityTypeIdentifierAppleExerciseTime',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierStepCount',
] as const;

export type HealthPredictionInputs = Partial<Pick<TonightCheckIn, 'physicalActivityMinutes' | 'heartRate' | 'steps'>>;

export async function readHealthPredictionInputs(requestPermission = false): Promise<HealthPredictionInputs> {
  if (Platform.OS !== 'ios' || !(await isHealthDataAvailableAsync())) return {};
  if (requestPermission) await requestAuthorization({ toRead: [...READ_TYPES] });

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [activity, steps, restingHeartRate] = await Promise.all([
    queryStatisticsForQuantity('HKQuantityTypeIdentifierAppleExerciseTime', ['cumulativeSum'], {
      filter: { date: { startDate: startOfDay, endDate: now } }, unit: 'min',
    }),
    queryStatisticsForQuantity('HKQuantityTypeIdentifierStepCount', ['cumulativeSum'], {
      filter: { date: { startDate: startOfDay, endDate: now } }, unit: 'count',
    }),
    getMostRecentQuantitySample('HKQuantityTypeIdentifierRestingHeartRate', 'count/min'),
  ]);

  const result: HealthPredictionInputs = {};
  if (activity.sumQuantity && activity.sumQuantity.quantity >= 0) {
    result.physicalActivityMinutes = String(Math.round(activity.sumQuantity.quantity));
  }
  if (steps.sumQuantity && steps.sumQuantity.quantity >= 0) {
    result.steps = String(Math.round(steps.sumQuantity.quantity));
  }
  if (restingHeartRate && restingHeartRate.startDate >= sevenDaysAgo) {
    result.heartRate = String(Math.round(restingHeartRate.quantity));
  }
  return result;
}
