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
  useWindowDimensions,
} from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { IconCalendar } from '../components/TabIcons';
import { IconCall, IconWhatsapp, IconTelegram } from '../components/ContactIcons';
import { IconPrices } from '../components/PropertyIcons';
import { IconPencil } from '../components/EditIcons';
import { useLanguage } from '../context/LanguageContext';
import { getCurrencySymbol } from '../utils/currency';
import { ownerOneTimeAmount, ownerMonthlyByMonth } from '../utils/ownerCommission';
import { getContactById, getContacts } from '../services/contactsService';
import { getProperties } from '../services/propertiesService';
import { getBookings } from '../services/bookingsService';
import { getCurrentUser } from '../services/authService';
import { generateConfirmationPDF } from '../services/bookingConfirmationService';
import PdfPreviewModal from '../components/PdfPreviewModal';

const TOP_INSET = (Constants.statusBarHeight ?? 44) + 12;

const COLORS = {
  background: '#F5F5F7',
  title:      '#2C2C2C',
  subtitle:   '#6B6B6B',
  cardBg:     '#FFFFFF',
  border:     '#E5E5EA',
  label:      '#6B6B6B',
  accent:     '#3D7D82',
};

function formatBookingDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const y = d.getFullYear();
  return `${day}.${m}.${y}`;
}

function formatPrice(val, sym) {
  if (val == null) return '—';
  return Number(val).toLocaleString('en-US').replace(/,/g, ' ') + ' ' + sym;
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
    <View style={styles.propInfoRow}>
      <Text style={styles.propInfoLabel} numberOfLines={1}>{label}</Text>
      {isLink ? (
        <TouchableOpacity onPress={onPress} style={styles.propInfoValueWrap}>
          <Text style={[styles.propInfoValue, styles.propInfoLink]} numberOfLines={1}>{value}</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.propInfoValue} numberOfLines={1}>{value || '—'}</Text>
      )}
    </View>
  );
}

function digitsOnly(s) {
  return String(s || '').replace(/[^\d]/g, '');
}

function openTelegram(handle) {
  const raw = String(handle || '').trim();
  if (!raw) return;
  if (raw.startsWith('@')) {
    Linking.openURL(`https://t.me/${raw.slice(1)}`);
  } else if (/^\+?\d+$/.test(raw)) {
    Linking.openURL(`https://t.me/+${digitsOnly(raw)}`);
  } else {
    Linking.openURL(`https://t.me/${raw}`);
  }
}

function openWhatsapp(phone) {
  const d = digitsOnly(phone);
  if (!d) return;
  Linking.openURL(`https://wa.me/${d}`);
}

function openPhone(phone, t) {
  const raw = String(phone || '').trim();
  const clean = raw.replace(/\s/g, '');
  if (!clean) return;
  Alert.alert(
    raw,
    t('callOrMessage'),
    [
      { text: t('cancel'), style: 'cancel' },
      { text: t('call'), onPress: () => Linking.openURL('tel:' + clean) },
      { text: t('sendMessage'), onPress: () => Linking.openURL('sms:' + clean) },
    ],
    { cancelable: true },
  );
}

function ContactActionBtn({ children, onPress }) {
  return (
    <TouchableOpacity style={styles.contactActionBtn} onPress={onPress} activeOpacity={0.7}>
      {children}
    </TouchableOpacity>
  );
}

function OwnerInfoRow({ label, name, phone, whatsapp, telegram, isLink, onPressName, t }) {
  const hasContacts = !!(phone || whatsapp || telegram);
  return (
    <>
      <View style={styles.propInfoRow}>
        <Text style={styles.propInfoLabel} numberOfLines={1}>{label}</Text>
        <View style={styles.propInfoValueWrap}>
          {isLink ? (
            <TouchableOpacity onPress={onPressName}>
              <Text style={[styles.propInfoValue, styles.propInfoLink]} numberOfLines={1}>{name || '—'}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.propInfoValue} numberOfLines={1}>{name || '—'}</Text>
          )}
        </View>
      </View>
      {hasContacts ? (
        <View style={styles.propInfoRow}>
          <Text style={styles.propInfoLabel} numberOfLines={1}>{t('pdContacts')}</Text>
          <View style={styles.contactActions}>
            {phone ? (
              <ContactActionBtn onPress={() => openPhone(phone, t)}>
                <IconCall size={20} color="#888" />
              </ContactActionBtn>
            ) : null}
            {whatsapp ? (
              <ContactActionBtn onPress={() => openWhatsapp(whatsapp)}>
                <IconWhatsapp size={20} color="#888" />
              </ContactActionBtn>
            ) : null}
            {telegram ? (
              <ContactActionBtn onPress={() => openTelegram(telegram)}>
                <IconTelegram size={20} color="#888" />
              </ContactActionBtn>
            ) : null}
          </View>
        </View>
      ) : null}
    </>
  );
}

