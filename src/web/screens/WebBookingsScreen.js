import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Image, TextInput, Pressable,
} from 'react-native';
import dayjs from 'dayjs';
import { useLanguage } from '../../context/LanguageContext';
import { getCurrencySymbol } from '../../utils/currency';

import { getBookings, deleteBooking } from '../../services/bookingsService';
import { getProperties } from '../../services/propertiesService';
import { getContacts } from '../../services/contactsService';
import { supabase } from '../../services/supabase';
import WebBookingEditPanel from '../components/WebBookingEditPanel';
import WebPropertyDetailPanel from '../components/WebPropertyDetailPanel';

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT   = '#3D7D82';
const C = {
  bg: '#F4F6F9', surface: '#FFFFFF', border: '#E9ECEF',
  text: '#212529', muted: '#6C757D', light: '#ADB5BD',
  accent: ACCENT, accentBg: '#EAF4F5',
  green: '#4AA87D', greenBg: '#F0FAF5',
  blue: '#5B82D6', blueBg: '#F0F5FD',
  amber: '#C2920E', amberBg: '#FFFDE7',
};

const MONTH_W = 130;   // px per month column
const ROW_H   = 48;    // px per property row
const LEFT_W  = 130;   // px for left property name column
const HOUSE_LIKE_TYPES = new Set(['house', 'resort_house', 'condo_apartment']);

const BOOKING_COLORS = [
  '#4FC3F7','#81C784','#FFB74D','#BA68C8',
  '#F06292','#4DD0E1','#AED581','#FFD54F',
  '#FF8A65','#A5D6A7','#80DEEA','#CE93D8',
  '#FFCC02','#80CBC4','#EF9A9A','#90A4AE',
];

