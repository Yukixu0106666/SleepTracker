import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useLanguage } from '../../theme/LanguageContext';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { t } = useLanguage();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            position: 'absolute',
          },
          default: {},
        }),
      }}
    >
      {/* My Profile */}
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabHistory'),
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="person.crop.circle.fill" color={color} />
          ),
        }}
      />

      {/* Track Sleep */}
      <Tabs.Screen
        name="sleep"
        options={{
          title: t('tabSleep'),
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="moon.fill" color={color} />
          ),
        }}
      />

      {/* Settings */}
      <Tabs.Screen
        name="setting"
        options={{
          title: t('tabProfile'),
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="gearshape.fill" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="health"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="recommendation"
        options={{
          title: t('tabRecommendation'),
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="lightbulb.fill" color={color} />
          ),
         }}
       />
    </Tabs>
  );
}
