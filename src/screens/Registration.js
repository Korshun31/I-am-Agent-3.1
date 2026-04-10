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

const fieldShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  elevation: 3,
};
const buttonShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.12,
  shadowRadius: 5,
  elevation: 4,
};

// Увеличенный размер стикеров, чтобы «Password» и иконка глаза помещались
const STICKER_LABEL_SIZE = { width: 108, height: 36 };

export default function Registration({ onBack, onSuccess }) {
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
    if (pw.length < 6) { setRegError(t('passwordTooShort')); return; }
    if (pw !== passwordConfirm) { setRegError(t('passwordsMismatch')); return; }
    setLoading(true);
    try {
      const userData = await signUp({ email: em, password: pw, name: (name || '').trim() });
      onSuccess?.(userData);
    } catch (err) {
      setRegError(err?.message || t('saveFailed'));
    } finally {
      setLoading(false);
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
        <Text style={styles.pageTitle}>{t('createAccount')}</Text>

        <View style={styles.form}>
          {/* Name */}
          <View style={styles.fieldWrap}>
            <View style={[styles.labelSticker, { backgroundColor: COLORS.regNameLabel }]}>
              <Text style={styles.labelText}>{t('name')}</Text>
            </View>
            <TextInput
              style={[styles.inputSticker, { backgroundColor: COLORS.regNameBg }, fieldShadow]}
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
            <View style={[styles.labelSticker, { backgroundColor: COLORS.regEmailLabel }]}>
              <Text style={styles.labelText}>{t('email')}</Text>
            </View>
            <TextInput
              ref={emailRef}
              style={[styles.inputSticker, { backgroundColor: COLORS.regEmailBg }, fieldShadow]}
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
            <View style={[styles.labelSticker, styles.labelWithIcon, { backgroundColor: COLORS.regPasswordLabel }]}>
              <Text style={styles.labelText}>{t('password')}</Text>
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
              style={[styles.inputSticker, { backgroundColor: COLORS.regPasswordBg }, fieldShadow]}
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
            <View style={[styles.labelSticker, styles.labelWithIcon, { backgroundColor: COLORS.regConfirmLabel }]}>
              <Text style={styles.labelText}>{t('password')}</Text>
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
              style={[styles.inputSticker, { backgroundColor: COLORS.regConfirmBg }, fieldShadow]}
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
            style={[styles.submitButton, buttonShadow]}
            activeOpacity={0.8}
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
    marginBottom: 20,
    position: 'relative',
  },
  labelSticker: {
    position: 'absolute',
    top: -12,
    right: 12,
    zIndex: 1,
    ...STICKER_LABEL_SIZE,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  labelWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingRight: 4,
  },
  labelText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.title,
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
  inputSticker: {
    height: 48,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    color: COLORS.title,
    borderWidth: 0,
  },
  submitButton: {
    backgroundColor: COLORS.green,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
  },
  regError: {
    color: '#C62828',
    fontSize: 14,
    textAlign: 'center',
    marginTop: -16,
    marginBottom: 16,
  },
  backWrap: {
    alignSelf: 'flex-start',
    marginBottom: 32,
  },
  backLink: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.backRed,
    textDecorationLine: 'underline',
  },
  footer: {
    fontSize: 12,
    color: COLORS.subtitle,
  },
});
