import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useLanguage } from '../context/LanguageContext';
import BookingCalendarScreen from '../screens/BookingCalendarScreen';

const TOP_INSET = (Constants.statusBarHeight ?? 44) + 12;

const MAX_SUBTITLE_LEN = 35;

function truncateWithEllipsis(str) {
  if (!str || typeof str !== 'string') return '';
  const s = String(str).trim();
  if (s.length <= MAX_SUBTITLE_LEN) return s;
  return s.slice(0, MAX_SUBTITLE_LEN - 3) + '...';
}

export default function PropertyBookingCalendarModal({ visible, onClose, propertyIds = [], subtitle = '', readOnly = false }) {
  const { t } = useLanguage();

  if (!visible) return null;

  const displayTitle = subtitle
    ? `${t('bookingCalendar')} — ${truncateWithEllipsis(subtitle)}`
    : t('bookingCalendar');

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={20} color="#2C2C2C" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">{displayTitle}</Text>
          <View style={styles.backBtn} />
        </View>
        <View style={styles.calendarWrap}>
          <BookingCalendarScreen
            isVisible={visible}
            propertyIdsFilter={propertyIds}
            embeddedInModal
            onClose={onClose}
            readOnly={readOnly}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
    paddingTop: TOP_INSET,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.07)',
    backgroundColor: '#FFF',
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2C2C2C',
    flex: 1,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  calendarWrap: {
    flex: 1,
  },
});
