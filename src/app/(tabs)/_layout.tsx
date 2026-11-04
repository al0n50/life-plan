import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import type { IconName } from '@/components/ui';
import { useLifeState, useModel } from '@/store/useLifePlan';
import { useColors } from '@/theme';

function icon(name: IconName) {
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={color as string} size={size} />;
  }
  return TabIcon;
}

export default function TabsLayout() {
  const c = useColors();
  const onboarded = useLifeState().onboarded;
  if (!onboarded) return <Redirect href="/onboarding" />;
  return <OnboardedTabs c={c} />;
}

function OnboardedTabs({ c }: { c: ReturnType<typeof useColors> }) {
  const M = useModel();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.text,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: icon('home-outline') }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar', tabBarIcon: icon('calendar-outline') }} />
      <Tabs.Screen
        name="log"
        options={{
          title: 'Log',
          tabBarIcon: icon('add-circle'),
          tabBarActiveTintColor: c.primary,
          tabBarInactiveTintColor: c.primary,
          tabBarBadge: M.pending.length || undefined,
          tabBarBadgeStyle: { backgroundColor: c.bucket.debt },
        }}
      />
      <Tabs.Screen name="life" options={{ title: 'Life', tabBarIcon: icon('compass-outline') }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: icon('menu-outline') }} />
    </Tabs>
  );
}
