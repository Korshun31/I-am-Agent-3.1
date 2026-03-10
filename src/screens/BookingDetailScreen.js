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
  Share,
} from 'react-native';
import Constants from 'expo-constants';
import { useLanguage } from '../context/LanguageContext';
import { getContactById, getContacts } from '../services/contactsService';
import { getProperties } from '../services/propertiesService';
import { getBookings } from '../services/bookingsService';
import { getCurrentUser } from '../services/authService';
import { generateConfirmationPDF } from '../services/bookingConfirmationService';

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

function PropertyInfoRow({ label, value, isLink, onPress }) {
  return (
    <View style={styles.propertyInfoRow}>
      <Text style={styles.propertyInfoLabel} numberOfLines={1}>{label}</Text>
      <Text style={styles.propertyInfoColon}>:</Text>
      {isLink ? (
        <TouchableOpacity onPress={onPress} style={styles.propertyInfoValueWrap}>
          <Text style={[styles.propertyInfoValue, styles.propertyInfoLink]} numberOfLines={1}>{value}</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.propertyInfoValue} numberOfLines={1}>{value || '—'}</Text>
      )}
    </View>
  );
}

export default function BookingDetailScreen({ booking, propertyCode, onBack, onContactPress, onDelete, onEdit, initialProperty, initialContact }) {
  const { t } = useLanguage();
  const [contact, setContact] = useState(initialContact ?? null);
  const [loadingContact, setLoadingContact] = useState(!initialContact && !!booking.contactId);
  const [property, setProperty] = useState(initialProperty ?? null);
  const [loadingProperty, setLoadingProperty] = useState(!initialProperty && !!booking?.propertyId);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const loadProperty = useCallback(async () => {
    if (!booking?.propertyId) {
      setProperty(null);
      setLoadingProperty(false);
      return;
    }
    setLoadingProperty(true);
    try {
      const all = await getProperties();
      const prop = all.find(p => p.id === booking.propertyId);
      if (!prop) {
        setProperty(null);
        setLoadingProperty(false);
        return;
      }
      let resort = null;
      if (prop.resort_id) {
        resort = all.find(p => p.id === prop.resort_id) || null;
      }
      const owners = await getContacts('owners');
      const owner = prop.owner_id ? owners.find(o => o.id === prop.owner_id) : null;
      const owner2 = prop.owner_id_2 ? owners.find(o => o.id === prop.owner_id_2) : null;
      const enriched = {
        ...prop,
        _owner: owner || null,
        _owner2: owner2 || null,
        ownerName: owner ? `${owner.name} ${owner.lastName}`.trim() : '',
        ownerPhone1: owner?.phone || '',
        ownerPhone2: owner?.extraPhones?.[0] || '',
        ownerTelegram: owner?.telegram || '',
        owner2Name: owner2 ? `${owner2.name} ${owner2.lastName}`.trim() : '',
        owner2Phone1: owner2?.phone || '',
        owner2Phone2: owner2?.extraPhones?.[0] || '',
        owner2Telegram: owner2?.telegram || '',
      };
      setProperty({ ...enriched, _resort: resort });
    } catch {
      setProperty(null);
    }
    setLoadingProperty(false);
  }, [booking?.propertyId]);

  useEffect(() => {
    if (!initialProperty) loadProperty();
  }, [loadProperty, initialProperty]);

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
    if (!initialContact) loadContact();
  }, [loadContact, initialContact]);

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

  const getBookingNumber = useCallback((b, allBookings) => {
    if (!b?.checkIn || !allBookings?.length) return '—';
    const year = new Date(b.checkIn).getFullYear();
    const yearShort = year % 100;
    const sameYear = allBookings
      .filter(x => new Date(x.checkIn).getFullYear() === year)
      .sort((a, b) => new Date(a.createdAt || a.checkIn) - new Date(b.createdAt || b.checkIn));
    const idx = sameYear.findIndex(x => x.id === b.id);
    const seq = idx >= 0 ? idx + 1 : 0;
    return `${seq}/${String(yearShort).padStart(2, '0')}`;
  }, []);

  const handleGenerateConfirmation = async () => {
    if (!booking) return;
    if (!property) {
      Alert.alert(t('error'), 'Загрузите данные объекта');
      return;
    }
    setGeneratingPdf(true);
    try {
      const [profile, bookings] = await Promise.all([
        getCurrentUser(),
        getBookings(property.id),
      ]);
      const confirmationNumber = getBookingNumber(booking, bookings);
      const { uri } = await generateConfirmationPDF({
        booking,
        property,
        contact: contact || null,
        profile: profile || {},
        confirmationNumber,
      });
      await Share.share({
        url: uri,
        type: 'application/pdf',
        title: t('bdBookingDates') || 'Подтверждение бронирования',
      });
    } catch (e) {
      Alert.alert(t('error'), e.message || 'Не удалось создать PDF');
    } finally {
      setGeneratingPdf(false);
    }
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
          <TouchableOpacity style={styles.actionBtn} onPress={handleGenerateConfirmation} activeOpacity={0.7} disabled={generatingPdf}>
            {generatingPdf ? (
              <ActivityIndicator size="small" color="#5DB8D4" />
            ) : (
              <Image source={require('../../assets/icon-booking-confirmation.png')} style={styles.actionIcon} resizeMode="contain" />
            )}
          </TouchableOpacity>
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
        {loadingProperty ? (
          <View style={[styles.propertyBlock, styles.propertyBlockLoading, { backgroundColor: 'rgba(255,204,0,0.2)', borderColor: '#FFCC00' }]}>
            <ActivityIndicator size="small" color="#999" style={styles.loader} />
          </View>
        ) : property ? (
          <View style={[styles.propertyBlock, { backgroundColor: 'rgba(255,204,0,0.2)', borderColor: '#FFCC00' }]}>
            <PropertyInfoRow label={t('propertyCode')} value={
              property._resort
                ? (property._resort.code || '') + (property.code_suffix ? ` (${property.code_suffix})` : '')
                : property.code
            } />
            <PropertyInfoRow label={t('pdCity')} value={property.city ?? property._resort?.city} />
            <PropertyInfoRow label={t('propDistrict')} value={property.district ?? property._resort?.district} />
            {(property._resort?.google_maps_link || property.google_maps_link) ? (
              <PropertyInfoRow
                label={t('pdLocation')}
                value={t('pdGoogleMapLink')}
                isLink
                onPress={() => Linking.openURL(property._resort?.google_maps_link || property.google_maps_link)}
              />
            ) : (
              <PropertyInfoRow label={t('pdLocation')} value="—" />
            )}
            <View style={styles.propertyDivider} />
            <PropertyInfoRow
              label={property.type === 'resort' ? t('pdOwnerManager') : (property._resort?.type === 'condo' ? t('pdReception') : t('pdOwner'))}
              value={property.ownerName || '—'}
              isLink={!!(property._owner && onContactPress)}
              onPress={property._owner && onContactPress ? () => onContactPress(property._owner) : undefined}
            />
            {property.ownerPhone1 ? <PropertyInfoRow label={t('pdPhone') + ' 1'} value={property.ownerPhone1} /> : null}
            {property.ownerPhone2 ? <PropertyInfoRow label={t('pdPhone') + ' 2'} value={property.ownerPhone2} /> : null}
            {property.ownerTelegram ? <PropertyInfoRow label={t('telegram')} value={property.ownerTelegram} /> : null}
            {property._resort?.type === 'condo' && (property.owner2Name || property.owner2Phone1 || property.owner2Phone2 || property.owner2Telegram) ? (
              <>
                <View style={styles.propertyDivider} />
                <PropertyInfoRow
                  label={t('pdOwnerContact')}
                  value={property.owner2Name || '—'}
                  isLink={!!(property._owner2 && onContactPress)}
                  onPress={property._owner2 && onContactPress ? () => onContactPress(property._owner2) : undefined}
                />
                {property.owner2Phone1 ? <PropertyInfoRow label={t('pdPhone') + ' 1'} value={property.owner2Phone1} /> : null}
                {property.owner2Phone2 ? <PropertyInfoRow label={t('pdPhone') + ' 2'} value={property.owner2Phone2} /> : null}
                {property.owner2Telegram ? <PropertyInfoRow label={t('telegram')} value={property.owner2Telegram} /> : null}
              </>
            ) : null}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('bdBookingDates')}</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('bookingCheckIn')}</Text>
            <View style={styles.detailValueRow}>
              <Text style={styles.detailValue}>{formatBookingDate(b.checkIn)}</Text>
              {b.checkInTime ? <Text style={[styles.detailValue, styles.detailValueTime]}>{b.checkInTime}</Text> : null}
            </View>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('bookingCheckOut')}</Text>
            <View style={styles.detailValueRow}>
              <Text style={styles.detailValue}>{formatBookingDate(b.checkOut)}</Text>
              {b.checkOutTime ? <Text style={[styles.detailValue, styles.detailValueTime]}>{b.checkOutTime}</Text> : null}
            </View>
          </View>
        </View>

        {(contact || loadingContact || b.contactId || b.notMyCustomer) ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('bookingChooseClient')}</Text>
            {b.notMyCustomer ? (
              <Text style={styles.contactValue}>{t('bookingNotMyCustomer')}</Text>
            ) : loadingContact ? (
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
                {b.passportId ? (
                  <View style={styles.contactRow}>
                    <Image source={require('../../assets/icon-passport-id.png')} style={styles.contactIcon} resizeMode="contain" />
                    <Text style={styles.contactValue}>{b.passportId}</Text>
                  </View>
                ) : null}
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
  detailValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  detailValueTime: {
    marginLeft: 20,
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
  propertyBlock: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 14,
  },
  propertyBlockLoading: {
    minHeight: 220,
    justifyContent: 'center',
  },
  propertyInfoRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  propertyInfoLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2C2C2C',
    width: 120,
  },
  propertyInfoColon: {
    fontSize: 13,
    color: '#6B6B6B',
    marginRight: 8,
  },
  propertyInfoValueWrap: {
    flex: 1,
  },
  propertyInfoValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2C2C2C',
    flex: 1,
  },
  propertyInfoLink: {
    color: COLORS.linkColor,
    textDecorationLine: 'underline',
  },
  propertyDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginVertical: 10,
  },
});
