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
      style={[styles.wrapper, { backgroundColor: COLORS.background }]}
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
            <Text style={styles.fieldLabel}>{t('newPassword') || 'NEW PASSWORD'}</Text>
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
            <Text style={styles.fieldLabel}>{t('confirmPassword') || 'CONFIRM PASSWORD'}</Text>
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
  fieldLabel:     {
    fontSize: 12, fontWeight: '600', color: '#6B6B6B',
    letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 8,
  },
  input:          {
    borderRadius: 10, paddingVertical: 15, paddingHorizontal: 16,
    fontSize: 16, color: COLORS.title,
    backgroundColor: '#EBEBEE', borderWidth: 1,
    borderTopColor: '#D1D1D6', borderLeftColor: '#D1D1D6',
    borderBottomColor: '#F0F0F3', borderRightColor: '#F0F0F3',
    marginBottom: 16,
  },
  error:          { color: '#C62828', fontSize: 14, textAlign: 'center', marginBottom: 12 },
  submitBtn:      {
    backgroundColor: 'transparent',
    borderWidth: 1.5, borderColor: '#3D7D82',
    borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText:  { color: '#3D7D82', fontSize: 16, fontWeight: '600' },
});
