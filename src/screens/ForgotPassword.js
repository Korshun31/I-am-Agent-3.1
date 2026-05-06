import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLanguage } from '../context/LanguageContext';
import Logo, { COLORS } from '../components/Logo';
import { requestPasswordReset } from '../services/authService';

// TD-014: экран запроса ссылки для сброса пароля.
export default function ForgotPassword({ onBack }) {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    setError('');
    const em = (email || '').trim();
    if (!em) { setError(t('enterEmail')); return; }
    setLoading(true);
    try {
      await requestPasswordReset(em);
      setSent(true);
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
        <Text style={styles.title}>{t('forgotPasswordTitle')}</Text>
        <Text style={styles.subtitle}>
          {sent ? t('forgotPasswordSentMessage') : t('forgotPasswordHint')}
        </Text>

        {!sent && (
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="mail@mail.com"
              placeholderTextColor="#777"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              editable={!loading}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              activeOpacity={0.8}
              onPress={handleSubmit}
              disabled={loading}
            >
              <Text style={styles.submitBtnText}>{loading ? t('saving') : t('forgotPasswordSubmit')}</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={styles.backBtn}>
          <Text style={styles.backBtnText}>{t('back')}</Text>
        </TouchableOpacity>
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
  backBtn:        { marginTop: 22, padding: 10 },
  backBtnText:    { color: COLORS.subtitle, fontSize: 15, textDecorationLine: 'underline' },
});
