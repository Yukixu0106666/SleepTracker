import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';
import { BlurView } from 'expo-blur';
import * as Localization from 'expo-localization';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useThemeContext } from '../theme/ThemeContext'; // adjust path if needed

interface SleepSession {
  start: string;
  end: string;
  duration: number;
}

export default function HistoryScreen() {
  const [history, setHistory] = useState<SleepSession[]>([]);
  const timeZoneLabel = Localization.timezone.split('/').pop()?.replace('_', ' ') || 'Local Time';
  const { theme } = useThemeContext();
  const isDark = theme === 'dark';

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const data = await AsyncStorage.getItem('sleepHistory');
      if (data) {
        const parsed = JSON.parse(data);
        setHistory(parsed);
      }
    } catch (err) {
      console.error('Failed to load sleep history:', err);
    }
  };

  const deleteSession = (index: number) => {
    Alert.alert('Ready to delete?', 'Do you want to delete this sleep session?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes',
        style: 'destructive',
        onPress: async () => {
          try {
            const updated = [...history];
            updated.splice(index, 1);
            setHistory(updated);
            await AsyncStorage.setItem('sleepHistory', JSON.stringify(updated));
          } catch (err) {
            console.error('Error deleting session:', err);
          }
        },
      },
    ]);
  };

  const formatDateTime = (iso: string) => {
    const date = new Date(iso);
    return format(date, "MMM dd, yyyy 'at' hh:mm a");
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, isDark && styles.containerDark]}>
      <Text style={[styles.header, isDark && styles.textLight]}>🕒 Sleep History</Text>
      {history.length === 0 ? (
        <Text style={[styles.text, isDark && styles.textLight]}>No sleep data recorded.</Text>
      ) : (
        history.map((session, index) => (
          <View key={index} style={[styles.card, isDark && styles.cardDark]}>
            <Text style={[styles.sessionTitle, isDark && styles.sessionTitleDark]}>
              📍 Session {index + 1}
            </Text>
            <Text style={[styles.text, isDark && styles.textLight]}>
              Start: {formatDateTime(session.start)} ({timeZoneLabel})
            </Text>
            <Text style={[styles.text, isDark && styles.textLight]}>
              End: {formatDateTime(session.end)} ({timeZoneLabel})
            </Text>
            <Text style={[styles.text, isDark && styles.textLight]}>
              Duration: {session.duration.toFixed(2)} hrs
            </Text>
            <TouchableOpacity
              onPress={() => deleteSession(index)}
              style={styles.deleteWrapper}
            >
              <BlurView intensity={30} tint="light" style={styles.blur}>
                <Text style={[styles.deleteText, isDark ? styles.deleteTextDark : styles.deleteTextLight]}>
                🗑️ Delete
                </Text>
              </BlurView>
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
    backgroundColor: '#fff',
    minHeight: '100%',
  },
  containerDark: {
    backgroundColor: '#0A1627',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#f3f4f6',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  cardDark: {
    backgroundColor: '#1E293B',
  },
  sessionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#d9534f',
    marginBottom: 5,
  },
  sessionTitleDark: {
    color: '#ff8888',
  },
  text: {
    fontSize: 15,
    color: '#000',
    marginBottom: 4,
  },
  textLight: {
    color: '#fff',
  },
  deleteWrapper: {
    alignSelf: 'flex-start',
    marginTop: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  blur: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
    deleteText: {
    fontWeight: '600',
  },
  deleteTextLight: {
    color: '#000',
  },
  deleteTextDark: {
    color: '#fff',
  },
});
