import { getSleepHistory } from '../services/sleepSync';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useThemeContext } from '../theme/ThemeContext';
import { useLanguage } from '../theme/LanguageContext';

interface SleepEntry {
  date: string;
  duration: number;
}

export default function StatsScreen() {
  const [sleepData, setSleepData] = useState<SleepEntry[]>([]);
  const { theme } = useThemeContext();
  const { language, t } = useLanguage();
  const isDark = theme === 'dark';

  useEffect(() => {
    const loadSleepData = async () => {
      try {
        const parsed = await getSleepHistory();
        if (parsed.length) {
          const grouped: Record<string, number> = {};

          parsed.forEach((s: any) => {
            const endDate = new Date(s.end);
            const dateKey = [
              endDate.getFullYear(),
              String(endDate.getMonth() + 1).padStart(2, '0'),
              String(endDate.getDate()).padStart(2, '0'),
            ].join('-');
            grouped[dateKey] = (grouped[dateKey] || 0) + s.duration;
          });

          const sortedDates = Object.keys(grouped).sort(
            (a, b) => new Date(a).getTime() - new Date(b).getTime()
          );
          const last7 = sortedDates.slice(-7);

          const formatted = last7.map((date) => ({
            date,
            duration: parseFloat(grouped[date].toFixed(2)),
          }));

          setSleepData(formatted);
        }
      } catch (err) {
        console.error('Failed to load sleep data:', err);
      }
    };

    loadSleepData();
  }, []);

  const averageSleep =
    sleepData.reduce((sum, d) => sum + d.duration, 0) / (sleepData.length || 1);

  const bestDay =
    sleepData.reduce(
      (a, b) => (a.duration > b.duration ? a : b),
      sleepData[0] || { date: '', duration: 0 }
    );

  const worstDay =
    sleepData.reduce(
      (a, b) => (a.duration < b.duration ? a : b),
      sleepData[0] || { date: '', duration: 0 }
    );

  const formatChartDate = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString(
    language === 'zh' ? 'zh-CN' : 'en-US',
    { month: 'short', day: 'numeric' }
  );

  return (
    <ScrollView contentContainerStyle={[styles.container, isDark && styles.containerDark]}>
      <Stack.Screen options={{ title: t('statsTitle'), headerBackTitle: t('back') }} />
      <Text style={[styles.title, isDark && styles.titleDark]}>{t('weeklySleep')}</Text>

      {sleepData.length > 0 ? (
        <>
          <LineChart
            data={{
              labels: sleepData.map((d) => formatChartDate(d.date)),
              datasets: [{ data: sleepData.map((d) => d.duration) }],
            }}
            width={Dimensions.get('window').width - 40}
            height={220}
            fromZero
            yAxisSuffix="h"
            chartConfig={{
              backgroundGradientFrom: isDark ? '#1E2923' : '#ffffff',
              backgroundGradientTo: isDark ? '#08130D' : '#f2f2f2',
              color: (opacity = 1) =>
                isDark
                  ? `rgba(255, 255, 255, ${opacity})`
                  : `rgba(0, 0, 0, ${opacity})`,
              labelColor: () => (isDark ? '#fff' : '#000'),
              propsForDots: {
                r: '5',
                strokeWidth: '2',
                stroke: isDark ? '#fff' : '#000',
              },
            }}
            style={{
              marginVertical: 8,
              borderRadius: 16,
            }}
          />

          <View style={[styles.summary, isDark && styles.summaryDark]}>
            <Text style={[styles.text, isDark && styles.textDark]}>{t('averageSleep')}: {averageSleep.toFixed(2)} {t('hours')}</Text>
            <Text style={[styles.text, isDark && styles.textDark]}>
              {t('bestDay')}: {formatChartDate(bestDay.date)} ({bestDay.duration} {t('hours')})
            </Text>
            <Text style={[styles.text, isDark && styles.textDark]}>
              {t('worstDay')}: {formatChartDate(worstDay.date)} ({worstDay.duration} {t('hours')})
            </Text>

            {averageSleep >= 7 ? (
              <Text style={[styles.text, { color: '#5cb85c' }]}>
                {t('enoughRest')}
              </Text>
            ) : (
              <Text style={[styles.text, { color: '#f0ad4e' }]}>
                {t('aimForSleep')}
              </Text>
            )}
          </View>
        </>
      ) : (
        <Text style={[styles.text, isDark && styles.textDark]}>{t('noStats')}</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#fff',
    flexGrow: 1,
  },
  containerDark: {
    backgroundColor: '#0A0F24',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 10,
  },
  titleDark: {
    color: '#fff',
  },
  text: {
    color: '#000',
    fontSize: 16,
    marginVertical: 4,
  },
  textDark: {
    color: '#fff',
  },
  summary: {
    marginTop: 20,
    backgroundColor: '#f1f5f9',
    padding: 15,
    borderRadius: 10,
  },
  summaryDark: {
    backgroundColor: '#1a1a2e',
  },
});
