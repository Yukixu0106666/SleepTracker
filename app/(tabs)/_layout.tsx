import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

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
          title: 'Sleep History',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="person.crop.circle.fill" color={color} />
          ),
        }}
      />

      {/* Track Sleep */}
      <Tabs.Screen
        name="sleep"
        options={{
          title: 'Track Sleep',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="moon.fill" color={color} />
          ),
        }}
      />

      {/* Settings */}
      <Tabs.Screen
        name="setting"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="gearshape.fill" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="recommendation"
        options={{
          title: 'Recommendation',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="lightbulb.fill" color={color} />
          ),
         }}
       />
    </Tabs>
  );
}
