// TD-120 фаза B: ежедневная синхронизация курсов валют из ECB.
//
// Источник: api.frankfurter.app — бесплатный прокси к официальным курсам
// ECB, без API-ключа. По выходным и праздникам ECB не публикует — Frankfurter
// в таком случае возвращает дату последнего рабочего дня. Мы сохраняем то,
// что вернулось (rate_date берётся из ответа, не из today). На клиенте поиск
// курса делает fallback на ближайшую более раннюю дату.
//
// Запускается pg_cron раз в сутки в 06:00 UTC (после публикации ECB ~16:00 CET
// предыдущего рабочего дня — запас).
//
// Базовая валюта USD. Сохраняем курсы USD → {EUR, THB, RUB} плюс identity
// USD→USD = 1. Кросс-курсы вычисляются на клиенте: rate(THB→RUB) =
// rate(USD→RUB) / rate(USD→THB).

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPPORTED = ['USD', 'EUR', 'THB', 'RUB'] as const;
type Currency = typeof SUPPORTED[number];

const BASE: Currency = 'USD';
const QUOTES: Currency[] = ['EUR', 'THB', 'RUB'];

interface FrankfurterResponse {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Защита: вызов разрешён только с service_role-ключом (pg_cron шлёт его в
  // Authorization header). Любые внешние вызовы без правильного Bearer-токена
  // отбиваются 401 — иначе публичный URL функции стал бы открытым эндпоинтом
  // на запись в таблицу.
  const authHeader = req.headers.get('Authorization') || '';
  const expected   = `Bearer ${serviceKey}`;
  if (authHeader !== expected) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  try {
    const url = `https://api.frankfurter.app/latest?from=${BASE}&to=${QUOTES.join(',')}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Frankfurter HTTP ${res.status}: ${await res.text()}`);
    }
    const data: FrankfurterResponse = await res.json();

    if (!data.date || !data.rates) {
      throw new Error(`Unexpected response shape: ${JSON.stringify(data)}`);
    }

    const rateDate = data.date;
    const rows: Array<{
      rate_date: string;
      base_currency: Currency;
      quote_currency: Currency;
      rate: number;
      source: string;
    }> = [
      { rate_date: rateDate, base_currency: BASE, quote_currency: BASE, rate: 1, source: 'frankfurter' },
    ];

    for (const q of QUOTES) {
      const r = data.rates[q];
      if (typeof r !== 'number' || !(r > 0)) {
        throw new Error(`Missing or invalid rate for ${q}: ${r}`);
      }
      rows.push({
        rate_date: rateDate,
        base_currency: BASE,
        quote_currency: q,
        rate: r,
        source: 'frankfurter',
      });
    }

    const { error } = await supabase
      .from('currency_rates')
      .upsert(rows, { onConflict: 'rate_date,base_currency,quote_currency' });

    if (error) throw new Error(`Upsert failed: ${error.message}`);

    return new Response(
      JSON.stringify({ ok: true, rate_date: rateDate, upserted: rows.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('sync-currency-rates failed:', message);
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
