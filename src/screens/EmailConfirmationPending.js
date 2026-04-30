import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform,
} from 'react-native';
import { useLanguage } from '../context/LanguageContext';
import Logo, { COLORS } from '../components/Logo';

// TD-015: экран после регистрации, пока юзер не подтвердил email.
export default function EmailConfirmationPending({ email, onBack }) {
  const { t } = useLanguage();

  return (
    <View style={[styles.wrapper, { backgroundColor: COLORS.backgroundLogin }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Logo size="small" />
        <Text style={styles.title}>{t('emailPendingTitle')}</Text>
        <Text style={styles.email}>{email}</Text>
        <Text style={styles.hint}>{t('emailPendingHint')}</Text>
        <Text style={styles.subhint}>{t('emailPendingSubhint')}</Text>

        <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={styles.backBtn}>
          <Text style={styles.backBtnText}>{t('emailPendingBackToLogin')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper:        { flex: 1 },
  scrollContent:  { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32, alignItems: 'center' },
  title:          { fontSize: 22, fontWeight: '700', color: COLORS.title, marginTop: 18, marginBottom: 12, textAlign: 'center' },
  email:          { fontSize: 16, fontWeight: '600', color: COLORS.title, marginBottom: 18, textAlign: 'center' },
  hint:           { fontSize: 14, color: COLORS.subtitle, marginBottom: 12, textAlign: 'center', maxWidth: 340, lineHeight: 20 },
  subhint:        { fontSize: 13, color: COLORS.subtitle, marginBottom: 28, textAlign: 'center', maxWidth: 340, lineHeight: 18, opacity: 0.8 },
  backBtn:        { marginTop: 16, padding: 12 },
  backBtnText:    { color: COLORS.subtitle, fontSize: 15, textDecorationLine: 'underline' },
});
