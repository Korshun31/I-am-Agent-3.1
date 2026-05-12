import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Logo, { COLORS } from '../components/Logo';
import { useLanguage } from '../context/LanguageContext';
import { signUp } from '../services/authService';

const COMMON_PASSWORDS = [
  '12345678', '123456789', '1234567890', 'password', 'password1',
  'qwerty12', 'qwertyui', 'qwerty123', 'abc12345', 'abcd1234',
  '11111111', '12341234', '00000000', 'iloveyou', 'sunshine',
  'princess', 'football', 'charlie1', 'trustno1', 'superman',
  'master12', 'welcome1', 'shadow12', 'monkey12', 'dragon12',
  'michael1', 'jennifer', 'jordan23', 'harley12', 'ranger12',
  'batman12', 'andrew12', 'tigger12', 'charlie', 'robert12',
  'thomas12', 'hockey12', 'daniel12', 'starwars', 'klaster1',
  'george12', 'computer', 'michelle', 'jessica1', 'pepper12',
  'zxcvbnm1', 'asdfghjk', 'qazwsxed', 'zaq12wsx', 'passw0rd',
];

export default function Registration({ onBack, onSuccess, onPendingConfirmation }) {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [regError, setRegError] = useState('');
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);

  const handleRegister = async () => {
    setRegError('');
    const em = (email || '').trim();
    const pw = password || '';
    if (!em) { setRegError(t('enterEmail')); return; }
    if (!pw) { setRegError(t('enterPassword')); return; }
    if (pw.length < 8) { setRegError(t('passwordTooShort')); return; }
    if (COMMON_PASSWORDS.includes(pw.toLowerCase())) { setRegError(t('passwordTooCommon') || 'This password is too common. Please choose a more secure password.'); return; }
    if (pw !== passwordConfirm) { setRegError(t('passwordsMismatch')); return; }
    setLoading(true);
    try {
      const userData = await signUp({ email: em, password: pw, name: (name || '').trim() });
      // TD-015: signUp вернул флаг — Supabase ждёт подтверждения email через письмо.
      if (userData?.pendingConfirmation) {
        onPendingConfirmation?.(userData.email || em);
      } else {
        onSuccess?.(userData);
      }
    } catch (err) {
      if (err?.message === 'DISPOSABLE_EMAIL') {
        setRegError(t('disposableEmailNotAllowed'));
      } else {
        setRegError(err?.message || t('saveFailed'));
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
        <Text style={styles.pageTitle}>{t('createAccount')}</Text>

        <View style={styles.form}>
          {/* Name */}
          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>{t('name')}</Text>
            <TextInput
              style={styles.input}
              placeholder="John Smith"
              placeholderTextColor="#888"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
            />
          </View>

          {/* E-mail */}
          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>{t('email')}</Text>
            <TextInput
              ref={emailRef}
              style={styles.input}
              placeholder="Test@test.com"
              placeholderTextColor="#888"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
          </View>

          {/* Password */}
          <View style={styles.fieldWrap}>
            <View style={styles.labelRow}>
              <Text style={styles.fieldLabel}>{t('password')}</Text>
              <TouchableOpacity
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                <View style={styles.eyeWrap}>
                  <Text style={styles.eyeIcon}>{'\u{1F441}'}</Text>
                  {!showPassword && <View style={styles.eyeSlash} />}
                </View>
              </TouchableOpacity>
            </View>
            <TextInput
              ref={passwordRef}
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#888"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus()}
            />
          </View>

          {/* Password confirm */}
          <View style={styles.fieldWrap}>
            <View style={styles.labelRow}>
              <Text style={styles.fieldLabel}>{t('password')}</Text>
              <TouchableOpacity
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => setShowPasswordConfirm(!showPasswordConfirm)}
                tabIndex={-1}
              >
                <View style={styles.eyeWrap}>
                  <Text style={styles.eyeIcon}>{'\u{1F441}'}</Text>
                  {!showPasswordConfirm && <View style={styles.eyeSlash} />}
                </View>
              </TouchableOpacity>
            </View>
            <TextInput
              ref={confirmRef}
              style={styles.input}
              placeholder={t('confirmPasswordPlaceholder')}
              placeholderTextColor="#888"
              value={passwordConfirm}
              onChangeText={setPasswordConfirm}
              secureTextEntry={!showPasswordConfirm}
              returnKeyType="done"
              onSubmitEditing={handleRegister}
            />
          </View>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            activeOpacity={0.7}
            disabled={loading}
            onPress={handleRegister}
          >
            <Text style={styles.submitButtonText}>{loading ? t('saving') : t('createAccountBtn')}</Text>
          </TouchableOpacity>

          {regError ? (
            <Text style={styles.regError}>{regError}</Text>
          ) : null}

          <TouchableOpacity style={styles.backWrap} onPress={onBack} activeOpacity={0.7}>
            <Text style={styles.backLink}>{t('back')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>Production 3.1 (2025)</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
  },
  appName: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.title,
    marginTop: 12,
    marginBottom: 4,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.title,
    marginBottom: 28,
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
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyeWrap: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Глаз как в макете: не цветной (серый)
  eyeIcon: {
    fontSize: 16,
    color: '#6B6B6B',
  },
  // Маленькая полосочка поверх глаза, когда пароль скрыт
  eyeSlash: {
    position: 'absolute',
    width: 24,
    height: 1.5,
    backgroundColor: '#6B6B6B',
    borderRadius: 1,
    transform: [{ rotate: '-45deg' }],
  },
  input: {
    height: 48,
    borderRadius: 10,
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
  submitButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#3D7D82',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#3D7D82',
    fontSize: 16,
    fontWeight: '600',
  },
  regError: {
    color: '#C62828',
    fontSize: 14,
    textAlign: 'center',
    marginTop: -16,
    marginBottom: 16,
  },
  backWrap: {
    alignSelf: 'center',
    marginBottom: 32,
  },
  backLink: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3D7D82',
    textDecorationLine: 'underline',
  },
  footer: {
    fontSize: 12,
    color: COLORS.subtitle,
  },
});
