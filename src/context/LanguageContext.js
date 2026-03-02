import React, { createContext, useContext, useState, useEffect } from 'react';
import { getStoredLanguage, setStoredLanguage, t } from '../i18n/translations';

const LanguageContext = createContext({ language: 'en', setLanguage: () => {}, t: (key) => key });

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState('en');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getStoredLanguage()
      .then((lang) => {
        setLanguageState(lang);
        setReady(true);
      })
      .catch(() => {
        setLanguageState('en');
        setReady(true);
      });
  }, []);

  const setLanguage = (lang) => {
    if (['en', 'th', 'ru'].includes(lang)) {
      setLanguageState(lang);
      setStoredLanguage(lang);
    }
  };

  const translate = (key) => t(language, key);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: translate, ready }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
