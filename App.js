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
import { LanguageProvider } from './src/context/LanguageContext';
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

function AppMainLoader({ onLogout }) {
  const { isLoaded, loadingProgress } = useAppData();
  const { user, handleUserUpdate, updateUser } = useUser();

  useEffect(() => {
    if (!user?.id || !user?.teamMembership) return;
    const channel = supabase
      .channel(`permissions-sync-${user.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'company_members',
        filter: `agent_id=eq.${user.id}`,
      }, async () => {
        const freshUser = await getCurrentUser();
        if (freshUser) updateUser(freshUser);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, user?.teamMembership]);

  if (!isLoaded) return <Preloader progress={loadingProgress} />;
  return <MainNavigator onLogout={onLogout} />;
}

function AppContent() {
  const { user, updateUser, resetUser, handleUserUpdate } = useUser();
  const [screen, setScreen] = useState('preloader');
  const [inviteToken, setInviteToken] = useState(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('token') || null;
    }
    return null;
  });

  useEffect(() => {
    async function checkSession() {
      try {
        const userData = await getCurrentUser();
        if (userData) {
          updateUser(userData);
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
          {screen === 'preloader' && Platform.OS !== 'web' && <Preloader />}
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
