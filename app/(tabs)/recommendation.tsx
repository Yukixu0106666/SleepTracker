import { getSleepHistory } from '../../services/sleepSync';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    DailyRecommendation,
    generateDailyRecommendation,
    isStructuredRecommendation,
    RECOMMENDATION_PROMPT_VERSION,
    SleepSession,
    UserProfile,
} from '../../services/dailyRecommendation';
import { useThemeContext } from '../../theme/ThemeContext';
import { useLanguage } from '../../theme/LanguageContext';

export default function RecommendationScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [recommendation, setRecommendation] = useState<DailyRecommendation | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { theme } = useThemeContext();
  const { language, t } = useLanguage();
  const isDark = theme === 'dark';

  const refreshRecommendation = async (providedProfile?: UserProfile, providedSession?: SleepSession) => {
    setIsLoading(true);
    try {
      const profileData = providedProfile ? null : await AsyncStorage.getItem('userProfile');
      const recentSessions = await getSleepHistory();
      const userProfile = providedProfile ?? (profileData ? (JSON.parse(profileData) as UserProfile) : undefined);
      const sleepSession = providedSession ?? recentSessions.at(-1);
      const generated = await generateDailyRecommendation({ session: sleepSession, profile: userProfile, recentSessions, language });

      setRecommendation(generated);
      await AsyncStorage.setItem('dailyRecommendation', JSON.stringify(generated));

      if (userProfile) {
        setProfile(userProfile);
      }
    } catch (err) {
      console.error('Failed to refresh recommendation:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const loadRecommendation = async () => {
      try {
        const profileData = await AsyncStorage.getItem('userProfile');
        const recentSessions = await getSleepHistory();
        const savedRecommendation = await AsyncStorage.getItem('dailyRecommendation');
        const userProfile = profileData ? (JSON.parse(profileData) as UserProfile) : undefined;
        const sleepSession = recentSessions.at(-1);

        if (userProfile) {
          setProfile(userProfile);
        }

        const savedValue = savedRecommendation ? JSON.parse(savedRecommendation) : undefined;
        if (
          isStructuredRecommendation(savedValue) &&
          savedValue.source === 'groq' &&
          savedValue.language === language &&
          savedValue.promptVersion === RECOMMENDATION_PROMPT_VERSION
        ) {
          setRecommendation(savedValue);
        } else {
          const generated = await generateDailyRecommendation({ session: sleepSession, profile: userProfile, recentSessions, language });
          setRecommendation(generated);
          await AsyncStorage.setItem('dailyRecommendation', JSON.stringify(generated));
        }
      } catch (err) {
        console.error('Failed to load recommendation:', err);
      } finally {
        setIsLoading(false);
      }
    };

    void loadRecommendation();
  }, [language]);

  return (
    <SafeAreaView style={[styles.safeArea, isDark && styles.containerDark]} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.container, isDark && styles.containerDark]}>
      <Text style={[styles.title, isDark && styles.titleDark]}>{t('recommendations')}</Text>

      {profile && profile.name && (
        <Text style={[styles.greeting, isDark && styles.greetingDark]}>
          {t('hello')}，{profile.name}！
        </Text>
      )}

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#176C89" />
          <Text style={[styles.recommendationText, isDark && styles.recommendationTextDark]}>
            {t('preparingSupport')}
          </Text>
        </View>
      ) : recommendation ? (
        <View style={styles.recommendationsContainer}>
          {recommendation.source === 'local' && (
            <View style={[styles.offlineNotice, isDark && styles.offlineNoticeDark]}>
              <Text style={[styles.offlineNoticeText, isDark && styles.recommendationTextDark]}>
                {t('offlinePlan')} {recommendation.fallbackReason}
              </Text>
            </View>
          )}
          <View style={[styles.card, isDark && styles.cardDark]}>
            <Text style={[styles.headline, isDark && styles.recommendationTextDark]}>{recommendation.headline}</Text>
          </View>
          <View style={[styles.card, isDark && styles.cardDark]}>
            <Text style={[styles.sectionTitle, isDark && styles.recommendationTextDark]}>{t('foodDrink')}</Text>
            {recommendation.foodPlan.map((item) => (
              <View key={`${item.timing}-${item.meal}`} style={styles.planItem}>
                <Text style={[styles.planTiming, isDark && styles.recommendationTextDark]}>{item.timing}</Text>
                <Text style={[styles.recommendationText, isDark && styles.recommendationTextDark]}>{item.meal}</Text>
                <Text style={[styles.planPortion, isDark && styles.greetingDark]}>{item.portion}</Text>
              </View>
            ))}
          </View>
          <View style={[styles.card, isDark && styles.cardDark]}>
            <Text style={[styles.sectionTitle, isDark && styles.recommendationTextDark]}>{t('movement')}</Text>
            <Text style={[styles.movementActivity, isDark && styles.recommendationTextDark]}>{recommendation.movementPlan.activity}</Text>
            <Text style={[styles.recommendationText, isDark && styles.recommendationTextDark]}>
              {recommendation.movementPlan.durationMinutes} {t('minutes')}，{recommendation.movementPlan.intensity}
            </Text>
            <Text style={[styles.planPortion, isDark && styles.greetingDark]}>{recommendation.movementPlan.timing}</Text>
            <MovementSection title={t('warmUp')} steps={recommendation.movementPlan.warmUp} isDark={isDark} minuteLabel={t('min')} />
            <MovementSection title={t('mainRoutine')} steps={recommendation.movementPlan.workout} isDark={isDark} minuteLabel={t('min')} />
            <MovementSection title={t('coolDown')} steps={recommendation.movementPlan.coolDown} isDark={isDark} minuteLabel={t('min')} />
            <View style={styles.alternativeBox}>
              <Text style={[styles.alternativeTitle, isDark && styles.recommendationTextDark]}>{t('lowerEnergy')}</Text>
              <Text style={[styles.recommendationText, isDark && styles.recommendationTextDark]}>
                {recommendation.movementPlan.lowerEnergyAlternative}
              </Text>
            </View>
          </View>
          <View style={[styles.card, isDark && styles.cardDark]}>
            <Text style={[styles.sectionTitle, isDark && styles.recommendationTextDark]}>{t('kinderMindset')}</Text>
            <Text style={[styles.recommendationText, isDark && styles.recommendationTextDark]}>{recommendation.mindset}</Text>
          </View>
          <View style={[styles.card, isDark && styles.cardDark]}>
            <Text style={[styles.sectionTitle, isDark && styles.recommendationTextDark]}>{t('tonight')}</Text>
            <Text style={[styles.recommendationText, isDark && styles.recommendationTextDark]}>{recommendation.tonight}</Text>
          </View>
        </View>
      ) : (
        <View style={[styles.card, isDark && styles.cardDark]}>
          <Text style={[styles.recommendationText, isDark && styles.recommendationTextDark]}>
            {t('noRecommendations')}
          </Text>
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        disabled={isLoading}
        onPress={() => refreshRecommendation()}
        style={[styles.refreshButton, isLoading && styles.refreshButtonDisabled]}
      >
        <Text style={styles.refreshButtonText}>{t('refreshAdvice')}</Text>
      </Pressable>

      <Text style={[styles.disclaimer, isDark && styles.greetingDark]}>
        {t('wellnessDisclaimer')}
      </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function MovementSection({
  title,
  steps,
  isDark,
  minuteLabel,
}: {
  title: string;
  steps: DailyRecommendation['movementPlan']['warmUp'];
  isDark: boolean;
  minuteLabel: string;
}) {
  return (
    <View style={styles.movementSection}>
      <Text style={[styles.movementSectionTitle, isDark && styles.recommendationTextDark]}>{title}</Text>
      {steps.map((step) => (
        <View key={`${step.name}-${step.durationMinutes}`} style={styles.movementStep}>
          <Text style={[styles.movementStepName, isDark && styles.recommendationTextDark]}>
            {step.name} - {step.durationMinutes} {minuteLabel}
          </Text>
          <Text style={[styles.recommendationText, isDark && styles.recommendationTextDark]}>{step.instruction}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    paddingTop: 20,
    paddingBottom: 120,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  containerDark: {
    backgroundColor: '#0A1627',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#000',
    textAlign: 'center',
  },
  titleDark: {
    color: '#fff',
  },
  greeting: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  greetingDark: {
    color: '#aaa',
  },
  recommendationsContainer: {
    gap: 12,
  },
  offlineNotice: {
    backgroundColor: '#eff6ff',
    borderLeftColor: '#3C6EB4',
    borderLeftWidth: 3,
    padding: 12,
  },
  offlineNoticeDark: {
    backgroundColor: '#172554',
  },
  offlineNoticeText: {
    color: '#1e3a8a',
    fontSize: 13,
    lineHeight: 19,
  },
  card: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#3C6EB4',
  },
  cardDark: {
    backgroundColor: '#1E293B',
    borderLeftColor: '#60A5FA',
  },
  recommendationText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#333',
  },
  headline: {
    fontSize: 17,
    lineHeight: 24,
    color: '#333',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    marginBottom: 6,
  },
  planItem: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#d1d5db',
    paddingTop: 10,
    marginTop: 10,
  },
  planTiming: {
    color: '#3C6EB4',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  planPortion: {
    color: '#666',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 3,
  },
  movementActivity: {
    color: '#333',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  movementSection: {
    borderTopColor: '#d1d5db',
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 12,
    paddingTop: 12,
  },
  movementSectionTitle: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  movementStep: {
    marginBottom: 10,
  },
  movementStepName: {
    color: '#3C6EB4',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  alternativeBox: {
    backgroundColor: '#e0f2fe',
    marginTop: 4,
    padding: 10,
  },
  alternativeTitle: {
    color: '#075985',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  recommendationTextDark: {
    color: '#e0e7ff',
  },
  loadingContainer: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 28,
  },
  refreshButton: {
    alignItems: 'center',
    backgroundColor: '#176C89',
    borderRadius: 8,
    marginTop: 12,
    paddingVertical: 12,
  },
  refreshButtonDisabled: {
    opacity: 0.6,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  disclaimer: {
    color: '#666',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 14,
    textAlign: 'center',
  },
});
