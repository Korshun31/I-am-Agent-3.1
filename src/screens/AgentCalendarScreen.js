import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  UIManager,
  Dimensions,
  Alert,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import dayjs from 'dayjs';
import CalendarRangePicker from 'react-native-calendar-range-picker';
import { useLanguage } from '../context/LanguageContext';
import { getCommissionEvents } from '../utils/ownerCommission';
import { useAppData } from '../context/AppDataContext';
import { useUser } from '../context/UserContext';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { eventOccursOnDate, updateCalendarEvent } from '../services/calendarEventsService';
import { getUnreadCount, getTotalCount } from '../services/notificationsService';
import { supabase } from '../services/supabase';
import AddCalendarEventModal from '../components/AddCalendarEventModal';
import AddBookingModal from '../components/AddBookingModal';
import { IconFolderClosed, IconFolderOpen } from '../components/FolderIcons';
import Checkbox from '../components/Checkbox';
import { TAB_BAR_CONTENT_HEIGHT } from '../components/BottomNav';
import PropertyNotificationsModal from '../components/PropertyNotificationsModal';
import BookingDetailScreen from './BookingDetailScreen';
import ContactDetailScreen from './ContactDetailScreen';
import { deleteBooking } from '../services/bookingsService';
import { cancelBookingReminders } from '../services/bookingRemindersService';

const TOP_INSET = (Constants.statusBarHeight ?? 44) + 12;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CALENDAR_SCALE = 1.1;
// Высота блока месяца, чтобы 6-недельный месяц вмещался с симметричными
// отступами 16 сверху и снизу.
const __LIB_SCALE = Math.max(0.78, Math.min(1, (SCREEN_WIDTH - 72) * 0.8 / 350));
const MONTH_BOX_HEIGHT = 16 + 33 + Math.round(50 * __LIB_SCALE) + 6 * Math.round(45 * __LIB_SCALE) + 16;
const CALENDAR_COLORS = [
  '#E57373', '#FF8A65', '#FFB74D', '#FFD54F',
  '#81C784', '#4DB6AC', '#64B5F6',
];

const CALENDAR_LOCALES = {
  en: { monthNames: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'], dayNames: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], today: 'Today', year: '' },
  ru: { monthNames: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'], dayNames: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'], today: 'Сегодня', year: '' },
  th: { monthNames: ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'], dayNames: ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'], today: 'วันนี้', year: '' },
};

