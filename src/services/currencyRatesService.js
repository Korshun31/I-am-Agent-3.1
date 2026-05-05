// TD-120 фаза C: чтение архива курсов валют из Supabase.
// Курсы публичные (RLS: anon+authenticated read), пишет только service_role
// через Edge Function `sync-currency-rates`. Эта утилита только читает.

import { supabase } from './supabase';

const DEFAULT_DAYS_BACK = 90;

export async function fetchRates(daysBack = DEFAULT_DAYS_BACK) {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - daysBack);
  const sinceStr = since.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('currency_rates')
    .select('rate_date, base_currency, quote_currency, rate')
    .gte('rate_date', sinceStr)
    .order('rate_date', { ascending: true });

  if (error) throw new Error(`fetchRates failed: ${error.message}`);
  return Array.isArray(data) ? data : [];
}
