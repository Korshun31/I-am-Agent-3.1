import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Modal,
  Pressable,
  Dimensions,
  Alert,
  TextInput,
  unstable_batchedUpdates,
  Keyboard,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
import Constants from 'expo-constants';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import 'dayjs/locale/th';
import { useLanguage } from '../context/LanguageContext';
import { useAppData } from '../context/AppDataContext';
import { useUser } from '../context/UserContext';
import { useIsFocused } from '@react-navigation/native';
import { deleteProperty } from '../services/propertiesService';
import { deleteBooking } from '../services/bookingsService';
import { cancelBookingReminders } from '../services/bookingRemindersService';
import { getUnreadCount, getTotalCount } from '../services/notificationsService';
import { supabase } from '../services/supabase';
import FilterBottomSheet from '../components/FilterBottomSheet';
import AddBookingModal from '../components/AddBookingModal';
import PropertyNotificationsModal from '../components/PropertyNotificationsModal';
import BookingDetailScreen from './BookingDetailScreen';
import ContactDetailScreen from './ContactDetailScreen';
import PropertyDetailScreen from './PropertyDetailScreen';

const TOP_INSET = (Constants.statusBarHeight ?? 44) + 12;
const BOTTOM_NAV_PADDING = 88;
const ROW_HEIGHT = 45;
const CHAR_WIDTH = 8;
const COL_PADDING = 13;
const MIN_COL_WIDTH = 60;
const MAX_COL_WIDTH = 105;
const MONTH_WIDTH = 100; // 83 + 20%
const NUM_MONTHS = 16;
const HOUSE_LIKE_TYPES = new Set(['house', 'resort_house', 'condo_apartment']);
// Цвета полосок бронирований моих клиентов: красный, оранжевый, жёлтый, зелёный, голубой, синий, фиолетовый
const PASTEL_COLORS = [
  '#E57373', '#FF8A65', '#FFB74D', '#FFD54F',
  '#81C784', '#4DB6AC', '#64B5F6', '#42A5F5',
  '#7986CB', '#9575CD', '#BA68C8', '#F48FB1',
  '#EF9A9A', '#FFAB91', '#A5D6A7', '#80DEEA',
];

const COLORS = {
  background: '#F5F2EB',
  title: '#2C2C2C',
  subtitle: '#6B6B6B',
  monthPast: '#E8E4DE',
  monthCurrent: '#D4EDDA',
  monthFuture: '#FFFFFF',
  border: '#E0D8CC',
  ownerBar: '#BDBDBD',
};

function getBookingNumber(booking, samePropertyBookings) {
  const year = new Date(booking.checkIn).getFullYear();
  const yearShort = year % 100;
  const sameYear = (samePropertyBookings || [])
    .filter(x => new Date(x.checkIn).getFullYear() === year)
    .sort((a, b) => new Date(a.createdAt || a.checkIn) - new Date(b.createdAt || b.checkIn));
  const idx = sameYear.findIndex(x => x.id === booking.id);
  const seq = idx >= 0 ? idx + 1 : 0;
  return `${seq}/${String(yearShort).padStart(2, '0')}`;
}

function parseSortKey(s) {
  const str = String(s ?? '').trim();
  const m = str.match(/^(.*?)(\d+)$/);
  if (m) return { prefix: m[1], num: parseInt(m[2], 10) };
  return { prefix: str, num: null };
}

function compareByCodeOrName(a, b) {
  const codeA = (a.code || a.name || '').trim();
  const codeB = (b.code || b.name || '').trim();
  const ka = parseSortKey(codeA);
  const kb = parseSortKey(codeB);
  const cmp = ka.prefix.localeCompare(kb.prefix);
  if (cmp !== 0) return cmp;
  if (ka.num != null && kb.num != null) return ka.num - kb.num;
  if (ka.num != null) return 1;
  if (kb.num != null) return -1;
  return 0;
}

/** Глобальные цвета: ≤7 бронирований — все разные; >7 — одинаковые как можно дальше (round-robin) */
function getGlobalColorMap(listToShow, bookingsByProperty) {
  const allMyBookings = [];
  listToShow.forEach((unit, rowIdx) => {
    const list = (bookingsByProperty[unit.id] || []).filter(b => !b.notMyCustomer);
    list.sort((a, b) => new Date(a.checkIn) - new Date(b.checkIn));
    list.forEach(b => allMyBookings.push(b));
  });
  const map = {};
  const n = allMyBookings.length;
  if (n <= 7) {
    allMyBookings.forEach((b, i) => {
      map[b.id] = PASTEL_COLORS[i];
    });
  } else {
    allMyBookings.forEach((b, i) => {
      map[b.id] = PASTEL_COLORS[i % PASTEL_COLORS.length];
    });
  }
  return map;
}

function truncateLabel(text, maxWidth, fontParams = {}) {
  const approxCharWidth = 7;
  const maxChars = Math.floor(maxWidth / approxCharWidth);
  if (!text || maxChars <= 0) return '';
  if (text.length <= maxChars) return text;
  return text.slice(0, Math.max(0, maxChars - 1)) + '…';
}

function getOwnerLabel(width, labels) {
  const { full, mid, min } = labels || {};
  const w = width || 0;
  if (w >= 110 && full) return full;
  if (w >= 55 && mid) return mid;
  return min || '';
}

