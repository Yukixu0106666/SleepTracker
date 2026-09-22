import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { flushSleepUploads } from '../services/sleepSync';

import { hasNativeSleepActivity, takeCompletedSleep } from '../services/sleepActivity';
import { persistCompletedSleep } from '../services/sleepSessionPersistence';
import { ThemeProvider, useThemeContext } from '../theme/ThemeContext';
import { LanguageProvider, useLanguage } from '../theme/LanguageContext';

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) return null;

  return (
    <ThemeProvider>
      <LanguageProvider>
        <InnerApp />
      </LanguageProvider>
    </ThemeProvider>
  );
}

function InnerApp() {
  const { theme } = useThemeContext();
  const { t } = useLanguage();

  return (
    <NavigationThemeProvider value={theme === 'dark' ? DarkTheme : DefaultTheme}>
      <WidgetSleepSessionSync />
      <SleepUploadSync />
      <Stack
        screenOptions={{
          headerBackTitle: t('back'),
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
    </NavigationThemeProvider>
  );
}

function WidgetSleepSessionSync() {
  const isSyncing = useRef(false);

  useEffect(() => {
    async function syncCompletedWidgetSession() {
      if (!hasNativeSleepActivity() || isSyncing.current) return;

      isSyncing.current = true;
      try {
        const completedSleep = await takeCompletedSleep();
        if (completedSleep) await persistCompletedSleep(completedSleep);
      } finally {
        isSyncing.current = false;
      }
    }

    syncCompletedWidgetSession().catch(() => undefined);
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') syncCompletedWidgetSession().catch(() => undefined);
    });
    return () => subscription.remove();
  }, []);

  return null;
}

function SleepUploadSync() {
  useEffect(() => {
    const flush = () => {
      if (AppState.currentState === 'active') void flushSleepUploads().catch(() => undefined);
    };
    flush();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') flush(); });
    const timer = setInterval(flush, 15000);
    return () => { subscription.remove(); clearInterval(timer); };
  }, []);
  return null;
}
