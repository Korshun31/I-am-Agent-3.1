import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://doosuanuttihcyxtkarf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_o8EX6ePkLXJM15d7pUlGNA_gQbaxftE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