export default function BookingCalendarScreen({ isVisible = true, propertyIdsFilter = null, embeddedInModal = false, onClose, onReady, readOnly = false } = {}) {
  console.log('[BookingCalendar] render', Date.now());
  const { user } = useUser();
  const isFocused = useIsFocused();
  const effectiveVisible = embeddedInModal ? isVisible : isFocused;
  const { t, language } = useLanguage();
  const { properties, bookings, contacts, propertiesLoading, refreshProperties, refreshBookings } = useAppData();

  useEffect(() => {
    onReady?.();
  }, []);
  const [filterVisible, setFilterVisible] = useState(false);
  const [filterValues, setFilterValues] = useState(null);
  const [loading, setLoading] = useState(false);
  const [year, setYear] = useState(dayjs().year());
  const [yearPickerVisible, setYearPickerVisible] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [initialMonth, setInitialMonth] = useState(null);
  const [preloadedProperty, setPreloadedProperty] = useState(null);
  const [preloadedContact, setPreloadedContact] = useState(null);
  const [selectedOwnerContact, setSelectedOwnerContact] = useState(null);
  const [selectedPropertyForDetail, setSelectedPropertyForDetail] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifModalVisible, setNotifModalVisible] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [notifRefreshKey, setNotifRefreshKey] = useState(0);
  const leftScrollRef = useRef(null);
  const rightScrollRef = useRef(null);
  const rightVerticalRef = useRef(null);
  const timelineScrollXRef = useRef(0);
  const scrollSyncRef = useRef(false);
  const prevVisibleRef = useRef(false);
  const hasScrolledOnceRef = useRef(false);
  const notifModalVisibleRef = useRef(false);

  const approvedProperties = properties.filter(p => !p.property_status || p.property_status === 'approved');
  const topLevel = approvedProperties.filter(p => !p.resort_id);
  const children = approvedProperties.filter(p => p.resort_id);
  const getParent = (id) => properties.find(pr => pr.id === id);

  const filterFn = useCallback((p, parent) => {
    if (!filterValues) return false;
    const f = filterValues;
    const cityVal = p.city ?? parent?.city;
    const districtVal = p.district ?? parent?.district;
    if (f.city && cityVal !== f.city) return false;
    if (f.districts?.length > 0 && !f.districts.includes(districtVal)) return false;
    const unitParentType = parent?.type;
    if (f.types?.length > 0) {
      const matches = f.types.some(typ => {
        if (typ === 'house') return !p.resort_id && HOUSE_LIKE_TYPES.has(p.type);
        if (typ === 'resort') return unitParentType === 'resort';
        if (typ === 'condo') return unitParentType === 'condo';
        return false;
      });
      if (!matches) return false;
    }
    if (f.bedrooms?.length > 0) {
      const br = p.bedrooms;
      if (br == null) return false;
      const matches = f.bedrooms.some(b => b === 5 ? br >= 5 : br === b);
      if (!matches) return false;
    }
    const price = p.price_monthly != null ? Number(p.price_monthly) : null;
    if (f.priceMin != null && (price == null || price < f.priceMin)) return false;
    if (f.priceMax != null && (price == null || price > f.priceMax)) return false;
    if (f.pets === true && !p.pets_allowed) return false;
    if (f.longTerm === true && !p.long_term_booking) return false;
    if (f.amenities?.length > 0) {
      const am = p.amenities || {};
      if (!f.amenities.every(k => am[k])) return false;
    }
    return true;
  }, [filterValues]);

  const { listToShow, uniqueCities, uniqueDistricts, hasActiveFilter } = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    let units = [];
    if (!filterValues && q) {
      // Только поиск, без фильтра — берём все объекты
      topLevel.filter(p => HOUSE_LIKE_TYPES.has(p.type)).forEach(p => {
        units.push({ ...p, _parentName: null, _parentCode: p.code });
      });
      children.forEach(p => {
        const parent = getParent(p.resort_id);
        units.push({ ...p, _parentName: parent?.name || '', _parentCode: parent?.code || '' });
      });
    } else {
      // Фильтр активен — применяем filterFn
      topLevel.filter(p => HOUSE_LIKE_TYPES.has(p.type)).forEach(p => {
        if (filterFn(p, null)) units.push({ ...p, _parentName: null, _parentCode: p.code });
      });
      children.forEach(p => {
        const parent = getParent(p.resort_id);
        if (filterFn(p, parent)) units.push({ ...p, _parentName: parent?.name || '', _parentCode: parent?.code || '' });
      });
    }

    let list = [...units].sort((a, b) => {
      const codeA = (a._parentCode ? a._parentCode + ' ' : '') + (a.code_suffix ?? a.code ?? '');
      const codeB = (b._parentCode ? b._parentCode + ' ' : '') + (b.code_suffix ?? b.code ?? '');
      return compareByCodeOrName({ code: codeA, name: a.name }, { code: codeB, name: b.name });
    });
    if (q) {
      list = list.filter((u) => {
        const parentCodePart = u._parentCode ? `${u._parentCode} ` : '';
        const codeSuffixPart = u.code_suffix ? ` (${u.code_suffix})` : '';
        const codeDisplay = `${parentCodePart}${u.code || ''}${codeSuffixPart}`.toLowerCase();
        const unitName = (u.name || '').toLowerCase();

        // Поиск по коду родителя (резорт/кондо) — показать всех детей
        const parentCode = (u._parentCode || '').toLowerCase();

        // Поиск по собственнику
        const owner = u.owner_id ? contacts.find(c => c.id === u.owner_id) : null;
        const owner2 = u.owner_id_2 ? contacts.find(c => c.id === u.owner_id_2) : null;
        const ownerName = `${owner?.name || ''} ${owner?.lastName || ''}`.trim().toLowerCase();
        const owner2Name = `${owner2?.name || ''} ${owner2?.lastName || ''}`.trim().toLowerCase();

        return unitName.includes(q) ||
               codeDisplay.includes(q) ||
               parentCode.includes(q) ||
               ownerName.includes(q) ||
               owner2Name.includes(q);
      });
    }
    if (propertyIdsFilter && propertyIdsFilter.length > 0) {
      const idSet = new Set(propertyIdsFilter);
      list = list.filter((u) => idSet.has(u.id));
    }
    const allCities = [
      ...topLevel.map(p => p.city),
      ...children.map(p => (getParent(p.resort_id)?.city ?? p.city)),
    ].filter(Boolean);
    const allDistricts = [
      ...topLevel.map(p => p.district),
      ...children.map(p => (getParent(p.resort_id)?.district ?? p.district)),
    ].filter(Boolean);
    const hasActive = Boolean(filterValues && (
      filterValues.city ||
      (filterValues.districts?.length ?? 0) > 0 ||
      (filterValues.types?.length ?? 0) > 0 ||
      (filterValues.bedrooms?.length ?? 0) > 0 ||
      filterValues.priceMin != null ||
      filterValues.priceMax != null ||
      filterValues.pets === true ||
      filterValues.longTerm === true ||
      (filterValues.amenities?.length ?? 0) > 0
    ));
    return {
      listToShow: list,
      uniqueCities: [...new Set(allCities)].sort(),
      uniqueDistricts: [...new Set(allDistricts)].sort(),
      hasActiveFilter: hasActive,
    };
  }, [topLevel, children, getParent, filterFn, filterValues, propertyIdsFilter, searchQuery]);

  const refreshBadge = useCallback(() => {
    getUnreadCount().then(setUnreadCount).catch(() => {});
    getTotalCount().then(setTotalCount).catch(() => {});
  }, []);

  useEffect(() => {
    notifModalVisibleRef.current = notifModalVisible;
  }, [notifModalVisible]);

  useEffect(() => {
    console.log('[BookingCalendar] effectiveVisible changed:', effectiveVisible, Date.now());
    if (!effectiveVisible || !user?.id) return;
    refreshBadge();
  }, [effectiveVisible, user?.id, refreshBadge]);

  const hasOpenedFilterOnce = useRef(false);

  useEffect(() => {
    if (effectiveVisible && !hasOpenedFilterOnce.current) {
      hasOpenedFilterOnce.current = true;
      setFilterVisible(true);
    }
  }, [effectiveVisible]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`notif-mobile-bookings-${user.id}`)
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

  const loadData = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      await Promise.all([refreshProperties(), refreshBookings()]);
    } catch (e) {
      console.error('BookingCalendar loadData error:', e);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [refreshProperties, refreshBookings]);

  useEffect(() => {
    if (prevVisibleRef.current && !effectiveVisible) {
      unstable_batchedUpdates(() => {
        setSelectedProperty(null);
        setSelectedBooking(null);
        setSelectedOwnerContact(null);
        setSelectedPropertyForDetail(null);
        setPreloadedProperty(null);
        setPreloadedContact(null);
        setAddModalVisible(false);
        setEditModalVisible(false);
      });
    }
    prevVisibleRef.current = effectiveVisible;
  }, [effectiveVisible]);

  const bookingsByProperty = React.useMemo(() => {
    const map = {};
    bookings.forEach(b => {
      if (!map[b.propertyId]) map[b.propertyId] = [];
      map[b.propertyId].push(b);
    });
    return map;
  }, [bookings]);

  const globalColorMap = React.useMemo(
    () => getGlobalColorMap(listToShow, bookingsByProperty),
    [listToShow, bookingsByProperty]
  );

  const leftColWidth = React.useMemo(() => {
    if (listToShow.length === 0) return MIN_COL_WIDTH;
    let maxLen = 0;
    listToShow.forEach((unit) => {
      const parent = unit.resort_id ? getParent(unit.resort_id) : null;
      const codeDisplay = parent
        ? (parent.code || '') + (unit.code_suffix ? ` (${unit.code_suffix})` : '')
        : (unit.code || '') + (unit.code_suffix ? ` (${unit.code_suffix})` : '');
      maxLen = Math.max(maxLen, String(codeDisplay).length);
    });
    const w = maxLen * CHAR_WIDTH + COL_PADDING;
    return Math.max(MIN_COL_WIDTH, Math.min(MAX_COL_WIDTH, w));
  }, [listToShow, getParent]);

  const months = React.useMemo(() => {
    const loc = language === 'ru' ? 'ru' : language === 'th' ? 'th' : 'en';
    const arr = [];
    for (let i = -3; i < NUM_MONTHS - 3; i++) {
      const d = dayjs().year(year).month(0).add(i, 'month').locale(loc);
      const raw = d.format('MMMM');
      arr.push({
        key: d.format('YYYY-MM'),
        year: d.year(),
        month: d.month(),
        label: raw ? raw[0].toUpperCase() + raw.slice(1) : raw,
      });
    }
    return arr;
  }, [year, language]);

  const initialScrollX = React.useMemo(() => {
    const curYear = dayjs().year();
    const curMonth = dayjs().month();
    const idx = months.findIndex(m => m.year === curYear && m.month === curMonth);
    if (idx < 0) return 0;
    // Текущий месяц сразу после первой колонки (не по центру)
    return Math.max(0, idx * MONTH_WIDTH);
  }, [months]);

  const todayLineX = React.useMemo(() => {
    if (months.length === 0) return -1;
    const timelineStart = dayjs().year(months[0].year).month(months[0].month).startOf('month');
    const timelineEnd = dayjs().year(months[months.length - 1].year).month(months[months.length - 1].month).endOf('month');
    const totalDays = Math.max(1, timelineEnd.diff(timelineStart, 'day') + 1);
    const today = dayjs();
    const dayIndex = today.diff(timelineStart, 'day');
    if (dayIndex < 0 || dayIndex >= totalDays) return -1;
    const rowWidth = months.length * MONTH_WIDTH;
    return (dayIndex / totalDays) * rowWidth;
  }, [months]);

  const getContactName = useCallback((contactId) => {
    if (!contactId) return '';
    const c = contacts.find(ct => ct.id === contactId);
    return c ? (`${(c.name || '').trim()} ${(c.lastName || '').trim()}`.trim() || c.phone || '') : '';
  }, [contacts]);

  const handleLeftScroll = (e) => {
    const y = e.nativeEvent.contentOffset.y;
    if (!scrollSyncRef.current && rightVerticalRef.current) {
      scrollSyncRef.current = true;
      rightVerticalRef.current.scrollTo({ y, animated: false });
      requestAnimationFrame(() => { scrollSyncRef.current = false; });
    }
  };

  const handleRightVerticalScroll = (e) => {
    const y = e.nativeEvent.contentOffset.y;
    if (!scrollSyncRef.current && leftScrollRef.current) {
      scrollSyncRef.current = true;
      leftScrollRef.current.scrollTo({ y, animated: false });
      requestAnimationFrame(() => { scrollSyncRef.current = false; });
    }
  };

  const rightScrollRefReady = useRef(false);
  const hasOpenedDetailRef = useRef(false);
  useEffect(() => {
    if (!rightScrollRefReady.current && rightScrollRef.current && initialScrollX > 0) {
      rightScrollRefReady.current = true;
      setTimeout(() => {
        rightScrollRef.current?.scrollTo({ x: initialScrollX, animated: false });
      }, 50);
    }
  }, [initialScrollX, listToShow.length]);

  useEffect(() => {
    if (effectiveVisible && rightScrollRef.current) {
      setTimeout(() => {
        if (!hasScrolledOnceRef.current) {
          hasScrolledOnceRef.current = true;
          rightScrollRef.current?.scrollTo({ x: initialScrollX, animated: false });
        } else {
          rightScrollRef.current?.scrollTo({ x: timelineScrollXRef.current, animated: false });
        }
      }, 50);
    }
  }, [effectiveVisible, initialScrollX]);

  // При возврате с экрана брони — прокрутить к текущему месяцу
  useEffect(() => {
    if (hasOpenedDetailRef.current && selectedBooking === null) {
      hasOpenedDetailRef.current = false;
      setTimeout(() => {
        rightScrollRef.current?.scrollTo({ x: initialScrollX, animated: false });
      }, 80);
    }
    if (selectedBooking) hasOpenedDetailRef.current = true;
  }, [selectedBooking, initialScrollX]);

  const handleAddPress = useCallback((property, monthKey) => {
    setSelectedProperty(property);
    setSelectedBooking(null);
    const isValidMonthKey = typeof monthKey === 'string' && /^\d{4}-\d{2}$/.test(monthKey);
    if (isValidMonthKey) {
      const [y, m] = monthKey.split('-').map(Number);
      if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
        setInitialMonth(null);
        setAddModalVisible(true);
        return;
      }
      setInitialMonth({ year: y, month: m - 1 });
    } else {
      setInitialMonth(null);
    }
    setAddModalVisible(true);
  }, []);

  const handleBookingPress = useCallback((booking, property) => {
    setInitialMonth(null);
    setEditModalVisible(false);

    const prop = booking?.propertyId ? properties.find(p => p.id === booking.propertyId) : null;
    const propResult = prop ? (() => {
      const resort = prop.resort_id ? (properties.find(p => p.id === prop.resort_id) || null) : null;
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
    })() : null;

    const contactResult = booking?.contactId
      ? (contacts.find(c => c.id === booking.contactId) || null)
      : null;

    setPreloadedProperty(propResult);
    setPreloadedContact(contactResult);
    setSelectedBooking(booking);
    setSelectedProperty(property);
    setDetailVisible(true);
  }, [properties, contacts]);

  const handleSaved = () => {
    loadData(false);
  };

  const currentYear = dayjs().year();
  const currentMonth = dayjs().month();
  const yearsForPicker = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#999" />
      </View>
    );
  }

  if (selectedPropertyForDetail) {
    const handleDeletePropertyDetail = () => {
      Alert.alert(t('pdDeleteTitle'), t('pdDeleteConfirm'), [
        { text: t('no'), style: 'cancel' },
        { text: t('yes'), style: 'destructive', onPress: async () => {
          try {
            await deleteProperty(selectedPropertyForDetail.id);
            setSelectedPropertyForDetail(null);
            handleSaved();
          } catch (e) {
            Alert.alert(t('error'), e?.message || String(e));
          }
        } },
      ]);
    };
    return (
      <PropertyDetailScreen
        property={selectedPropertyForDetail}
        onBack={() => setSelectedPropertyForDetail(null)}
        onDelete={handleDeletePropertyDetail}
        onPropertyUpdated={() => { handleSaved(); }}
        onSelectProperty={(prop) => setSelectedPropertyForDetail(prop)}
        user={user}
      />
    );
  }
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

  return (
    <View style={{ flex: 1 }}>

      {/* Слой 1: Гант-календарь — всегда в DOM, скрыт когда открыто бронирование */}
      <View style={{ flex: 1, opacity: detailVisible ? 0 : 1 }}
            pointerEvents={detailVisible ? 'none' : 'auto'}>
      <View style={styles.container}>
      {!embeddedInModal && (
        <View style={styles.fixedTop}>
          <View style={styles.header}>
            <View style={styles.headerActions} />
            <Text style={styles.headerTitle}>{t('bookingCalendar')}</Text>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => setNotifModalVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.bellIcon}>🔔</Text>
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
          <View style={styles.toolbarRow}>
            <View style={styles.searchWrap}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder={t('search')}
                placeholderTextColor="#999"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.searchClear}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={[styles.toolbarBtn, hasActiveFilter && styles.filterBtnActive]}
              activeOpacity={0.7}
              onPress={() => setFilterVisible(true)}
            >
              <Image
                source={require('../../assets/icon-filter.png')}
                style={[styles.toolbarBtnImage, hasActiveFilter && styles.filterIconActive]}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {listToShow.length === 0 ? (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>{t('calendarNoProperties')}</Text>
          </View>
        </TouchableWithoutFeedback>
      ) : (
        <View style={styles.calendarWrap}>
          <View style={styles.calendarRow}>
            <View style={[styles.leftColWrap, { width: leftColWidth }]}>
              <TouchableOpacity
                style={[styles.yearCell, styles.cornerCell]}
                onPress={() => setYearPickerVisible(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.yearText}>{year}</Text>
              </TouchableOpacity>
            <ScrollView
              ref={leftScrollRef}
              style={styles.leftCol}
              contentContainerStyle={styles.leftColContent}
              showsVerticalScrollIndicator={false}
              onScroll={handleLeftScroll}
              scrollEventThrottle={16}
              bounces={false}
            >
              {listToShow.map((unit) => {
                const parent = unit.resort_id ? getParent(unit.resort_id) : null;
                const codeDisplay = parent
                  ? (parent.code || '') + (unit.code_suffix ? ` (${unit.code_suffix})` : '')
                  : (unit.code || '') + (unit.code_suffix ? ` (${unit.code_suffix})` : '');
                return (
                  <TouchableOpacity
                    key={unit.id}
                    style={[styles.row, styles.propertyRow]}
                    onPress={() => setSelectedPropertyForDetail(unit)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.propertyLabel, styles.propertyLabelLink]} numberOfLines={1}>{codeDisplay}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            </View>

            <ScrollView
              ref={rightScrollRef}
              style={styles.rightArea}
              horizontal
              showsHorizontalScrollIndicator={true}
              contentContainerStyle={{ width: NUM_MONTHS * MONTH_WIDTH }}
              onScroll={(e) => {
                const x = e?.nativeEvent?.contentOffset?.x;
                timelineScrollXRef.current = Number.isFinite(x) ? x : 0;
              }}
              scrollEventThrottle={16}
            >
              <View style={{ width: NUM_MONTHS * MONTH_WIDTH, flexDirection: 'column' }}>
                <View style={styles.monthsHeader}>
                  {months.map((m) => {
                    const isPast = m.year < currentYear || (m.year === currentYear && m.month < currentMonth);
                    const isCurrent = m.year === currentYear && m.month === currentMonth;
                    return (
                      <View
                        key={m.key}
                        style={[
                          styles.monthCell,
                          isPast && styles.monthPast,
                          isCurrent && styles.monthCurrent,
                          !isPast && !isCurrent && styles.monthFuture,
                        ]}
                      >
                        <Text style={styles.monthLabel} numberOfLines={1}>
                          <Text style={styles.monthLabelBold}>{m.label}</Text>
                          <Text style={styles.monthYearRed}> {String(m.year % 100).padStart(2, '0')}</Text>
                        </Text>
                        <View style={styles.monthDivisions}>
                          <View style={styles.division} />
                          <View style={styles.division} />
                          <View style={styles.division} />
                        </View>
                      </View>
                    );
                  })}
                </View>

                <ScrollView
                  ref={rightVerticalRef}
                  style={styles.gridScroll}
                  contentContainerStyle={{ paddingBottom: BOTTOM_NAV_PADDING, position: 'relative' }}
                  showsVerticalScrollIndicator={true}
                  onScroll={handleRightVerticalScroll}
                  scrollEventThrottle={16}
                  bounces={false}
                >
                  {todayLineX >= 0 && (
                    <View
                      pointerEvents="none"
                      style={{
                        position: 'absolute',
                        left: todayLineX - 1,
                        top: 0,
                        height: listToShow.length * ROW_HEIGHT,
                        width: 2,
                        backgroundColor: 'rgba(255, 0, 0, 0.15)',
                      }}
                    />
                  )}
                  {(() => {
                    const canBook = user?.teamPermissions?.can_book;
                    const isAgent = !!(user?.teamMembership);
                    return listToShow.map((unit) => {
                      const canAddBooking = !readOnly && (!isAgent || canBook);
                      return (
                        <CalendarRow
                          key={unit.id}
                          unit={unit}
                          months={months}
                          monthWidth={MONTH_WIDTH}
                          rowHeight={ROW_HEIGHT}
                          currentYear={currentYear}
                          currentMonth={currentMonth}
                          bookings={bookingsByProperty[unit.id] || []}
                          getContactName={getContactName}
                          getOwnerLabel={getOwnerLabel}
                          globalColorMap={globalColorMap}
                          truncateLabel={truncateLabel}
                          timelineScrollXRef={timelineScrollXRef}
                          onCellPress={canAddBooking ? handleAddPress : undefined}
                          onBookingPress={handleBookingPress}
                          ownerLabels={{ full: t('ownerCustomer'), mid: t('ownerCustomerShort'), min: t('ownerCustomerMin') }}
                        />
                      );
                    });
                  })()}
                </ScrollView>
              </View>
            </ScrollView>
          </View>
        </View>
      )}

      <FilterBottomSheet
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        filter={filterValues}
        onApply={setFilterValues}
        cities={uniqueCities}
        districts={uniqueDistricts}
      />

      {yearPickerVisible && (
        <YearPickerModal
          visible={yearPickerVisible}
          years={yearsForPicker}
          currentYear={year}
          onSelect={(y) => {
            setYear(y);
            setYearPickerVisible(false);
          }}
          onClose={() => setYearPickerVisible(false)}
          t={t}
        />
      )}

      <AddBookingModal
        visible={addModalVisible}
        onClose={() => { setAddModalVisible(false); setSelectedProperty(null); setInitialMonth(null); }}
        onSaved={() => { setAddModalVisible(false); setSelectedProperty(null); setInitialMonth(null); handleSaved(); }}
        property={selectedProperty}
        initialMonth={initialMonth}
      />

      <PropertyNotificationsModal
        visible={notifModalVisible}
        onClose={() => setNotifModalVisible(false)}
        onBadgeUpdate={refreshBadge}
        refreshSignal={notifRefreshKey}
        onOpenProperty={(propertyId) => {
          if (!propertyId) return;
          const target = properties.find(p => p.id === propertyId);
          if (target) setSelectedPropertyForDetail(target);
        }}
      />

    </View>
      </View>

      {/* Слой 2: Детали бронирования — монтируется один раз, остаётся в DOM */}
      {selectedBooking && selectedProperty && (
        <View style={[StyleSheet.absoluteFill, { opacity: detailVisible ? 1 : 0 }]}
              pointerEvents={detailVisible ? 'auto' : 'none'}>
          <BookingDetailScreen
            booking={selectedBooking}
            propertyCode={(() => {
              const parent = selectedProperty.resort_id ? getParent(selectedProperty.resort_id) : null;
              const codeDisplay = parent
                ? (parent.code || '') + (selectedProperty.code_suffix ? ` (${selectedProperty.code_suffix})` : '')
                : (selectedProperty.code || '') + (selectedProperty.code_suffix ? ` (${selectedProperty.code_suffix})` : '');
              const propBookings = bookingsByProperty[selectedProperty.id] || [];
              return `${codeDisplay} ${getBookingNumber(selectedBooking, propBookings)}`;
            })()}
            initialProperty={preloadedProperty}
            initialContact={preloadedContact}
            onContactPress={(contact) => setSelectedOwnerContact(contact)}
            user={user}
            onBack={() => {
              setDetailVisible(false);
            }}
            onDelete={async (id) => {
              try {
                await cancelBookingReminders(id);
                await deleteBooking(id);
                setDetailVisible(false);
                setSelectedBooking(null);
                setSelectedProperty(null);
                setPreloadedProperty(null);
                setPreloadedContact(null);
                handleSaved();
              } catch (e) {
                Alert.alert(t('error'), e?.message || String(e));
              }
            }}
            onEdit={() => setEditModalVisible(true)}
          />
          <AddBookingModal
            visible={editModalVisible}
            onClose={() => setEditModalVisible(false)}
            onSaved={(updated) => {
              setEditModalVisible(false);
              if (updated) setSelectedBooking(updated);
              handleSaved();
            }}
            property={selectedProperty}
            editBooking={selectedBooking}
          />
        </View>
      )}

    </View>
  );
}

function YearPickerModal({ visible, years, currentYear, onSelect, onClose, t }) {
  if (!visible) return null;
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={yearPickerStyles.backdrop} onPress={onClose}>
        <View style={yearPickerStyles.box}>
          <Text style={yearPickerStyles.title}>{t('yearSelect')}</Text>
          {years.map((y) => (
            <TouchableOpacity
              key={y}
              style={[yearPickerStyles.option, y === currentYear && yearPickerStyles.optionActive]}
              onPress={() => onSelect(y)}
              activeOpacity={0.7}
            >
              <Text style={[yearPickerStyles.optionText, y === currentYear && yearPickerStyles.optionTextActive]}>{y}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={yearPickerStyles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={yearPickerStyles.closeText}>{t('close')}</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
}

const yearPickerStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  box: {
    width: 200,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2C2C2C',
    marginBottom: 12,
    textAlign: 'center',
  },
  option: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 6,
  },
  optionActive: {
    backgroundColor: 'rgba(46, 125, 50, 0.15)',
  },
  optionText: {
    fontSize: 16,
    color: '#2C2C2C',
    textAlign: 'center',
  },
  optionTextActive: {
    fontWeight: '700',
    color: '#2E7D32',
  },
  closeBtn: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  closeText: {
    fontSize: 15,
    color: '#888',
  },
});

const CalendarRow = React.memo(function CalendarRow({
  unit,
  months,
  monthWidth,
  rowHeight,
  bookings,
  getContactName,
  getOwnerLabel,
  globalColorMap,
  truncateLabel,
  timelineScrollXRef,
  onCellPress,
  onBookingPress,
  ownerLabels,
  currentYear,
  currentMonth,
}) {
  const [contactNames, setContactNames] = useState({});

  useEffect(() => {
    const names = {};
    bookings.forEach(b => {
      if (b.notMyCustomer || !b.contactId) return;
      names[b.id] = getContactName(b.contactId);
    });
    setContactNames(names);
  }, [bookings, getContactName]);

  const rowWidth = months.length * monthWidth;

  const resolveAbsolutePressX = (e) => {
    const localX = e?.nativeEvent?.locationX;
    const scrollX = timelineScrollXRef?.current;
    if (!Number.isFinite(localX) || !Number.isFinite(scrollX)) return null;
    const absoluteX = localX + scrollX;
    if (!Number.isFinite(absoluteX)) return null;
    return absoluteX;
  };

  const dateToPx = (d) => {
    const idx = months.findIndex(m => m.year === d.year() && m.month === d.month());
    if (idx >= 0) {
      const daysInMonth = d.daysInMonth();
      const dayOfMonth = d.date();
      return idx * monthWidth + ((dayOfMonth - 1) / daysInMonth) * monthWidth;
    }
    if (months.length === 0) return 0;
    const first = dayjs().year(months[0].year).month(months[0].month).startOf('month');
    if (d.isBefore(first)) return 0;
    return rowWidth;
  };

  return (
    <View style={[rowStyles.row, { height: rowHeight, width: rowWidth }]}>
      <Pressable
        style={{ flexDirection: 'row', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        onPress={onCellPress ? (e) => {
          const x = resolveAbsolutePressX(e);
          if (!Number.isFinite(x) || !Number.isFinite(monthWidth) || monthWidth <= 0 || months.length === 0) {
            onCellPress(unit, null);
            return;
          }
          const monthIdx = Math.floor(x / monthWidth);
          if (!Number.isInteger(monthIdx) || monthIdx < 0 || monthIdx >= months.length) {
            onCellPress(unit, null);
            return;
          }
          onCellPress(unit, months[monthIdx].key);
        } : undefined}
      >
        {months.map((m) => {
          const isPast = m.year < currentYear || (m.year === currentYear && m.month < currentMonth);
          const isCurrent = m.year === currentYear && m.month === currentMonth;
          const cellBg = isPast ? COLORS.monthPast : isCurrent ? COLORS.monthCurrent : COLORS.monthFuture;
          return (
            <View
              key={m.key}
              style={[rowStyles.cell, { width: monthWidth, backgroundColor: cellBg }]}
            />
          );
        })}
      </Pressable>
      {bookings.map((b) => {
        const checkInStr = typeof b.checkIn === 'string' && b.checkIn.length >= 10 ? b.checkIn.substring(0, 10) : b.checkIn;
        const checkOutStr = typeof b.checkOut === 'string' && b.checkOut.length >= 10 ? b.checkOut.substring(0, 10) : b.checkOut;
        const cin = dayjs(checkInStr);
        const cout = dayjs(checkOutStr);
        const leftPx = Math.max(0, dateToPx(cin));
        const rightPx = Math.min(rowWidth, dateToPx(cout.add(1, 'day')));
        const widthPx = Math.max(2, rightPx - leftPx);
        const rawColor = b.notMyCustomer ? COLORS.ownerBar : (globalColorMap[b.id] || PASTEL_COLORS[0]);
        const barColor = b.notMyCustomer ? rawColor : rawColor.replace(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i, (_, r, g, b) => `rgba(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)}, 0.6)`);
        const label = b.notMyCustomer
          ? getOwnerLabel(widthPx - 8, ownerLabels)
          : (contactNames[b.id] || '');
        const dayIn = `${String(cin.date()).padStart(2, '0')}.${String(cin.month() + 1).padStart(2, '0')}`;
        const dayOut = `${String(cout.date()).padStart(2, '0')}.${String(cout.month() + 1).padStart(2, '0')}`;
        const spaceForDates = 50;
        const labelMaxWidth = widthPx - 8;
        const labelNeedsWidth = label ? Math.min(label.length * 7, labelMaxWidth) : 0;
        const canShowDates = widthPx >= 70 && labelMaxWidth >= labelNeedsWidth + spaceForDates;
        const displayLabel = b.notMyCustomer ? label : truncateLabel(label, canShowDates ? labelMaxWidth - spaceForDates : labelMaxWidth - 4);

        return (
          <TouchableOpacity
            key={b.id}
            style={[
              rowStyles.bar,
              {
                left: leftPx,
                width: widthPx,
                backgroundColor: barColor,
                borderRadius: 17,
                borderWidth: 1,
                borderColor: 'rgba(107, 107, 107, 0.3)',
                zIndex: 10,
              },
            ]}
            onPress={onBookingPress ? (e) => {
              e.stopPropagation();
              onBookingPress(b, unit);
            } : undefined}
            activeOpacity={onBookingPress ? 0.8 : 1}
          >
            <View style={rowStyles.barInner}>
              {canShowDates && <Text style={[rowStyles.barDateText, rowStyles.barDateIn]}>{dayIn}</Text>}
              <Text style={[rowStyles.barText, rowStyles.barTextCenter]} numberOfLines={1}>{displayLabel}</Text>
              {canShowDates && <Text style={[rowStyles.barDateText, rowStyles.barDateOut]}>{dayOut}</Text>}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.18)',
  },
  cell: {
    height: '100%',
    borderRightWidth: 1,
    borderRightColor: 'rgba(0,0,0,0.18)',
  },
  bar: {
    position: 'absolute',
    top: 5,
    bottom: 5,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  barInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: 4,
  },
  barText: {
    fontSize: 11,
    color: '#2C2C2C',
    fontWeight: '700',
    textAlign: 'center',
  },
  barTextCenter: {
    flex: 1,
    textAlign: 'center',
    minWidth: 0,
  },
  barDateText: {
    fontSize: 11,
    fontWeight: '700',
  },
  barDateIn: {
    color: '#2E7D32',
  },
  barDateOut: {
    color: '#C62828',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  fixedTop: {
    paddingTop: TOP_INSET,
    paddingHorizontal: 20,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerActions: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.title,
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellIcon: {
    fontSize: 22,
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
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 16,
  },
  badgeRead: {
    backgroundColor: '#AAAAAA',
  },
  badgeTextRead: {
    color: '#FFFFFF',
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245,242,235,0.9)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0D8CC',
    paddingHorizontal: 12,
    height: 40,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.title,
    paddingVertical: 0,
  },
  searchClear: {
    fontSize: 14,
    color: '#999',
    paddingLeft: 6,
  },
  toolbarBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(245,242,235,0.9)',
    borderWidth: 1,
    borderColor: '#E0D8CC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarBtnImage: {
    width: 26,
    height: 26,
  },
  filterBtnActive: {
    shadowColor: '#5DB87A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 4,
  },
  filterIconActive: {
    shadowColor: '#5DB87A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.subtitle,
    textAlign: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(245,242,235,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarWrap: {
    flex: 1,
    flexDirection: 'row',
  },
  calendarRow: {
    flex: 1,
    flexDirection: 'row',
    minHeight: 0,
  },
  leftColWrap: {
    flexShrink: 0,
  },
  leftCol: {
    flex: 1,
  },
  leftColContent: {
    paddingBottom: BOTTOM_NAV_PADDING,
  },
  yearCell: {
    height: ROW_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    backgroundColor: COLORS.background,
  },
  cornerCell: {
    backgroundColor: '#EDE9E3',
  },
  yearText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.title,
  },
  propertyRow: {
    height: ROW_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    backgroundColor: COLORS.background,
  },
  propertyLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.title,
  },
  propertyLabelLink: {
    color: '#D81B60',
    textDecorationLine: 'underline',
  },
  rightArea: {
    flex: 1,
  },
  monthsHeader: {
    flexDirection: 'row',
    height: ROW_HEIGHT,
  },
  monthCell: {
    width: MONTH_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(0,0,0,0.18)',
    paddingHorizontal: 2,
  },
  monthPast: {
    backgroundColor: COLORS.monthPast,
  },
  monthCurrent: {
    backgroundColor: COLORS.monthCurrent,
  },
  monthFuture: {
    backgroundColor: COLORS.monthFuture,
  },
  monthLabel: {
    fontSize: 11,
    color: COLORS.title,
  },
  monthLabelBold: {
    fontWeight: '700',
  },
  monthYearRed: {
    fontWeight: '700',
    color: '#E53935',
  },
  monthDivisions: {
    position: 'absolute',
    bottom: 2,
    left: 4,
    right: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  division: {
    width: 1,
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  gridScroll: {
    flex: 1,
  },
});
