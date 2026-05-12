import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Logo, { COLORS } from '../components/Logo';
import { signIn } from '../services/authService';
import { clearKickedFlag } from '../utils/kickedFlag';

// TD-032: brute-force protection. After MAX_ATTEMPTS wrong passwords for the
// same email, block the login button for LOCK_DURATION_MS. Counter is keyed
// by lowercased email and persisted in AsyncStorage so it survives reloads.
const MAX_ATTEMPTS = 3;
const LOCK_DURATION_MS = 60 * 1000;
const ATTEMPTS_KEY = (email) => `loginAttempts:${(email || '').trim().toLowerCase()}`;
const LOCK_KEY     = (email) => `loginLockedUntil:${(email || '').trim().toLowerCase()}`;

export default function Login({ onSignUp, onLogin, onForgotPassword }) {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef(null);

  // Tick every second while the form is locked, so the countdown re-renders.
  useEffect(() => {
    if (lockedUntil <= Date.now()) return undefined;
    const id = setInterval(() => {
      const t1 = Date.now();
      setNow(t1);
      if (t1 >= lockedUntil) {
        setLockedUntil(0);
        setLoginError('');
      }
    }, 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  // When user changes the email, look up any persisted lock for that email.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const em = (email || '').trim().toLowerCase();
      if (!em) {
        if (!cancelled) { setLockedUntil(0); setLoginError(''); }
        return;
      }
      try {
        const raw = await AsyncStorage.getItem(LOCK_KEY(em));
        const until = raw ? parseInt(raw, 10) : 0;
        if (cancelled) return;
        if (until && until > Date.now()) {
          setLockedUntil(until);
          setNow(Date.now());
        } else {
          setLockedUntil(0);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [email]);

  const isLocked = lockedUntil > now;
  const secondsLeft = isLocked ? Math.ceil((lockedUntil - now) / 1000) : 0;

  const recordFailedAttempt = async (em) => {
    try {
      const raw = await AsyncStorage.getItem(ATTEMPTS_KEY(em));
      const prev = parseInt(raw, 10);
      const next = (Number.isFinite(prev) ? prev : 0) + 1;
      if (next >= MAX_ATTEMPTS) {
        const until = Date.now() + LOCK_DURATION_MS;
        await AsyncStorage.setItem(LOCK_KEY(em), String(until));
        await AsyncStorage.removeItem(ATTEMPTS_KEY(em));
        setLockedUntil(until);
        setNow(Date.now());
      } else {
        await AsyncStorage.setItem(ATTEMPTS_KEY(em), String(next));
      }
    } catch {}
  };

  const resetLoginAttempts = async (em) => {
    try {
      await AsyncStorage.multiRemove([ATTEMPTS_KEY(em), LOCK_KEY(em)]);
    } catch {}
  };

  const handleLogin = async () => {
    if (isLocked || loading) return;
    setLoginError('');
    const em = (email || '').trim();
    const pw = password || '';
    if (!em) { setLoginError(t('enterEmail')); return; }
    if (!pw) { setLoginError(t('enterPassword')); return; }
    setLoading(true);
    try {
      const userData = await signIn({ email: em, password: pw });
      await resetLoginAttempts(em.toLowerCase());
      // TD-128: успешный вход стирает флаг «меня выкинули» из прошлой сессии.
      await clearKickedFlag();
      onLogin?.(userData);
    } catch (err) {
      const msg = err?.message || '';
      if (msg.includes('Invalid login credentials')) {
        await recordFailedAttempt(em.toLowerCase());
        setLoginError(t('wrongPassword'));
      } else if (msg === 'PROFILE_NOT_FOUND') {
        setLoginError(t('loginProfileNotFound'));
      } else if (msg === 'EMAIL_NOT_CONFIRMED') {
        // TD-015: юзер пытается войти, но не подтвердил email через письмо.
        setLoginError(t('emailNotConfirmedHint'));
      } else {
        setLoginError(msg || t('saveFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.wrapper, { backgroundColor: COLORS.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Logo size="small" />
        <Text style={styles.appName}>{t('appName')}</Text>
        <Text style={styles.tagline}>{t('tagline')}</Text>

        <View style={styles.form}>
          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>{t('email')}</Text>
            <TextInput
              style={styles.input}
              placeholder="mail@mail.com"
              placeholderTextColor="#777"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
          </View>
          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>{t('password')}</Text>
            <TextInput
              ref={passwordRef}
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#777"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="password"
              autoComplete="password"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
          </View>

          <TouchableOpacity
            style={[styles.loginButton, (isLocked || loading) && styles.loginButtonDisabled]}
            activeOpacity={0.7}
            onPress={handleLogin}
            disabled={isLocked || loading}
          >
            <Text style={styles.loginButtonText}>{loading ? t('saving') : t('login')}</Text>
          </TouchableOpacity>

          {/* TD-014: ссылка на экран сброса пароля */}
          {onForgotPassword && (
            <TouchableOpacity onPress={onForgotPassword} activeOpacity={0.7} style={styles.forgotLink}>
              <Text style={styles.forgotLinkText}>{t('forgotPasswordLink')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {isLocked ? (
          <Text style={styles.loginError}>
            {(t('loginLockedTryAgain') || 'Too many failed attempts. Try again in {seconds} s.').replace('{seconds}', String(secondsLeft))}
          </Text>
        ) : loginError ? (
          <Text style={styles.loginError}>{loginError}</Text>
        ) : null}

        <View style={styles.signUpRow}>
          <Text style={styles.signUpPrompt}>{t('noAccount')}</Text>
          <TouchableOpacity onPress={onSignUp} activeOpacity={0.7}>
            <Text style={styles.signUpLink}>{t('signUp')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center',
  },
  appName: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.title,
    marginTop: 14,
    marginBottom: 4,
  },
  tagline: {
    fontSize: 14,
    color: COLORS.subtitle,
    marginBottom: 32,
  },
  form: {
    width: '100%',
    maxWidth: 340,
  },
  fieldWrap: {
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B6B6B',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  input: {
    borderRadius: 10,
    paddingVertical: 15,
    paddingHorizontal: 16,
    fontSize: 16,
    color: COLORS.title,
    backgroundColor: '#EBEBEE',
    borderWidth: 1,
    borderTopColor: '#D1D1D6',
    borderLeftColor: '#D1D1D6',
    borderBottomColor: '#F0F0F3',
    borderRightColor: '#F0F0F3',
    marginBottom: 16,
  },
  loginButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#3D7D82',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 26,
  },
  loginButtonDisabled: {
    opacity: 0.5,
  },
  loginButtonText: {
    color: '#3D7D82',
    fontSize: 16,
    fontWeight: '600',
  },
  forgotLink: {
    alignSelf: 'center',
    marginTop: -10,
    marginBottom: 20,
    padding: 8,
  },
  forgotLinkText: {
    color: '#3D7D82',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  signUpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  signUpPrompt: {
    fontSize: 15,
    color: COLORS.subtitle,
  },
  loginError: {
    color: '#C62828',
    fontSize: 14,
    textAlign: 'center',
    marginTop: -16,
    marginBottom: 16,
  },
  signUpLink: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3D7D82',
    textDecorationLine: 'underline',
  },
});