const TYPE_COLOR = {
  house:  { border: '#C2920E', bg: '#FFFDE7', text: '#C2920E' },
  resort: { border: '#2E7D32', bg: '#E8F5E9', text: '#2E7D32' },
  condo:  { border: '#1565C0', bg: '#E3F2FD', text: '#1565C0' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Returns the pre-computed effectiveType (annotated during load)
function getEffectiveType(prop) {
  if (!prop) return 'house';
  return prop.effectiveType || prop.type || 'house';
}

function fmt(n, sym) {
  if (n == null) return '—';
  return Number(n).toLocaleString('ru-RU') + ' ' + (sym || '฿');
}

function fmtDate(d) {
  if (!d) return '—';
  return dayjs(d).format('DD.MM.YY');
}

function fmtDateLong(d) {
  if (!d) return '—';
  return dayjs(d).format('DD MMM YYYY');
}

function nightsCount(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  return dayjs(checkOut).diff(dayjs(checkIn), 'day');
}

  // Build timeline: 12 months back → 24 months forward = ~37 months
  function buildMonths() {
    const today = dayjs();
    const start = today.subtract(12, 'month').startOf('month');
    const end   = today.add(24, 'month').endOf('month');
    const months = [];
    let m = start;
    while (m.isBefore(end) || m.isSame(end, 'month')) {
      months.push(m);
      m = m.add(1, 'month');
    }
    return months;
  }

// Convert a date to X pixel offset within the timeline
function dateToPx(dateStr, months) {
  if (!dateStr) return 0;
  const d = dayjs(dateStr);
  const start = months[0];
  const end = months[months.length - 1].endOf('month');
  if (d.isBefore(start)) return 0;
  if (d.isAfter(end)) return months.length * MONTH_W;
  const totalDays = end.diff(start, 'day') + 1;
  const dayOffset = d.diff(start, 'day');
  return (dayOffset / totalDays) * months.length * MONTH_W;
}

// Обратная функция: X-пиксель → дата
function pxToDate(x, months) {
  if (!months || months.length === 0) return null;
  const start = months[0];
  const end = months[months.length - 1].endOf('month');
  const totalDays = end.diff(start, 'day') + 1;
  const totalW = months.length * MONTH_W;
  if (x < 0 || x > totalW) return null;
  const dayOffset = Math.min(Math.round((x / totalW) * totalDays), totalDays - 1);
  return start.add(dayOffset, 'day').format('YYYY-MM-DD');
}

// Total timeline width
function timelineWidth(months) {
  return months.length * MONTH_W;
}

// Assign colors to bookings (round-robin, grey for notMyCustomer)
function assignColors(bookings) {
  const map = {};
  let idx = 0;
  bookings.forEach(b => {
    if (b.notMyCustomer) {
      map[b.id] = '#BDBDBD';
    } else {
      map[b.id] = BOOKING_COLORS[idx % BOOKING_COLORS.length];
      idx++;
    }
  });
  return map;
}

// Filter properties based on selected filter
function filterProperties(properties, bookings, filter, userId) {
  if (filter === 'all') return properties;
  // 'mine' (admin) — объекты у которых есть хоть одно "моё" бронирование (не собственник)
  if (filter === 'mine') {
    const myProps = new Set(
      bookings.filter(b => !b.notMyCustomer).map(b => b.propertyId)
    );
    return properties.filter(p => myProps.has(p.id));
  }
  // 'company' (agent) — объекты компании с бронированиями клиентов агентства (не собственники)
  if (filter === 'company') {
    const companyProps = new Set(
      bookings.filter(b => !b.notMyCustomer).map(b => b.propertyId)
    );
    return properties.filter(p => companyProps.has(p.id));
  }
  // 'myBookings' (agent) — только объекты с бронированиями самого агента
  if (filter === 'myBookings') {
    const agentProps = new Set(
      bookings.filter(b => b.agentId === userId).map(b => b.propertyId)
    );
    return properties.filter(p => agentProps.has(p.id));
  }
  return properties;
}

// ─── Booking Status Badge ─────────────────────────────────────────────────────

function statusInfo(checkIn, checkOut, t) {
  const today = dayjs();
  const ci = dayjs(checkIn);
  const co = dayjs(checkOut);
  if (co.isBefore(today, 'day'))  return { label: t ? t('bookingStatusDone')     : 'Done',     color: C.muted,  bg: '#F0F0F0' };
  if (ci.isAfter(today, 'day'))   return { label: t ? t('bookingStatusUpcoming') : 'Upcoming',  color: C.blue,   bg: C.blueBg };
  return                                  { label: t ? t('bookingStatusActive')   : 'Active',   color: C.green,  bg: C.greenBg };
}

// ─── Booking Detail Panel ─────────────────────────────────────────────────────

function BookingDetail({ booking, property, contact, onEdit, onDelete, onClose, user }) {
  const { t } = useLanguage();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

// Guard: agent can edit/delete only bookings they personally created (agentId = own id)
const canEditBooking   = !user?.teamMembership || (booking?.agentId === user?.id && !!user?.teamPermissions?.can_book);
const canDeleteBooking = !user?.teamMembership || booking?.agentId === user?.id;

  if (!booking) return null;

  const psym = getCurrencySymbol(property?.currency || 'THB');
  const st = statusInfo(booking.checkIn, booking.checkOut, t);
  const nights = nightsCount(booking.checkIn, booking.checkOut);
  const tc = TYPE_COLOR[getEffectiveType(property)] || TYPE_COLOR.house;

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
        <View style={{ flex: 1 }}>
          <View style={[d.statusBadge, { backgroundColor: st.bg }]}>
            <Text style={[d.statusText, { color: st.color }]}>{st.label}</Text>
          </View>
          <Text style={d.propName} numberOfLines={1}>
            {property?.name || t('bookingProperty')}
          </Text>
          <View style={d.propMeta}>
            <View style={[d.typeDot, { backgroundColor: tc.border }]} />
            <Text style={[d.propCode, { color: tc.text }]}>
              {property?.code || ''}
              {property?.code_suffix ? ` (${property.code_suffix})` : ''}
            </Text>
            {property?.city ? <Text style={d.propCity}> · {property.city}</Text> : null}
          </View>
        </View>
        <View style={d.headerActions}>
          {canEditBooking && (
            <TouchableOpacity style={d.editBtn} onPress={onEdit}>
              <Text style={d.editBtnText}>{t('edit')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={d.closeBtn} onPress={onClose}>
            <Text style={d.closeBtnText}>✕</Text>
          </TouchableOpacity>
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
              ? (property?.owner_commission_one_time_is_percent
                  ? `${Number(booking.ownerCommissionOneTime).toLocaleString()}%`
                  : fmt(booking.ownerCommissionOneTime, psym))
              : null}
          />
          <InfoRow
            label={t('bookingOwnerCommMonthly')}
            value={booking.ownerCommissionMonthly != null
              ? (property?.owner_commission_monthly_is_percent
                  ? `${Number(booking.ownerCommissionMonthly).toLocaleString()}%`
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

        {/* Delete — только своё бронирование и при наличии разрешения */}
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

const d = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface, borderLeftWidth: 1, borderLeftColor: C.border },
  header: { flexDirection: 'row', alignItems: 'flex-start', padding: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  statusBadge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 6 },
  statusText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  propName: { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 4 },
  propMeta: { flexDirection: 'row', alignItems: 'center' },
  typeDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  propCode: { fontSize: 13, fontWeight: '700' },
  propCity: { fontSize: 13, color: C.muted },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 12 },
  editBtn: {
    backgroundColor: '#EAF4F5',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: '#B2D8DB',
  },
  editBtnText: { fontSize: 14, color: '#3D7D82', fontWeight: '700' },
  closeBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 18, color: C.muted },
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
  infoValue: { fontSize: 13, color: C.text, fontWeight: '500', textAlign: 'right', flex: 1 },
  datesRow: { flexDirection: 'row', alignItems: 'center' },
  dateBlock: { flex: 1 },
  dateLabel: { fontSize: 11, color: C.light, fontWeight: '700', letterSpacing: 0.5, marginBottom: 3 },
  dateValue: { fontSize: 14, color: C.text, fontWeight: '600' },
  dateTime: { fontSize: 12, color: C.muted, marginTop: 2 },
  dateSep: { alignItems: 'center', paddingHorizontal: 12 },
  dateSepLine: { fontSize: 16, color: C.light },
  dateSepNights: { fontSize: 11, color: C.muted, marginTop: 2 },
  ownerLabel: { fontSize: 14, color: C.muted, fontStyle: 'italic', paddingVertical: 4 },
  commentText: { fontSize: 13, color: C.text, lineHeight: 20 },
  photo: { width: 90, height: 90, borderRadius: 8, marginRight: 8 },
  deleteRow: { padding: 20, paddingBottom: 0 },
  deleteBtn: { borderWidth: 1, borderColor: '#FFCDD2', borderRadius: 8, padding: 12, alignItems: 'center' },
  deleteBtnText: { fontSize: 13, color: '#E53935', fontWeight: '600' },
});

// ─── Gantt Chart ──────────────────────────────────────────────────────────────


// ─── List View ────────────────────────────────────────────────────────────────

function ListView({ bookings, properties, contacts, colorMap, onSelectBooking, selectedBookingId }) {
  const { t } = useLanguage();
  const today = dayjs().format('YYYY-MM-DD');

  const upcoming = bookings.filter(b => b.checkIn > today).sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  const current  = bookings.filter(b => b.checkIn <= today && b.checkOut >= today).sort((a, b) => a.checkOut.localeCompare(b.checkOut));
  const past     = bookings.filter(b => b.checkOut < today).sort((a, b) => b.checkOut.localeCompare(a.checkOut));

  function Group({ title, color, items }) {
    if (!items.length) return null;
    return (
      <View style={lv.group}>
        <View style={[lv.groupHeader, { borderLeftColor: color }]}>
          <Text style={[lv.groupTitle, { color }]}>{title}</Text>
          <Text style={lv.groupCount}>{items.length}</Text>
        </View>
        {items.map(bk => {
          const prop = properties.find(p => p.id === bk.propertyId);
          const contact = contacts.find(c => c.id === bk.contactId);
          const tc = TYPE_COLOR[getEffectiveType(prop)] || TYPE_COLOR.house;
          const color = colorMap[bk.id] || '#90A4AE';
          const isSelected = bk.id === selectedBookingId;
          const nights = nightsCount(bk.checkIn, bk.checkOut);
          const fullCode = prop ? (prop.code + (prop.code_suffix ? ` (${prop.code_suffix})` : '')) : '—';
          const clientName = bk.notMyCustomer
            ? t('bookingNotMyClient')
            : (contact ? `${contact.name || ''} ${contact.lastName || ''}`.trim() || '—' : '—');

          return (
            <TouchableOpacity
              key={bk.id}
              style={[lv.row, isSelected && lv.rowSelected]}
              onPress={() => onSelectBooking(bk)}
              activeOpacity={0.75}
            >
              <View style={[lv.colorDot, { backgroundColor: color }]} />
              <View style={[lv.codeChip, { borderColor: tc.border, backgroundColor: tc.bg }]}>
                <Text style={[lv.codeText, { color: tc.text }]}>{fullCode}</Text>
              </View>
              <View style={lv.propInfo}>
                <Text style={lv.propName} numberOfLines={1}>{prop?.name || '—'}</Text>
                <Text style={lv.clientName} numberOfLines={1}>{clientName}</Text>
              </View>
              <View style={lv.dates}>
                <Text style={lv.dateIn}>{fmtDate(bk.checkIn)}</Text>
                <Text style={lv.dateArrow}>→</Text>
                <Text style={lv.dateOut}>{fmtDate(bk.checkOut)}</Text>
                <Text style={lv.nights}>{nights}{t('bookingNights')[0]}</Text>
              </View>
              <View style={lv.price}>
                {bk.totalPrice ? (
                  <Text style={lv.priceText}>{Number(bk.totalPrice).toLocaleString('ru-RU')} {getCurrencySymbol(prop?.currency || 'THB')}</Text>
                ) : (
                  <Text style={lv.priceEmpty}>—</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  return (
    <ScrollView style={lv.scroll} showsVerticalScrollIndicator={false}>
      <Group title={t('bookingStatusActive')}   color={C.green} items={current}  />
      <Group title={t('bookingStatusUpcoming')} color={C.blue}  items={upcoming} />
      <Group title={t('bookingStatusDone')}     color={C.muted} items={past}     />
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const lv = StyleSheet.create({
  scroll: { flex: 1 },
  group: { marginBottom: 4 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, borderLeftWidth: 3, backgroundColor: '#FAFBFC', borderBottomWidth: 1, borderBottomColor: C.border },
  groupTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  groupCount: { marginLeft: 8, fontSize: 12, color: C.muted, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.surface, gap: 10 },
  rowSelected: { backgroundColor: '#EAF4F5' },
  colorDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  codeChip: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, flexShrink: 0 },
  codeText: { fontSize: 11, fontWeight: '700' },
  propInfo: { flex: 1, minWidth: 0 },
  propName: { fontSize: 13, color: C.text, fontWeight: '600' },
  clientName: { fontSize: 12, color: C.muted, marginTop: 1 },
  dates: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  dateIn: { fontSize: 12, color: C.text, fontWeight: '500' },
  dateArrow: { fontSize: 11, color: C.light },
  dateOut: { fontSize: 12, color: C.text, fontWeight: '500' },
  nights: { fontSize: 11, color: C.muted, marginLeft: 4 },
  price: { minWidth: 90, alignItems: 'flex-end', flexShrink: 0 },
  priceText: { fontSize: 13, color: ACCENT, fontWeight: '700' },
  priceEmpty: { fontSize: 13, color: C.light },
});


// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function WebBookingsScreen({ user, refreshKey }) {
  const { t } = useLanguage();
  const [bookings, setBookings]     = useState([]);
  const [properties, setProperties] = useState([]);
  const [contacts, setContacts]     = useState([]);
  const [owners, setOwners]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [myCompanyName, setMyCompanyName] = useState('');
  const [viewMode, setViewMode]     = useState('gantt'); // 'gantt' | 'list'
  const [propFilter, setPropFilter] = useState('all');   // 'all' | 'mine'
  const [districtFilters, setDistrictFilters] = useState([]); // multi-select
  const [bedroomsFilters, setBedroomsFilters] = useState([]); // multi-select
  const [petsFilter, setPetsFilter]           = useState(false);
  const [longTermFilter, setLongTermFilter]   = useState(false);
  const [districtOpen, setDistrictOpen] = useState(false);
  const [bedroomsOpen, setBedroomsOpen] = useState(false);
  const districtLeaveTimer = useRef(null);
  const bedroomsLeaveTimer = useRef(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [editPanelMode, setEditPanelMode]     = useState(null); // null | 'create' | 'edit'
  const [createTemplate, setCreateTemplate]   = useState(null);
  const [propDetailProperty, setPropDetailProperty] = useState(null);
  const [search, setSearch]         = useState('');

  const months   = useMemo(() => buildMonths(), []);
  const totalW   = useMemo(() => timelineWidth(months), [months]);
  const colorMap = useMemo(() => assignColors(bookings), [bookings]);

  const canCreate = !user?.teamMembership || !!user?.teamPermissions?.can_book;

  const handleGanttCellPress = (prop, date) => {
    setCreateTemplate({ propertyId: prop.id, checkIn: date });
    setSelectedBooking(null);
    setEditPanelMode('create');
  };

  // Загружаем название компании для агента-участника напрямую из БД
  useEffect(() => {
    async function loadCompanyName() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data: membership } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', session.user.id)
        .eq('role', 'agent')
        .maybeSingle();
      if (!membership?.company_id) return;
      const { data: company } = await supabase
        .from('companies')
        .select('name')
        .eq('id', membership.company_id)
        .maybeSingle();
      if (company?.name) setMyCompanyName(company.name);
    }
    loadCompanyName();
  }, []);

  const ganttScrollRef = useRef(null); // single scroll container for gantt

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const agentId = user?.teamMembership ? user.id : null;
      const [bk, pr, co, ow] = await Promise.all([
        getBookings(null, null, agentId),
        getProperties(agentId),
        getContacts('clients'),
        getContacts('owners'),
      ]);
      setBookings(bk);
      // Build parent map for effective type resolution
      const parentMap = {};
      pr.forEach(p => { parentMap[p.id] = p; });
      // Only bookable units: standalone houses + all child units (houses in resorts, apartments in condos)
      // Child units can have type 'house', 'resort', or 'condo' in DB depending on parent type
      const bookable = pr
        .filter(p => p.resort_id || HOUSE_LIKE_TYPES.has(p.type))
        .map(p => {
          if (p.resort_id) {
            const parent = parentMap[p.resort_id];
            return { ...p, effectiveType: parent?.type || 'resort' };
          }
          return { ...p, effectiveType: 'house' };
        });
      setProperties(bookable);
      setContacts(co);
      setOwners(ow);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (refreshKey) load(); }, [refreshKey]);


  // Auto-scroll gantt so current month is the 2nd visible column
  useEffect(() => {
    if (!loading && viewMode === 'gantt') {
      const currentMonthX = dateToPx(dayjs().startOf('month').format('YYYY-MM-DD'), months);
      const offset = Math.max(0, currentMonthX - MONTH_W);
      setTimeout(() => {
        const node = ganttScrollRef.current;
        if (node) node.scrollLeft = offset;
      }, 150);
    }
  }, [loading, viewMode]);

  const selectedProperty = selectedBooking
    ? properties.find(p => p.id === selectedBooking.propertyId)
    : null;
  const selectedContact = selectedBooking
    ? contacts.find(c => c.id === selectedBooking.contactId)
    : null;

  // Уникальные районы из загруженных объектов
  const uniqueDistricts = useMemo(() =>
    [...new Set(properties.map(p => p.district).filter(Boolean))].sort(),
  [properties]);

  // Filter + search properties
  const visibleProps = useMemo(() => {
    let result = filterProperties(properties, bookings, propFilter, user?.id);
    if (districtFilters.length > 0) result = result.filter(p => districtFilters.includes(p.district));
    if (bedroomsFilters.length > 0) result = result.filter(p => bedroomsFilters.includes(p.bedrooms));
    if (petsFilter)     result = result.filter(p => p.pets_allowed);
    if (longTermFilter) result = result.filter(p => p.long_term_booking);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(p =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.code || '').toLowerCase().includes(q) ||
        (p.district || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [properties, bookings, propFilter, districtFilters, bedroomsFilters, petsFilter, longTermFilter, search]);

  const visibleBookings = useMemo(() => {
    if (viewMode !== 'list') return bookings;
    let result = bookings;
    if (propFilter === 'mine') result = result.filter(b => !b.notMyCustomer);
    if (propFilter === 'company') result = result.filter(b => !b.notMyCustomer);
    if (propFilter === 'myBookings') result = result.filter(b => b.agentId === user?.id);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(b => {
        const prop = properties.find(p => p.id === b.propertyId);
        const contact = contacts.find(c => c.id === b.contactId);
        return (prop?.name || '').toLowerCase().includes(q) ||
          (prop?.code || '').toLowerCase().includes(q) ||
          (contact?.name || '').toLowerCase().includes(q) ||
          (contact?.lastName || '').toLowerCase().includes(q);
      });
    }
    return result;
  }, [bookings, properties, contacts, viewMode, search, propFilter]);

  const showDetail = !!selectedBooking;

  if (loading) {
    return (
      <View style={s.loadingWrap}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={s.loadingText}>{t('loading')}</Text>
      </View>
    );
  }

  return (
    <View style={s.root}>
      {/* ── Toolbar ── */}
      <View style={s.toolbar}>
        {/* Row 1: Title + Search + Add */}
        <View style={s.toolbarRow1}>
          <Text style={s.toolbarTitle}>{t('bookingsTitle')}</Text>
          <View style={s.searchWrap}>
            <Text style={s.searchIcon}>🔍</Text>
            <TextInput
              style={s.searchInput}
              placeholder={t('search') + '…'}
              placeholderTextColor={C.light}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} style={s.searchClear} activeOpacity={0.7}>
                <Text style={s.searchClearText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
          {(!user?.teamMembership || user?.teamPermissions?.can_book) && (
            <TouchableOpacity style={s.addBtn} onPress={() => { setCreateTemplate(null); setSelectedBooking(null); setEditPanelMode('create'); }}>
              <Text style={s.addBtnText}>+ {t('bookingsAddBtn')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Row 2: Filters + View toggle */}
        <View style={s.toolbarRow2}>
          {/* Left: content filters */}
          <View style={s.filterGroup}>
            {/* Segment: разные табы для агента и для админа */}
            <View style={s.segmentWrap}>
              {(user?.teamMembership ? [
                { key: 'all',        label: t('all') },
                { key: 'company',    label: t('bookingsFilterCompany') },
                { key: 'myBookings', label: t('bookingsFilterMine') },
              ] : [
                { key: 'all',  label: t('all') },
                { key: 'mine', label: t('dashboardMyClients') },
              ]).map(f => (
                <TouchableOpacity
                  key={f.key}
                  style={[s.segmentBtn, propFilter === f.key && s.segmentBtnActive]}
                  onPress={() => setPropFilter(f.key)}
                >
                  <Text style={[s.segmentBtnText, propFilter === f.key && s.segmentBtnTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Dropdown: Район (мультивыбор) */}
            <View
              style={s.dropdownWrap}
              onMouseEnter={() => { if (districtLeaveTimer.current) clearTimeout(districtLeaveTimer.current); }}
              onMouseLeave={() => { districtLeaveTimer.current = setTimeout(() => setDistrictOpen(false), 300); }}
            >
              <TouchableOpacity
                style={[s.dropdownBtn, districtFilters.length > 0 && s.dropdownBtnActive]}
                onPress={() => { setDistrictOpen(o => !o); setBedroomsOpen(false); }}
              >
                <Text style={[s.dropdownBtnText, districtFilters.length > 0 && s.dropdownBtnTextActive]}>
                  {districtFilters.length > 0 ? `${t('filterDistrict')} (${districtFilters.length})` : t('filterDistrict')} ▾
                </Text>
              </TouchableOpacity>
              {districtOpen && (
                <View style={s.dropdownList}>
                  {uniqueDistricts.map(d => {
                    const selected = districtFilters.includes(d);
                    return (
                      <TouchableOpacity
                        key={d} style={s.dropdownItem}
                        onPress={() => setDistrictFilters(prev =>
                          selected ? prev.filter(x => x !== d) : [...prev, d]
                        )}
                      >
                        <View style={s.dropdownItemRow}>
                          <View style={[s.dropdownCheckbox, selected && s.dropdownCheckboxChecked]}>
                            {selected && <Text style={s.dropdownCheckmark}>✓</Text>}
                          </View>
                          <Text style={[s.dropdownItemText, selected && s.dropdownItemTextActive]}>{d}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                  {uniqueDistricts.length === 0 && (
                    <Text style={s.dropdownEmpty}>{t('noData')}</Text>
                  )}
                </View>
              )}
            </View>

            {/* Dropdown: Спальни (мультивыбор) */}
            <View
              style={s.dropdownWrap}
              onMouseEnter={() => { if (bedroomsLeaveTimer.current) clearTimeout(bedroomsLeaveTimer.current); }}
              onMouseLeave={() => { bedroomsLeaveTimer.current = setTimeout(() => setBedroomsOpen(false), 300); }}
            >
              <TouchableOpacity
                style={[s.dropdownBtn, bedroomsFilters.length > 0 && s.dropdownBtnActive]}
                onPress={() => { setBedroomsOpen(o => !o); setDistrictOpen(false); }}
              >
                <Text style={[s.dropdownBtnText, bedroomsFilters.length > 0 && s.dropdownBtnTextActive]}>
                  {bedroomsFilters.length > 0 ? `${t('filterBedrooms')} (${bedroomsFilters.length})` : t('filterBedrooms')} ▾
                </Text>
              </TouchableOpacity>
              {bedroomsOpen && (
                <View style={s.dropdownList}>
                  {[1,2,3,4,5,6].map(n => {
                    const selected = bedroomsFilters.includes(n);
                    const label = `${n} ${t('filterBedrooms').toLowerCase()}`;
                    return (
                      <TouchableOpacity
                        key={n} style={s.dropdownItem}
                        onPress={() => setBedroomsFilters(prev =>
                          selected ? prev.filter(x => x !== n) : [...prev, n]
                        )}
                      >
                        <View style={s.dropdownItemRow}>
                          <View style={[s.dropdownCheckbox, selected && s.dropdownCheckboxChecked]}>
                            {selected && <Text style={s.dropdownCheckmark}>✓</Text>}
                          </View>
                          <Text style={[s.dropdownItemText, selected && s.dropdownItemTextActive]}>{label}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Разделитель */}
            <View style={s.filterDivider} />

            {/* Чекбокс: С питомцами */}
            <TouchableOpacity style={s.checkRow} onPress={() => setPetsFilter(v => !v)} activeOpacity={0.7}>
              <View style={[s.checkbox, petsFilter && s.checkboxChecked]}>
                {petsFilter && <Text style={s.checkmark}>✓</Text>}
              </View>
              <Text style={[s.checkLabel, petsFilter && s.checkLabelActive]}>🐾 {t('filterPets')}</Text>
            </TouchableOpacity>

            {/* Чекбокс: Дальние даты */}
            <TouchableOpacity style={s.checkRow} onPress={() => setLongTermFilter(v => !v)} activeOpacity={0.7}>
              <View style={[s.checkbox, longTermFilter && s.checkboxChecked]}>
                {longTermFilter && <Text style={s.checkmark}>✓</Text>}
              </View>
              <Text style={[s.checkLabel, longTermFilter && s.checkLabelActive]}>📅 {t('filterLongTerm')}</Text>
            </TouchableOpacity>

            {/* Кнопка сброса всех фильтров */}
            {(districtFilters.length > 0 || bedroomsFilters.length > 0 || petsFilter || longTermFilter || propFilter !== 'all') && (
              <TouchableOpacity
                style={s.resetBtn}
                onPress={() => {
                  setDistrictFilters([]);
                  setBedroomsFilters([]);
                  setPetsFilter(false);
                  setLongTermFilter(false);
                  setPropFilter('all');
                }}
                activeOpacity={0.7}
              >
                <Text style={s.resetBtnText}>✕ {t('filter')}</Text>
              </TouchableOpacity>
            )}
          </View>

        </View>
      </View>

      {/* ── Body ── */}
      <View style={s.body}>
        {/* Left + Gantt / List */}
        <View style={[s.mainArea, showDetail && s.mainAreaWithDetail]}>
          {viewMode === 'gantt' ? (
            <>
              {/* Gantt: single overflow:auto container — CSS sticky works for both axes */}
              <View style={s.ganttOuter}>
                <View ref={ganttScrollRef} style={s.ganttScroll}>
                  <View style={{ minWidth: LEFT_W + totalW }}>
                    {/* Sticky header row */}
                    <View style={[s.ganttHeaderRow, { position: 'sticky', top: 0, zIndex: 10 }]}>
                      {/* Corner cell — sticky left + top */}
                      <View style={[s.ganttLeftHeader, { position: 'sticky', left: 0, zIndex: 11 }]} />
                      {months.map((m, i) => {
                        const today = dayjs();
                        const isCurrent = m.isSame(today, 'month');
                        const isPast = m.isBefore(today, 'month');
                        return (
                          <View key={i} style={[s.monthCell, isCurrent && s.monthCellCurrent, isPast && s.monthCellPast]}>
                            <Text style={[s.monthName, isCurrent && s.monthNameCurrent]}>{m.format('MMM')}</Text>
                            <Text style={[s.yearName, isCurrent && { color: '#E53935' }]}>{m.format('YY')}</Text>
                          </View>
                        );
                      })}
                    </View>

                    {/* Property rows */}
                    {visibleProps.map((prop, pi) => {
                      const tc = TYPE_COLOR[getEffectiveType(prop)] || TYPE_COLOR.house;
                      const fullCode = prop.code + (prop.code_suffix ? ` (${prop.code_suffix})` : '');
                      const propBookings = bookings.filter(b => b.propertyId === prop.id);
                      // Contract flags (company-first)
                      const isAgent              = !!user?.teamMembership;
                      const isResponsibleProperty = isAgent && prop.responsible_agent_id === user?.id;
                      const todayX = dateToPx(dayjs().format('YYYY-MM-DD'), months);
                      return (
                        <View key={prop.id} style={s.ganttRowWrap}>
                          {/* Sticky left cell — clickable to open/close property detail */}
                          <TouchableOpacity
                            style={[s.ganttLeftCell, s.ganttLeftCellBtn, { position: 'sticky', left: 0, zIndex: 2, borderLeftColor: tc.border }, pi % 2 === 1 && s.ganttLeftCellAlt, propDetailProperty?.id === prop.id && s.ganttLeftCellSelected]}
                            onPress={() => setPropDetailProperty(prop)}
                            activeOpacity={0.7}
                          >
                            <Text style={[s.ganttCode, { color: tc.text }]} numberOfLines={1}>{fullCode}</Text>
                            <Text style={s.ganttPropName} numberOfLines={1}>{prop.name}</Text>
                          </TouchableOpacity>

                          {/* Timeline */}
                          <Pressable
                            style={[s.ganttRow, { width: totalW }]}
                            onPress={canCreate ? (e) => {
                              const x = e.nativeEvent.locationX;
                              const date = pxToDate(x, months);
                              if (date) handleGanttCellPress(prop, date);
                            } : undefined}
                          >
                            {/* Month background bands */}
                            {months.map((m, mi) => {
                              const now = dayjs();
                              const isMPast = m.isBefore(now, 'month');
                              const isMCurrent = m.isSame(now, 'month');
                              return (
                                <View
                                  key={mi}
                                  pointerEvents="none"
                                  style={[
                                    s.monthBand,
                                    { left: mi * MONTH_W },
                                    isMPast && s.monthBandPast,
                                    isMCurrent && s.monthBandCurrent,
                                  ]}
                                >
                                  {[0.25, 0.5, 0.75].map(frac => (
                                    <View key={frac} style={[s.weekDivider, { left: MONTH_W * frac }]} />
                                  ))}
                                </View>
                              );
                            })}
                            <View style={[s.todayLine, { left: todayX }]} />
                            {propBookings.map(bk => {
                              const x1 = dateToPx(bk.checkIn, months);
                              const x2 = dateToPx(bk.checkOut, months);
                              const w  = Math.max(x2 - x1, 6);
                              const color = colorMap[bk.id] || '#90A4AE';
                              const isSelected = bk.id === selectedBooking?.id;
                              const contact = contacts.find(c => c.id === bk.contactId);
                              const companyName = myCompanyName || user?.companyInfo?.name || user?.teamMembership?.companyName || '';

                              // Per-booking contract flags
                              const isOwnBooking   = bk.agentId === user?.id;
                              const isAdminBooking = isAgent && isResponsibleProperty && !isOwnBooking;
                              const canOpenBooking = !isAgent || (isResponsibleProperty && isOwnBooking);

                              // Label: Владелец > компания (чужая бронь) > клиент
                              const label = bk.notMyCustomer
                                ? (t('bookingOwnerLabel') || 'Владелец')
                                : isAdminBooking
                                  ? companyName
                                  : (contact ? `${contact.name || ''} ${contact.lastName || ''}`.trim() : '');

                              return (
                                <View key={bk.id} onClick={e => e.stopPropagation()}>
                                  <TouchableOpacity
                                    style={[s.bar, { left: x1, width: w, backgroundColor: color }, isSelected && s.barSelected, isAdminBooking && s.barCompany]}
                                    onPress={() => { if (canOpenBooking) setSelectedBooking(bk); }}
                                    activeOpacity={canOpenBooking ? 0.8 : 1}
                                  >
                                    {w >= 50 && <Text style={s.barDateL} numberOfLines={1}>{dayjs(bk.checkIn).format('DD.MM')}</Text>}
                                    {w >= 110 && <Text style={s.barLabel} numberOfLines={1}>{label}</Text>}
                                    {w >= 50 && <Text style={s.barDateR} numberOfLines={1}>{dayjs(bk.checkOut).format('DD.MM')}</Text>}
                                  </TouchableOpacity>
                                </View>
                              );
                            })}
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </View>
            </>
          ) : (
            <ListView
              bookings={visibleBookings}
              properties={properties}
              contacts={contacts}
              colorMap={colorMap}
              onSelectBooking={setSelectedBooking}
              selectedBookingId={selectedBooking?.id}
            />
          )}
        </View>

        {/* Detail panel */}
        {showDetail && (
          <View style={s.detailPanel}>
            <BookingDetail
              booking={selectedBooking}
              property={selectedProperty}
              contact={selectedContact}
              onEdit={() => setEditPanelMode('edit')}
              onDelete={() => { setSelectedBooking(null); load(); }}
              onClose={() => setSelectedBooking(null)}
              user={user}
            />
          </View>
        )}
      </View>

      {/* Property detail panel — slides from RIGHT */}
      <WebPropertyDetailPanel
        visible={propDetailProperty !== null}
        property={propDetailProperty}
        bookings={bookings}
        owners={owners}
        onClose={() => setPropDetailProperty(null)}
        user={user}
      />

      {/* Edit panel */}
      <WebBookingEditPanel
        visible={editPanelMode !== null}
        mode={editPanelMode || 'create'}
        booking={editPanelMode === 'edit' ? selectedBooking : createTemplate}
        properties={
          user?.teamMembership
            ? properties.filter(p => p.responsible_agent_id === user.id)
            : properties
        }
        contacts={contacts}
        onClose={() => setEditPanelMode(null)}
        onSaved={(saved) => {
          setEditPanelMode(null);
          load();
          if (saved) setSelectedBooking(saved);
        }}
        user={user}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, flexDirection: 'column' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { fontSize: 15, color: C.muted },

  // Toolbar
  toolbar: {
    flexDirection: 'column',
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
    gap: 10, zIndex: 100,
  },
  toolbarRow1: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  toolbarRow2: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  toolbarTitle: { fontSize: 20, fontWeight: '800', color: C.text, marginRight: 4 },

  // Search
  searchWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.bg, borderRadius: 10, borderWidth: 1.5, borderColor: C.border,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  searchIcon: { fontSize: 14, opacity: 0.5 },
  searchInput: { flex: 1, fontSize: 14, color: C.text, outlineStyle: 'none', padding: 0 },
  searchClear: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: C.light, alignItems: 'center', justifyContent: 'center',
  },
  searchClearText: { color: '#FFF', fontSize: 10, fontWeight: '700', lineHeight: 12 },

  // Add button
  addBtn: {
    backgroundColor: '#EAF4F5',
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexShrink: 0,
    borderWidth: 1.5,
    borderColor: '#B2D8DB',
  },
  addBtnText: { fontSize: 14, color: '#3D7D82', fontWeight: '700' },

  // Filter group (row 2 left)
  filterGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  // Segment control (Все / Только мои)
  segmentWrap: {
    flexDirection: 'row',
    backgroundColor: C.bg, borderRadius: 8, borderWidth: 1, borderColor: C.border,
    overflow: 'hidden',
  },
  segmentBtn: { paddingHorizontal: 14, paddingVertical: 6 },
  segmentBtnActive: { backgroundColor: ACCENT },
  segmentBtnText: { fontSize: 12, color: C.muted, fontWeight: '600' },
  segmentBtnTextActive: { color: '#FFF', fontWeight: '700' },

  // Dropdown filters
  dropdownWrap: { position: 'relative', zIndex: 50 },
  dropdownBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.bg,
  },
  dropdownBtnActive: { borderColor: ACCENT, backgroundColor: C.accentBg },
  dropdownBtnText: { fontSize: 12, color: C.muted, fontWeight: '600' },
  dropdownBtnTextActive: { color: ACCENT, fontWeight: '700' },
  dropdownList: {
    position: 'absolute', top: 36, left: 0, zIndex: 999,
    backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border,
    minWidth: 180, maxHeight: 320, overflow: 'scroll',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15, shadowRadius: 16, elevation: 12,
  },
  dropdownItem: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  dropdownItemRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dropdownCheckbox: {
    width: 18, height: 18, borderRadius: 4,
    borderWidth: 1.5, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.surface,
  },
  dropdownCheckboxChecked: { backgroundColor: ACCENT, borderColor: ACCENT },
  dropdownCheckmark: { color: '#FFF', fontSize: 11, fontWeight: '700', lineHeight: 13 },
  dropdownItemText: { fontSize: 13, color: C.text },
  dropdownItemTextActive: { color: ACCENT, fontWeight: '600' },
  dropdownEmpty: { padding: 14, fontSize: 13, color: C.muted, textAlign: 'center' },

  // Filter divider
  filterDivider: { width: 1, height: 20, backgroundColor: C.border, marginHorizontal: 4 },

  // Checkboxes
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, cursor: 'pointer' },
  checkbox: {
    width: 18, height: 18, borderRadius: 4,
    borderWidth: 1.5, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.surface,
  },
  checkboxChecked: { backgroundColor: ACCENT, borderColor: ACCENT },
  checkmark: { color: '#FFF', fontSize: 11, fontWeight: '700', lineHeight: 13 },
  checkLabel: { fontSize: 12, color: C.muted, fontWeight: '500' },
  checkLabelActive: { color: ACCENT, fontWeight: '700' },
  resetBtn: {
    marginLeft: 4,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: ACCENT,
    backgroundColor: C.accentBg,
  },
  resetBtnText: { fontSize: 12, color: ACCENT, fontWeight: '700' },

  // View toggle (row 2 right)
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: C.bg, borderRadius: 8, borderWidth: 1, borderColor: C.border,
    overflow: 'hidden',
  },
  viewBtn: { paddingHorizontal: 14, paddingVertical: 6 },
  viewBtnActive: { backgroundColor: ACCENT },
  viewBtnText: { fontSize: 12, color: C.muted, fontWeight: '600' },
  viewBtnTextActive: { color: '#FFF', fontWeight: '700' },

  // Body
  body: { flex: 1, flexDirection: 'row' },
  mainArea: { flex: 1, overflow: 'hidden' },
  mainAreaWithDetail: { flex: 1 },
  detailPanel: { width: 360, borderLeftWidth: 1, borderLeftColor: C.border },

  // Gantt
  ganttOuter: { flex: 1, overflow: 'hidden' },
  ganttScroll: { flex: 1, overflow: 'auto' },
  ganttHeaderRow: {
    flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: C.border,
    backgroundColor: C.surface,
  },
  ganttLeftHeader: {
    width: LEFT_W, flexShrink: 0,
    borderRightWidth: 1, borderRightColor: C.border,
    backgroundColor: C.surface,
  },
  monthCell: { width: MONTH_W, flexShrink: 0, alignItems: 'center', paddingVertical: 8, borderRightWidth: 1, borderRightColor: C.border, backgroundColor: '#FAFAFA' },
  monthCellCurrent: { backgroundColor: '#E8F5E9' },
  monthCellPast: { backgroundColor: '#F5F3EF' },
  monthName: { fontSize: 12, fontWeight: '600', color: C.text, textTransform: 'capitalize' },
  monthNameCurrent: { color: C.green, fontWeight: '800' },
  yearName: { fontSize: 10, color: C.muted, marginTop: 1 },
  // Row wrapper (left cell + timeline side by side)
  ganttRowWrap: { flexDirection: 'row', height: ROW_H, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.18)', backgroundColor: C.surface },
  ganttLeftCell: {
    width: LEFT_W, flexShrink: 0, height: ROW_H,
    justifyContent: 'center', paddingHorizontal: 10,
    borderLeftWidth: 3, borderRightWidth: 1, borderRightColor: C.border,
    backgroundColor: C.surface,
  },
  ganttLeftCellAlt: { backgroundColor: '#F5F3EF' },
  ganttLeftCellBtn: { cursor: 'pointer' },
  ganttLeftCellSelected: { backgroundColor: '#FCE4EC' },
  ganttCode: { fontSize: 12, fontWeight: '700' },
  ganttPropName: { fontSize: 10, color: C.muted, marginTop: 1 },
  ganttRow: { height: ROW_H, position: 'relative' },
  monthBand: {
    position: 'absolute', top: 0, bottom: 1, width: MONTH_W,
    borderRightWidth: 1, borderRightColor: 'rgba(0,0,0,0.1)',
  },
  monthBandPast:    { backgroundColor: '#EDE9E3' },
  monthBandCurrent: { backgroundColor: 'rgba(212,237,218,0.55)' },
  weekDivider: {
    position: 'absolute', top: 0, bottom: 0,
    width: 1, backgroundColor: 'rgba(0,0,0,0.045)',
  },
  todayLine: { position: 'absolute', top: 0, bottom: 0, width: 1.5, backgroundColor: '#E53935', zIndex: 1, opacity: 0.55 },
  bar: {
    position: 'absolute', top: 6, height: ROW_H - 12,
    borderRadius: 18, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, overflow: 'hidden',
  },
  barSelected: { borderWidth: 2, borderColor: 'rgba(0,0,0,0.4)' },
  barCompany: { opacity: 0.75 },
  barDateL: { fontSize: 11, color: 'rgba(0,0,0,0.7)', fontWeight: '500' },
  barLabel: { flex: 1, fontSize: 12, color: 'rgba(0,0,0,0.8)', fontWeight: '500', textAlign: 'center', marginHorizontal: 4 },
  barDateR: { fontSize: 11, color: 'rgba(0,0,0,0.7)', fontWeight: '500' },
});
