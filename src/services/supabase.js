import 'expo-sqlite/localStorage/install';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://doosuanuttihcyxtkarf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_o8EX6ePkLXJM15d7pUlGNA_gQbaxftE';

// expo-sqlite/localStorage/install provides localStorage polyfill on native via SQLite
// so we can use localStorage on all platforms without AsyncStorage conflicts
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
