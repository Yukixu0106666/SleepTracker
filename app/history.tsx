import { deleteSleepSession, getSleepHistory } from '../services/sleepSync';
import type { StoredSession } from '../services/sleepJournal';
import { useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Stack } from 'expo-router';
import { useCallback, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useThemeContext } from '../theme/ThemeContext'; // adjust path if needed
import { useLanguage } from '../theme/LanguageContext';

export default function HistoryScreen() {
  const [history, setHistory] = useState<StoredSession[]>([]);
  const { theme } = useThemeContext();
  const { language, t } = useLanguage();
  const isDark = theme === 'dark';

  useFocusEffect(useCallback(() => {
    loadHistory();
  }, []));

  const loadHistory = async () => {
    try {
      setHistory(await getSleepHistory());
    } catch (err) {
      console.error('Failed to load sleep history:', err);
    }
  };

  const deleteSession = (index: number) => {
    Alert.alert(t('deleteConfirmTitle'), t('deleteConfirmBody'), [
      { text: t('no'), style: 'cancel' },
      {
        text: t('yes'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteSleepSession(history[index].sessionId);
            setHistory(await getSleepHistory());
          } catch (err) {
            console.error('Error deleting session:', err);
          }
        },
      },
    ]);
  };

  const formatDateTime = (iso: string) => {
    const date = new Date(iso);
    return language === 'zh'
      ? format(date, 'yyyy年MM月dd日 HH:mm', { locale: zhCN })
      : format(date, "MMM dd, yyyy 'at' hh:mm a");
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, isDark && styles.containerDark]}>
      <Stack.Screen options={{ title: t('tabHistory'), headerBackTitle: t('back') }} />
      <Text style={[styles.header, isDark && styles.textLight]}>{t('tabHistory')}</Text>
      {history.length === 0 ? (
        <Text style={[styles.text, isDark && styles.textLight]}>{t('noSleepData')}</Text>
      ) : (
        history.map((session, index) => (
          <View key={session.sessionId} style={[styles.card, isDark && styles.cardDark]}>
            <Text style={[styles.sessionTitle, isDark && styles.sessionTitleDark]}>
              {language === 'zh' ? `第 ${index + 1} 次睡眠` : `${t('session')} ${index + 1}`}
            </Text>
            <Text style={[styles.text, isDark && styles.textLight]}>
              {t('start')}: {formatDateTime(session.start)}
            </Text>
            <Text style={[styles.text, isDark && styles.textLight]}>
              {t('end')}: {formatDateTime(session.end)}
            </Text>
            <Text style={[styles.text, isDark && styles.textLight]}>
              {t('duration')}: {session.duration.toFixed(2)} {t('hours')}
            </Text>
            <TouchableOpacity
              onPress={() => deleteSession(index)}
              style={styles.deleteWrapper}
            >
              <Text style={styles.deleteText}>{t('delete')}</Text>
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
    backgroundColor: '#176C89',
    marginTop: 8,
    borderRadius: 8,
    overflow: 'hidden',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  deleteText: {
    color: '#fff',
    fontWeight: '600',
  },
});
