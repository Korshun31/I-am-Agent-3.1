import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://doosuanuttihcyxtkarf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_o8EX6ePkLXJM15d7pUlGNA_gQbaxftE';

const storage = Platform.OS === 'web' ? localStorage : AsyncStorage;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});
