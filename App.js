import React, { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import ErrorBoundary from './src/components/ErrorBoundary';

if (Platform.OS !== 'web') {
  try {
    const Notifications = require('expo-notifications').default;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch {}
}
import { LanguageProvider } from './src/context/LanguageContext';
import Preloader from './src/screens/Preloader';
import Login from './src/screens/Login';
import Registration from './src/screens/Registration';
import MainScreen from './src/screens/MainScreen';
import WebMainScreen from './src/web/WebMainScreen';
import { getCurrentUser, signOut } from './src/services/authService';

const initialUser = { email: '', name: '', lastName: '', phone: '', telegram: '', documentNumber: '', extraPhones: [], extraEmails: [], whatsapp: '', photoUri: '' };

export default function App() {
  const [screen, setScreen] = useState('preloader');
  const [user, setUser] = useState(initialUser);

  useEffect(() => {
    async function checkSession() {
      try {
        const userData = await getCurrentUser();
        if (userData) {
          setUser(userData);
          setScreen('main');
        } else {
          setScreen('login');
        }
      } catch {
        setScreen('login');
      }
    }
    
    if (Platform.OS === 'web') {
      checkSession();
    } else {
      const timer = setTimeout(checkSession, 2500);
      return () => clearTimeout(timer);
    }
  }, []);

  const goToMain = (userData) => {
    if (userData && typeof userData === 'object') {
      setUser({
        ...userData,
        email: userData.email || '',
        name: userData.name || '',
        lastName: userData.lastName || '',
        phone: userData.phone || '',
        telegram: userData.telegram || '',
        documentNumber: userData.documentNumber || '',
        extraPhones: Array.isArray(userData.extraPhones) ? userData.extraPhones : [],
        extraEmails: Array.isArray(userData.extraEmails) ? userData.extraEmails : [],
        whatsapp: userData.whatsapp || '',
        photoUri: userData.photoUri || '',
        workAs: userData.workAs === 'company' ? 'company' : 'private',
        companyInfo: userData.companyInfo || {},
      });
    } else {
      setUser(initialUser);
    }
    setScreen('main');
  };

  const handleUserUpdate = (updatedUser) => {
    setUser((prev) => ({
      ...prev,
      ...updatedUser,
      extraPhones: Array.isArray(updatedUser?.extraPhones) ? updatedUser.extraPhones : prev.extraPhones || [],
      extraEmails: Array.isArray(updatedUser?.extraEmails) ? updatedUser.extraEmails : prev.extraEmails || [],
      whatsapp: updatedUser?.whatsapp !== undefined ? updatedUser.whatsapp : prev.whatsapp || '',
      photoUri: updatedUser?.photoUri !== undefined ? updatedUser.photoUri : prev.photoUri || '',
      workAs: updatedUser?.workAs !== undefined ? updatedUser.workAs : prev.workAs || 'private',
      companyInfo: updatedUser?.companyInfo !== undefined ? updatedUser.companyInfo : prev.companyInfo || {},
    }));
  };

  const handleLogout = async () => {
    try { await signOut(); } catch {}
    setUser(initialUser);
    setScreen('login');
  };

  return (
    <ErrorBoundary>
    <LanguageProvider>
      <StatusBar style="dark" />
      {screen === 'preloader' && Platform.OS !== 'web' && <Preloader />}
      {(screen === 'login' || (screen === 'preloader' && Platform.OS === 'web')) && (
        <Login
          onSignUp={() => setScreen('registration')}
          onLogin={(user) => goToMain(user)}
        />
      )}
      {screen === 'registration' && (
        <Registration
          onBack={() => setScreen('login')}
          onSuccess={(user) => goToMain(user)}
        />
      )}
      {screen === 'main' && (
        Platform.OS === 'web' ? (
          <WebMainScreen onLogout={handleLogout} user={user} onUserUpdate={handleUserUpdate} />
        ) : (
          <MainScreen onLogout={handleLogout} user={user} onUserUpdate={handleUserUpdate} />
        )
      )}
    </LanguageProvider>
    </ErrorBoundary>
  );
}
