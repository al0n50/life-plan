import { router, Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useHydrated } from '@/store/useLifePlan';
import { RESET_PATH } from '@/sync/recovery';
import { startAccountSync, useAccount } from '@/sync/useAccount';
import { useColors } from '@/theme';

// Accounts are optional: this only syncs when someone is signed in
startAccountSync();

export default function RootLayout() {
  const hydrated = useHydrated();
  const c = useColors();
  const recovering = useAccount((s) => s.recovering);
  const pathname = usePathname();
  const sentToReset = useRef(false);

  // A reset link that landed anywhere else (e.g. the home page) still opens the reset screen, once
  useEffect(() => {
    if (!hydrated || !recovering || sentToReset.current) return;
    sentToReset.current = true;
    if (pathname !== RESET_PATH) router.replace(RESET_PATH);
  }, [hydrated, recovering, pathname]);

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
