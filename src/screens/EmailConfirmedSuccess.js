import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../context/LanguageContext';
import Logo, { COLORS } from '../components/Logo';

// TD-015: экран который видит юзер после клика по confirmation-ссылке.
// На вебе откроется через redirect Supabase. На мобильном откроется в браузере
// (в Safari/Chrome) — там универсальный текст, который понятен и тем кто на компе,
// и тем кто на телефоне (откроет приложение и войдёт с этим email).
export default function EmailConfirmedSuccess({ onGoToLogin }) {
  const { t } = useLanguage();

  return (
    <View style={[styles.wrapper, { backgroundColor: COLORS.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Logo size="small" />
        <Ionicons name="checkmark-circle" size={56} color="#3D7D82" style={styles.checkmark} />
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
  checkmark:      { marginTop: 24, marginBottom: 8 },
  title:          { fontSize: 20, fontWeight: '600', letterSpacing: -0.3, color: COLORS.title, marginBottom: 18, textAlign: 'center' },
  hint:           { fontSize: 14, color: COLORS.subtitle, marginBottom: 12, textAlign: 'center', maxWidth: 360, lineHeight: 20 },
  btn:            { borderWidth: 1.5, borderColor: '#3D7D82', backgroundColor: 'rgba(61,125,130,0.08)', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, marginTop: 22 },
  btnText:        { color: '#3D7D82', fontSize: 16, fontWeight: '600' },
});
