import React, { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import ErrorBoundary from './src/components/ErrorBoundary';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

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
import { LanguageProvider, useLanguage } from './src/context/LanguageContext';
import { UserProvider, useUser } from './src/context/UserContext';
import { AppDataProvider, useAppData } from './src/context/AppDataContext';
import Preloader from './src/screens/Preloader';
import Login from './src/screens/Login';
import Registration from './src/screens/Registration';
import MainNavigator from './src/navigation/MainNavigator';
import WebMainScreen from './src/web/WebMainScreen';
import { getCurrentUser, signOut } from './src/services/authService';
import { supabase } from './src/services/supabase';
import WebInviteAcceptScreen from './src/web/screens/WebInviteAcceptScreen';
import { Image } from 'expo-image';
import { getProperties } from './src/services/propertiesService';

function AppMainLoader({ onLogout }) {
  const { isLoaded, loadingProgress } = useAppData();

  if (!isLoaded) return <Preloader progress={loadingProgress} />;
  return <MainNavigator onLogout={onLogout} />;
}

function AppContent() {
  const { user, updateUser, resetUser, handleUserUpdate } = useUser();
  const { setLanguage } = useLanguage();
  const [screen, setScreen] = useState('preloader');
  const [preloaderProgress, setPreloaderProgress] = useState(0);
  const [preloaderStatus, setPreloaderStatus] = useState('Checking session...');
  const [inviteToken, setInviteToken] = useState(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('token') || null;
    }
    return null;
  });

  useEffect(() => {
    async function checkSession() {
      setPreloaderStatus('Checking session...');
      setPreloaderProgress(0);
      try {
        const userData = await getCurrentUser();
        if (userData) {
          updateUser(userData);
          if (userData.language) setLanguage(userData.language);
          setPreloaderProgress(10);
          setPreloaderStatus('Loading data...');
          try {
            const properties = await getProperties();
            setPreloaderProgress(30);
            const allPhotos = properties
              .map(p => p.photos?.[0])
              .filter(uri => typeof uri === 'string' && uri.startsWith('http'));
            const total = allPhotos.length;
            if (total > 0) {
              let loaded = 0;
              const chunkSize = 5;
              for (let i = 0; i < allPhotos.length; i += chunkSize) {
                const chunk = allPhotos.slice(i, i + chunkSize);
                await Promise.all(chunk.map(async (uri) => {
                  try { await Image.prefetch(uri); } catch {}
                  loaded++;
                  setPreloaderProgress(30 + Math.round((loaded / total) * 70));
                  setPreloaderStatus(`Loading photos... ${loaded} of ${total}`);
                }));
              }
            } else {
              setPreloaderProgress(100);
            }
          } catch {}
          setScreen('main');
        } else {
          setScreen('login');
        }
      } catch {
        setScreen('login');
      }
    }

    checkSession();
  }, []);

  // Auto sign-out when Supabase refresh token becomes invalid
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED_ERROR') {
        resetUser();
        setScreen('login');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    try { await signOut(); } catch {}
    resetUser();
    setScreen('login');
  };

  const handleInviteComplete = (userData) => {
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', '/');
    }
    setInviteToken(null);
    if (userData) {
      updateUser(userData);
      setScreen('main');
    }
  };

  const handleInviteCancel = () => {
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', '/');
    }
    setInviteToken(null);
  };

  return (
    <>
      <StatusBar style="dark" />
      {Platform.OS === 'web' && inviteToken ? (
        <WebInviteAcceptScreen
          token={inviteToken}
          onComplete={handleInviteComplete}
          onCancel={handleInviteCancel}
        />
      ) : (
        <>
          {(screen === 'login' || (screen === 'preloader' && Platform.OS === 'web')) && (
            <Login
              onSignUp={() => setScreen('registration')}
              onLogin={(userData) => { updateUser(userData); setScreen('main'); }}
            />
          )}
          {screen === 'registration' && (
            <Registration
              onBack={() => setScreen('login')}
              onSuccess={(userData) => { updateUser(userData); setScreen('main'); }}
            />
          )}
          {screen === 'preloader' && Platform.OS !== 'web' && (
            <Preloader progress={preloaderProgress} statusText={preloaderStatus} />
          )}
          {screen === 'main' && (
            Platform.OS === 'web' ? (
              <WebMainScreen onLogout={handleLogout} user={user} onUserUpdate={handleUserUpdate} />
            ) : (
              <AppDataProvider user={user}>
                <AppMainLoader onLogout={handleLogout} />
              </AppDataProvider>
            )
          )}
        </>
      )}
    </>
  );
}

export default function App() {
  const handleLogout = async () => {
    try { await signOut(); } catch {}
  };

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <UserProvider onLogout={handleLogout}>
          <NavigationContainer>
            <LanguageProvider>
              <AppContent />
            </LanguageProvider>
          </NavigationContainer>
        </UserProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
