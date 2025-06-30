import { Link } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeContext } from '../../theme/ThemeContext';

export default function HomeScreen() {
  const { theme } = useThemeContext();
  const isDark = theme === 'dark';

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      {/* Title row with emoji */}
      <View style={styles.titleRow}>
        <Text style={[styles.titleText, isDark && styles.titleTextDark]}>Sleep Tracker</Text>
        <Text style={styles.emoji}>😴</Text>
      </View>

      <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>
        Track your sleep sessions and rest better.
      </Text>

      <Link href="/history" asChild>
        <Pressable style={styles.button}>
          <Text style={styles.buttonText}>🕒 View Sleep History</Text>
        </Pressable>
      </Link>

      <Link href="/stats" asChild>
        <Pressable style={styles.button}>
          <Text style={styles.buttonText}>📊 View Stats</Text>
        </Pressable>
      </Link>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  containerDark: {
    backgroundColor: '#0A1627',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  titleText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000',
  },
  titleTextDark: {
    color: '#FFFFFF',
  },
  emoji: {
    fontSize: 32,
    marginLeft: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 24,
  },
  subtitleDark: {
    color: '#AAB8CC',
  },
  button: {
    backgroundColor: '#3C6EB4',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 16,
    width: '100%',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 18,
    textAlign: 'center',
  },
});
