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
import ForgotPassword from './src/screens/ForgotPassword';
import UpdatePassword from './src/screens/UpdatePassword';
import EmailConfirmationPending from './src/screens/EmailConfirmationPending';
import EmailConfirmedSuccess from './src/screens/EmailConfirmedSuccess';
import MainNavigator from './src/navigation/MainNavigator';
import WebMainScreen from './src/web/WebMainScreen';
import { getCurrentUser, signOut } from './src/services/authService';
import { supabase } from './src/services/supabase';
import WebInviteAcceptScreen from './src/web/screens/WebInviteAcceptScreen';
function AppMainLoader({ onLogout, onUserUpdate }) {
  const { isLoaded, loadingProgress } = useAppData();

  if (!isLoaded) return <Preloader progress={loadingProgress} />;
  return <MainNavigator onLogout={onLogout} onUserUpdate={onUserUpdate} />;
}

function AppContent() {
  const { user, updateUser, resetUser, handleUserUpdate } = useUser();
  const { setLanguage } = useLanguage();
  const [screen, setScreen] = useState('preloader');
  const [pendingEmail, setPendingEmail] = useState('');
  const [inviteToken, setInviteToken] = useState(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('invite_token') || null;
    }
    return null;
  });

  useEffect(() => {
    async function checkSession() {
      // TD-014: если URL содержит recovery-хеш от Supabase (?type=recovery), не идём
      // в main — пусть listener PASSWORD_RECOVERY переключит на updatePassword.
      if (Platform.OS === 'web' && typeof window !== 'undefined'
          && window.location?.hash?.includes('type=recovery')) {
        setScreen('updatePassword');
        return;
      }
      // TD-015: после клика по confirmation-ссылке Supabase редиректит на сайт
      // с хешем type=signup. Не уводим в main — показываем «Почта подтверждена».
      if (Platform.OS === 'web' && typeof window !== 'undefined'
          && window.location?.hash?.includes('type=signup')) {
        setScreen('confirmedSuccess');
        return;
      }
      try {
        const userData = await getCurrentUser();
        if (userData) {
          updateUser(userData);
          if (userData.language) setLanguage(userData.language);
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

  // Реакция на события Supabase Auth:
  //   SIGNED_OUT — выход (в т.ч. когда Supabase v2 сам логаутит при невалидном refresh-токене);
  //   PASSWORD_RECOVERY — клик по recovery-ссылке → экран установки нового пароля (TD-014).
  // Реальные события Supabase JS v2: INITIAL_SESSION, PASSWORD_RECOVERY, SIGNED_IN, SIGNED_OUT,
  // TOKEN_REFRESHED, USER_UPDATED, MFA_CHALLENGE_VERIFIED. Никаких *_ERROR событий нет.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        resetUser();
        setScreen('login');
      } else if (event === 'PASSWORD_RECOVERY') {
        setScreen('updatePassword');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async (opts) => {
    try { await signOut(opts); } catch {}
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
          {/* TD-019: на стадии 'preloader' показываем Preloader на обеих платформах,
              чтобы веб не мерцал Login во время восстановления сессии. */}
          {screen === 'preloader' && (
            <Preloader />
          )}
          {screen === 'login' && (
            <Login
              onSignUp={() => setScreen('registration')}
              onForgotPassword={() => setScreen('forgotPassword')}
              onLogin={(userData) => {
                updateUser(userData);
                if (userData?.language) setLanguage(userData.language);
                setScreen('main');
              }}
            />
          )}
          {screen === 'forgotPassword' && (
            <ForgotPassword onBack={() => setScreen('login')} />
          )}
          {screen === 'updatePassword' && (
            <UpdatePassword
              onDone={() => {
                // signOut() в UpdatePassword уже триггерит SIGNED_OUT → listener выше сам
                // делает resetUser() + setScreen('login'). Здесь только чистим recovery-хеш URL.
                if (Platform.OS === 'web' && typeof window !== 'undefined') {
                  window.history.replaceState({}, '', '/');
                }
              }}
            />
          )}
          {screen === 'registration' && (
            <Registration
              onBack={() => setScreen('login')}
              onSuccess={(userData) => {
                updateUser(userData);
                if (userData?.language) setLanguage(userData.language);
                setScreen('main');
              }}
              onPendingConfirmation={(email) => {
                setPendingEmail(email);
                setScreen('emailConfirmation');
              }}
            />
          )}
          {screen === 'emailConfirmation' && (
            <EmailConfirmationPending
              email={pendingEmail}
              onBack={() => { setPendingEmail(''); setScreen('login'); }}
            />
          )}
          {screen === 'confirmedSuccess' && (
            <EmailConfirmedSuccess
              onGoToLogin={async () => {
                // Юзер уже логинен Supabase'ом через хеш-токен. Сбрасываем эту
                // авто-сессию и кидаем на Login, чтобы он зашёл паролем как обычно.
                try { await signOut(); } catch {}
                resetUser();
                if (Platform.OS === 'web' && typeof window !== 'undefined') {
                  window.history.replaceState({}, '', '/');
                }
                setScreen('login');
              }}
            />
          )}
          {screen === 'main' && (
            Platform.OS === 'web' ? (
              <WebMainScreen onLogout={handleLogout} user={user} onUserUpdate={handleUserUpdate} />
            ) : (
              <AppDataProvider user={user}>
                <AppMainLoader onLogout={handleLogout} onUserUpdate={handleUserUpdate} />
              </AppDataProvider>
            )
          )}
        </>
      )}
    </>
  );
}

export default function App() {
  const handleLogout = async (opts) => {
    try { await signOut(opts); } catch {}
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
