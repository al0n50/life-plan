import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

/**
 * The Life Plan cloud backend (Supabase project `life-plan`).
 * The URL and publishable key are public by design: they only allow what the database's
 * row-level security rules allow (each account can reach only its own plan). Set
 * EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to point at another
 * project (e.g. a local one for development). Never put a secret key in the app.
 */
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://wefbmijbzvuzloijfnnl.supabase.co';
const SUPABASE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_XJSyPCXKh9XIvnSSH6CjrA_C661_cFg';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    // AsyncStorage keeps people signed in across launches (localStorage on web)
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // On web, finishing email confirmation lands on the site with a session in the URL
    detectSessionInUrl: Platform.OS === 'web',
  },
});

// On phones, only refresh the session while the app is in the foreground (Supabase's guidance)
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
