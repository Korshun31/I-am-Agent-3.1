import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import 'dayjs/locale/en';
import { getStoredLanguage, setStoredLanguage, t } from '../i18n/translations';
import { getCurrencySymbol } from '../utils/currency';

const CURRENCY_KEY = '@app_currency';
const VALID_CURRENCIES = ['THB', 'USD', 'EUR', 'RUB'];

const LanguageContext = createContext({
  language: 'en', setLanguage: () => {},
  currency: 'THB', setCurrency: () => {},
  currencySymbol: '฿',
  t: (key) => key,
  ready: false,
});

function applyDayjsLocale(lang) {
  dayjs.locale(lang === 'th' ? 'en' : lang);
}

async function getStoredCurrency() {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const stored = await AsyncStorage.getItem(CURRENCY_KEY);
    return stored && VALID_CURRENCIES.includes(stored) ? stored : 'THB';
  } catch {
    return 'THB';
  }
}

async function setStoredCurrency(currency) {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.setItem(CURRENCY_KEY, currency);
  } catch (_) {}
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState('en');
  const [currency, setCurrencyState] = useState('THB');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Валюту НЕ читаем из AsyncStorage: единственный источник истины — БД
    // (users_profile.settings.selectedCurrency). App.js устанавливает её через
    // setCurrency после getCurrentUser. Иначе кэш на устройстве перетирает
    // значение из БД из-за гонки между двумя useEffect'ами при старте.
    getStoredLanguage()
      .then((lang) => {
        setLanguageState(lang);
        applyDayjsLocale(lang);
        setReady(true);
      })
      .catch(() => {
        setLanguageState('en');
        applyDayjsLocale('en');
        setReady(true);
      });
  }, []);

  const setLanguage = useCallback((lang) => {
    if (['en', 'th', 'ru'].includes(lang)) {
      setLanguageState(lang);
      setStoredLanguage(lang);
      applyDayjsLocale(lang);
    }
  }, []);

  const setCurrency = useCallback((cur) => {
    if (VALID_CURRENCIES.includes(cur)) {
      setCurrencyState(cur);
      setStoredCurrency(cur);
    }
  }, []);

  const translate = useCallback((key) => t(language, key), [language]);

  const value = useMemo(() => ({
    language, setLanguage,
    currency, setCurrency,
    currencySymbol: getCurrencySymbol(currency),
    t: translate,
    ready,
  }), [language, currency, ready, setLanguage, setCurrency, translate]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
