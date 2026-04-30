import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { useLanguage } from '../context/LanguageContext';
import Logo, { COLORS } from '../components/Logo';

// TD-015: экран который видит юзер после клика по confirmation-ссылке.
// На вебе откроется через redirect Supabase. На мобильном откроется в браузере
// (в Safari/Chrome) — там универсальный текст, который понятен и тем кто на компе,
// и тем кто на телефоне (откроет приложение и войдёт с этим email).
export default function EmailConfirmedSuccess({ onGoToLogin }) {
  const { t } = useLanguage();

  return (
    <View style={[styles.wrapper, { backgroundColor: COLORS.backgroundLogin }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Logo size="small" />
        <Text style={styles.checkmark}>✓</Text>
        <Text style={styles.title}>{t('emailConfirmedTitle')}</Text>
        <Text style={styles.hint}>{t('emailConfirmedHintWeb')}</Text>
        <Text style={styles.hint}>{t('emailConfirmedHintMobile')}</Text>

        <TouchableOpacity onPress={onGoToLogin} activeOpacity={0.8} style={styles.btn}>
          <Text style={styles.btnText}>{t('emailConfirmedGoToLogin')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper:        { flex: 1 },
  scrollContent:  { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32, alignItems: 'center' },
  checkmark:      { fontSize: 56, color: '#2E7D32', marginTop: 24, marginBottom: 8 },
  title:          { fontSize: 22, fontWeight: '700', color: COLORS.title, marginBottom: 18, textAlign: 'center' },
  hint:           { fontSize: 14, color: COLORS.subtitle, marginBottom: 12, textAlign: 'center', maxWidth: 360, lineHeight: 20 },
  btn:            { backgroundColor: COLORS.green, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, marginTop: 22 },
  btnText:        { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
