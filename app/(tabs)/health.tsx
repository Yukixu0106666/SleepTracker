import {
    getMostRecentQuantitySample,
    isHealthDataAvailableAsync,
    queryCategorySamples,
    requestAuthorization,
} from '@kingstinct/react-native-healthkit';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '../../theme/LanguageContext';

type HealthSummary = {
  heartRate: string;
  heartRateDate: string;
  sleepDuration: string;
  sleepDate: string;
};

export default function HealthScreen() {
  const { language, t } = useLanguage();
  const [summary, setSummary] = useState<HealthSummary | null>(null);
  const [status, setStatus] = useState(t('healthConnectPrompt'));
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!summary && !isLoading) setStatus(t('healthConnectPrompt'));
  }, [isLoading, summary, t]);

  const connectHealthKit = async () => {
    if (Platform.OS !== 'ios') {
      setStatus(t('healthIphoneOnly'));
      return;
    }

    setIsLoading(true);
    setStatus(t('healthRequesting'));

    try {
      const isAvailable = await isHealthDataAvailableAsync();
      if (!isAvailable) {
        setStatus(t('healthUnavailable'));
        return;
      }

      await requestAuthorization({
        toRead: [
          'HKQuantityTypeIdentifierHeartRate',
          'HKCategoryTypeIdentifierSleepAnalysis',
        ],
      });

      setStatus(t('healthReading'));
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [heartRate, sleepSamples] = await Promise.all([
        getMostRecentQuantitySample('HKQuantityTypeIdentifierHeartRate', 'count/min'),
        queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
          limit: 100,
          ascending: false,
          filter: { date: { startDate: dayAgo } },
        }),
      ]);

      const sleepMinutes = sleepSamples.reduce((total, sample) => {
        return total + (sample.endDate.getTime() - sample.startDate.getTime()) / 60000;
      }, 0);

      setSummary({
        heartRate: heartRate ? `${Math.round(heartRate.quantity)} ${heartRate.unit}` : t('noData'),
        heartRateDate: heartRate ? heartRate.startDate.toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US') : t('noRecentHeartRate'),
        sleepDuration: sleepMinutes > 0 ? `${(sleepMinutes / 60).toFixed(1)} ${t('hours')}` : t('noData'),
        sleepDate: sleepSamples.length > 0 ? t('sleepLastDay') : t('noRecentSleep'),
      });
      setStatus(t('healthConnected'));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown HealthKit error';
      setStatus(`${t('healthReadError')}: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
        <Text style={styles.title}>{t('health')}</Text>
          <Text style={styles.subtitle}>{t('healthSubtitle')}</Text>
        </View>

        <View style={styles.statusBox}>
          <Text style={styles.statusLabel}>{t('appleHealth')}</Text>
          <Text style={styles.statusText}>{status}</Text>
          <Pressable
            accessibilityRole="button"
            disabled={isLoading}
            onPress={connectHealthKit}
            style={({ pressed }) => [styles.connectButton, pressed && styles.connectButtonPressed, isLoading && styles.connectButtonDisabled]}>
            {isLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.connectButtonText}>{summary ? t('refreshHealth') : t('connectHealth')}</Text>}
          </Pressable>
        </View>

        {summary ? (
          <View style={styles.metrics}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>{t('latestHeartRate')}</Text>
              <Text style={styles.metricValue}>{summary.heartRate}</Text>
              <Text style={styles.metricDetail}>{summary.heartRateDate}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>{t('sleepLast24Hours')}</Text>
              <Text style={styles.metricValue}>{summary.sleepDuration}</Text>
              <Text style={styles.metricDetail}>{summary.sleepDate}</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    padding: 20,
    gap: 16,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    color: '#111827',
  },
  subtitle: {
    fontSize: 16,
    color: '#4B5563',
  },
  statusBox: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#111827',
  },
  connectButton: {
    alignItems: 'center',
    backgroundColor: '#176C89',
    borderRadius: 8,
    marginTop: 16,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  connectButtonPressed: {
    opacity: 0.82,
  },
  connectButtonDisabled: {
    opacity: 0.65,
  },
  connectButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  metrics: {
    gap: 12,
  },
  metricCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  metricLabel: {
    color: '#4B5563',
    fontSize: 14,
    fontWeight: '600',
  },
  metricValue: {
    color: '#111827',
    fontSize: 28,
    fontWeight: '700',
    marginTop: 6,
  },
  metricDetail: {
    color: '#6B7280',
    fontSize: 13,
    marginTop: 6,
  },
});
