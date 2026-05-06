// TD-120 фаза C: общий «склад» курсов валют для всего приложения.
// Один раз при старте читает курсы из Supabase, кэширует в AsyncStorage на
// сутки. Не зависит от user — курсы публичные данные ECB.
//
// Паттерн против гонок (учли урок фазы A): один useEffect, два этапа в
// одной async-функции. Сначала кэш (если свежий) — мгновенный paint. Потом
// всегда fetch из БД — единственный источник записи в state после первого
// paint. Запись в AsyncStorage только после успешного fetch.

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchRates } from '../services/currencyRatesService';
import { indexRates } from '../utils/currencyConvert';

const CACHE_KEY = '@currency_rates_cache_v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_DAYS_BACK = 90;

const CurrencyRatesContext = createContext({
  rates: null,
  ratesReady: false,
  refreshRates: async () => {},
});

export function CurrencyRatesProvider({ children }) {
  const [rows, setRows] = useState(null);
  const [ratesReady, setRatesReady] = useState(false);

  const loadAndCache = useCallback(async () => {
    try {
      const fresh = await fetchRates(FETCH_DAYS_BACK);
      setRows(fresh);
      setRatesReady(true);
      try {
        await AsyncStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ cachedAt: Date.now(), rows: fresh }),
        );
      } catch (_) {}
      return fresh;
    } catch (e) {
      // Сетевая ошибка — оставляем что есть (кэш или null). Не падаем.
      // eslint-disable-next-line no-console
      console.warn('CurrencyRatesContext: fetchRates failed', e?.message || e);
      setRatesReady(true);
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Этап 1 — мгновенный paint из кэша если он свежий.
      try {
        const raw = await AsyncStorage.getItem(CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.rows)
              && Number.isFinite(parsed.cachedAt)
              && Date.now() - parsed.cachedAt < CACHE_TTL_MS) {
            if (!cancelled) {
              setRows(parsed.rows);
              setRatesReady(true);
            }
          }
        }
      } catch (_) {}

      // Этап 2 — всегда тянем из БД, обновляем state и кэш по успеху.
      // Даже если кэш свежий: фоновое обновление безопасно, единственный
      // writer state-а после mount.
      if (!cancelled) await loadAndCache();
    })();
    return () => { cancelled = true; };
  }, [loadAndCache]);

  // Индексируем только когда массив строк меняется. На клиенте уйдёт ~раз
  // в сутки (после успешного фонового обновления).
  const rates = useMemo(() => (rows ? indexRates(rows) : null), [rows]);

  const refreshRates = useCallback(async () => { await loadAndCache(); }, [loadAndCache]);

  const value = useMemo(() => ({
    rates,
    ratesReady,
    refreshRates,
  }), [rates, ratesReady, refreshRates]);

  return (
    <CurrencyRatesContext.Provider value={value}>
      {children}
    </CurrencyRatesContext.Provider>
  );
}

export function useCurrencyRates() {
  return useContext(CurrencyRatesContext);
}
