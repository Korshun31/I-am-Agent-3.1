import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useLanguage } from '../context/LanguageContext';

// Модалка «Вы были исключены из компании …». Показывается на экране логина
// после того как сервер сообщил о деактивации (postgres_changes онлайн или
// am_i_still_active=false при cold start / возврате из фона). Закрывается
// крестиком в правом верхнем углу — тогда стирается флаг и юзер может войти.
export default function KickedModal({ visible, companyName, onClose }) {
  const { t } = useLanguage();

  if (!visible) return null;

  const message = (t('kickedFromCompany') || 'You were removed from the company "{name}"')
    .replace('{name}', companyName || '');

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            accessibilityLabel="Close"
          >
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.message}>{message}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 28,
    paddingHorizontal: 24,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 14 },
      android: { elevation: 8 },
      default: { boxShadow: '0 6px 20px rgba(0,0,0,0.18)' },
    }),
  },
  closeBtn: {
    position: 'absolute',
    top: 8,
    right: 12,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 20,
    color: '#6C757D',
    lineHeight: 22,
  },
  message: {
    fontSize: 16,
    color: '#212529',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 22,
  },
});
