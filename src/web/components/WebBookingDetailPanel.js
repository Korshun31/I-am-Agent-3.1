import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  Modal, Animated, StyleSheet, Platform,
} from 'react-native';
import dayjs from 'dayjs';
import { useLanguage } from '../../context/LanguageContext';
import { getCurrencySymbol } from '../../utils/currency';
import { getPropertyTypeColors } from '../constants/propertyTypeColors';
import { deleteBooking } from '../../services/bookingsService';

const ACCENT = '#3D7D82';
const C = {
  bg: '#F4F6F9', surface: '#FFFFFF', border: '#E9ECEF',
  text: '#212529', muted: '#6C757D', light: '#ADB5BD',
  accent: ACCENT, accentBg: '#EAF4F5',
  green: '#4AA87D', greenBg: '#F0FAF5',
  blue: '#5B82D6', blueBg: '#F0F5FD',
  amber: '#C2920E', amberBg: '#FFFDE7',
};

function getEffectiveType(prop) {
  if (!prop) return 'house';
  return prop.effectiveType || prop.type || 'house';
}

function fmt(n, sym) {
  if (n == null) return '—';
  return Number(n).toLocaleString('ru-RU') + ' ' + (sym || '฿');
}

function fmtDateLong(d) {
  if (!d) return '—';
  return dayjs(d).format('DD MMM YYYY');
}

function nightsCount(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  return dayjs(checkOut).diff(dayjs(checkIn), 'day');
}

function statusInfo(checkIn, checkOut, t) {
  const today = dayjs();
  const ci = dayjs(checkIn);
  const co = dayjs(checkOut);
  if (co.isBefore(today, 'day')) return { label: t ? t('bookingStatusDone')     : 'Done',     color: C.muted, bg: '#F0F0F0' };
  if (ci.isAfter(today, 'day'))  return { label: t ? t('bookingStatusUpcoming') : 'Upcoming', color: C.blue,  bg: C.blueBg };
  return                                 { label: t ? t('bookingStatusActive')   : 'Active',   color: C.green, bg: C.greenBg };
}

