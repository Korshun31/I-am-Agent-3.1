import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://mdxujiuvmondmagfnwob.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1keHVqaXV2bW9uZG1hZ2Zud29iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMjY4MTMsImV4cCI6MjA5MTgwMjgxM30.X00wg1yAl86j619uSGnT_5y56JR-q-m5j-uwaUK8tv8';

const storage = Platform.OS === 'web' ? localStorage : AsyncStorage;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});
