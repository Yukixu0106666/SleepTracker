import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { UserProfile } from '../../services/dailyRecommendation';
import { HealthPredictionInputs, readHealthPredictionInputs } from '../../services/healthPredictionInputs';
import { getSleepHistory } from '../../services/sleepSync';
import { predictTonightSleep, TonightCheckIn, TonightSleepPrediction } from '../../services/tonightSleepPrediction';
import { useLanguage } from '../../theme/LanguageContext';
import { useThemeContext } from '../../theme/ThemeContext';

const EMPTY_CHECK_IN: TonightCheckIn = { physicalActivityMinutes: '', stressLevel: '', heartRate: '', steps: '' };

export default function PredictionScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [prediction, setPrediction] = useState<TonightSleepPrediction | null>(null);
  const [checkIn, setCheckIn] = useState<TonightCheckIn>(EMPTY_CHECK_IN);
  const [healthFields, setHealthFields] = useState<(keyof HealthPredictionInputs)[]>([]);
  const [healthSyncMessage, setHealthSyncMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncingHealth, setIsSyncingHealth] = useState(false);

  const { theme } = useThemeContext();
  const { t } = useLanguage();
  const isDark = theme === 'dark';

  useFocusEffect(useCallback(() => {
    let active = true;
    setIsLoading(true);
    Promise.all([
      AsyncStorage.getItem('userProfile'),
      AsyncStorage.getItem('tonightCheckIn.v1'),
      AsyncStorage.getItem('appleHealthConnected.v1'),
      getSleepHistory(),
    ])
      .then(async ([profileData, checkInData, healthConnected, recentSessions]) => {
        if (!active) return;
        const latestProfile = profileData ? (JSON.parse(profileData) as UserProfile) : undefined;
        const savedCheckIn = checkInData ? (JSON.parse(checkInData) as TonightCheckIn) : EMPTY_CHECK_IN;
        let resolvedCheckIn = savedCheckIn;

        if (healthConnected === 'true') {
          try {
            const healthInputs = await readHealthPredictionInputs(false);
            if (!active) return;
            const syncedFields = Object.keys(healthInputs) as (keyof HealthPredictionInputs)[];
            if (syncedFields.length > 0) {
              resolvedCheckIn = { ...savedCheckIn, ...healthInputs };
              setHealthFields(syncedFields);
              setHealthSyncMessage(t('healthPredictionSynced'));
              await AsyncStorage.setItem('tonightCheckIn.v1', JSON.stringify(resolvedCheckIn));
            } else {
              setHealthFields([]);
              setHealthSyncMessage(t('healthPredictionNoData'));
            }
          } catch {
            if (active) setHealthSyncMessage(t('healthPredictionSyncError'));
          }
        }

        if (!active) return;
        setProfile(latestProfile ?? null);
        setCheckIn(resolvedCheckIn);
        setPrediction(predictTonightSleep(resolvedCheckIn, latestProfile, recentSessions));
      })
      .catch(() => undefined)
      .finally(() => { if (active) setIsLoading(false); });

    return () => { active = false; };
  }, [t]));

  const syncHealthInputs = async () => {
    setIsSyncingHealth(true);
    setHealthSyncMessage(null);
    try {
      const [healthInputs, recentSessions] = await Promise.all([
        readHealthPredictionInputs(true),
        getSleepHistory(),
      ]);
      const syncedFields = Object.keys(healthInputs) as (keyof HealthPredictionInputs)[];
      if (syncedFields.length === 0) {
        setHealthFields([]);
        setHealthSyncMessage(t('healthPredictionNoData'));
        return;
      }

      const mergedCheckIn = { ...checkIn, ...healthInputs };
      setCheckIn(mergedCheckIn);
      setHealthFields(syncedFields);
      setHealthSyncMessage(t('healthPredictionSynced'));
      setPrediction(predictTonightSleep(mergedCheckIn, profile ?? undefined, recentSessions));
      await Promise.all([
        AsyncStorage.setItem('appleHealthConnected.v1', 'true'),
        AsyncStorage.setItem('tonightCheckIn.v1', JSON.stringify(mergedCheckIn)),
      ]);
    } catch {
      setHealthSyncMessage(t('healthPredictionSyncError'));
    } finally {
      setIsSyncingHealth(false);
    }
  };

  const updatePrediction = async () => {
    await AsyncStorage.setItem('tonightCheckIn.v1', JSON.stringify(checkIn));
    const recentSessions = await getSleepHistory();
    setPrediction(predictTonightSleep(checkIn, profile ?? undefined, recentSessions));
  };

  return (
    <SafeAreaView style={[styles.safeArea, isDark && styles.containerDark]} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.container, isDark && styles.containerDark]}>
        <Text style={[styles.title, isDark && styles.textDark]}>{t('tonightPrediction')}</Text>
        <Text style={[styles.intro, isDark && styles.mutedDark]}>{t('tonightCheckInIntro')}</Text>

        {isLoading ? (
          <ActivityIndicator color="#176C89" style={styles.loading} />
        ) : (
          <View style={styles.content}>
            <Pressable
              accessibilityRole="button"
              disabled={isSyncingHealth}
              onPress={() => void syncHealthInputs()}
              style={[styles.healthButton, isDark && styles.healthButtonDark, isSyncingHealth && styles.disabled]}
            >
              {isSyncingHealth
                ? <ActivityIndicator color="#176C89" size="small" />
                : <Text style={[styles.healthButtonText, isDark && styles.healthButtonTextDark]}>{t('syncAppleHealth')}</Text>}
            </Pressable>
            {healthSyncMessage ? <Text style={[styles.syncMessage, isDark && styles.mutedDark]}>{healthSyncMessage}</Text> : null}
            <Text style={[styles.manualNote, isDark && styles.mutedDark]}>{t('stressManualNote')}</Text>

            <View style={styles.inputs}>
              {([
                ['physicalActivityMinutes', 'activityMinutes', '60'],
                ['stressLevel', 'stressLevel', '1–10'],
                ['heartRate', 'restingHeartRate', '70'],
                ['steps', 'dailySteps', '7000'],
              ] as const).map(([field, label, placeholder]) => {
                const isFromHealth = field !== 'stressLevel' && healthFields.includes(field);
                return (
                  <View key={field} style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, isDark && styles.textDark]}>
                      {t(label)}{isFromHealth ? ` · ${t('fromAppleHealth')}` : ''}
                    </Text>
                    <TextInput
                      accessibilityLabel={t(label)}
                      editable={!isFromHealth}
                      keyboardType="numeric"
                      onChangeText={(value) => {
                        setHealthFields((current) => current.filter((item) => item !== field));
                        setCheckIn((current) => ({ ...current, [field]: value }));
                      }}
                      placeholder={placeholder}
                      placeholderTextColor={isDark ? '#78908D' : '#94A3B8'}
                      style={[styles.input, isFromHealth && styles.inputSynced, isDark && styles.inputDark]}
                      value={checkIn[field]}
                    />
                  </View>
                );
              })}
            </View>

            <Pressable accessibilityRole="button" onPress={() => void updatePrediction()} style={styles.predictButton}>
              <Text style={styles.predictButtonText}>{t('calculateTonightPrediction')}</Text>
            </Pressable>

            {prediction?.available ? (
              <View style={styles.result}>
                <View style={styles.scoreRow}>
                  <Text style={[styles.score, isDark && styles.textDark]}>{prediction.score}%</Text>
                  <View style={styles.labelBlock}>
                    <Text style={[styles.resultLabel, isDark && styles.textDark]}>
                      {prediction.label === 'good' ? t('likelyGoodTonight') : t('likelyPoorTonight')}
                    </Text>
                    <Text style={[styles.muted, isDark && styles.mutedDark]}>{t('tonightGoodLikelihood')}</Text>
                  </View>
                </View>
                <View style={[styles.track, isDark && styles.trackDark]}>
                  <View style={[styles.fill, { width: `${prediction.score}%` }]} />
                </View>
                {prediction.factors.map((factor) => {
                  const label = factor.feature === 'activity' ? 'activityMinutes' : factor.feature === 'stress' ? 'stressLevel' : factor.feature === 'heartRate' ? 'restingHeartRate' : factor.feature === 'steps' ? 'dailySteps' : factor.feature === 'age' ? 'ageSignal' : 'bmiSignal';
                  return (
                    <Text key={factor.feature} style={[styles.factor, isDark && styles.textDark]}>
                      {factor.direction === 'positive' ? '+' : '−'} {t(label)}: {factor.displayValue} · {factor.direction === 'positive' ? t('raisedTonightPrediction') : t('loweredTonightPrediction')}
                    </Text>
                  );
                })}
                <Text style={[styles.factor, isDark && styles.textDark]}>
                  {t('recentSleepHistory')}: {prediction.historyNights > 0
                    ? `${prediction.recentGoodNights}/${prediction.historyNights} ${t('goodNights')} · ${prediction.recentAverageDuration?.toFixed(1)} ${t('hours')}`
                    : t('noValidHistory')}
                </Text>
                <Text style={[styles.method, isDark && styles.mutedDark]}>{t('historyInfluence')}: {Math.round(prediction.historyInfluence * 100)}%</Text>
                <Text style={[styles.method, isDark && styles.mutedDark]}>{t('tonightModelMethod')}</Text>
                <Text style={[styles.method, isDark && styles.mutedDark]}>{t('tonightModelValidation')}</Text>
              </View>
            ) : (
              <Text style={[styles.empty, isDark && styles.textDark]}>{t('completeTonightInputs')}</Text>
            )}
            <Text style={[styles.disclaimer, isDark && styles.mutedDark]}>{t('tonightPredictionDisclaimer')}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { backgroundColor: '#FFFFFF', paddingBottom: 120, paddingHorizontal: 24, paddingTop: 24 },
  containerDark: { backgroundColor: '#0A1627' },
  title: { color: '#111827', fontSize: 30, fontWeight: '800', marginBottom: 10 },
  intro: { color: '#64748B', fontSize: 14, lineHeight: 21, marginBottom: 28 },
  loading: { marginTop: 40 },
  content: { width: '100%' },
  healthButton: { alignItems: 'center', backgroundColor: '#E9F4F7', borderColor: '#176C89', borderRadius: 8, borderWidth: 1, marginBottom: 10, paddingVertical: 12 },
  healthButtonDark: { backgroundColor: '#17364B', borderColor: '#9CC7D8' },
  healthButtonText: { color: '#176C89', fontSize: 14, fontWeight: '700' },
  healthButtonTextDark: { color: '#9CC7D8' },
  disabled: { opacity: 0.6 },
  syncMessage: { color: '#526763', fontSize: 11, lineHeight: 16, marginBottom: 4 },
  manualNote: { color: '#64748B', fontSize: 11, lineHeight: 16, marginBottom: 18 },
  inputs: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 18, rowGap: 18 },
  inputGroup: { flexBasis: '47%', flexGrow: 1 },
  inputLabel: { color: '#334155', fontSize: 12, fontWeight: '600', marginBottom: 4 },
  input: { backgroundColor: 'transparent', borderBottomColor: '#A8C8D3', borderBottomWidth: 1, color: '#172B29', fontSize: 17, paddingHorizontal: 0, paddingVertical: 10 },
  inputDark: { backgroundColor: 'transparent', borderBottomColor: '#527B91', color: '#E0E7FF' },
  inputSynced: { color: '#176C89' },
  predictButton: { alignItems: 'center', backgroundColor: '#176C89', borderRadius: 8, marginBottom: 20, marginTop: 28, paddingVertical: 13 },
  predictButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  result: { borderTopColor: '#D7E6EA', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 22 },
  scoreRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  score: { color: '#176C89', fontSize: 38, fontWeight: '800' },
  labelBlock: { flex: 1 },
  resultLabel: { color: '#243B39', fontSize: 16, fontWeight: '700' },
  muted: { color: '#66736F', fontSize: 13, marginTop: 3 },
  track: { backgroundColor: '#D7E6EA', borderRadius: 4, height: 8, marginBottom: 12, marginTop: 10, overflow: 'hidden' },
  trackDark: { backgroundColor: '#24465D' },
  fill: { backgroundColor: '#176C89', borderRadius: 4, height: '100%' },
  factor: { color: '#334155', fontSize: 13, lineHeight: 20 },
  method: { color: '#66736F', fontSize: 11, lineHeight: 16, marginTop: 5 },
  empty: { color: '#333333', fontSize: 14, lineHeight: 22 },
  disclaimer: { color: '#66736F', fontSize: 11, lineHeight: 16, marginTop: 12 },
  textDark: { color: '#E0E7FF' },
  mutedDark: { color: '#AAAAAA' },
});
