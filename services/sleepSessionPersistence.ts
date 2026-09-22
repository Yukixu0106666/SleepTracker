import AsyncStorage from '@react-native-async-storage/async-storage';
import { flushSleepUploads, getSleepHistory, sleepJournal } from './sleepSync';

import {
    DailyRecommendation,
    generateDailyRecommendation,
    SleepSession,
    UserProfile,
} from './dailyRecommendation';

export async function persistCompletedSleep(session: SleepSession): Promise<DailyRecommendation> {
  await sleepJournal.add(session);
  const history = await getSleepHistory();
  void flushSleepUploads().catch(() => undefined);

  const profileData = await AsyncStorage.getItem('userProfile');
  const profile = profileData ? (JSON.parse(profileData) as UserProfile) : undefined;
  const language = (await AsyncStorage.getItem('appLanguage')) === 'zh' ? 'zh' : 'en';
  const recommendation = await generateDailyRecommendation({ session, profile, recentSessions: history, language });
  await AsyncStorage.setItem('dailyRecommendation', JSON.stringify(recommendation));

  return recommendation;
}