export default function BookingDetailScreen({ booking, propertyCode, onBack, onContactPress, onPropertyPress, onDelete, onEdit, initialProperty, initialContact, user }) {
  const { t, language } = useLanguage();
  const { width } = useWindowDimensions();
  const hPad = width < 390 ? 16 : 20;
  const [contact, setContact] = useState(initialContact ?? null);
  const [loadingContact, setLoadingContact] = useState(!initialContact && !!booking.contactId);
  const [property, setProperty] = useState(initialProperty ?? null);
  const [loadingProperty, setLoadingProperty] = useState(!initialProperty && !!booking?.propertyId);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfPreviewVisible, setPdfPreviewVisible] = useState(false);
  const [pdfPreviewUri, setPdfPreviewUri] = useState(null);
  const [pdfPreviewHtml, setPdfPreviewHtml] = useState(null);

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
      if (prop.parent_id) {
        resort = all.find(p => p.id === prop.parent_id) || null;
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
      Alert.alert(t('error'), t('errorLoadProperty'));
      return;
    }
    setGeneratingPdf(true);
    try {
      const [profile, bookings] = await Promise.all([
        getCurrentUser(),
        getBookings(property.id),
      ]);
      const confirmationNumber = getBookingNumber(booking, bookings);
      const { uri, html } = await generateConfirmationPDF({
        booking,
        property,
        contact: contact || null,
        profile: profile || {},
        confirmationNumber,
        language: language || 'ru',
      });
      setPdfPreviewUri(uri);
      setPdfPreviewHtml(html);
      setPdfPreviewVisible(true);
    } catch (e) {
      Alert.alert(t('error'), e.message || t('errorCreatePdf'));
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handlePdfSend = async () => {
    if (!pdfPreviewUri) return;
    try {
      const result = await Share.share({
        url: pdfPreviewUri,
        type: 'application/pdf',
        title: t('pdfPreviewTitle'),
      });
      if (result.action === Share.sharedAction) {
        setPdfPreviewVisible(false);
        setPdfPreviewUri(null);
        setPdfPreviewHtml(null);
      }
    } catch (e) {
      Alert.alert(t('error'), e.message || t('errorSendFile'));
    }
  };

  const b = booking || {};
  const bookingSym = getCurrencySymbol(property?.currency || 'THB');
  const photos = Array.isArray(b.photos) ? b.photos : [];
  const contactName = contact ? [contact.name, contact.lastName].filter(Boolean).join(' ').trim() : null;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingHorizontal: hPad }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={20} color="#2C2C2C" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{propertyCode || t('pdBookingList')}</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Кнопки управления: агент видит их только для своих бронирований */}
      {(() => {
        const isTeamMember = !!(user?.teamMembership);
        const isOwnBooking = !isTeamMember || booking?.responsibleAgentId === user?.id;
        if (!isOwnBooking) return null;
        return (
          <View style={[styles.actionsRow, { paddingHorizontal: hPad }]}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleDelete} activeOpacity={0.7}>
              <Ionicons name="trash-outline" size={22} color="#888" />
            </TouchableOpacity>
            <View style={styles.actionsRight}>
              <TouchableOpacity style={styles.actionBtn} onPress={handleGenerateConfirmation} activeOpacity={0.7} disabled={generatingPdf}>
                {generatingPdf ? (
                  <ActivityIndicator size="small" color={COLORS.accent} />
                ) : (
                  <Ionicons name="document-text-outline" size={22} color="#888" />
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => onEdit?.(b)} activeOpacity={0.7}>
                <IconPencil size={22} color="#888" />
              </TouchableOpacity>
            </View>
          </View>
        );
      })()}

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: hPad }]}
        showsVerticalScrollIndicator={false}
      >
        {loadingProperty ? (
          <View style={[styles.card, styles.cardLoading]}>
            <ActivityIndicator size="small" color="#999" style={styles.loader} />
          </View>
        ) : property ? (
          <View style={styles.card}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="home-outline" size={18} color="#888" />
              <Text style={styles.sectionTitleText}>{t('bdGeneralInfo')}</Text>
            </View>
            <PropertyInfoRow
              label={t('propertyCode')}
              value={
                property._resort
                  ? (property._resort.code || '') + (property.code_suffix ? ` (${property.code_suffix})` : '')
                  : property.code
              }
              isLink={!!onPropertyPress}
              onPress={onPropertyPress ? () => onPropertyPress(property) : undefined}
            />
            <PropertyInfoRow label={t('pdCity')} value={property.city ?? property._resort?.city} />
            <PropertyInfoRow label={t('propDistrict')} value={property.district ?? property._resort?.district} />
            {(property.google_maps_link ?? property._resort?.google_maps_link) ? (
              <PropertyInfoRow
                label={t('pdLocation')}
                value={t('pdGoogleMapLink')}
                isLink
                onPress={() => Linking.openURL(property.google_maps_link ?? property._resort?.google_maps_link)}
              />
            ) : (
              <PropertyInfoRow label={t('pdLocation')} value="—" />
            )}
            <View style={styles.propDivider} />
            <OwnerInfoRow
              label={property.type === 'resort' ? t('pdOwnerManager') : (property._resort?.type === 'condo' ? t('pdReception') : t('pdOwner'))}
              name={property.ownerName}
              phone={property.ownerPhone1}
              whatsapp={property.ownerWhatsapp}
              telegram={property.ownerTelegram}
              isLink={!!(property._owner && onContactPress)}
              onPressName={property._owner && onContactPress ? () => onContactPress(property._owner) : undefined}
              t={t}
            />
            {property._resort?.type === 'condo' && (property.owner2Name || property.owner2Phone1 || property.owner2Whatsapp || property.owner2Telegram) ? (
              <>
                <View style={styles.propDivider} />
                <OwnerInfoRow
                  label={t('pdOwnerContact')}
                  name={property.owner2Name}
                  phone={property.owner2Phone1}
                  whatsapp={property.owner2Whatsapp}
                  telegram={property.owner2Telegram}
                  isLink={!!(property._owner2 && onContactPress)}
                  onPressName={property._owner2 && onContactPress ? () => onContactPress(property._owner2) : undefined}
                  t={t}
                />
              </>
            ) : null}
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.sectionTitleRow}>
            <IconCalendar size={18} color="#888" />
            <Text style={styles.sectionTitleText}>{t('bdBookingDates')}</Text>
          </View>
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
            <View style={styles.sectionTitleRow}>
              <Ionicons name="person-outline" size={18} color="#888" />
              <Text style={styles.sectionTitleText}>{t('bdClientInfo')}</Text>
            </View>
            {b.notMyCustomer ? (
              <Text style={styles.contactValue}>{t('bookingNotMyCustomer')}</Text>
            ) : loadingContact ? (
              <ActivityIndicator size="small" color="#999" style={styles.loader} />
            ) : contact ? (
              <>
                <OwnerInfoRow
                  label={t('bdClient')}
                  name={contactName}
                  phone={contact.phone}
                  whatsapp={contact.whatsapp}
                  telegram={contact.telegram}
                  isLink={!!onContactPress}
                  onPressName={onContactPress ? () => onContactPress(contact) : undefined}
                  t={t}
                />
                {b.passportId ? (
                  <PropertyInfoRow label={t('bookingPassportId')} value={b.passportId} />
                ) : null}
              </>
            ) : (
              <Text style={styles.placeholderText}>—</Text>
            )}
          </View>
        ) : null}

        {[b.priceMonthly, b.totalPrice, b.bookingDeposit, b.saveDeposit, b.commission, b.ownerCommissionOneTime, b.ownerCommissionMonthly].some(v => v != null) ? (
          <View style={styles.card}>
            <View style={styles.sectionTitleRow}>
              <IconPrices size={18} color="#888" />
              <Text style={styles.sectionTitleText}>{t('bdPrices')}</Text>
            </View>
            <DetailRow label={t('pdPriceMonthly')} value={b.priceMonthly != null ? formatPrice(b.priceMonthly, bookingSym) : null} />
            <DetailRow label={t('bookingTotalPrice')} value={b.totalPrice != null ? formatPrice(b.totalPrice, bookingSym) : null} />
            <DetailRow label={t('pdBookingDeposit')} value={b.bookingDeposit != null ? formatPrice(b.bookingDeposit, bookingSym) : null} />
            <DetailRow label={t('pdSaveDeposit')} value={b.saveDeposit != null ? formatPrice(b.saveDeposit, bookingSym) : null} />
            <DetailRow label={t('bookingOwnerCommOnce')} value={b.ownerCommissionOneTime != null ? (b.ownerCommissionOneTimeIsPercent ? `${formatPrice(ownerOneTimeAmount(b), bookingSym)} (${Number(b.ownerCommissionOneTime).toLocaleString()}%)` : formatPrice(b.ownerCommissionOneTime, bookingSym)) : null} />
            {(() => {
              if (b.ownerCommissionMonthly == null) return null;
              if (!b.ownerCommissionMonthlyIsPercent) {
                return <DetailRow label={t('ownerCommissionMonthly')} value={formatPrice(b.ownerCommissionMonthly, bookingSym)} />;
              }
              const months = ownerMonthlyByMonth(b);
              const total = months.reduce((s, r) => s + r.amount, 0);
              const pct = `(${Number(b.ownerCommissionMonthly).toLocaleString()}%)`;
              return (
                <>
                  <DetailRow label={t('ownerCommissionMonthly')} value={`${formatPrice(total, bookingSym)} ${pct}`} />
                  {months.length > 1 ? months.map((r, i) => (
                    <DetailRow key={i} label={`${t('commissionMonth')} ${i + 1}`} value={formatPrice(r.amount, bookingSym)} />
                  )) : null}
                </>
              );
            })()}
            <DetailRow label={t('pdCommission')} value={b.commission != null ? formatPrice(b.commission, bookingSym) : null} />
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

      <PdfPreviewModal
        visible={pdfPreviewVisible}
        pdfUri={pdfPreviewUri}
        html={pdfPreviewHtml}
        onClose={() => {
          setPdfPreviewVisible(false);
          setPdfPreviewUri(null);
          setPdfPreviewHtml(null);
        }}
        onSend={handlePdfSend}
      />
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
    justifyContent: 'space-between',
    paddingTop: TOP_INSET,
    paddingBottom: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.3,
    color: COLORS.title,
    textAlign: 'center',
  },
  headerRight: {
    width: 36,
  },

  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  actionsRight: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
  },

  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 88,
  },

  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  cardLoading: {
    minHeight: 120,
    justifyContent: 'center',
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.title,
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitleText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.title,
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: COLORS.label,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.title,
  },
  detailValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 20,
  },
  detailValueTime: {
    // gap в detailValueRow задаёт расстояние; стиль оставлен как no-op для обратной совместимости JSX
  },

  propInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
  },
  propInfoLabel: {
    fontSize: 14,
    color: COLORS.label,
    width: 130,
    flexShrink: 0,
  },
  propInfoValueWrap: {
    flex: 1,
  },
  propInfoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.title,
    flex: 1,
    textAlign: 'right',
  },
  propInfoLink: {
    color: COLORS.accent,
    fontWeight: '600',
  },
  propDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.07)',
    marginVertical: 8,
  },

  contactActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 'auto',
  },
  contactActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  loader: {
    marginVertical: 8,
  },
  contactLink: {
    marginBottom: 10,
  },
  contactLinkText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.accent,
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
    fontSize: 16,
    color: COLORS.title,
  },
  placeholderText: {
    fontSize: 16,
    color: COLORS.label,
    fontStyle: 'italic',
  },

  commentsText: {
    fontSize: 16,
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
