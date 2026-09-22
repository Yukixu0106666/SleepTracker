import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  AppState,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  DailyRecommendation,
  SleepSession,
} from '../../services/dailyRecommendation';
import {
  getActiveSleep,
  hasNativeSleepActivity,
  startSleepActivity,
  stopSleepActivity,
  takeCompletedSleep,
} from '../../services/sleepActivity';
import { persistCompletedSleep } from '../../services/sleepSessionPersistence';
import type { SleepQualityPrediction } from '../../services/sleepQualityModel';
import { useThemeContext } from '../../theme/ThemeContext';
import { useLanguage } from '../../theme/LanguageContext';

export default function SleepScreen() {
  const [sleepStart, setSleepStart] = useState<Date | null>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showConfirmStop, setShowConfirmStop] = useState(false);
  const [showTimingReminder, setShowTimingReminder] = useState(false);
  const [recommendation, setRecommendation] = useState<DailyRecommendation | null>(null);
  const [qualityPrediction, setQualityPrediction] = useState<SleepQualityPrediction | null>(null);
  const [showModelDetails, setShowModelDetails] = useState(false);
  const [isGeneratingRecommendation, setIsGeneratingRecommendation] = useState(false);

  const { theme } = useThemeContext();
  const { t } = useLanguage();
  const isDark = theme === 'dark';

  useEffect(() => {
    async function restoreNativeSleepState() {
      if (!hasNativeSleepActivity()) return;
      const activeSleep = await getActiveSleep();
      const completedSleep = await takeCompletedSleep();
      if (activeSleep) setSleepStart(new Date(activeSleep.start));
      else setSleepStart(null);
      if (completedSleep) await saveCompletedSleep(completedSleep, false);
    }

    restoreNativeSleepState().catch(() => undefined);
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') restoreNativeSleepState().catch(() => undefined);
    });
    return () => subscription.remove();
  }, []);

  const startSleep = async () => {
    if (hasNativeSleepActivity()) {
      const activeSleep = await startSleepActivity();
      setSleepStart(new Date(activeSleep.start));
    } else {
      setSleepStart(new Date());
    }
  };

  const needsSleepTimingReminder = () => {
    const hour = new Date().getHours();
    const isMiddayRestWindow = hour >= 12 && hour < 14;
    return hour < 21 && !isMiddayRestWindow;
  };

  const handleToggleSleep = async () => {
    if (!sleepStart) {
      if (needsSleepTimingReminder()) {
        setShowTimingReminder(true);
      } else {
        await startSleep();
      }
    } else {
      setShowConfirmStop(true);
    }
  };

  const stopSleep = async () => {
    if (!sleepStart) return;

    const completedSleep = hasNativeSleepActivity()
      ? await stopSleepActivity()
      : {
          start: sleepStart.toISOString(),
          end: new Date().toISOString(),
          duration: +((Date.now() - sleepStart.getTime()) / (1000 * 60 * 60)).toFixed(2),
        };
    if (!completedSleep) return;

    await saveCompletedSleep(completedSleep, true);
  };

  const saveCompletedSleep = async (completedSleep: SleepSession, showSummary: boolean) => {
    const session: SleepSession = {
      start: completedSleep.start,
      end: completedSleep.end,
      duration: completedSleep.duration,
    };

    setSleepStart(null);
    if (showSummary) {
      setShowConfirmStop(false);
      setShowSummaryModal(true);
      setShowModelDetails(false);
      setIsGeneratingRecommendation(true);
    }

    try {
      const result = await persistCompletedSleep(session);
      setRecommendation(result.recommendation);
      setQualityPrediction(result.qualityPrediction);
    } finally {
      if (showSummary) setIsGeneratingRecommendation(false);
    }
  };

  const formattedStart = sleepStart
    ? sleepStart.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <SafeAreaView style={[styles.safeArea, isDark && styles.safeAreaDark]} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.eyebrow, isDark && styles.eyebrowDark]}>{t('sleepJournal')}</Text>
            <Text style={[styles.title, isDark && styles.textDark]}>{t('restRecorded')}</Text>
          </View>
          <View style={[styles.headerIcon, isDark && styles.headerIconDark]}>
            <MaterialCommunityIcons name="weather-night" size={22} color={isDark ? '#A7D7EA' : '#176C89'} />
          </View>
        </View>

        <View style={[styles.statusPanel, isDark && styles.statusPanelDark]}>
          <View style={styles.statusTopRow}>
            <View style={styles.statusCopy}>
              <Text style={[styles.statusLabel, isDark && styles.statusLabelDark]}>
                {sleepStart ? t('sleepInProgress') : t('nextRest')}
              </Text>
              <Text style={[styles.statusTitle, isDark && styles.textDark]}>
                {sleepStart ? t('sleepWell') : t('ready')}
              </Text>
            </View>
            <View style={styles.statusIconColumn}>
              <MaterialCommunityIcons
                name="bed-outline"
                size={27}
                color={isDark ? '#A7D7EA' : '#176C89'}
              />
            </View>
          </View>

          <View style={[styles.timeBlock, isDark && styles.timeBlockDark]}>
            {sleepStart ? (
              <>
                <Text style={[styles.elapsedTime, isDark && styles.textDark]}>{formattedStart}</Text>
                <Text style={[styles.elapsedCaption, isDark && styles.statusLabelDark]}>{t('startedAt')}</Text>
              </>
            ) : (
              <>
                <Text style={[styles.elapsedTime, isDark && styles.textDark]}>--:--</Text>
                <Text style={[styles.elapsedCaption, isDark && styles.statusLabelDark]}>{t('waiting')}</Text>
              </>
            )}
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={sleepStart ? t('stopTracking') : t('startTracking')}
          onPress={() => void handleToggleSleep()}
          style={({ pressed }) => [
            styles.primaryAction,
            styles.startAction,
            pressed && styles.actionPressed,
          ]}
        >
          <MaterialCommunityIcons name={sleepStart ? 'stop' : 'play'} size={22} color="#FFFFFF" />
          <Text style={styles.primaryActionText}>{sleepStart ? t('stopSleep') : t('startSleep')}</Text>
        </Pressable>

        <View style={[styles.widgetNote, isDark && styles.widgetNoteDark]}>
          <MaterialCommunityIcons name="widgets-outline" size={18} color={isDark ? '#9CC7D8' : '#267892'} />
          <Text style={[styles.widgetNoteText, isDark && styles.widgetNoteTextDark]}>
            {t('widgetNote')}
          </Text>
        </View>
      </View>

      <Modal visible={showTimingReminder} transparent animationType="fade" onRequestClose={() => setShowTimingReminder(false)}>
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, isDark && styles.modalDark]}>
            <View style={[styles.modalIcon, isDark && styles.modalIconDark]}>
              <MaterialCommunityIcons name="clock-alert-outline" size={26} color={isDark ? '#A7D7EA' : '#176C89'} />
            </View>
            <Text style={[styles.summaryTitle, isDark && styles.textDark]}>{t('timingTitle')}</Text>
            <Text style={[styles.modalText, isDark && styles.textDark]}>
              {t('timingBody')}
            </Text>
            <View style={[styles.modalButtonRow, styles.centeredModalButtonRow]}>
              <Pressable onPress={() => setShowTimingReminder(false)} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>{t('goBack')}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowTimingReminder(false);
                  void startSleep();
                }}
                style={styles.continueButton}
              >
                <Text style={styles.continueButtonText}>{t('startAnyway')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showConfirmStop} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, isDark && styles.modalDark]}>
            <Text style={[styles.summaryTitle, styles.centeredModalText, isDark && styles.textDark]}>{t('finishSleep')}</Text>
            <Text style={[styles.modalText, styles.centeredModalText, isDark && styles.textDark]}>{t('finishBody')}</Text>
            <View style={[styles.modalButtonRow, styles.centeredModalButtonRow]}>
              <Pressable onPress={() => setShowConfirmStop(false)} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>{t('keepTracking')}</Text>
              </Pressable>
              <Pressable onPress={() => void stopSleep()} style={styles.continueButton}>
                <Text style={styles.continueButtonText}>{t('stopAndSave')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showSummaryModal} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, isDark && styles.modalDark]}>
            {isGeneratingRecommendation ? (
              <Text style={[styles.modalText, isDark && styles.textDark]}>
                {t('preparing')}
              </Text>
            ) : (
              <ScrollView style={styles.summaryScroll} showsVerticalScrollIndicator={false}>
                {qualityPrediction && (
                  <View style={[styles.qualityCard, isDark && styles.qualityCardDark]}>
                    <Text style={[styles.qualityEyebrow, isDark && styles.statusLabelDark]}>{t('morningReport')}</Text>
                    <View style={styles.qualityScoreRow}>
                      <Text style={[styles.qualityScore, isDark && styles.textDark]}>{qualityPrediction.score}%</Text>
                      <View style={styles.qualityLabelBlock}>
                        <Text style={[styles.qualityLabel, isDark && styles.textDark]}>
                          {qualityPrediction.label === 'good' ? t('predictedGood') : t('predictedPoor')}
                        </Text>
                        <Text style={[styles.qualityCaption, isDark && styles.statusLabelDark]}>{t('goodSleepLikelihood')}</Text>
                      </View>
                    </View>
                    <View style={[styles.probabilityTrack, isDark && styles.probabilityTrackDark]}>
                      <View style={[styles.probabilityFill, { width: `${qualityPrediction.score}%` }]} />
                    </View>
                    <Pressable onPress={() => setShowModelDetails((visible) => !visible)}>
                      <Text style={styles.modelDetailsButton}>
                        {showModelDetails ? t('hideModelDetails') : t('whyThisEstimate')}
                      </Text>
                    </Pressable>
                    {showModelDetails && (
                      <View style={[styles.modelDetails, isDark && styles.modelDetailsDark]}>
                        <Text style={[styles.modelDetailsTitle, isDark && styles.textDark]}>{t('modelSignals')}</Text>
                        {qualityPrediction.factors.map((factor) => {
                          const featureLabel = factor.feature === 'duration'
                            ? t('durationSignal')
                            : factor.feature === 'age' ? t('ageSignal') : t('bmiSignal');
                          return (
                            <Text key={factor.feature} style={[styles.factorText, isDark && styles.textDark]}>
                              {factor.direction === 'positive' ? '+' : '−'} {featureLabel}: {factor.displayValue} · {factor.direction === 'positive' ? t('positiveSignal') : t('negativeSignal')}
                            </Text>
                          );
                        })}
                        <Text style={[styles.modelCopy, isDark && styles.statusLabelDark]}>{t('modelMethod')}</Text>
                        <Text style={[styles.modelCopy, isDark && styles.statusLabelDark]}>{t('modelValidation')}</Text>
                        <Text style={[styles.modelDisclaimer, isDark && styles.statusLabelDark]}>{t('modelDisclaimer')}</Text>
                      </View>
                    )}
                  </View>
                )}
                <Text style={[styles.summaryTitle, isDark && styles.textDark]}>
                  {t('sleepSupport')}
                </Text>
                <Text style={[styles.modalText, isDark && styles.textDark]}>{recommendation?.headline}</Text>
                <Text style={[styles.summaryItem, isDark && styles.textDark]}>
                  {t('firstMeal')}: {recommendation?.foodPlan[0]?.meal} ({recommendation?.foodPlan[0]?.portion})
                </Text>
                <Text style={[styles.summaryItem, isDark && styles.textDark]}>
                  {t('movement')}: {recommendation?.movementPlan.activity}, {recommendation?.movementPlan.durationMinutes} minutes. Start with {recommendation?.movementPlan.warmUp[0]?.name}.
                </Text>
                <Text style={[styles.summaryItem, isDark && styles.textDark]}>{t('mindset')}: {recommendation?.mindset}</Text>
              </ScrollView>
            )}
            <Pressable onPress={() => setShowSummaryModal(false)} style={styles.closeButton}>
              <Text style={styles.continueButtonText}>{t('close')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F8FA',
  },
  safeAreaDark: {
    backgroundColor: '#0A1627',
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  eyebrow: {
    color: '#267892',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginBottom: 5,
  },
  eyebrowDark: {
    color: '#9CC7D8',
  },
  title: {
    color: '#123044',
    fontSize: 29,
    fontWeight: '700',
    letterSpacing: 0,
  },
  headerIcon: {
    alignItems: 'center',
    backgroundColor: '#D9EDF3',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  headerIconDark: {
    backgroundColor: '#17364B',
  },
  statusPanel: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D7E6EA',
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 20,
  },
  statusPanelDark: {
    backgroundColor: '#142941',
    borderColor: '#24465D',
  },
  statusTopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    minHeight: 58,
  },
  statusCopy: {
    flex: 1,
    flexShrink: 1,
    paddingRight: 64,
  },
  statusIconColumn: {
    alignItems: 'flex-start',
    position: 'absolute',
    right: -4,
    top: 2,
  },
  statusLabel: {
    color: '#53707D',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  statusLabelDark: {
    color: '#9CC7D8',
  },
  statusTitle: {
    color: '#123044',
    fontSize: 23,
    fontWeight: '700',
  },
  timeBlock: {
    backgroundColor: '#EDF5F7',
    borderRadius: 6,
    marginTop: 24,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  timeBlockDark: {
    backgroundColor: '#0D2035',
  },
  elapsedTime: {
    color: '#123044',
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 0,
  },
  elapsedCaption: {
    color: '#53707D',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.9,
    marginTop: 4,
  },
  primaryAction: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginTop: 18,
    paddingVertical: 17,
  },
  startAction: {
    backgroundColor: '#176C89',
  },
  actionPressed: {
    opacity: 0.84,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  textDark: {
    color: '#fff',
  },
  widgetNote: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
    paddingHorizontal: 4,
  },
  widgetNoteDark: {},
  widgetNoteText: {
    color: '#53707D',
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  widgetNoteTextDark: {
    color: '#9CC7D8',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 8,
    width: '86%',
    maxHeight: '90%',
    alignItems: 'stretch',
  },
  summaryScroll: {
    flexGrow: 0,
  },
  modalDark: {
    backgroundColor: '#142941',
  },
  modalIcon: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#D9EDF3',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    marginBottom: 18,
    width: 40,
  },
  modalIconDark: {
    backgroundColor: '#17364B',
  },
  modalText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'left',
    color: '#000',
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    color: '#000',
    textAlign: 'left',
  },
  centeredModalText: {
    textAlign: 'center',
  },
  summaryItem: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
    color: '#000',
  },
  qualityCard: {
    backgroundColor: '#EDF7FA',
    borderColor: '#C7E2EA',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 20,
    padding: 16,
  },
  qualityCardDark: {
    backgroundColor: '#0D2035',
    borderColor: '#24465D',
  },
  qualityEyebrow: {
    color: '#267892',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  qualityScoreRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  qualityScore: {
    color: '#123044',
    fontSize: 38,
    fontWeight: '800',
    marginRight: 14,
  },
  qualityLabelBlock: {
    flex: 1,
  },
  qualityLabel: {
    color: '#123044',
    fontSize: 15,
    fontWeight: '700',
  },
  qualityCaption: {
    color: '#53707D',
    fontSize: 12,
    marginTop: 3,
  },
  probabilityTrack: {
    backgroundColor: '#D7E6EA',
    borderRadius: 4,
    height: 7,
    marginTop: 12,
    overflow: 'hidden',
  },
  probabilityTrackDark: {
    backgroundColor: '#24465D',
  },
  probabilityFill: {
    backgroundColor: '#176C89',
    borderRadius: 4,
    height: '100%',
  },
  modelDetailsButton: {
    color: '#176C89',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 12,
  },
  modelDetails: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    marginTop: 12,
    padding: 12,
  },
  modelDetailsDark: {
    backgroundColor: '#142941',
  },
  modelDetailsTitle: {
    color: '#123044',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 7,
  },
  factorText: {
    color: '#123044',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 4,
  },
  modelCopy: {
    color: '#53707D',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 8,
  },
  modelDisclaimer: {
    color: '#6B7280',
    fontSize: 10,
    fontStyle: 'italic',
    lineHeight: 15,
    marginTop: 8,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
  },
  centeredModalButtonRow: {
    justifyContent: 'center',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#176C89',
    borderRadius: 6,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  continueButton: {
    alignItems: 'center',
    backgroundColor: '#176C89',
    borderRadius: 6,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: '#176C89',
    borderRadius: 6,
    marginTop: 4,
    paddingVertical: 12,
  },
});
