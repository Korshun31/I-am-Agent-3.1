import React, { createContext, useContext, useState, useEffect } from 'react';
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
    Promise.all([getStoredLanguage(), getStoredCurrency()])
      .then(([lang, cur]) => {
        setLanguageState(lang);
        applyDayjsLocale(lang);
        setCurrencyState(cur);
        setReady(true);
      })
      .catch(() => {
        setLanguageState('en');
        applyDayjsLocale('en');
        setCurrencyState('THB');
        setReady(true);
      });
  }, []);

  const setLanguage = (lang) => {
    if (['en', 'th', 'ru'].includes(lang)) {
      setLanguageState(lang);
      setStoredLanguage(lang);
      applyDayjsLocale(lang);
    }
  };

  const setCurrency = (cur) => {
    if (VALID_CURRENCIES.includes(cur)) {
      setCurrencyState(cur);
      setStoredCurrency(cur);
    }
  };

  const translate = (key) => t(language, key);

  return (
    <LanguageContext.Provider value={{
      language, setLanguage,
      currency, setCurrency,
      currencySymbol: getCurrencySymbol(currency),
      t: translate,
      ready,
    }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
