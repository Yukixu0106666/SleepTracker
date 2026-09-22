import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeContext } from '../../theme/ThemeContext';
import { useLanguage } from '../../theme/LanguageContext';

export default function HomeScreen() {
  const { theme } = useThemeContext();
  const { t } = useLanguage();
  const isDark = theme === 'dark';

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <View style={styles.titleRow}>
        <Text style={[styles.titleText, isDark && styles.titleTextDark]}>{t('appName')}</Text>
      </View>

      <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>
        {t('homeSubtitle')}
      </Text>

      <Link href="/history" asChild>
        <Pressable style={styles.button}>
          <Text style={styles.buttonText}>{t('viewHistory')}</Text>
        </Pressable>
      </Link>

      <Link href="/stats" asChild>
        <Pressable style={styles.button}>
          <Text style={styles.buttonText}>{t('viewStats')}</Text>
        </Pressable>
      </Link>

      <Link href="/(tabs)/health" asChild>
        <Pressable style={styles.button}>
          <Text style={styles.buttonText}>{t('appleHealth')}</Text>
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
    backgroundColor: '#176C89',
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
