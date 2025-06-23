import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface SleepSession {
  start: string;
  end: string;
  duration: number;
}

export default function HistoryScreen() {
  const [history, setHistory] = useState<SleepSession[]>([]);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const data = await AsyncStorage.getItem('sleepHistory');
      if (data) {
        const parsed = JSON.parse(data);
        setHistory(parsed);
        console.log('Loaded history:', parsed);
      }
    } catch (err) {
      console.error('Failed to load sleep history:', err);
    }
  };

  const deleteSession = (index: number) => {
    console.log('Pressed delete for index:', index);
    Alert.alert('Ready to delete?', 'Do you want to delete this sleep session?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes',
        style: 'destructive',
        onPress: async () => {
          try {
            console.log('Confirmed deletion for:', index);
            const updated = [...history];
            updated.splice(index, 1);
            setHistory(updated);
            await AsyncStorage.setItem('sleepHistory', JSON.stringify(updated));
            console.log('Updated history saved:', updated);
          } catch (err) {
            console.error('Error deleting session:', err);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>🕒 Sleep History</Text>
      {history.length === 0 ? (
        <Text style={styles.text}>No sleep data recorded.</Text>
      ) : (
        history.map((session, index) => (
          <View key={index} style={styles.card}>
            <Text style={styles.sessionTitle}>📍 Session {index + 1}</Text>
            <Text style={styles.text}>Start: {session.start}</Text>
            <Text style={styles.text}>End: {session.end}</Text>
            <Text style={styles.text}>Duration: {session.duration.toFixed(2)} hrs</Text>
            <TouchableOpacity onPress={() => deleteSession(index)} style={styles.deleteButton}>
              <Text style={styles.delete}>🗑️ Delete</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#111',
    minHeight: '100%',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#2a2a2a',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  sessionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ff6666',
    marginBottom: 5,
  },
  text: {
    fontSize: 15,
    color: 'white',
    marginBottom: 4,
  },
  deleteButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#400',
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  delete: {
    color: '#ff4d4d',
    fontWeight: '600',
  },
});

