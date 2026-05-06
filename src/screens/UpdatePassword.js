import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLanguage } from '../context/LanguageContext';
import Logo, { COLORS } from '../components/Logo';
import { setNewPassword, signOut } from '../services/authService';

// TD-014: установка нового пароля после клика по recovery-ссылке.
export default function UpdatePassword({ onDone }) {
  const { t } = useLanguage();
  const [pass1, setPass1] = useState('');
  const [pass2, setPass2] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    setError('');
    if (!pass1 || pass1.length < 8) { setError(t('passwordTooShort') || 'Password must be at least 8 characters'); return; }
    if (pass1 !== pass2) { setError(t('passwordsDoNotMatch') || 'Passwords do not match'); return; }
    setLoading(true);
    try {
      await setNewPassword(pass1);
      setSuccess(true);
      // signOut() вызовет SIGNED_OUT в onAuthStateChange → App.js сам переключит экран на Login
      // и сбросит user. Никакого setTimeout — listener реагирует мгновенно.
      await signOut();
      onDone?.();
    } catch (e) {
      setError(e?.message || t('saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.wrapper, { backgroundColor: COLORS.backgroundLogin }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Logo size="small" />
        <Text style={styles.title}>{t('updatePasswordTitle')}</Text>
        <Text style={styles.subtitle}>
          {success ? t('updatePasswordSuccess') : t('updatePasswordHint')}
        </Text>

        {!success && (
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder={t('newPassword') || 'New password'}
              placeholderTextColor="#777"
              value={pass1}
              onChangeText={setPass1}
              secureTextEntry
              autoCapitalize="none"
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder={t('confirmPassword') || 'Confirm password'}
              placeholderTextColor="#777"
              value={pass2}
              onChangeText={setPass2}
              secureTextEntry
              autoCapitalize="none"
              editable={!loading}
              onSubmitEditing={handleSubmit}
              returnKeyType="done"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              activeOpacity={0.8}
              onPress={handleSubmit}
              disabled={loading}
            >
              <Text style={styles.submitBtnText}>{loading ? t('saving') : t('updatePasswordSubmit')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper:        { flex: 1 },
  scrollContent:  { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32, alignItems: 'center' },
  title:          { fontSize: 22, fontWeight: '700', color: COLORS.title, marginTop: 18, marginBottom: 8, textAlign: 'center' },
  subtitle:       { fontSize: 14, color: COLORS.subtitle, marginBottom: 28, textAlign: 'center', maxWidth: 340, lineHeight: 20 },
  form:           { width: '100%', maxWidth: 340 },
  input:          {
    borderRadius: 12, paddingVertical: 15, paddingHorizontal: 16,
    fontSize: 16, color: COLORS.title, backgroundColor: '#FFF8DC',
    marginBottom: 14,
  },
  error:          { color: '#C62828', fontSize: 14, textAlign: 'center', marginBottom: 12 },
  submitBtn:      { backgroundColor: COLORS.green, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText:  { color: '#FFF', fontSize: 17, fontWeight: '700' },
});
