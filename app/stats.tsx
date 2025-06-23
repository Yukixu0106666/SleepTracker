import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text } from 'react-native';
import { BarChart } from 'react-native-chart-kit';

interface SleepEntry {
  date: string;
  duration: number;
}

export default function StatsScreen() {
  const [sleepData, setSleepData] = useState<SleepEntry[]>([]);

  useEffect(() => {
    const loadSleepData = async () => {
      try {
        const data = await AsyncStorage.getItem('sleepHistory');
        if (data) {
          const parsed = JSON.parse(data);
          const last7 = parsed.slice(-7); // Get last 7 records

          const formatted = last7.map((s: any) => ({
            date: new Date(s.end).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            }),
            duration: parseFloat(s.duration.toFixed(2)),
          }));

          setSleepData(formatted);
        }
      } catch (err) {
        console.error('Failed to load sleep data:', err);
      }
    };

    loadSleepData();
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>🛌 Your Sleep in the Past Week</Text>

      {sleepData.length > 0 ? (
        <BarChart
          data={{
            labels: sleepData.map((d) => d.date),
            datasets: [{ data: sleepData.map((d) => d.duration) }],
          }}
          width={Dimensions.get('window').width - 40}
          height={220}
          fromZero
          yAxisLabel=""
          yAxisSuffix="h"
          chartConfig={{
            backgroundGradientFrom: '#1E2923',
            backgroundGradientTo: '#08130D',
            color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
            labelColor: () => '#fff',
            style: { borderRadius: 16 },
          }}
          style={{
            marginVertical: 8,
            borderRadius: 16,
          }}
        />
      ) : (
        <Text style={styles.text}>No sleep data to show yet.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#0A0F24',
    flexGrow: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 10,
  },
  text: {
    color: '#fff',
    fontSize: 16,
  },
});
