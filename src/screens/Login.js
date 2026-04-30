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
import { signIn, signInWithGoogle, signInWithFacebook } from '../services/authService';

// TD-032: brute-force protection. After MAX_ATTEMPTS wrong passwords for the
// same email, block the login button for LOCK_DURATION_MS. Counter is keyed
// by lowercased email and persisted in AsyncStorage so it survives reloads.
const MAX_ATTEMPTS = 3;
const LOCK_DURATION_MS = 60 * 1000;
const ATTEMPTS_KEY = (email) => `loginAttempts:${(email || '').trim().toLowerCase()}`;
const LOCK_KEY     = (email) => `loginLockedUntil:${(email || '').trim().toLowerCase()}`;

// Тени в стиле макета: выраженные drop shadow, «слоистость»
const inputShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.12,
  shadowRadius: 6,
  elevation: 4,
};
const labelShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.1,
  shadowRadius: 3,
  elevation: 3,
};
const buttonShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.15,
  shadowRadius: 6,
  elevation: 5,
};

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

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (e) {
      Alert.alert(t('error'), e.message);
    }
  };

  const handleFacebookLogin = async () => {
    try {
      await signInWithFacebook();
    } catch (e) {
      Alert.alert(t('error'), e.message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.wrapper, { backgroundColor: COLORS.backgroundLogin }]}
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
            <View style={[styles.labelSticker, styles.labelStickerEmail]}>
              <Text style={styles.labelBannerText}>{t('email')}</Text>
            </View>
            <TextInput
              style={[styles.input, styles.inputEmail, inputShadow]}
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
            <View style={[styles.labelSticker, styles.labelStickerPassword]}>
              <Text style={styles.labelBannerText}>{t('password')}</Text>
            </View>
            <TextInput
              ref={passwordRef}
              style={[styles.input, styles.inputPassword, inputShadow]}
              placeholder="••••••••"
              placeholderTextColor="#777"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
          </View>

          <TouchableOpacity
            style={[styles.loginButton, buttonShadow, (isLocked || loading) && styles.loginButtonDisabled]}
            activeOpacity={0.8}
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

          {/* <Text style={styles.orText}>{t('orSignIn')}</Text> */}
          {/* <View style={styles.socialRow}>
            <TouchableOpacity style={[styles.socialBtn, inputShadow]} activeOpacity={0.8} onPress={handleGoogleLogin}>
              <Text style={styles.socialIconGoogle}>G</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.socialBtn, styles.socialBtnFacebook, inputShadow]}
              activeOpacity={0.8}
              onPress={handleFacebookLogin}
            >
              <Text style={styles.socialIconFacebook}>f</Text>
            </TouchableOpacity>
          </View> */}
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
    marginBottom: 22,
    position: 'relative',
  },
  // Стикеры как на странице регистрации: один размер, цвет поля совпадает с цветом метки
  labelSticker: {
    position: 'absolute',
    top: -12,
    right: 12,
    zIndex: 1,
    width: 100,
    height: 36,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  labelStickerEmail: {
    backgroundColor: COLORS.stickerYellow,
  },
  labelStickerPassword: {
    backgroundColor: COLORS.stickerBlue,
  },
  labelBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.title,
  },
  input: {
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 16,
    fontSize: 16,
    color: COLORS.title,
    borderWidth: 0,
  },
  inputEmail: {
    backgroundColor: COLORS.stickerYellow,
  },
  inputPassword: {
    backgroundColor: COLORS.stickerBlue,
  },
  loginButton: {
    backgroundColor: COLORS.green,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 26,
  },
  loginButtonDisabled: {
    opacity: 0.5,
  },
  loginButtonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
  },
  forgotLink: {
    alignSelf: 'center',
    marginTop: -10,
    marginBottom: 20,
    padding: 8,
  },
  forgotLinkText: {
    color: COLORS.subtitle,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  orText: {
    fontSize: 14,
    color: COLORS.subtitle,
    marginBottom: 18,
    textAlign: 'center',
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 18,
    marginBottom: 44,
  },
  socialBtn: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  socialBtnFacebook: {
    backgroundColor: COLORS.facebookBlue,
  },
  socialIconGoogle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#5F6368',
  },
  socialIconFacebook: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFF',
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
    color: COLORS.signUpPink,
    textDecorationLine: 'underline',
  },
});
