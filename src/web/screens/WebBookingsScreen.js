import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Image, TextInput, Pressable, Platform,
} from 'react-native';
import dayjs from 'dayjs';
import { useLanguage } from '../../context/LanguageContext';
import { getCurrencySymbol } from '../../utils/currency';
import { getPropertyTypeColors } from '../constants/propertyTypeColors';

import { getBookings, deleteBooking } from '../../services/bookingsService';
import { getProperties } from '../../services/propertiesService';
import { getContacts } from '../../services/contactsService';
import { getActiveTeamMembers } from '../../services/companyService';
import { supabase } from '../../services/supabase';
import WebBookingEditPanel from '../components/WebBookingEditPanel';
import WebPropertyDetailPanel from '../components/WebPropertyDetailPanel';
import { buildConfirmationHTML } from '../../services/bookingConfirmationService';

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
// TD-095: список удобств для фильтра — синхронизирован с FilterBottomSheet (мобильный) и CURSOR_RULES 2.7.
const FILTER_AMENITY_KEYS = ['swimming_pool', 'gym', 'parking', 'washing_machine'];

const BOOKING_COLORS = [
  '#4FC3F7','#81C784','#FFB74D','#BA68C8',
  '#F06292','#4DD0E1','#AED581','#FFD54F',
  '#FF8A65','#A5D6A7','#80DEEA','#CE93D8',
  '#FFCC02','#80CBC4','#EF9A9A','#90A4AE',
];


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

  // Build timeline: 36 months back → 36 months forward (~6 лет вокруг сегодня).
  // TD-097: расширили окно, чтобы пикер года мог скроллить по диапазону.
  function buildMonths() {
    const today = dayjs();
    const start = today.subtract(36, 'month').startOf('month');
    const end   = today.add(36, 'month').endOf('month');
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
      bookings.filter(b => b.responsibleAgentId === userId).map(b => b.propertyId)
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

export function BookingDetail({ booking, property, contact, onEdit, onDelete, onClose, onPrint, user, teamMembers = [] }) {
  const { t } = useLanguage();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

// Guard: agent can edit/delete only bookings they are responsible for
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
        {/* Top row: actions on the left, close on the right */}
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

        {/* Identity zone */}
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
  propCity: { fontSize: 13, color: C.muted },
  headerActions: { display: 'none' },
  editBtn: {
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: ACCENT,
  },
  editBtnText: { fontSize: 13, color: '#FFFFFF', fontWeight: '600' },
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

// ─── Gantt Chart ──────────────────────────────────────────────────────────────


// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function WebBookingsScreen({ user, refreshKey }) {
  const { t } = useLanguage();
  const [bookings, setBookings]     = useState([]);
  const [properties, setProperties] = useState([]);
  const [contacts, setContacts]     = useState([]);
  const [owners, setOwners]         = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [myCompanyName, setMyCompanyName] = useState('');
  const [propFilter, setPropFilter] = useState('all');   // 'all' | 'mine'
  const [cityFilters, setCityFilters] = useState([]); // TD-092: multi-select
  const [typeFilters, setTypeFilters] = useState([]); // TD-093: multi-select 'house' | 'resort' | 'condo'
  const [districtFilters, setDistrictFilters] = useState([]); // multi-select
  const [bedroomsFilters, setBedroomsFilters] = useState([]); // multi-select
  const [priceMin, setPriceMin]   = useState(''); // TD-094
  const [priceMax, setPriceMax]   = useState(''); // TD-094
  const [amenityFilters, setAmenityFilters] = useState([]); // TD-095
  const [petsFilter, setPetsFilter]           = useState(false);
  const [longTermFilter, setLongTermFilter]   = useState(false);
  const [responsibleFilter, setResponsibleFilter] = useState('all'); // 'all' | 'none' | <agentUserId>
  const [cityOpen, setCityOpen]         = useState(false);
  const [typeOpen, setTypeOpen]         = useState(false);
  const [districtOpen, setDistrictOpen] = useState(false);
  const [bedroomsOpen, setBedroomsOpen] = useState(false);
  const [amenityOpen, setAmenityOpen]   = useState(false);
  const [yearOpen, setYearOpen]         = useState(false); // TD-097
  const [responsibleOpen, setResponsibleOpen] = useState(false);
  const cityLeaveTimer     = useRef(null);
  const typeLeaveTimer     = useRef(null);
  const districtLeaveTimer = useRef(null);
  const bedroomsLeaveTimer = useRef(null);
  const amenityLeaveTimer  = useRef(null);
  const yearLeaveTimer     = useRef(null);
  const responsibleLeaveTimer = useRef(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [editPanelMode, setEditPanelMode]     = useState(null); // null | 'create' | 'edit'
  const [createTemplate, setCreateTemplate]   = useState(null);
  const [propDetailProperty, setPropDetailProperty] = useState(null);
  const [search, setSearch]         = useState('');

  const months   = useMemo(() => buildMonths(), []);
  const totalW   = useMemo(() => timelineWidth(months), [months]);
  // TD-097: список годов для пикера — на основе диапазона months.
  const yearOptions = useMemo(() => {
    const set = new Set(months.map(m => m.year()));
    return [...set].sort((a, b) => a - b);
  }, [months]);
  const handleYearJump = (year) => {
    const targetX = dateToPx(`${year}-01-01`, months);
    const node = ganttScrollRef.current;
    if (node) node.scrollLeft = Math.max(0, targetX);
    setYearOpen(false);
  };
  // Общий helper: закрывает все dropdown'ы кроме указанного. Предотвращает
  // ситуацию когда два списка открыты одновременно.
  const closeOtherDropdowns = (except) => {
    if (except !== 'city')        setCityOpen(false);
    if (except !== 'type')        setTypeOpen(false);
    if (except !== 'district')    setDistrictOpen(false);
    if (except !== 'bedrooms')    setBedroomsOpen(false);
    if (except !== 'amenity')     setAmenityOpen(false);
    if (except !== 'year')        setYearOpen(false);
    if (except !== 'responsible') setResponsibleOpen(false);
  };
  const colorMap = useMemo(() => assignColors(bookings), [bookings]);

  const canCreate = !user?.teamMembership || !!user?.teamPermissions?.can_manage_bookings;

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
      const [bk, pr, allContacts] = await Promise.all([
        getBookings(null, null, agentId),
        getProperties(agentId),
        getContacts(),
      ]);
      // owners — подмножество для фильтра ответственных и для panel'а правки
      const ow = allContacts.filter(c => c.type === 'owners');
      const co = allContacts;
      setBookings(bk);
      // Build parent map for effective type resolution
      const parentMap = {};
      pr.forEach(p => { parentMap[p.id] = p; });
      // Only bookable units: standalone houses + all child units (houses in resorts, apartments in condos)
      // Child units can have type 'house', 'resort', or 'condo' in DB depending on parent type
      const bookable = pr
        .filter(p => p.parent_id || HOUSE_LIKE_TYPES.has(p.type))
        .map(p => {
          if (p.parent_id) {
            const parent = parentMap[p.parent_id];
            return { ...p, effectiveType: parent?.type || 'resort' };
          }
          return { ...p, effectiveType: 'house' };
        });
      setProperties(bookable);
      setContacts(co);
      setOwners(ow);

      // Team members — needed by the booking-detail panel to show the
      // responsible-agent name. Only admin actually sees that section, so
      // skip the network call for team members altogether.
      if (!user?.teamMembership && user?.companyId) {
        try {
          const tm = await getActiveTeamMembers(user.companyId);
          setTeamMembers(Array.isArray(tm) ? tm : []);
        } catch { setTeamMembers([]); }
      } else {
        setTeamMembers([]);
      }
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
    if (!loading) {
      const currentMonthX = dateToPx(dayjs().startOf('month').format('YYYY-MM-DD'), months);
      const offset = Math.max(0, currentMonthX - MONTH_W);
      setTimeout(() => {
        const node = ganttScrollRef.current;
        if (node) node.scrollLeft = offset;
      }, 150);
    }
  }, [loading]);

  const selectedProperty = selectedBooking
    ? properties.find(p => p.id === selectedBooking.propertyId)
    : null;
  const selectedContact = selectedBooking
    ? contacts.find(c => c.id === selectedBooking.contactId)
    : null;

  const handlePrintConfirmation = (booking) => {
    try {
      const property = properties.find(p => p.id === booking.propertyId);
      const contact = contacts.find(c => c.id === booking.contactId);
      const allBookings = bookings.filter(b => b.propertyId === booking.propertyId);
      const idx = allBookings
        .sort((a, b) => new Date(a.createdAt || a.checkIn) - new Date(b.createdAt || b.checkIn))
        .findIndex(b => b.id === booking.id);
      const year = new Date(booking.checkIn).getFullYear();
      const confirmationNumber = `${idx >= 0 ? idx + 1 : 1}/${String(year % 100).padStart(2, '0')}`;
      const html = buildConfirmationHTML({
        booking,
        property: property || {},
        contact: contact || {},
        profile: user || {},
        confirmationNumber,
        language: t('lang') || 'en',
      });
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 500);
      }
    } catch (e) {
      alert(e.message || 'Error generating confirmation');
    }
  };

  // Уникальные города и районы из загруженных объектов
  const uniqueCities = useMemo(() =>
    [...new Set(properties.map(p => p.city).filter(Boolean))].sort(),
  [properties]);
  const uniqueDistricts = useMemo(() =>
    [...new Set(properties.map(p => p.district).filter(Boolean))].sort(),
  [properties]);

  // Активные агенты команды у которых есть хотя бы один назначенный дом
  const responsibleAgents = useMemo(() => {
    const agentIdsWithProps = new Set(
      properties.map(p => p.responsible_agent_id).filter(Boolean)
    );
    return (teamMembers || [])
      .filter(m => agentIdsWithProps.has(m.user_id ?? m.id))
      .map(m => ({
        id: m.user_id ?? m.id,
        name: ([m.name, m.last_name || m.lastName].filter(Boolean).join(' ') || m.email || '—'),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [properties, teamMembers]);

  const hasUnassignedProperty = useMemo(
    () => properties.some(p => !p.responsible_agent_id),
    [properties]
  );

  // Filter + search properties
  const visibleProps = useMemo(() => {
    let result = filterProperties(properties, bookings, propFilter, user?.id);
    if (cityFilters.length > 0)     result = result.filter(p => cityFilters.includes(p.city));
    if (typeFilters.length > 0)     result = result.filter(p => typeFilters.includes(p.effectiveType || p.type));
    if (districtFilters.length > 0) result = result.filter(p => districtFilters.includes(p.district));
    if (bedroomsFilters.length > 0) result = result.filter(p => bedroomsFilters.includes(p.bedrooms));
    // TD-094: фильтр по цене price_monthly. Если поле null/0 — объект не пройдёт фильтр.
    const minNum = parseFloat(priceMin);
    const maxNum = parseFloat(priceMax);
    if (Number.isFinite(minNum)) result = result.filter(p => Number(p.price_monthly) >= minNum);
    if (Number.isFinite(maxNum)) result = result.filter(p => Number(p.price_monthly) <= maxNum);
    // TD-095: удобства хранятся как объект { swimming_pool: true, gym: false, ... }.
    // Объект пройдёт фильтр только если у него все выбранные удобства === true.
    if (amenityFilters.length > 0) {
      result = result.filter(p => {
        const am = p.amenities || {};
        return amenityFilters.every(a => am[a]);
      });
    }
    if (petsFilter)     result = result.filter(p => p.pets_allowed);
    if (longTermFilter) result = result.filter(p => p.long_term_booking);
    if (responsibleFilter === 'none') {
      result = result.filter(p => !p.responsible_agent_id);
    } else if (responsibleFilter !== 'all') {
      result = result.filter(p => p.responsible_agent_id === responsibleFilter);
    }
    if (search.trim()) {
      // TD-096: поиск по коду, имени объекта, имени собственника (owner_id и owner_id_2).
      const q = search.trim().toLowerCase();
      const ownerName = (id) => {
        if (!id) return '';
        const o = owners.find(x => x.id === id);
        if (!o) return '';
        return [o.name, o.lastName].filter(Boolean).join(' ').toLowerCase();
      };
      result = result.filter(p =>
        (p.code || '').toLowerCase().includes(q) ||
        (p.name || '').toLowerCase().includes(q) ||
        ownerName(p.owner_id).includes(q) ||
        ownerName(p.owner_id_2).includes(q)
      );
    }
    return result;
  }, [properties, bookings, propFilter, cityFilters, typeFilters, districtFilters, bedroomsFilters, priceMin, priceMax, amenityFilters, petsFilter, longTermFilter, responsibleFilter, search, owners]);

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
          {(!user?.teamMembership || user?.teamPermissions?.can_manage_bookings) && (
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

            {/* TD-092: Dropdown — Город (мультивыбор) */}
            <View
              style={s.dropdownWrap}
              onMouseEnter={() => { if (cityLeaveTimer.current) clearTimeout(cityLeaveTimer.current); }}
              onMouseLeave={() => { cityLeaveTimer.current = setTimeout(() => setCityOpen(false), 300); }}
            >
              <TouchableOpacity
                style={[s.dropdownBtn, cityFilters.length > 0 && s.dropdownBtnActive]}
                onPress={() => { closeOtherDropdowns('city'); setCityOpen(o => !o); }}
              >
                <Text style={[s.dropdownBtnText, cityFilters.length > 0 && s.dropdownBtnTextActive]}>
                  {cityFilters.length > 0 ? `${t('filterCity')} (${cityFilters.length})` : t('filterCity')} ▾
                </Text>
              </TouchableOpacity>
              {cityOpen && (
                <View style={s.dropdownList}>
                  {uniqueCities.map(c => {
                    const selected = cityFilters.includes(c);
                    return (
                      <TouchableOpacity
                        key={c} style={s.dropdownItem}
                        onPress={() => setCityFilters(prev =>
                          selected ? prev.filter(x => x !== c) : [...prev, c]
                        )}
                      >
                        <View style={s.dropdownItemRow}>
                          <View style={[s.dropdownCheckbox, selected && s.dropdownCheckboxChecked]}>
                            {selected && <Text style={s.dropdownCheckmark}>✓</Text>}
                          </View>
                          <Text style={[s.dropdownItemText, selected && s.dropdownItemTextActive]}>{c}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                  {uniqueCities.length === 0 && (
                    <Text style={s.dropdownEmpty}>{t('noData')}</Text>
                  )}
                </View>
              )}
            </View>

            {/* TD-093: Dropdown — Тип объекта (мультивыбор: house/resort/condo) */}
            <View
              style={s.dropdownWrap}
              onMouseEnter={() => { if (typeLeaveTimer.current) clearTimeout(typeLeaveTimer.current); }}
              onMouseLeave={() => { typeLeaveTimer.current = setTimeout(() => setTypeOpen(false), 300); }}
            >
              <TouchableOpacity
                style={[s.dropdownBtn, typeFilters.length > 0 && s.dropdownBtnActive]}
                onPress={() => { closeOtherDropdowns('type'); setTypeOpen(o => !o); }}
              >
                <Text style={[s.dropdownBtnText, typeFilters.length > 0 && s.dropdownBtnTextActive]}>
                  {typeFilters.length > 0 ? `${t('filterType')} (${typeFilters.length})` : t('filterType')} ▾
                </Text>
              </TouchableOpacity>
              {typeOpen && (
                <View style={s.dropdownList}>
                  {['house', 'resort', 'condo'].map(typeKey => {
                    const selected = typeFilters.includes(typeKey);
                    return (
                      <TouchableOpacity
                        key={typeKey} style={s.dropdownItem}
                        onPress={() => setTypeFilters(prev =>
                          selected ? prev.filter(x => x !== typeKey) : [...prev, typeKey]
                        )}
                      >
                        <View style={s.dropdownItemRow}>
                          <View style={[s.dropdownCheckbox, selected && s.dropdownCheckboxChecked]}>
                            {selected && <Text style={s.dropdownCheckmark}>✓</Text>}
                          </View>
                          <Text style={[s.dropdownItemText, selected && s.dropdownItemTextActive]}>{t(typeKey)}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Dropdown: Район (мультивыбор) */}
            <View
              style={s.dropdownWrap}
              onMouseEnter={() => { if (districtLeaveTimer.current) clearTimeout(districtLeaveTimer.current); }}
              onMouseLeave={() => { districtLeaveTimer.current = setTimeout(() => setDistrictOpen(false), 300); }}
            >
              <TouchableOpacity
                style={[s.dropdownBtn, districtFilters.length > 0 && s.dropdownBtnActive]}
                onPress={() => { closeOtherDropdowns('district'); setDistrictOpen(o => !o); }}
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
                onPress={() => { closeOtherDropdowns('bedrooms'); setBedroomsOpen(o => !o); }}
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

            {/* TD-094: Цена аренды от/до */}
            <View style={s.priceRangeWrap}>
              <TextInput
                style={[s.priceInput, priceMin && s.priceInputActive]}
                placeholder={t('filterPriceFromPlaceholder') || (t('priceFrom') || 'from')}
                placeholderTextColor="#999"
                value={priceMin}
                onChangeText={(v) => setPriceMin(v.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
              />
              <Text style={s.priceRangeDash}>—</Text>
              <TextInput
                style={[s.priceInput, priceMax && s.priceInputActive]}
                placeholder={t('filterPriceToPlaceholder') || (t('priceTo') || 'to')}
                placeholderTextColor="#999"
                value={priceMax}
                onChangeText={(v) => setPriceMax(v.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
              />
            </View>

            {/* TD-095: Dropdown — Удобства (мультивыбор: бассейн/спортзал/парковка/стиралка) */}
            <View
              style={s.dropdownWrap}
              onMouseEnter={() => { if (amenityLeaveTimer.current) clearTimeout(amenityLeaveTimer.current); }}
              onMouseLeave={() => { amenityLeaveTimer.current = setTimeout(() => setAmenityOpen(false), 300); }}
            >
              <TouchableOpacity
                style={[s.dropdownBtn, amenityFilters.length > 0 && s.dropdownBtnActive]}
                onPress={() => { closeOtherDropdowns('amenity'); setAmenityOpen(o => !o); }}
              >
                <Text style={[s.dropdownBtnText, amenityFilters.length > 0 && s.dropdownBtnTextActive]}>
                  {amenityFilters.length > 0 ? `${t('filterAmenities')} (${amenityFilters.length})` : t('filterAmenities')} ▾
                </Text>
              </TouchableOpacity>
              {amenityOpen && (
                <View style={s.dropdownList}>
                  {FILTER_AMENITY_KEYS.map(key => {
                    const selected = amenityFilters.includes(key);
                    return (
                      <TouchableOpacity
                        key={key} style={s.dropdownItem}
                        onPress={() => setAmenityFilters(prev =>
                          selected ? prev.filter(x => x !== key) : [...prev, key]
                        )}
                      >
                        <View style={s.dropdownItemRow}>
                          <View style={[s.dropdownCheckbox, selected && s.dropdownCheckboxChecked]}>
                            {selected && <Text style={s.dropdownCheckmark}>✓</Text>}
                          </View>
                          <Text style={[s.dropdownItemText, selected && s.dropdownItemTextActive]}>{t('amenity_' + key)}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* TD-097: Dropdown — Год (Gantt jump) */}
            <View
              style={s.dropdownWrap}
              onMouseEnter={() => { if (yearLeaveTimer.current) clearTimeout(yearLeaveTimer.current); }}
              onMouseLeave={() => { yearLeaveTimer.current = setTimeout(() => setYearOpen(false), 300); }}
            >
              <TouchableOpacity
                style={s.dropdownBtn}
                onPress={() => { closeOtherDropdowns('year'); setYearOpen(o => !o); }}
              >
                <Text style={s.dropdownBtnText}>{t('filterYear')} ▾</Text>
              </TouchableOpacity>
              {yearOpen && (
                <View style={s.dropdownList}>
                  {yearOptions.map(year => (
                    <TouchableOpacity
                      key={year} style={s.dropdownItem}
                      onPress={() => handleYearJump(year)}
                    >
                      <Text style={s.dropdownItemText}>{year}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Dropdown: Ответственный (single-select, только админу) */}
            {!user?.teamMembership && (responsibleAgents.length > 0 || hasUnassignedProperty) && (
              <View
                style={s.dropdownWrap}
                onMouseEnter={() => { if (responsibleLeaveTimer.current) clearTimeout(responsibleLeaveTimer.current); }}
                onMouseLeave={() => { responsibleLeaveTimer.current = setTimeout(() => setResponsibleOpen(false), 300); }}
              >
                <TouchableOpacity
                  style={[s.dropdownBtn, responsibleFilter !== 'all' && s.dropdownBtnActive]}
                  onPress={() => { closeOtherDropdowns('responsible'); setResponsibleOpen(o => !o); }}
                >
                  <Text style={[s.dropdownBtnText, responsibleFilter !== 'all' && s.dropdownBtnTextActive]}>
                    {(() => {
                      if (responsibleFilter === 'all') return `${t('filterResponsible')} ▾`;
                      if (responsibleFilter === 'none') return `${t('filterResponsibleNone')} ▾`;
                      const a = responsibleAgents.find(x => x.id === responsibleFilter);
                      return `${a ? a.name : t('filterResponsible')} ▾`;
                    })()}
                  </Text>
                </TouchableOpacity>
                {responsibleOpen && (
                  <View style={s.dropdownList}>
                    <TouchableOpacity
                      style={s.dropdownItem}
                      onPress={() => { setResponsibleFilter('all'); setResponsibleOpen(false); }}
                    >
                      <View style={s.dropdownItemRow}>
                        <View style={[s.dropdownRadio, responsibleFilter === 'all' && s.dropdownRadioChecked]}>
                          {responsibleFilter === 'all' && <View style={s.dropdownRadioDot} />}
                        </View>
                        <Text style={[s.dropdownItemText, responsibleFilter === 'all' && s.dropdownItemTextActive]}>
                          {t('filterResponsibleAll')}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    {responsibleAgents.map(a => {
                      const selected = responsibleFilter === a.id;
                      return (
                        <TouchableOpacity
                          key={a.id} style={s.dropdownItem}
                          onPress={() => { setResponsibleFilter(a.id); setResponsibleOpen(false); }}
                        >
                          <View style={s.dropdownItemRow}>
                            <View style={[s.dropdownRadio, selected && s.dropdownRadioChecked]}>
                              {selected && <View style={s.dropdownRadioDot} />}
                            </View>
                            <Text style={[s.dropdownItemText, selected && s.dropdownItemTextActive]}>{a.name}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                    {hasUnassignedProperty && (
                      <TouchableOpacity
                        style={s.dropdownItem}
                        onPress={() => { setResponsibleFilter('none'); setResponsibleOpen(false); }}
                      >
                        <View style={s.dropdownItemRow}>
                          <View style={[s.dropdownRadio, responsibleFilter === 'none' && s.dropdownRadioChecked]}>
                            {responsibleFilter === 'none' && <View style={s.dropdownRadioDot} />}
                          </View>
                          <Text style={[s.dropdownItemText, responsibleFilter === 'none' && s.dropdownItemTextActive]}>
                            {t('filterResponsibleNone')}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}

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
            {(cityFilters.length > 0 || typeFilters.length > 0 || districtFilters.length > 0 || bedroomsFilters.length > 0
              || amenityFilters.length > 0 || priceMin || priceMax
              || petsFilter || longTermFilter || propFilter !== 'all' || responsibleFilter !== 'all') && (
              <TouchableOpacity
                style={s.resetBtn}
                onPress={() => {
                  setCityFilters([]);
                  setTypeFilters([]);
                  setDistrictFilters([]);
                  setBedroomsFilters([]);
                  setAmenityFilters([]);
                  setPriceMin('');
                  setPriceMax('');
                  setPetsFilter(false);
                  setLongTermFilter(false);
                  setPropFilter('all');
                  setResponsibleFilter('all');
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
        <View style={[s.mainArea, showDetail && s.mainAreaWithDetail]}>
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
                      const tc = getPropertyTypeColors(getEffectiveType(prop));
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
                              const isOwnBooking   = bk.responsibleAgentId === user?.id;
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
              onPrint={() => selectedBooking && handlePrintConfirmation(selectedBooking)}
              user={user}
              teamMembers={teamMembers}
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
        teamMembers={teamMembers}
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
  // TD-094: фильтр цена от/до
  priceRangeWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  priceInput: {
    width: 70, paddingHorizontal: 8, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.bg, fontSize: 12, color: C.text,
  },
  priceInputActive: { borderColor: ACCENT, backgroundColor: C.accentBg },
  priceRangeDash:   { color: C.muted, fontSize: 12 },
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
  dropdownRadio: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 1.5, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.surface,
  },
  dropdownRadioChecked: { borderColor: ACCENT },
  dropdownRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: ACCENT },
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
