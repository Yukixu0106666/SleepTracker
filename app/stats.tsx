import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useThemeContext } from '../theme/ThemeContext';

interface SleepEntry {
  date: string;
  duration: number;
}

export default function StatsScreen() {
  const [sleepData, setSleepData] = useState<SleepEntry[]>([]);
  const { theme } = useThemeContext();
  const isDark = theme === 'dark';

  useEffect(() => {
    const loadSleepData = async () => {
      try {
        const data = await AsyncStorage.getItem('sleepHistory');
        if (data) {
          const parsed = JSON.parse(data);
          const grouped: Record<string, number> = {};

          parsed.forEach((s: any) => {
            const dateKey = new Date(s.end).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            });
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

  return (
    <ScrollView contentContainerStyle={[styles.container, isDark && styles.containerDark]}>
      <Text style={[styles.title, isDark && styles.titleDark]}>🛏️ Your Sleep in the Past Week</Text>

      {sleepData.length > 0 ? (
        <>
          <LineChart
            data={{
              labels: sleepData.map((d) => d.date),
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
            <Text style={[styles.text, isDark && styles.textDark]}>📊 Average Sleep: {averageSleep.toFixed(2)} hrs</Text>
            <Text style={[styles.text, isDark && styles.textDark]}>
              🏆 Best Day: {bestDay.date} ({bestDay.duration} hrs)
            </Text>
            <Text style={[styles.text, isDark && styles.textDark]}>
              😴 Worst Day: {worstDay.date} ({worstDay.duration} hrs)
            </Text>

            {averageSleep >= 7 ? (
              <Text style={[styles.text, { color: '#5cb85c' }]}>
                ✅ You're getting enough rest! Keep it up!
              </Text>
            ) : (
              <Text style={[styles.text, { color: '#f0ad4e' }]}>
                ⚠️ Try to aim for 7–9 hours of sleep daily!
              </Text>
            )}
          </View>
        </>
      ) : (
        <Text style={[styles.text, isDark && styles.textDark]}>No sleep data to show yet.</Text>
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