function formatDateYMD(d) {
  if (!d) return '';
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

function formatTimeDisplay(timeStr) {
  if (!timeStr) return '';
  const parts = String(timeStr).split(':');
  if (parts.length >= 2) return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  return timeStr;
}

function getBookingNumber(booking, allBookings) {
  const year = new Date(booking.checkIn).getFullYear();
  const yearShort = year % 100;
  const sameYear = (allBookings || [])
    .filter(x => new Date(x.checkIn).getFullYear() === year)
    .sort((a, b) => new Date(a.createdAt || a.checkIn) - new Date(b.createdAt || b.checkIn));
  const idx = sameYear.findIndex(x => x.id === booking.id);
  const seq = idx >= 0 ? idx + 1 : 0;
  return `${seq}/${String(yearShort).padStart(2, '0')}`;
}

const EVENT_BLOCK_COLORS = {
  checkInMine: { bg: 'rgba(168,230,163,0.7)', border: '#81C784' },
  checkOutMine: { bg: 'rgba(255,205,210,0.8)', border: '#E57373' },
  commission: { bg: 'rgba(187,222,251,0.8)', border: '#64B5F6' },
  other: { bg: 'rgba(224,224,224,0.8)', border: '#BDBDBD' },
};

const DRAWER_ANIMATION = {
  duration: 300,
  create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  update: { type: LayoutAnimation.Types.easeInEaseOut },
  delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
};

function EventCard({ event, expanded, onToggle, onEdit, onOpenBooking, isBooking, t, onStatusChange }) {
  const navigation = useNavigation();
  const { contacts } = useAppData();
  const [contactName, setContactName] = useState('');
  const [localCompleted, setLocalCompleted] = useState(!!event.isCompleted);

  useEffect(() => {
    setLocalCompleted(!!event.isCompleted);
  }, [event.isCompleted]);

  const handleToggleCompleted = async () => {
    const newVal = !localCompleted;
    setLocalCompleted(newVal);
    if (!isBooking) {
      try {
        await updateCalendarEvent(event.id, { ...event, isCompleted: newVal });
        onStatusChange?.();
      } catch (e) {
        setLocalCompleted(!newVal);
        Alert.alert(t('error'), e.message);
      }
    }
  };

  useEffect(() => {
    if (!isBooking || !event.booking) return;
    const b = event.booking;
    if (b.notMyCustomer) {
      setContactName(t('ownerCustomer'));
      return;
    }
    if (!b.contactId) {
      setContactName('');
      return;
    }
    const c = contacts.find(ct => ct.id === b.contactId);
    setContactName(c ? `${c.name} ${c.lastName}`.trim() : '');
  }, [isBooking, event?.booking?.contactId, event?.booking?.notMyCustomer, t, contacts]);

  if (isBooking) {
    const isCommission = event.eventType === 'commissionOneTime' || event.eventType === 'commissionMonthly';
    const typeIcon = isCommission
      ? require('../../assets/icon-commission-owner.png')
      : (event.eventType === 'checkIn' ? require('../../assets/icon-checkin.png') : require('../../assets/icon-checkout.png'));
    const displayName = isCommission
      ? (event.commissionTitle || '')
      : (contactName || (event.booking?.notMyCustomer ? t('ownerCustomer') : ''));
    const blockColors = isCommission
      ? EVENT_BLOCK_COLORS.commission
      : event.notMyCustomer
      ? EVENT_BLOCK_COLORS.other
      : (event.eventType === 'checkIn' ? EVENT_BLOCK_COLORS.checkInMine : EVENT_BLOCK_COLORS.checkOutMine);
    const objName = event.objectDisplayName || '';
    return (
      <View style={[styles.eventCard, styles.eventCardPropertyStyle, { backgroundColor: blockColors.bg, borderColor: blockColors.border }]}>
        <View style={styles.eventRow}>
          <TouchableOpacity style={styles.eventMainArea} onPress={() => {}} activeOpacity={1}>
            <Image source={typeIcon} style={styles.eventTypeIcon} resizeMode="contain" />
            <Text style={styles.eventName} numberOfLines={1}>{displayName}</Text>
          </TouchableOpacity>
          {objName ? (
            <Text style={styles.eventObjectLabel} numberOfLines={1} ellipsizeMode="tail">{objName}</Text>
          ) : null}
          <TouchableOpacity onPress={onToggle} style={styles.expandBtn} activeOpacity={0.5}>
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color="#6B6B6B" />
          </TouchableOpacity>
        </View>
        {expanded && (
          <View style={styles.eventExpanded}>
            {event.property ? (
              <TouchableOpacity style={styles.eventDetailRow} onPress={() => navigation.navigate('RealEstate', { propertyToOpen: event.property })} activeOpacity={0.7}>
                <Image source={require('../../assets/icon-property-house.png')} style={styles.eventDetailIcon} resizeMode="contain" />
                <Text style={styles.eventDetailLink}>{event.propertyLabel || '—'}</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.eventDetailRow}>
                <Image source={require('../../assets/icon-property-house.png')} style={styles.eventDetailIcon} resizeMode="contain" />
                <Text style={styles.eventDetailText}>{event.propertyLabel || '—'}</Text>
              </View>
            )}
            {event.booking?.notMyCustomer ? (
              <View style={styles.eventDetailRow}>
                <Image source={require('../../assets/icon-booking-hashtag.png')} style={styles.eventDetailIconBooking} resizeMode="contain" />
                <Text style={styles.eventDetailText}>N/A</Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.eventDetailRow} onPress={() => onOpenBooking?.(event.booking, event.property, event.fullBookingCode)} activeOpacity={0.7}>
                <Image source={require('../../assets/icon-booking-hashtag.png')} style={styles.eventDetailIconBooking} resizeMode="contain" />
                <Text style={styles.eventDetailLink} numberOfLines={1}>{event.fullBookingCode || event.bookingNum || '—'}</Text>
              </TouchableOpacity>
            )}
            {isCommission && event.commissionAmount != null ? (
              <View style={styles.eventDetailRow}>
                <Text style={styles.eventDetailText}>{t('commissionPaymentAmount')}: </Text>
                <Text style={styles.eventDetailAmount}>
                  {Number(event.commissionAmount).toLocaleString('en-US', { minimumFractionDigits: 0 }).replace(/,/g, ' ')} Thb
                </Text>
              </View>
            ) : null}
          </View>
        )}
      </View>
    );
  }

  const stripeColor = event.color || '#B5CDE3';
  return (
    <View style={styles.customEventCard}>
      <View style={[styles.eventStripe, { backgroundColor: stripeColor }]} />
      <View style={[styles.eventRow, styles.eventRowWithStripe]}>
        <TouchableOpacity style={styles.eventMainArea} onPress={() => {}} activeOpacity={1}>
          <Text style={[styles.eventName, localCompleted && styles.eventNameDimmed]} numberOfLines={1} ellipsizeMode="tail">{event.title}</Text>
        </TouchableOpacity>
        {event.eventTime ? (
          <View style={styles.eventTimeCenter}>
            <Text style={[styles.eventTimeText, localCompleted && styles.textDimmed]}>{formatTimeDisplay(event.eventTime)}</Text>
          </View>
        ) : null}
        {localCompleted && (
          <View style={styles.checkIconBadge}>
            <Text style={styles.checkIconBadgeText}>✓</Text>
          </View>
        )}
        <TouchableOpacity onPress={onToggle} style={styles.expandBtn} activeOpacity={0.5}>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color="#6B6B6B" />
        </TouchableOpacity>
      </View>
      {expanded && (
        <View style={[styles.eventExpanded, styles.eventExpandedWithStripe]}>
          {(event.eventDate || event.eventTime) && (
            <Text style={styles.eventDetailText}>
              {formatDateDisplay(event.eventDate)}
              {event.eventTime ? ` ${formatTimeDisplay(event.eventTime)}` : ''}
            </Text>
          )}
          {event.comments ? (
            <Text style={styles.eventComments}>{event.comments}</Text>
          ) : null}
          <View style={styles.eventFooterRow}>
            <TouchableOpacity
              style={styles.completedCheckboxRow}
              onPress={handleToggleCompleted}
              activeOpacity={0.7}
            >
              <Checkbox checked={localCompleted} size={20} />
              <Text style={[styles.completedLabel, localCompleted && styles.completedLabelActive]}>
                {t('agentCalendarEventCompleted')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.editBtn} onPress={onEdit}>
              <Text style={styles.editBtnText}>{t('editContact')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

export default function AgentCalendarScreen({ onReady }) {
  const { user } = useUser();
  const isVisible = useIsFocused();
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  const { properties, bookings, contacts, calendarEvents, refreshProperties, refreshBookings, refreshCalendarEvents } = useAppData();

  useEffect(() => { onReady?.(); }, []);
  const [selectedDate, setSelectedDate] = useState(() => formatDateYMD(new Date()));
  const [loading, setLoading] = useState(true);
  const [addEventVisible, setAddEventVisible] = useState(false);
  const [addBookingVisible, setAddBookingVisible] = useState(false);
  const [editEvent, setEditEvent] = useState(null);
  const [editBooking, setEditBooking] = useState(null);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [viewBookingDetail, setViewBookingDetail] = useState(null);
  const [editBookingDetailModalVisible, setEditBookingDetailModalVisible] = useState(false);
  const [selectedOwnerContact, setSelectedOwnerContact] = useState(null);
  const [notifModalVisible, setNotifModalVisible] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [notifRefreshKey, setNotifRefreshKey] = useState(0);
  const notifModalVisibleRef = useRef(false);

  // Полное обновление (после мутаций): события + общий стор
  const loadData = useCallback(async (opts = {}) => {
    if (!opts.silent) setLoading(true);
    try {
      await Promise.all([
        refreshCalendarEvents(),
        refreshProperties(),
        refreshBookings(),
      ]);
    } catch {}
    if (!opts.silent) setLoading(false);
  }, [refreshCalendarEvents, refreshProperties, refreshBookings]);

  const hasLoadedRef = useRef(false); // загружаем только один раз при первом открытии
  const prevVisibleRef = useRef(false);
  useEffect(() => {
    if (isVisible && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      setLoading(false);
    }
    if (prevVisibleRef.current && !isVisible) {
      setSelectedOwnerContact(null);
      setViewBookingDetail(null);
      setEditBookingDetailModalVisible(false);
    }
    prevVisibleRef.current = isVisible;
  }, [isVisible]);

  const refreshBadge = useCallback(() => {
    getUnreadCount().then(setUnreadCount).catch(() => {});
    getTotalCount().then(setTotalCount).catch(() => {});
  }, []);

  useEffect(() => {
    notifModalVisibleRef.current = notifModalVisible;
  }, [notifModalVisible]);

  useEffect(() => {
    if (!isVisible || !user?.id) return;
    refreshBadge();
  }, [isVisible, user?.id, refreshBadge]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`notif-mobile-agent-calendar-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${user.id}`,
        },
        () => {
          refreshBadge();
          if (notifModalVisibleRef.current) {
            setNotifRefreshKey((k) => k + 1);
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, refreshBadge]);

  const toggleExpandAll = () => {
    LayoutAnimation.configureNext(DRAWER_ANIMATION);
    if (!allEventsExpanded) {
      const ids = new Set();
      dayEvents.forEach((ev) => ids.add(ev.key));
      setExpandedIds(ids);
    } else {
      setExpandedIds(new Set());
    }
  };

  const toggleExpand = (key) => {
    LayoutAnimation.configureNext(DRAWER_ANIMATION);
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const openAddEvent = () => {
    setEditEvent(null);
    setAddEventVisible(true);
  };

  const openEditEvent = (ev) => {
    setEditEvent(ev);
    setAddEventVisible(true);
  };

  const openEditBooking = (ev) => {
    setEditBooking(ev.booking);
    setAddBookingVisible(true);
  };

  const handleViewBooking = (booking, property, propertyCode) => {
    if (booking && property && propertyCode) {
      setViewBookingDetail({ booking, property, propertyCode });
    }
  };

  const mergedDayEvents = React.useMemo(() => {
    const list = [];
    const propsMap = {};
    (properties || []).forEach(p => { propsMap[p.id] = p; });
    const getPropertyLabel = (b) => {
      const prop = propsMap[b.propertyId];
      if (!prop) return '—';
      const resort = prop.parent_id ? propsMap[prop.parent_id] : null;
      const code = resort ? (resort.code || resort.name) : (prop.code || prop.name);
      const unit = prop.code_suffix ? ` (${prop.code_suffix})` : '';
      return `${code}${unit}`.trim() || '—';
    };
    const getObjectDisplayName = (b) => {
      const prop = propsMap[b.propertyId];
      if (!prop) return '—';
      const parent = prop.parent_id ? propsMap[prop.parent_id] : null;
      if (parent) return (parent.name || parent.code || '').trim() || '—';
      return (prop.name || prop.code || '').trim() || '—';
    };
    const truncateLabel = (s, maxLen = 24) => {
      if (!s || typeof s !== 'string') return '';
      const t = String(s).trim();
      return t.length <= maxLen ? t : t.slice(0, maxLen - 3) + '...';
    };

    (bookings || []).forEach(b => {
      if (!b.checkIn) return;
      const prop = propsMap[b.propertyId];

      const objName = truncateLabel(getObjectDisplayName(b));
      const d = dayjs(b.checkIn).format('YYYY-MM-DD');

      // Заселение: только свои бронирования (не клиенты собственника)
      const showCheckIn = !b.notMyCustomer;
      if (showCheckIn && d === selectedDate) {
        list.push({
          key: `b-in-${b.id}`,
          type: 'booking',
          eventType: 'checkIn',
          color: b.notMyCustomer ? '#BDBDBD' : '#81C784',
          booking: b,
          property: prop,
          propertyLabel: getPropertyLabel(b),
          objectDisplayName: objName,
          bookingNum: getBookingNumber(b, bookings),
          fullBookingCode: `${getPropertyLabel(b)} ${getBookingNumber(b, bookings)}`.trim(),
          notMyCustomer: b.notMyCustomer,
        });
      }

      // Выселение: все бронирования в своих объектах (включая клиентов собственника)
      const showCheckOut = true;
      if (showCheckOut && b.checkOut) {
        const dOut = dayjs(b.checkOut).format('YYYY-MM-DD');
        if (dOut === selectedDate) {
          list.push({
            key: `b-out-${b.id}`,
            type: 'booking',
            eventType: 'checkOut',
            color: b.notMyCustomer ? '#BDBDBD' : '#E57373',
            booking: b,
            property: prop,
            propertyLabel: getPropertyLabel(b),
            objectDisplayName: objName,
            bookingNum: getBookingNumber(b, bookings),
            fullBookingCode: `${getPropertyLabel(b)} ${getBookingNumber(b, bookings)}`.trim(),
            notMyCustomer: b.notMyCustomer,
          });
        }
      }

      const label = getPropertyLabel(b);
      const codeAndNum = `${label} ${getBookingNumber(b, bookings)}`.trim();

      // Комиссии: все объекты в контексте уже свои
      const events = getCommissionEvents(b);
      const monthly = events.filter(e => e.type === 'monthly');
      events.forEach((evt) => {
        if (evt.date !== selectedDate) return;
        if (evt.type === 'oneTime') {
          list.push({
            key: `comm-1-${b.id}`,
            type: 'booking',
            eventType: 'commissionOneTime',
            booking: b,
            property: propsMap[b.propertyId],
            propertyLabel: label,
            objectDisplayName: truncateLabel(getObjectDisplayName(b)),
            fullBookingCode: codeAndNum,
            commissionTitle: `${t('commissionOneTimeEvent')} ${codeAndNum} (${evt.amount})`,
            commissionAmount: evt.amount,
            notMyCustomer: false,
          });
        } else {
          const idx = monthly.findIndex(e => e.month === evt.month);
          const suffix = monthly.length > 1 ? ` — ${t('commissionMonth')} ${idx + 1}/${monthly.length}` : '';
          list.push({
            key: `comm-m-${b.id}-${evt.date}`,
            type: 'booking',
            eventType: 'commissionMonthly',
            booking: b,
            property: propsMap[b.propertyId],
            propertyLabel: label,
            objectDisplayName: truncateLabel(getObjectDisplayName(b)),
            fullBookingCode: codeAndNum,
            commissionTitle: `${t('commissionMonthlyEvent')} ${codeAndNum} (${evt.amount})${suffix}`,
            commissionAmount: evt.amount,
            notMyCustomer: false,
          });
        }
      });
    });

    (calendarEvents || []).forEach(e => {
      if (eventOccursOnDate(e, selectedDate)) {
        list.push({
          key: `c-${e.id}-${selectedDate}`,
          type: 'custom',
          ...e,
        });
      }
    });

    list.sort((a, b) => {
      const timeA = a.type === 'booking' ? (a.eventType === 'checkIn' ? '00:00' : '23:59') : (a.eventTime || '00:00');
      const timeB = b.type === 'booking' ? (b.eventType === 'checkIn' ? '00:00' : '23:59') : (b.eventTime || '00:00');
      return (timeA || '').localeCompare(timeB || '');
    });
    return list;
  }, [selectedDate, bookings, calendarEvents, properties]);

  const dayEvents = mergedDayEvents;

  const allEventsExpanded = dayEvents.length > 0 && dayEvents.every((ev) => expandedIds.has(ev.key));

  const eventCountsByDate = React.useMemo(() => {
    const counts = {};
    (bookings || []).forEach((b) => {
      // Заселение: только свои бронирования (не клиенты собственника)
      if (!b.notMyCustomer && b.checkIn) {
        const d = dayjs(b.checkIn).format('YYYY-MM-DD');
        counts[d] = (counts[d] || 0) + 1;
      }

      // Выселение: все бронирования в своих объектах
      if (b.checkOut && b.checkOut !== b.checkIn) {
        const d = dayjs(b.checkOut).format('YYYY-MM-DD');
        counts[d] = (counts[d] || 0) + 1;
      }

      // Комиссии: все объекты уже свои
      getCommissionEvents(b).forEach((evt) => {
        counts[evt.date] = (counts[evt.date] || 0) + 1;
      });
    });

    (calendarEvents || []).forEach((e) => {
      if (e.repeatType) {
        const start = e.eventDate ? dayjs(e.eventDate) : null;
        if (!start?.isValid()) return;
        const rangeStart = dayjs().subtract(1, 'year').startOf('month');
        const rangeEnd = dayjs().add(2, 'year').endOf('month');
        let d = rangeStart.startOf('month');
        while (d.isBefore(rangeEnd) || d.isSame(rangeEnd, 'day')) {
          const dateStr = d.format('YYYY-MM-DD');
          if (eventOccursOnDate(e, dateStr)) counts[dateStr] = (counts[dateStr] || 0) + 1;
          d = d.add(1, 'day');
        }
      } else if (e.eventDate) {
        const d = dayjs(e.eventDate).format('YYYY-MM-DD');
        counts[d] = (counts[d] || 0) + 1;
      }
    });

    return counts;
  }, [bookings, calendarEvents, properties, user]);

  if (selectedOwnerContact) {
    return (
      <ContactDetailScreen
        contact={selectedOwnerContact}
        onBack={() => setSelectedOwnerContact(null)}
        onContactUpdated={() => setSelectedOwnerContact(null)}
        onContactDeleted={() => setSelectedOwnerContact(null)}
        user={user}
      />
    );
  }

  if (viewBookingDetail) {
    const { booking, property, propertyCode } = viewBookingDetail;
    const clearDetail = () => {
      setViewBookingDetail(null);
      setEditBookingDetailModalVisible(false);
      setSelectedOwnerContact(null);
    };
    const detailProperty = (() => {
      if (!booking?.propertyId) return null;
      const prop = properties.find(p => p.id === booking.propertyId);
      if (!prop) return null;
      const resort = prop.parent_id ? (properties.find(p => p.id === prop.parent_id) || null) : null;
      const owners = contacts.filter(c => c.type === 'owners');
      const owner = prop.owner_id ? owners.find(o => o.id === prop.owner_id) : null;
      const owner2 = prop.owner_id_2 ? owners.find(o => o.id === prop.owner_id_2) : null;
      return {
        ...prop,
        _resort: resort,
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
    })();
    const detailContact = booking?.contactId
      ? (contacts.find(c => c.id === booking.contactId) || null)
      : null;
    return (
      <View style={{ flex: 1 }}>
        <BookingDetailScreen
          booking={booking}
          propertyCode={propertyCode}
          initialProperty={detailProperty}
          initialContact={detailContact}
          onContactPress={(contact) => setSelectedOwnerContact(contact)}
          onBack={clearDetail}
          onDelete={async (id) => {
            try {
              await cancelBookingReminders(id);
              await deleteBooking(id);
              clearDetail();
              loadData();
            } catch (e) {
              Alert.alert(t('error'), e?.message || String(e));
            }
          }}
          onEdit={() => setEditBookingDetailModalVisible(true)}
        />
        <AddBookingModal
          visible={editBookingDetailModalVisible}
          onClose={() => setEditBookingDetailModalVisible(false)}
          onSaved={(updated) => {
            setEditBookingDetailModalVisible(false);
            if (updated) setViewBookingDetail(prev => prev ? { ...prev, booking: updated } : null);
            loadData();
          }}
          property={property}
          editBooking={booking}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.fixedTop}>
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <Text style={styles.headerTitle}>{t('agentCalendarTitle')}</Text>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => setNotifModalVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={22} color="#888" />
            {unreadCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            ) : totalCount > 0 ? (
              <View style={[styles.badge, styles.badgeRead]}>
                <Text style={[styles.badgeText, styles.badgeTextRead]}>
                  {totalCount > 9 ? '9+' : totalCount}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.step2Content}>
        <View style={[styles.calendarInline, styles.calendarInlineStep2]} collapsable={false}>
            <CalendarRangePicker
              locale={CALENDAR_LOCALES[language] || CALENDAR_LOCALES.en}
              startDate={selectedDate}
              endDate={selectedDate}
              singleSelectMode
              onChange={(date) => date && setSelectedDate(date)}
              eventCountsByDate={eventCountsByDate}
              pastYearRange={1}
              futureYearRange={2}
              isMonthFirst
              dimPastDates
              style={{
                container: { backgroundColor: 'transparent', paddingBottom: 0 },
                dayTextColor: '#1d1c1d',
                dayNameText: { color: '#bababe' },
                disabledTextColor: '#bababe',
                todayColor: '#E85D4C',
                holidayColor: '#E85D4C',
                selectedDayBackgroundColor: '#FFB74D',
                monthOverlayContainer: {
                  width: Math.round((Math.min(SCREEN_WIDTH - 72, 368)) * 0.8 * CALENDAR_SCALE),
                  height: MONTH_BOX_HEIGHT,
                  backgroundColor: 'rgba(255,255,255,0.95)',
                  borderRadius: 12,
                  marginRight: 16,
                  overflow: 'hidden',
                },
                monthNameContainer: {
                  width: '100%',
                  justifyContent: 'center',
                  alignItems: 'center',
                  paddingLeft: 0,
                  paddingRight: 0,
                },
                monthNameText: { textAlign: 'center' },
              }}
              flatListProps={(() => {
                const w = Math.round((Math.min(SCREEN_WIDTH - 72, 368)) * 0.8 * CALENDAR_SCALE);
                const slot = w + 16;
                const viewportWidth = SCREEN_WIDTH - 40;
                const padH = Math.max(0, (viewportWidth - w) / 2);
                const monthCount = (1 + 2) * 12;
                return {
                  horizontal: true,
                  nestedScrollEnabled: true,
                  removeClippedSubviews: false,
                  scrollEventThrottle: 16,
                  bounces: true,
                  alwaysBounceHorizontal: true,
                  snapToOffsets: Array.from({ length: monthCount }, (_, i) => {
                    const itemCenter = padH + slot * i + w / 2;
                    return itemCenter - viewportWidth / 2;
                  }),
                  snapToAlignment: 'center',
                  decelerationRate: 'fast',
                  getItemLayout: (_, index) => ({ length: slot, offset: slot * index, index }),
                  contentContainerStyle: { paddingHorizontal: padH },
                  showsHorizontalScrollIndicator: false,
                };
              })()}
            />
          </View>
        </View>

      <View style={styles.eventsToolbarFixed}>
        <View style={styles.eventsToolbarIcons}>
          <TouchableOpacity onPress={openAddEvent} activeOpacity={0.7} style={styles.eventsToolbarIconBtn}>
            <Ionicons name="add-outline" size={22} color="#888" />
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleExpandAll} activeOpacity={0.7} style={styles.eventsToolbarIconBtn}>
            {allEventsExpanded
              ? <IconFolderOpen   size={22} color="#888" />
              : <IconFolderClosed size={22} color="#888" />
            }
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.eventsScroll}
        contentContainerStyle={[styles.eventsScrollContent, { paddingBottom: insets.bottom + TAB_BAR_CONTENT_HEIGHT + 12 }]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#6B6B6B" style={{ marginVertical: 24 }} />
        ) : dayEvents.length === 0 ? (
          <Text style={styles.emptyText}>{t('agentCalendarNoEvents')}</Text>
        ) : (
          dayEvents.map((ev) => (
            <EventCard
              key={ev.key}
              event={ev}
              expanded={expandedIds.has(ev.key)}
              onToggle={() => toggleExpand(ev.key)}
              onEdit={ev.type === 'booking' ? () => openEditBooking(ev) : () => openEditEvent(ev)}
              onOpenBooking={handleViewBooking}
              isBooking={ev.type === 'booking'}
              t={t}
              onStatusChange={() => loadData({ silent: true })}
            />
          ))
        )}
      </ScrollView>

      <AddCalendarEventModal
        visible={addEventVisible}
        onClose={() => { setAddEventVisible(false); setEditEvent(null); }}
        onSaved={loadData}
        editEvent={editEvent}
        initialDate={selectedDate}
      />

      <AddBookingModal
        visible={addBookingVisible}
        onClose={() => { setAddBookingVisible(false); setEditBooking(null); }}
        onSaved={() => { loadData(); setEditBooking(null); }}
        property={editBooking ? (properties || []).find(p => p.id === editBooking.propertyId) : null}
        editBooking={editBooking}
        initialMonth={selectedDate ? (() => {
          if (!selectedDate) return null;
          const [y, m] = selectedDate.split('-');
          return { year: parseInt(y, 10), month: parseInt(m, 10) - 1 };
        })() : null}
      />

      <PropertyNotificationsModal
        visible={notifModalVisible}
        onClose={() => setNotifModalVisible(false)}
        onBadgeUpdate={refreshBadge}
        refreshSignal={notifRefreshKey}
        onOpenProperty={(propertyId) => {
          if (!propertyId) return;
          const target = (properties || []).find(p => p.id === propertyId);
          if (target) navigation.navigate('RealEstate', { propertyToOpen: target });
        }}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  eventsScroll: {
    flex: 1,
    paddingHorizontal: 16,
  },
  eventsScrollContent: {
    paddingTop: 4,
  },
  fixedTop: {
    paddingTop: TOP_INSET,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerSpacer: {
    width: 36,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E53935',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeRead: {
    backgroundColor: '#AAAAAA',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 16,
  },
  badgeTextRead: {
    color: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.3,
    color: '#2C2C2C',
  },
  step2Content: {
    flexShrink: 1,
    padding: 14,
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  calendarInline: {
    marginBottom: 8,
  },
  calendarInlineStep2: { marginBottom: 16 },
  eventsToolbarFixed: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  eventsToolbarIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  eventsToolbarIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6B6B6B',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 24,
  },
  eventCard: {
    marginBottom: 10,
    overflow: 'hidden',
  },
  eventCardPropertyStyle: {
    borderRadius: 14,
    borderWidth: 1.5,
  },
  customEventCard: {
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  eventStripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  eventRowWithStripe: {
    paddingLeft: 20,
  },
  eventExpandedWithStripe: {
    paddingLeft: 20,
  },
  eventMainArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  eventTypeIcon: {
    width: 28,
    height: 28,
    marginRight: 10,
  },
  eventName: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    fontWeight: '600',
    color: '#2C2C2C',
  },
  eventObjectLabel: {
    fontSize: 14,
    color: '#6B6B6B',
    maxWidth: 120,
    marginRight: 8,
  },
  eventTimeCenter: {
    marginRight: 25,
    justifyContent: 'center',
  },
  eventTimeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3D7D82',
  },
  expandBtn: {
    padding: 6,
  },
  eventExpanded: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
    paddingTop: 10,
  },
  eventDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    minHeight: 28,
  },
  eventDetailIcon: {
    width: 28,
    height: 28,
    marginRight: 8,
    alignSelf: 'center',
    marginTop: -4,
  },
  eventDetailIconBooking: {
    width: 22,
    height: 22,
    marginRight: 8,
    alignSelf: 'center',
    marginTop: 4,
  },
  eventDetailText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#2C2C2C',
  },
  eventDetailAmount: {
    fontWeight: '700',
    color: '#3D7D82',
  },
  eventDetailLink: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: '#3D7D82',
  },
  eventComments: {
    fontSize: 14,
    color: '#6B6B6B',
    marginBottom: 10,
    fontStyle: 'italic',
  },
  editBtn: {
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  editBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3D7D82',
  },
  eventFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  completedCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  completedLabel: {
    fontSize: 14,
    color: '#2C2C2C',
  },
  completedLabelActive: {
    color: '#3D7D82',
    fontWeight: '700',
  },
  eventNameDimmed: {
    color: '#868E96',
  },
  textDimmed: {
    color: '#868E96',
  },
  checkIconSmall: {
    width: 14,
    height: 14,
    marginLeft: 10,
    flexShrink: 0,
  },
  checkIconLeftOfArrow: {
    width: 14,
    height: 14,
    marginRight: 10,
    flexShrink: 0,
  },
  checkIconBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#3D7D82',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkIconBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
});
