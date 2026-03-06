import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import Constants from 'expo-constants';
import { useLanguage } from '../context/LanguageContext';
import { getContactById } from '../services/contactsService';

const TOP_INSET = (Constants.statusBarHeight ?? 44) + 12;

const COLORS = {
  background: '#F5F2EB',
  title: '#2C2C2C',
  subtitle: '#5A5A5A',
  backArrow: '#5DB8D4',
  cardBg: '#FFFFFF',
  border: '#E0DAD2',
  labelColor: '#8A8A8A',
  linkColor: '#D81B60',
};

function formatBookingDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const y = d.getFullYear();
  return `${day}.${m}.${y}`;
}

function formatPrice(val) {
  if (val == null) return '—';
  return Number(val).toLocaleString('en-US').replace(/,/g, ' ') + ' Thb';
}

function DetailRow({ label, value }) {
  if (value == null || value === '') return null;
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{String(value)}</Text>
    </View>
  );
}

export default function BookingDetailScreen({ booking, propertyCode, onBack, onContactPress, onDelete, onEdit }) {
  const { t } = useLanguage();
  const [contact, setContact] = useState(null);
  const [loadingContact, setLoadingContact] = useState(!!booking.contactId);

  const loadContact = useCallback(async () => {
    if (!booking?.contactId) {
      setContact(null);
      setLoadingContact(false);
      return;
    }
    setLoadingContact(true);
    try {
      const c = await getContactById(booking.contactId);
      setContact(c);
    } catch {
      setContact(null);
    }
    setLoadingContact(false);
  }, [booking?.contactId]);

  useEffect(() => {
    loadContact();
  }, [loadContact]);

  const openPhone = (number) => {
    const clean = (number || '').replace(/\s/g, '');
    if (!clean) return;
    Alert.alert(number, t('callOrMessage'), [
      { text: t('back'), style: 'cancel' },
      { text: t('call'), onPress: () => Linking.openURL('tel:' + clean) },
      { text: t('sendMessage'), onPress: () => Linking.openURL('sms:' + clean) },
    ]);
  };

  const openTelegram = (value) => {
    const v = (value || '').trim();
    if (!v) return;
    const isPhone = /^\+?[\d\s-]+$/.test(v);
    const url = isPhone
      ? 'https://t.me/+' + v.replace(/\D/g, '')
      : 'https://t.me/' + (v.startsWith('@') ? v.slice(1) : v);
    Linking.openURL(url);
  };

  const handleDelete = () => {
    Alert.alert(t('bdDeleteTitle'), t('bdDeleteConfirm'), [
      { text: t('no'), style: 'cancel' },
      { text: t('yes'), style: 'destructive', onPress: () => onDelete?.(booking?.id) },
    ]);
  };

  const b = booking || {};
  const photos = Array.isArray(b.photos) ? b.photos : [];
  const contactName = contact ? [contact.name, contact.lastName].filter(Boolean).join(' ').trim() : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.8}>
          <Text style={styles.backArrowText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{propertyCode || t('pdBookingList')}</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleDelete} activeOpacity={0.7}>
          <Image source={require('../../assets/trash-icon.png')} style={styles.actionIconLg} resizeMode="contain" />
        </TouchableOpacity>
        <View style={styles.actionsRight}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => onEdit?.(b)} activeOpacity={0.7}>
            <Image source={require('../../assets/pencil-icon.png')} style={styles.actionIcon} resizeMode="contain" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('bdBookingDates')}</Text>
          <DetailRow label={t('bookingCheckIn')} value={formatBookingDate(b.checkIn)} />
          <DetailRow label={t('bookingCheckOut')} value={formatBookingDate(b.checkOut)} />
        </View>

        {(contact || loadingContact || b.contactId) ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('bookingChooseClient')}</Text>
            {loadingContact ? (
              <ActivityIndicator size="small" color="#999" style={styles.loader} />
            ) : contact ? (
              <>
                <TouchableOpacity
                  onPress={() => onContactPress?.(contact)}
                  style={styles.contactLink}
                  activeOpacity={0.7}
                >
                  <Text style={styles.contactLinkText}>{contactName || t('bookingChooseClientPlaceholder')}</Text>
                </TouchableOpacity>
                {contact.phone ? (
                  <TouchableOpacity onPress={() => openPhone(contact.phone)} style={styles.contactRow} activeOpacity={0.7}>
                    <Image source={require('../../assets/icon-contact-phone.png')} style={styles.contactIcon} resizeMode="contain" />
                    <Text style={styles.contactValue}>{contact.phone}</Text>
                  </TouchableOpacity>
                ) : null}
                {contact.telegram ? (
                  <TouchableOpacity onPress={() => openTelegram(contact.telegram)} style={styles.contactRow} activeOpacity={0.7}>
                    <Image source={require('../../assets/icon-contact-telegram.png')} style={styles.contactIcon} resizeMode="contain" />
                    <Text style={styles.contactValue}>{contact.telegram}</Text>
                  </TouchableOpacity>
                ) : null}
              </>
            ) : (
              <Text style={styles.placeholderText}>—</Text>
            )}
          </View>
        ) : null}

        {(b.passportId || b.notMyCustomer) ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('bdClientData')}</Text>
            {b.notMyCustomer ? (
              <DetailRow label={t('bookingNotMyCustomer')} value={t('yes')} />
            ) : null}
            <DetailRow label={t('bookingPassportId')} value={b.passportId} />
          </View>
        ) : null}

        {[b.priceMonthly, b.totalPrice, b.bookingDeposit, b.saveDeposit, b.commission].some(v => v != null) ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('bdPrices')}</Text>
            <DetailRow label={t('pdPriceMonthly')} value={b.priceMonthly != null ? formatPrice(b.priceMonthly) : null} />
            <DetailRow label={t('bookingTotalPrice')} value={b.totalPrice != null ? formatPrice(b.totalPrice) : null} />
            <DetailRow label={t('pdBookingDeposit')} value={b.bookingDeposit != null ? formatPrice(b.bookingDeposit) : null} />
            <DetailRow label={t('pdSaveDeposit')} value={b.saveDeposit != null ? formatPrice(b.saveDeposit) : null} />
            <DetailRow label={t('pdCommission')} value={b.commission != null ? formatPrice(b.commission) : null} />
          </View>
        ) : null}

        {(b.adults != null || b.children != null || b.pets) ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('bdGuests')}</Text>
            <DetailRow label={t('bookingAdults')} value={b.adults} />
            <DetailRow label={t('bookingChildren')} value={b.children} />
            {b.pets ? <DetailRow label={t('pdPets')} value={t('yes')} /> : null}
          </View>
        ) : null}

        {b.comments ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('pdComments')}</Text>
            <Text style={styles.commentsText}>{b.comments}</Text>
          </View>
        ) : null}

        {photos.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('wizAddPhoto')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photosRow}>
              {photos.map((uri, idx) => (
                <Image key={idx} source={{ uri }} style={styles.photoThumb} resizeMode="cover" />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: TOP_INSET,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  backBtn: {
    width: 52,
    padding: 8,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  backArrowText: {
    fontSize: 24,
    color: COLORS.backArrow,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.title,
    textAlign: 'center',
  },
  headerRight: {
    width: 52,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingHorizontal: 20,
  },
  actionsRight: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(245,242,235,0.9)',
    borderWidth: 1,
    borderColor: '#E0D8CC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    width: 20,
    height: 20,
  },
  actionIconLg: {
    width: 24,
    height: 24,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 88,
  },
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.title,
    marginBottom: 12,
  },
  detailRow: {
    marginBottom: 10,
  },
  detailLabel: {
    fontSize: 13,
    color: COLORS.labelColor,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.title,
  },
  loader: {
    marginVertical: 8,
  },
  contactLink: {
    marginBottom: 10,
  },
  contactLinkText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.linkColor,
    textDecorationLine: 'underline',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  contactIcon: {
    width: 22,
    height: 22,
    marginRight: 10,
  },
  contactValue: {
    fontSize: 15,
    color: COLORS.title,
  },
  placeholderText: {
    fontSize: 15,
    color: COLORS.labelColor,
    fontStyle: 'italic',
  },
  commentsText: {
    fontSize: 15,
    color: COLORS.title,
    lineHeight: 22,
  },
  photosRow: {
    flexDirection: 'row',
    gap: 10,
  },
  photoThumb: {
    width: 100,
    height: 100,
    borderRadius: 12,
  },
  bottomSpacer: {
    height: 20,
  },
});