function BookingDetail({ booking, property, contact, onEdit, onDelete, onClose, onPrint, user, teamMembers = [] }) {
  const { t } = useLanguage();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canEditBooking   = !user?.teamMembership || (booking?.responsibleAgentId === user?.id && !!user?.teamPermissions?.can_manage_bookings);
  const canDeleteBooking = !user?.teamMembership || booking?.responsibleAgentId === user?.id;

  if (!booking) return null;

  const psym = getCurrencySymbol(property?.currency || 'THB');
  const st = statusInfo(booking.checkIn, booking.checkOut, t);
  const nights = nightsCount(booking.checkIn, booking.checkOut);
  const tc = getPropertyTypeColors(getEffectiveType(property));

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteBooking(booking.id);
      onDelete();
    } catch (e) {
      if (e.message === 'BOOKING_DELETE_FORBIDDEN') {
        alert(t('bookingDeleteForbidden') || 'Нет прав на удаление этого бронирования.');
      } else {
        alert(t('errorPrefix') + ' ' + e.message);
      }
    } finally {
      setDeleting(false);
    }
  };

  function Section({ title, children }) {
    return (
      <View style={d.section}>
        <Text style={d.sectionTitle}>{title}</Text>
        {children}
      </View>
    );
  }

  function InfoRow({ label, value, accent }) {
    if (value == null || value === '' || value === '—') return null;
    return (
      <View style={d.infoRow}>
        <Text style={d.infoLabel}>{label}</Text>
        <Text style={[d.infoValue, accent && { color: ACCENT, fontWeight: '700' }]}>{value}</Text>
      </View>
    );
  }

  return (
    <View style={d.container}>
      {/* Header */}
      <View style={d.header}>
        <View style={d.headerTopRow}>
          <View style={d.headerLeftActions}>
            {!booking.notMyCustomer && (
              <TouchableOpacity
                style={d.iconBtn}
                onPress={onPrint}
                accessibilityLabel={t('bookingConfirmation')}
                {...(Platform.OS === 'web' ? { title: t('bookingConfirmationTooltip') || t('bookingConfirmation') } : {})}
              >
                <Text style={d.iconBtnText}>📄</Text>
              </TouchableOpacity>
            )}
            {canEditBooking && (
              <TouchableOpacity
                style={d.iconBtn}
                onPress={onEdit}
                accessibilityLabel={t('edit')}
                {...(Platform.OS === 'web' ? { title: t('edit') } : {})}
              >
                <Text style={d.iconBtnText}>✏️</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={d.closeBtn} onPress={onClose}>
            <Text style={d.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={d.headerIdentity}>
          <View style={d.propNameRow}>
            <View style={[d.statusBadge, { backgroundColor: st.bg }]}>
              <Text style={[d.statusText, { color: st.color }]}>{st.label}</Text>
            </View>
            <Text style={d.propName} numberOfLines={1}>
              {property?.name || t('bookingProperty')}
            </Text>
          </View>
          <View style={d.propMeta}>
            <View style={[d.typeDot, { backgroundColor: tc.border }]} />
            <Text style={d.propCode} numberOfLines={1} ellipsizeMode="tail">
              {property?.code || ''}
              {property?.code_suffix ? ` (${property.code_suffix})` : ''}
              {property?.city ? ` · ${property.city}` : ''}
            </Text>
          </View>
        </View>
      </View>

      {confirmDelete && (
        <View style={d.confirmBar}>
          <Text style={d.confirmText}>{t('bookingDeleteConfirm')}</Text>
          <TouchableOpacity style={d.confirmYes} onPress={handleDelete} disabled={deleting}>
            <Text style={d.confirmYesText}>{deleting ? '...' : t('delete')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={d.confirmNo} onPress={() => setConfirmDelete(false)}>
            <Text style={d.confirmNoText}>{t('cancel')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={d.scroll} showsVerticalScrollIndicator={false}>
        {/* Dates */}
        <Section title={t('bookingSectionDates')}>
          <View style={d.datesRow}>
            <View style={d.dateBlock}>
              <Text style={d.dateLabel}>{t('checkIn')}</Text>
              <Text style={d.dateValue}>{fmtDateLong(booking.checkIn)}</Text>
              {booking.checkInTime ? <Text style={d.dateTime}>{booking.checkInTime}</Text> : null}
            </View>
            <View style={d.dateSep}>
              <Text style={d.dateSepLine}>→</Text>
              <Text style={d.dateSepNights}>{nights} {t('nightsShort')}</Text>
            </View>
            <View style={d.dateBlock}>
              <Text style={d.dateLabel}>{t('checkOut')}</Text>
              <Text style={d.dateValue}>{fmtDateLong(booking.checkOut)}</Text>
              {booking.checkOutTime ? <Text style={d.dateTime}>{booking.checkOutTime}</Text> : null}
            </View>
          </View>
        </Section>

        {/* Client */}
        <Section title={t('bookingSectionClient')}>
          {booking.notMyCustomer ? (
            <Text style={d.ownerLabel}>{t('bookingNotMyClient')}</Text>
          ) : (
            <>
              <InfoRow label={t('name')} value={contact ? `${contact.name || ''} ${contact.lastName || ''}`.trim() : '—'} />
              <InfoRow label={t('bookingPassportId')} value={booking.passportId} />
              {contact?.phone ? <InfoRow label={t('contactPhoneLabel')} value={contact.phone} /> : null}
              {contact?.telegram ? <InfoRow label="Telegram" value={contact.telegram} /> : null}
            </>
          )}
        </Section>

        {/* Responsible — admin only */}
        {!user?.teamMembership && (() => {
          const ra = booking.responsibleAgentId;
          let label;
          if (!ra) {
            label = user?.companyInfo?.name || user?.teamMembership?.companyName || t('workAsCompany') || 'Company';
          } else {
            const m = (teamMembers || []).find(x => (x.user_id ?? x.id) === ra);
            label = m
              ? ([m.name, m.last_name || m.lastName].filter(Boolean).join(' ') || m.email || '—')
              : '—';
          }
          return (
            <Section title={t('bookingSectionResponsible')}>
              <InfoRow label={t('bookingResponsibleLabel')} value={label} />
            </Section>
          );
        })()}

        {/* Prices */}
        <Section title={t('bookingSectionCost')}>
          <InfoRow label={t('bookingRentMonthly')} value={fmt(booking.priceMonthly, psym)} accent />
          <InfoRow label={t('bookingTotalLabel')} value={fmt(booking.totalPrice, psym)} accent />
          <InfoRow label={t('bookingDepositLabel')} value={fmt(booking.bookingDeposit, psym)} />
          <InfoRow label={t('bookingSaveDeposit')} value={fmt(booking.saveDeposit, psym)} />
          <InfoRow label={t('bookingAgentComm')} value={fmt(booking.commission, psym)} />
          <InfoRow
            label={t('bookingOwnerCommOnce')}
            value={booking.ownerCommissionOneTime != null
              ? (booking.ownerCommissionOneTimeIsPercent && booking.priceMonthly
                  ? `${fmt(Math.round((Number(booking.ownerCommissionOneTime) / 100) * Number(booking.priceMonthly)), psym)} (${Number(booking.ownerCommissionOneTime).toLocaleString()}%)`
                  : fmt(booking.ownerCommissionOneTime, psym))
              : null}
          />
          <InfoRow
            label={t('bookingOwnerCommMonthly')}
            value={booking.ownerCommissionMonthly != null
              ? (booking.ownerCommissionMonthlyIsPercent && booking.priceMonthly
                  ? `${fmt(Math.round((Number(booking.ownerCommissionMonthly) / 100) * Number(booking.priceMonthly)), psym)} (${Number(booking.ownerCommissionMonthly).toLocaleString()}%)`
                  : fmt(booking.ownerCommissionMonthly, psym))
              : null}
          />
        </Section>

        {/* Guests */}
        {(booking.adults || booking.children || booking.pets) ? (
          <Section title={t('bookingSectionGuests')}>
            <InfoRow label={t('bookingAdultsLabel')} value={booking.adults} />
            <InfoRow label={t('bookingChildrenLabel')} value={booking.children} />
            {booking.pets ? <InfoRow label={t('bookingHasPets')} value="✓" /> : null}
          </Section>
        ) : null}

        {/* Comments */}
        {booking.comments ? (
          <Section title={t('bookingSectionComment')}>
            <Text style={d.commentText}>{booking.comments}</Text>
          </Section>
        ) : null}

        {/* Photos */}
        {booking.photos?.length > 0 ? (
          <Section title={t('bookingSectionPhotos')}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
              {booking.photos.map((url, i) => (
                <Image key={i} source={{ uri: url }} style={d.photo} resizeMode="cover" />
              ))}
            </ScrollView>
          </Section>
        ) : null}

        {/* Delete */}
        {canDeleteBooking && (
          <View style={d.deleteRow}>
            <TouchableOpacity
              style={d.deleteBtn}
              onPress={() => setConfirmDelete(true)}
            >
              <Text style={d.deleteBtnText}>{t('delete')}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

export default function WebBookingDetailPanel({
  visible, booking, property, contact,
  user, teamMembers,
  onEdit, onDelete, onClose, onPrint,
}) {
  const slideAnim    = useRef(new Animated.Value(540)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 540, duration: 280, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  if (!mounted && !visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Animated.View style={[s.backdrop, { opacity: backdropAnim }]} pointerEvents={visible ? 'auto' : 'none'}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View style={[s.panel, { transform: [{ translateX: slideAnim }] }]}>
          <BookingDetail
            booking={booking}
            property={property}
            contact={contact}
            user={user}
            teamMembers={teamMembers}
            onEdit={onEdit}
            onDelete={onDelete}
            onClose={onClose}
            onPrint={onPrint}
          />
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:  { flex: 1, flexDirection: 'row', justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  panel: {
    width: 500, height: '100%', backgroundColor: C.surface,
    shadowColor: '#000', shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.18, shadowRadius: 24, elevation: 24,
    flexDirection: 'column',
  },
});

const d = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface },
  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerLeftActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerIdentity: { gap: 5 },
  propNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 0,
  },
  statusText: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
  propName: { fontSize: 16, fontWeight: '600', color: C.text, flex: 1 },
  propMeta: { flexDirection: 'row', alignItems: 'center' },
  typeDot: { width: 7, height: 7, borderRadius: 3.5, marginRight: 6, flexShrink: 0 },
  propCode: { fontSize: 13, color: C.muted, flex: 1 },
  iconBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: { fontSize: 16, lineHeight: 20 },
  closeBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 16, color: C.muted, lineHeight: 20 },
  confirmBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF3F3', padding: 12, borderBottomWidth: 1, borderBottomColor: '#FFCDD2', gap: 8 },
  confirmText: { flex: 1, fontSize: 13, color: C.text },
  confirmYes: { backgroundColor: '#E53935', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  confirmYesText: { fontSize: 12, color: '#FFF', fontWeight: '700' },
  confirmNo: { borderWidth: 1, borderColor: C.border, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  confirmNoText: { fontSize: 12, color: C.muted },
  scroll: { flex: 1 },
  section: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  sectionTitle: { fontSize: 10, fontWeight: '800', color: C.light, letterSpacing: 1, marginBottom: 10 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  infoLabel: { fontSize: 13, color: C.muted, flex: 1 },
  infoValue: { fontSize: 13, color: C.text, fontWeight: '500', textAlign: 'right', flex: 1, minWidth: 90 },
  datesRow: { flexDirection: 'row', alignItems: 'stretch' },
  dateBlock: { flex: 1 },
  dateLabel: { fontSize: 11, color: C.light, fontWeight: '700', letterSpacing: 0.5, marginBottom: 3 },
  dateValue: { fontSize: 14, color: C.text, fontWeight: '600' },
  dateTime: { fontSize: 12, color: C.muted, marginTop: 2 },
  dateSep: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  dateSepLine: { fontSize: 16, color: C.light },
  dateSepNights: { fontSize: 11, color: C.muted, marginTop: 2 },
  ownerLabel: { fontSize: 14, color: C.muted, fontStyle: 'italic', paddingVertical: 4 },
  commentText: { fontSize: 13, color: C.text, lineHeight: 20 },
  photo: { width: 90, height: 90, borderRadius: 8, marginRight: 8 },
  deleteRow: { padding: 20, paddingBottom: 0 },
  deleteBtn: { borderWidth: 1, borderColor: '#FFCDD2', borderRadius: 8, padding: 12, alignItems: 'center' },
  deleteBtnText: { fontSize: 13, color: '#E53935', fontWeight: '600' },
});
