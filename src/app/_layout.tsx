import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useHydrated } from '@/store/useLifePlan';
import { startAccountSync } from '@/sync/useAccount';
import { useColors } from '@/theme';

// Accounts are optional: this only syncs when someone is signed in
startAccountSync();

export default function RootLayout() {
  const hydrated = useHydrated();
  const c = useColors();

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      {hydrated ? (
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }} />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
          <ActivityIndicator color={c.primary} />
        </View>
      )}
    </SafeAreaProvider>
  );
}
