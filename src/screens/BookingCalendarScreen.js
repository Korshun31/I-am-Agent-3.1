import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Pressable,
  Dimensions,
  Alert,
  TextInput,
  unstable_batchedUpdates,
  Keyboard,
  Animated,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Defs, Pattern, Line as SvgLine, Rect, Text as SvgText } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import 'dayjs/locale/th';
import { useLanguage } from '../context/LanguageContext';
import { useAppData } from '../context/AppDataContext';
import { useUser } from '../context/UserContext';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { FONT } from '../utils/scale';
import { compareCode } from '../utils/codeSort';
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
import { TAB_BAR_CONTENT_HEIGHT } from '../components/BottomNav';

const TOP_INSET = (Constants.statusBarHeight ?? 44) + 12;
const ROW_HEIGHT = 45;
const CHAR_WIDTH = 7;
const COL_PADDING = 20;
const MIN_COL_WIDTH = 100;
const MAX_COL_WIDTH = 150;
const MONTH_WIDTH = 100; // 83 + 20%
// Дневной режим: единица — неделя (7 дней внутри). Подключится в следующем подшаге.
const DAY_WIDTH = 28;
const WEEK_WIDTH = DAY_WIDTH * 7; // 196
const VIEW_MODE_STORAGE_KEY = 'bookingCalendar:viewMode';
const HOUSE_LIKE_TYPES = new Set(['house', 'resort_house', 'condo_apartment']);
// 6 приглушённых цветов вместо 16 кислотных. Каждый читается на белом и сером фоне,
// различим между соседями по строке. На гант-таймлайне цвет нужен для различия
// соседних броней одного объекта, не для уникальной идентификации каждой брони.
const PASTEL_COLORS = [
  '#B5CDE3',  // пыльно-синий
  '#B8D4B8',  // шалфейно-зелёный
  '#E3C9A3',  // тёплый песочный
  '#C5B8D4',  // лавандовый
  '#B8D0D0',  // дымчатый teal
  '#D4C4B0',  // какао-бежевый
];
// Пастельно-красный для выходных дней (суббота/воскресенье) в шапке D режима.
const WEEKEND_TEXT_COLOR = '#C97A7A';

const COLORS = {
  background:   '#F5F5F7',
  title:        '#2C2C2C',
  subtitle:     '#6B6B6B',
  monthPast:    '#EFEFF1',
  monthCurrent: 'rgba(61,125,130,0.10)',
  monthFuture:  '#FFFFFF',
  border:       '#E5E5EA',
  searchBg:     'rgba(255,255,255,0.9)',
  searchBorder: '#E5E5EA',
  ownerBar:     '#D4D4D4',
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

function compareByCodeOrName(a, b) {
  const codeA = (a.code || a.name || '').trim();
  const codeB = (b.code || b.name || '').trim();
  return compareCode(codeA, codeB);
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
  const { user } = useUser();
  const isFocused = useIsFocused();
  const effectiveVisible = embeddedInModal ? isVisible : isFocused;
  const insets = useSafeAreaInsets();
  const bottomNavPadding = insets.bottom + TAB_BAR_CONTENT_HEIGHT + 12;
  const { t, language } = useLanguage();
  const { properties, bookings, contacts, propertiesLoading, bookingsLoading, refreshProperties, refreshBookings } = useAppData();

  useEffect(() => {
    onReady?.();
  }, []);
  const [filterVisible, setFilterVisible] = useState(false);
  const [filterValues, setFilterValues] = useState(null);
  const [loading, setLoading] = useState(false);
  // Месяц/год по центру видимой ленты — общий стейт для обоих режимов.
  // Используется в левой верхней ячейке как «2026» (M) или «05.2026» (D).
  // setState вызывается через ref-сравнение, не на каждый кадр прокрутки.
  const [centerYearMonth, setCenterYearMonth] = useState(() => {
    const d = dayjs();
    return { year: d.year(), month: d.month() };
  });
  const lastMonthKeyRef = useRef(null);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [preloadedProperty, setPreloadedProperty] = useState(null);
  const [preloadedContact, setPreloadedContact] = useState(null);
  const [selectedOwnerContact, setSelectedOwnerContact] = useState(null);
  const [selectedPropertyForDetail, setSelectedPropertyForDetail] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'day'
  const [viewModeReady, setViewModeReady] = useState(false);
  const [notifModalVisible, setNotifModalVisible] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [notifRefreshKey, setNotifRefreshKey] = useState(0);
  const rightScrollRef = useRef(null);
  const timelineScrollXRef = useRef(0);
  const prevVisibleRef = useRef(false);
  const hasScrolledOnceRef = useRef(false);
  // Отдельный флаг для onContentSizeChange — не зависит от hasScrolledOnceRef.
  // Гарантирует доскролл к сегодня после того как ScrollView сообщил о готовом
  // contentSize, даже если ранний эффект пытался scrollTo при contentSize=0
  // и не попал.
  const initialContentScrollDoneRef = useRef(false);
  const notifModalVisibleRef = useRef(false);

  // TD: вертикальная синхронизация левой колонки с правым таймлайном через
  // нативную анимацию (без bridge), чтобы левая ехала плавно на больших списках.
  const scrollY = useRef(new Animated.Value(0)).current;
  const onVerticalScroll = useRef(
    Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })
  ).current;

  // После упрощения модели прав модерация снята — все объекты считаются одобренными.
  // Один проход по properties: получаем topLevel, children и Map для O(1) поиска родителя.
  // Раньше эти три значения пересоздавались каждый рендер, ломая мемоизацию listToShow.
  const { topLevel, children, parentMap } = useMemo(() => {
    const top = [];
    const kids = [];
    const map = new Map();
    (properties || []).forEach((p) => {
      map.set(p.id, p);
      if (p.parent_id) kids.push(p);
      else top.push(p);
    });
    return { topLevel: top, children: kids, parentMap: map };
  }, [properties]);
  const getParent = useCallback((id) => parentMap.get(id), [parentMap]);

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
        if (typ === 'house') return !p.parent_id && HOUSE_LIKE_TYPES.has(p.type);
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

  // Префильтр по умолчанию: дома где есть актуальная бронь (идущая сейчас или
  // будущая). Применяется только пока юзер не открыл модалку и не применил
  // свой фильтр (filterValues=null). Возвращает null пока брони ещё грузятся,
  // чтобы не мигать «нет броней» (в этом случае показываем всё).
  const propertyIdsWithActiveBooking = React.useMemo(() => {
    if (bookingsLoading) return null;
    const todayStr = new Date().toISOString().slice(0, 10);
    const set = new Set();
    (bookings || []).forEach((b) => {
      if (!b.checkOut) return;
      if (b.checkOut < todayStr) return;
      if (b.notMyCustomer) return; // брони от собственника не считаются «моими»
      set.add(b.propertyId);
    });
    return set;
  }, [bookings, bookingsLoading]);

  const { listToShow, uniqueCities, uniqueDistricts, hasActiveFilter } = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    // Префильтр «Мои бронирования / Бронирования компании» по умолчанию ВКЛ.
    // Юзер может выключить через чекбокс в модалке фильтров — тогда myBookings === false.
    // Если календарь открыт «изнутри» карточки (propertyIdsFilter задан) — префильтр
    // выключаем, иначе объекты без актуальных броней отсекаются и пустые строки не видны.
    const myBookingsOn = !filterValues || filterValues.myBookings !== false;
    const hasDirectIdsFilter = !!(propertyIdsFilter && propertyIdsFilter.length > 0);
    const prefilterActive = myBookingsOn && propertyIdsWithActiveBooking !== null && !hasDirectIdsFilter;

    let units = [];
    if (filterValues) {
      // Юзер открыл модалку и применил фильтр — работает старая filterFn,
      // префильтр по бронированиям выключается (юзер увидит ровно то, что
      // выбрал).
      topLevel.filter(p => HOUSE_LIKE_TYPES.has(p.type)).forEach(p => {
        if (filterFn(p, null)) units.push({ ...p, _parentName: null, _parentCode: p.code });
      });
      children.forEach(p => {
        const parent = getParent(p.parent_id);
        if (filterFn(p, parent)) units.push({ ...p, _parentName: parent?.name || '', _parentCode: parent?.code || '' });
      });
    } else {
      // Без ручного фильтра — берём все юниты. Дальше префильтр по
      // бронированиям сузит, либо (если брони ещё грузятся) покажем всё.
      topLevel.filter(p => HOUSE_LIKE_TYPES.has(p.type)).forEach(p => {
        units.push({ ...p, _parentName: null, _parentCode: p.code });
      });
      children.forEach(p => {
        const parent = getParent(p.parent_id);
        units.push({ ...p, _parentName: parent?.name || '', _parentCode: parent?.code || '' });
      });
    }

    if (prefilterActive) {
      units = units.filter((u) => propertyIdsWithActiveBooking.has(u.id));
      // Агент видит только дома где он указан как ответственный за объект.
      // Админ — все актуальные дома компании.
      if (user?.isAgentRole && !user?.isAdminRole && user?.id) {
        units = units.filter((u) => u.responsible_agent_id === user.id);
      }
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
      ...children.map(p => (getParent(p.parent_id)?.city ?? p.city)),
    ].filter(Boolean);
    const allDistricts = [
      ...topLevel.map(p => p.district),
      ...children.map(p => (getParent(p.parent_id)?.district ?? p.district)),
    ].filter(Boolean);
    const hasActive = Boolean(myBookingsOn || (filterValues && (
      filterValues.city ||
      (filterValues.districts?.length ?? 0) > 0 ||
      (filterValues.types?.length ?? 0) > 0 ||
      (filterValues.bedrooms?.length ?? 0) > 0 ||
      filterValues.priceMin != null ||
      filterValues.priceMax != null ||
      filterValues.pets === true ||
      filterValues.longTerm === true ||
      (filterValues.amenities?.length ?? 0) > 0
    )));
    return {
      listToShow: list,
      uniqueCities: [...new Set(allCities)].sort(),
      uniqueDistricts: [...new Set(allDistricts)].sort(),
      hasActiveFilter: hasActive,
    };
  }, [topLevel, children, getParent, filterFn, filterValues, propertyIdsFilter, searchQuery, propertyIdsWithActiveBooking, user?.id, user?.isAgentRole, user?.isAdminRole]);

  const refreshBadge = useCallback(() => {
    getUnreadCount().then(setUnreadCount).catch(() => {});
    getTotalCount().then(setTotalCount).catch(() => {});
  }, []);

  useEffect(() => {
    notifModalVisibleRef.current = notifModalVisible;
  }, [notifModalVisible]);

  // Восстанавливаем сохранённый режим календаря при первом монтировании.
  // Флаг viewModeReady блокирует рендер ленты до завершения чтения, чтобы
  // эффекты прокрутки не успели сработать на дефолтном режиме и потом не
  // дёргать геометрию задним числом, если сохранён другой режим.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(VIEW_MODE_STORAGE_KEY)
      .then((saved) => {
        if (cancelled) return;
        if (saved === 'month' || saved === 'day') setViewMode(saved);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setViewModeReady(true);
      });
    return () => { cancelled = true; };
  }, []);

  // Уникальный id для SVG-паттерна делителей дней. Несколько экземпляров экрана
  // не должны коллизировать по id внутри одного React-дерева.
  const dayDividerPatternId = `dd-${React.useId()}`;
  const headerDayDividerPatternId = `hdd-${React.useId()}`;

  const handleViewModeChange = useCallback((next) => {
    if (next !== 'month' && next !== 'day') return;
    if (next === viewMode) return;
    // При смене режима сбрасываем «уже прокрутили» и текущую позицию, чтобы
    // эффект скролла после ре-рендера отработал на новой initialScrollX.
    hasScrolledOnceRef.current = false;
    initialContentScrollDoneRef.current = false;
    timelineScrollXRef.current = 0;
    setViewMode(next);
    AsyncStorage.setItem(VIEW_MODE_STORAGE_KEY, next).catch(() => {});
  }, [viewMode]);

  useEffect(() => {
    if (!effectiveVisible || !user?.id) return;
    refreshBadge();
  }, [effectiveVisible, user?.id, refreshBadge]);

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
        setDetailVisible(false);
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
      const parent = unit.parent_id ? getParent(unit.parent_id) : null;
      const codeDisplay = parent
        ? (parent.code || '') + (unit.code_suffix ? ` (${unit.code_suffix})` : '')
        : (unit.code || '') + (unit.code_suffix ? ` (${unit.code_suffix})` : '');
      maxLen = Math.max(maxLen, String(codeDisplay).length);
    });
    const w = maxLen * CHAR_WIDTH + COL_PADDING;
    return Math.max(MIN_COL_WIDTH, w);
  }, [listToShow, getParent]);

  // Геометрия ленты: единая точка правды для ширины одной единицы и их количества.
  const months = React.useMemo(() => {
    const loc = language === 'ru' ? 'ru' : language === 'th' ? 'th' : 'en';
    const base = dayjs().startOf('month');
    const arr = [];
    // 6 месяцев назад + текущий + 12 вперёд = 19 единиц.
    for (let i = -6; i <= 12; i++) {
      const d = base.add(i, 'month').locale(loc);
      const raw = d.format('MMM');
      arr.push({
        key: d.format('YYYY-MM'),
        year: d.year(),
        month: d.month(),
        label: raw ? raw[0].toUpperCase() + raw.slice(1) : raw,
      });
    }
    return arr;
  }, [language]);

  // Массив недель для дневного режима. Старт — понедельник недели, в которую
  // попадает «сегодня минус 3 месяца». Конец — последний день месяца через
  // 12 месяцев от текущего. Понедельник считается вручную (без плагина isoWeek),
  // потому что в dayjs startOf('week') зависит от локали.
  // Label показывает диапазон «12-18 май» или «28 апр-4 май» если неделя
  // пересекает границу месяца. key — дата понедельника, по нему позиционируем.
  const weeks = React.useMemo(() => {
    const loc = language === 'ru' ? 'ru' : language === 'th' ? 'th' : 'en';
    const today = dayjs();
    const back = today.subtract(3, 'month').startOf('day');
    const backDow = back.day();
    const backOffsetToMonday = backDow === 0 ? -6 : 1 - backDow;
    const firstMonday = back.add(backOffsetToMonday, 'day');
    const forwardEnd = today.add(12, 'month').endOf('month');
    const totalDays = forwardEnd.diff(firstMonday, 'day') + 1;
    const numWeeks = Math.ceil(totalDays / 7);
    const arr = [];
    for (let i = 0; i < numWeeks; i++) {
      const start = firstMonday.add(i * 7, 'day').locale(loc);
      const end = start.add(6, 'day');
      const sameMonth = start.month() === end.month();
      const label = sameMonth
        ? `${start.format('D')}-${end.format('D MMM')}`
        : `${start.format('D MMM')}-${end.format('D MMM')}`;
      arr.push({
        key: start.format('YYYY-MM-DD'),
        startDate: start.format('YYYY-MM-DD'),
        endDate: end.format('YYYY-MM-DD'),
        year: start.year(),
        label,
      });
    }
    return arr;
  }, [language]);

  // Геометрия ленты: единая точка правды для ширины одной единицы и их количества.
  // M — единица «месяц» (100px). D — «неделя» (196px), внутри 7 столбиков-дней.
  const unitWidth = viewMode === 'day' ? WEEK_WIDTH : MONTH_WIDTH;
  const unitCount = viewMode === 'day' ? weeks.length : months.length;
  const totalWidth = unitCount * unitWidth;

  // Функция позиции брони на ленте — общая для обеих веток. Объявляется ПОСЛЕ
  // months/weeks/totalWidth (TDZ): deps useCallback читаются при выполнении.
  const dateToPx = useCallback((d) => {
    if (viewMode === 'day') {
      const startStr = weeks[0]?.startDate;
      if (!startStr) return 0;
      const start = dayjs(startStr);
      const days = d.diff(start, 'day');
      if (days < 0) return 0;
      const maxDays = weeks.length * 7;
      if (days >= maxDays) return totalWidth;
      return days * DAY_WIDTH;
    }
    const idx = months.findIndex(m => m.year === d.year() && m.month === d.month());
    if (idx >= 0) {
      const daysInMonth = d.daysInMonth();
      const dayOfMonth = d.date();
      return idx * MONTH_WIDTH + ((dayOfMonth - 1) / daysInMonth) * MONTH_WIDTH;
    }
    if (months.length === 0) return 0;
    const first = dayjs().year(months[0].year).month(months[0].month).startOf('month');
    if (d.isBefore(first)) return 0;
    return totalWidth;
  }, [viewMode, months, weeks, totalWidth]);

  // Полудневный сдвиг полоски брони — D-режим делит стыковой столбик пополам.
  const bookingBarInset = viewMode === 'day' ? DAY_WIDTH / 2 : 0;

  // Прекомпьют дня ленты в день/месяц/год для двух вещей:
  // — SVG-числа в шапке D режима (`date`)
  // — определение «текущего месяца по центру» в onScroll (через dayIdx из x).
  // Считается один раз при смене языка/режима, чтобы не дёргать dayjs() 60 раз/сек.
  const monthOfDay = React.useMemo(() => {
    if (viewMode !== 'day') return null;
    const startStr = weeks[0]?.startDate;
    if (!startStr) return null;
    const start = dayjs(startStr);
    const total = weeks.length * 7;
    const arr = new Array(total);
    for (let i = 0; i < total; i++) {
      const d = start.add(i, 'day');
      arr[i] = { year: d.year(), month: d.month(), date: d.date(), dow: d.day() };
    }
    return arr;
  }, [viewMode, weeks]);

  const initialScrollX = React.useMemo(() => {
    // Центрируем «сегодня» в видимой части ленты (экран минус левая колонка).
    const viewportW = Math.max(1, SCREEN_WIDTH - leftColWidth);
    if (viewMode === 'day') {
      const startStr = weeks[0]?.startDate;
      if (!startStr) return 0;
      const start = dayjs(startStr);
      const todayIdx = dayjs().startOf('day').diff(start, 'day');
      if (todayIdx < 0) return 0;
      const todayCenter = todayIdx * DAY_WIDTH + DAY_WIDTH / 2;
      return Math.max(0, todayCenter - viewportW / 2);
    }
    const curYear = dayjs().year();
    const curMonth = dayjs().month();
    const idx = months.findIndex(m => m.year === curYear && m.month === curMonth);
    if (idx < 0) return 0;
    const monthCenter = idx * unitWidth + unitWidth / 2;
    return Math.max(0, monthCenter - viewportW / 2);
  }, [months, weeks, viewMode, unitWidth, leftColWidth]);

  useEffect(() => {
    if (timelineScrollXRef.current === 0) {
      timelineScrollXRef.current = initialScrollX;
    }
  }, [initialScrollX]);

  const todayLineX = React.useMemo(() => {
    if (viewMode === 'day') return -1; // в дневном «сегодня» уже подсвечен столбиком DAY_WIDTH
    if (months.length === 0) return -1;
    const timelineStart = dayjs().year(months[0].year).month(months[0].month).startOf('month');
    const timelineEnd = dayjs().year(months[months.length - 1].year).month(months[months.length - 1].month).endOf('month');
    const totalDays = Math.max(1, timelineEnd.diff(timelineStart, 'day') + 1);
    const today = dayjs();
    const dayIndex = today.diff(timelineStart, 'day');
    if (dayIndex < 0 || dayIndex >= totalDays) return -1;
    const rowWidth = totalWidth;
    return (dayIndex / totalDays) * rowWidth;
  }, [months, viewMode, totalWidth]);

  // contactNamesByBookingId: считаем имена клиентов один раз для всех броней
  // вместо setState на каждом ряду (раньше CalendarRow делал useState+useEffect
  // и пересчитывал при каждом mount — на 50 рядах было 50 лишних апдейтов).
  const contactNamesByBookingId = useMemo(() => {
    const contactsMap = new Map();
    (contacts || []).forEach((c) => { contactsMap.set(c.id, c); });
    const out = {};
    (bookings || []).forEach((b) => {
      if (b.notMyCustomer || !b.contactId) return;
      const c = contactsMap.get(b.contactId);
      if (!c) return;
      const fullName = `${(c.name || '').trim()} ${(c.lastName || '').trim()}`.trim();
      out[b.id] = fullName || c.phone || '';
    });
    return out;
  }, [bookings, contacts]);


  // Единственная точка управления горизонтальной прокруткой. Раньше за scrollTo
  // конкурировали пять разных useEffect, которые при смене режима/возврате с
  // деталей могли срабатывать в неопределённом порядке. Теперь приоритеты явные:
  //  1) первый раз (включая после смены режима) — initialScrollX
  //  2) только что закрыли детали брони — initialScrollX
  //  3) иначе — восстановить сохранённую позицию из timelineScrollXRef
  const prevSelectedBookingRef = useRef(null);
  useEffect(() => {
    if (!effectiveVisible || !rightScrollRef.current) {
      prevSelectedBookingRef.current = selectedBooking;
      return;
    }
    if (listToShow.length === 0) {
      prevSelectedBookingRef.current = selectedBooking;
      return;
    }
    const bookingJustClosed = prevSelectedBookingRef.current !== null && selectedBooking === null;
    prevSelectedBookingRef.current = selectedBooking;

    let targetX;
    if (!hasScrolledOnceRef.current) {
      hasScrolledOnceRef.current = true;
      targetX = initialScrollX;
    } else if (bookingJustClosed) {
      targetX = initialScrollX;
    } else {
      targetX = timelineScrollXRef.current > 0
        ? timelineScrollXRef.current
        : initialScrollX;
    }

    const id = requestAnimationFrame(() => {
      rightScrollRef.current?.scrollTo({ x: targetX, animated: false });
    });
    return () => cancelAnimationFrame(id);
  }, [effectiveVisible, initialScrollX, selectedBooking, selectedPropertyForDetail, listToShow.length]);

  const handleAddPress = useCallback((property) => {
    setSelectedProperty(property);
    setSelectedBooking(null);
    setAddModalVisible(true);
  }, []);

  const handleBookingPress = useCallback((booking, property) => {
    // TD-085: агент видит только свои брони. Чужие (другого агента или брони компании)
    // открывать нельзя — детали с именем клиента, телефоном, ценой и комиссиями скрыты.
    const isAgent = !!user?.teamMembership;
    if (isAgent && booking?.responsibleAgentId !== user?.id) {
      return;
    }

    setEditModalVisible(false);

    const prop = booking?.propertyId ? properties.find(p => p.id === booking.propertyId) : null;
    const propResult = prop ? (() => {
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
        ownerWhatsapp: owner?.whatsapp || '',
        owner2Name: owner2 ? `${owner2.name} ${owner2.lastName}`.trim() : '',
        owner2Phone1: owner2?.phone || '',
        owner2Phone2: owner2?.extraPhones?.[0] || '',
        owner2Telegram: owner2?.telegram || '',
        owner2Whatsapp: owner2?.whatsapp || '',
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
  }, [properties, contacts, user]);

  const handleSaved = () => {
    loadData(false);
  };

  const currentYear = dayjs().year();
  const currentMonth = dayjs().month();

  if (loading || !viewModeReady) {
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
        <View style={[styles.fixedTop, { paddingHorizontal: SCREEN_WIDTH < 390 ? 16 : 20 }]}>
          <View style={styles.header}>
            <View style={styles.headerActions} />
            <Text style={styles.headerTitle}>{t('bookingCalendar')}</Text>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => setNotifModalVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={unreadCount > 0 ? 'notifications' : 'notifications-outline'}
                size={22}
                color={unreadCount > 0 ? '#3D7D82' : '#888'}
              />
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
              <Ionicons name="search-outline" size={FONT.body} color="#999" style={styles.searchIconIon} />
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
                  <Ionicons name="close-circle" size={16} color="#BBBBBB" />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={[styles.toolbarBtn, hasActiveFilter && styles.filterBtnActive]}
              activeOpacity={0.7}
              onPress={() => setFilterVisible(true)}
            >
              <Ionicons name="funnel-outline" size={18} color={hasActiveFilter ? '#3D7D82' : '#888'} />
            </TouchableOpacity>
            <View style={styles.viewModeWrap}>
              <TouchableOpacity
                style={[styles.viewModeBtn, viewMode === 'month' && styles.viewModeBtnActiveLeft]}
                activeOpacity={0.7}
                onPress={() => handleViewModeChange('month')}
              >
                <Text style={[styles.viewModeText, viewMode === 'month' && styles.viewModeTextActive]}>M</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.viewModeBtn, viewMode === 'day' && styles.viewModeBtnActiveRight]}
                activeOpacity={0.7}
                onPress={() => handleViewModeChange('day')}
              >
                <Text style={[styles.viewModeText, viewMode === 'day' && styles.viewModeTextActive]}>D</Text>
              </TouchableOpacity>
            </View>
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
              <View style={[styles.yearCell, styles.cornerCell]}>
                {viewMode === 'day' ? (() => {
                  const raw = dayjs().year(centerYearMonth.year).month(centerYearMonth.month).format('MMM');
                  const monthLabel = raw.charAt(0).toUpperCase() + raw.slice(1);
                  const yy = String(centerYearMonth.year).slice(-2);
                  return (
                    <Text style={styles.yearText}>
                      {monthLabel} <Text style={{ color: WEEKEND_TEXT_COLOR }}>{yy}</Text>
                    </Text>
                  );
                })() : (
                  <Text style={styles.yearText}>{centerYearMonth.year}</Text>
                )}
              </View>
            <View style={[styles.leftCol, { overflow: 'hidden' }]}>
              <Animated.View
                style={[
                  styles.leftColContent,
                  { paddingBottom: bottomNavPadding, transform: [{ translateY: Animated.multiply(scrollY, -1) }] },
                ]}
              >
                {listToShow.map((unit) => {
                  const parent = unit.parent_id ? getParent(unit.parent_id) : null;
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
              </Animated.View>
            </View>
            </View>

            <ScrollView
              ref={rightScrollRef}
              style={styles.rightArea}
              horizontal
              showsHorizontalScrollIndicator={true}
              contentContainerStyle={{ width: totalWidth }}
              onContentSizeChange={(w) => {
                // Доcкролл к сегодня после первого готового layout. Использует
                // СВОЙ флаг, не hasScrolledOnceRef — ранний эффект мог уже
                // выставить hasScrolledOnceRef в true даже если physical
                // scrollTo промахнулся (contentSize был 0). Здесь мы точно
                // знаем, что лента шириной w готова.
                if (!initialContentScrollDoneRef.current && w > 0 && initialScrollX > 0) {
                  initialContentScrollDoneRef.current = true;
                  rightScrollRef.current?.scrollTo({ x: initialScrollX, animated: false });
                }
              }}
              onScroll={(e) => {
                const x = e?.nativeEvent?.contentOffset?.x;
                timelineScrollXRef.current = Number.isFinite(x) ? x : 0;
                const viewportW = e?.nativeEvent?.layoutMeasurement?.width;
                if (!Number.isFinite(viewportW) || viewportW <= 0) return;
                const centerX = (Number.isFinite(x) ? x : 0) + viewportW / 2;
                let idx = Math.floor(centerX / unitWidth);
                if (idx < 0) idx = 0;
                if (idx > unitCount - 1) idx = unitCount - 1;
                // Месяц/год по центру — обновляем стейт только при пересечении
                // границы месяца. Ref-сравнение защищает от setState 60 раз/сек.
                let nextKey = null;
                if (viewMode === 'day' && monthOfDay) {
                  const dayIdx = Math.floor(centerX / DAY_WIDTH);
                  if (dayIdx >= 0 && dayIdx < monthOfDay.length) {
                    const entry = monthOfDay[dayIdx];
                    nextKey = `${entry.year}-${entry.month}`;
                  }
                } else if (viewMode === 'month' && months[idx]) {
                  const m = months[idx];
                  nextKey = `${m.year}-${m.month}`;
                }
                if (nextKey && nextKey !== lastMonthKeyRef.current) {
                  lastMonthKeyRef.current = nextKey;
                  const [y, mo] = nextKey.split('-').map(Number);
                  setCenterYearMonth({ year: y, month: mo });
                }
              }}
              scrollEventThrottle={16}
            >
              <View style={{ width: totalWidth, flexDirection: 'column' }}>
                <View style={styles.monthsHeader}>
                  {viewMode === 'day' ? (
                    <>
                      {weeks.map((w) => (
                        <View key={w.key} style={[styles.monthCell, styles.monthFuture, { width: WEEK_WIDTH }]} />
                      ))}
                      {/* 490 чисел дней одним SVG-слоем — нативный рендер, шапка
                          не дёргается при горизонтальном скролле. */}
                      {monthOfDay && (
                        <Svg
                          style={{ position: 'absolute', top: 0, left: 0 }}
                          width={totalWidth}
                          height={ROW_HEIGHT}
                          pointerEvents="none"
                        >
                          <Defs>
                            <Pattern
                              id={headerDayDividerPatternId}
                              width={DAY_WIDTH}
                              height={ROW_HEIGHT}
                              patternUnits="userSpaceOnUse"
                            >
                              <SvgLine
                                x1={DAY_WIDTH - 0.5}
                                y1="0"
                                x2={DAY_WIDTH - 0.5}
                                y2={ROW_HEIGHT}
                                stroke="rgba(0,0,0,0.06)"
                                strokeWidth="1"
                              />
                            </Pattern>
                          </Defs>
                          <Rect width={totalWidth} height={ROW_HEIGHT} fill={`url(#${headerDayDividerPatternId})`} />
                          {monthOfDay.map((entry, i) => {
                            const isWeekend = entry.dow === 0 || entry.dow === 6;
                            return (
                              <SvgText
                                key={i}
                                x={i * DAY_WIDTH + DAY_WIDTH / 2}
                                y={ROW_HEIGHT / 2 + 4}
                                textAnchor="middle"
                                fontSize="12"
                                fill={isWeekend ? WEEKEND_TEXT_COLOR : COLORS.title}
                              >
                                {entry.date}
                              </SvgText>
                            );
                          })}
                        </Svg>
                      )}
                    </>
                  ) : (
                    months.map((m) => {
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
                    })
                  )}
                </View>

                <Animated.ScrollView
                  style={styles.gridScroll}
                  contentContainerStyle={{ paddingBottom: bottomNavPadding, position: 'relative' }}
                  showsVerticalScrollIndicator={true}
                  onScroll={onVerticalScroll}
                  scrollEventThrottle={16}
                  bounces={false}
                >
                  {/* Общий фоновый слой сетки за всеми строками сразу:
                      подсветка прошлых/текущего месяцев + вертикальные разделители месяцев.
                      Раньше каждая строка рисовала 24 ячейки фона (~1200 элементов на 50 объектов).
                      Теперь — 24 разделителя + 1-2 подсветки общим слоем независимо от числа строк. */}
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: totalWidth,
                      height: listToShow.length * ROW_HEIGHT,
                    }}
                  >
                    {viewMode === 'day' ? (() => {
                      // Дневной режим: подсветка прошлое/сегодня двумя прямоугольниками,
                      // вместо 16 квадратов месяцев. Старт ленты — startDate первой недели.
                      const startStr = weeks[0]?.startDate;
                      if (!startStr) return null;
                      const start = dayjs(startStr);
                      const totalDays = weeks.length * 7;
                      const daysSinceStart = dayjs().startOf('day').diff(start, 'day');
                      const pastWidth = Math.max(0, Math.min(daysSinceStart, totalDays)) * DAY_WIDTH;
                      const todayLeft = daysSinceStart >= 0 && daysSinceStart < totalDays
                        ? daysSinceStart * DAY_WIDTH
                        : -1;
                      const slabHeight = Math.max(1, listToShow.length * ROW_HEIGHT);
                      return (
                        <>
                          {pastWidth > 0 && (
                            <View
                              style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: pastWidth,
                                backgroundColor: COLORS.monthPast,
                              }}
                            />
                          )}
                          {todayLeft >= 0 && (
                            <View
                              style={{
                                position: 'absolute',
                                left: todayLeft,
                                top: 0,
                                bottom: 0,
                                width: DAY_WIDTH,
                                backgroundColor: COLORS.monthCurrent,
                              }}
                            />
                          )}
                          {/* Тонкие делители дней — один SVG с повторяющимся паттерном
                              вместо 490 View. patternUnits=userSpaceOnUse обязателен,
                              иначе Android отдаёт пустоту. id уникален на инстанс. */}
                          <Svg
                            style={{ position: 'absolute', top: 0, left: 0 }}
                            width={totalWidth}
                            height={slabHeight}
                            pointerEvents="none"
                          >
                            <Defs>
                              <Pattern
                                id={dayDividerPatternId}
                                width={DAY_WIDTH}
                                height={slabHeight}
                                patternUnits="userSpaceOnUse"
                              >
                                <SvgLine
                                  x1={DAY_WIDTH - 0.5}
                                  y1="0"
                                  x2={DAY_WIDTH - 0.5}
                                  y2={slabHeight}
                                  stroke="rgba(0,0,0,0.05)"
                                  strokeWidth="1"
                                />
                              </Pattern>
                            </Defs>
                            <Rect width={totalWidth} height={slabHeight} fill={`url(#${dayDividerPatternId})`} />
                          </Svg>
                          {/* Жирные линии границ недель — поверх паттерна дней. */}
                          {weeks.map((w, wi) => (
                            <View
                              key={`wdiv-${w.key}`}
                              style={{
                                position: 'absolute',
                                left: (wi + 1) * WEEK_WIDTH - 1,
                                top: 0,
                                bottom: 0,
                                width: 1,
                                backgroundColor: 'rgba(0,0,0,0.12)',
                              }}
                            />
                          ))}
                        </>
                      );
                    })() : (
                      <>
                        {months.map((m, mi) => {
                          const isPast = m.year < currentYear || (m.year === currentYear && m.month < currentMonth);
                          const isCurrent = m.year === currentYear && m.month === currentMonth;
                          if (!isPast && !isCurrent) return null;
                          return (
                            <View
                              key={m.key}
                              style={{
                                position: 'absolute',
                                left: mi * MONTH_WIDTH,
                                top: 0,
                                bottom: 0,
                                width: MONTH_WIDTH,
                                backgroundColor: isPast ? COLORS.monthPast : COLORS.monthCurrent,
                              }}
                            />
                          );
                        })}
                        {months.map((m, mi) => (
                          <View
                            key={`div-${m.key}`}
                            style={{
                              position: 'absolute',
                              left: (mi + 1) * MONTH_WIDTH - 1,
                              top: 0,
                              bottom: 0,
                              width: 1,
                              backgroundColor: 'rgba(0,0,0,0.06)',
                            }}
                          />
                        ))}
                      </>
                    )}
                  </View>
                  {todayLineX >= 0 && (
                    <View
                      pointerEvents="none"
                      style={{
                        position: 'absolute',
                        left: todayLineX - 1,
                        top: 0,
                        height: listToShow.length * ROW_HEIGHT,
                        width: 2,
                        backgroundColor: 'rgba(61,125,130,0.40)',
                      }}
                    />
                  )}
                  {(() => {
                    const canBook = user?.teamPermissions?.can_manage_bookings;
                    const isAgent = !!(user?.teamMembership);
                    return listToShow.map((unit) => {
                      const canAddBooking = !readOnly && (!isAgent || canBook);
                      return (
                        <CalendarRow
                          key={unit.id}
                          unit={unit}
                          rowWidth={totalWidth}
                          dateToPx={dateToPx}
                          bookingBarInset={bookingBarInset}
                          rowHeight={ROW_HEIGHT}
                          currentYear={currentYear}
                          currentMonth={currentMonth}
                          bookings={bookingsByProperty[unit.id] || []}
                          contactNamesByBookingId={contactNamesByBookingId}
                          getOwnerLabel={getOwnerLabel}
                          globalColorMap={globalColorMap}
                          truncateLabel={truncateLabel}
                          onCellPress={canAddBooking ? handleAddPress : undefined}
                          onBookingPress={handleBookingPress}
                          ownerLabels={{ full: t('ownerCustomer'), mid: t('ownerCustomerShort'), min: t('ownerCustomerMin') }}
                          isAgentMode={isAgent}
                          currentUserId={user?.id}
                          companyName={user?.companyInfo?.name || user?.teamMembership?.companyName || ''}
                        />
                      );
                    });
                  })()}
                </Animated.ScrollView>
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
        user={user}
      />

      <AddBookingModal
        visible={addModalVisible}
        onClose={() => { setAddModalVisible(false); setSelectedProperty(null); }}
        onSaved={() => { setAddModalVisible(false); setSelectedProperty(null); handleSaved(); }}
        property={selectedProperty}
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
            embeddedInModal={embeddedInModal}
            booking={selectedBooking}
            propertyCode={(() => {
              const parent = selectedProperty.parent_id ? getParent(selectedProperty.parent_id) : null;
              const codeDisplay = parent
                ? (parent.code || '') + (selectedProperty.code_suffix ? ` (${selectedProperty.code_suffix})` : '')
                : (selectedProperty.code || '') + (selectedProperty.code_suffix ? ` (${selectedProperty.code_suffix})` : '');
              const propBookings = bookingsByProperty[selectedProperty.id] || [];
              return `${codeDisplay} ${getBookingNumber(selectedBooking, propBookings)}`;
            })()}
            initialProperty={preloadedProperty}
            initialContact={preloadedContact}
            onContactPress={(contact) => setSelectedOwnerContact(contact)}
            onPropertyPress={(prop) => setSelectedPropertyForDetail(prop)}
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

const CalendarRow = React.memo(function CalendarRow({
  unit,
  rowWidth,
  dateToPx,
  bookingBarInset,
  rowHeight,
  bookings,
  contactNamesByBookingId,
  getOwnerLabel,
  globalColorMap,
  truncateLabel,
  onCellPress,
  onBookingPress,
  ownerLabels,
  isAgentMode,
  currentUserId,
  companyName,
}) {
  return (
    <View style={[rowStyles.row, { height: rowHeight, width: rowWidth }]}>
      <Pressable
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        onPress={onCellPress ? () => onCellPress(unit) : undefined}
      />
      {bookings.map((b) => {
        const checkInStr = typeof b.checkIn === 'string' && b.checkIn.length >= 10 ? b.checkIn.substring(0, 10) : b.checkIn;
        const checkOutStr = typeof b.checkOut === 'string' && b.checkOut.length >= 10 ? b.checkOut.substring(0, 10) : b.checkOut;
        const cin = dayjs(checkInStr);
        const cout = dayjs(checkOutStr);
        const leftPx = Math.max(0, dateToPx(cin) + bookingBarInset);
        const rightPx = Math.min(rowWidth, dateToPx(cout.add(1, 'day')) - bookingBarInset);
        const widthPx = Math.max(2, rightPx - leftPx);
        const rawColor = b.notMyCustomer ? COLORS.ownerBar : (globalColorMap[b.id] || PASTEL_COLORS[0]);
        const barColor = b.notMyCustomer ? rawColor : rawColor.replace(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i, (_, r, g, b) => `rgba(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)}, 0.6)`);
        // TD-085: на чужой брони агент видит название компании вместо имени клиента.
        const isForeignToAgent = isAgentMode && b.responsibleAgentId !== currentUserId;
        const label = b.notMyCustomer
          ? getOwnerLabel(widthPx - 8, ownerLabels)
          : isForeignToAgent
            ? companyName
            : (contactNamesByBookingId?.[b.id] || '');
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
                borderRadius: 18,
                borderWidth: 2,
                borderColor: rawColor,
                zIndex: 10,
              },
            ]}
            onPress={(onBookingPress && !isForeignToAgent) ? (e) => {
              e.stopPropagation();
              onBookingPress(b, unit);
            } : undefined}
            activeOpacity={(onBookingPress && !isForeignToAgent) ? 0.8 : 1}
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
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  cell: {
    height: '100%',
    borderRightWidth: 1,
    borderRightColor: 'rgba(0,0,0,0.06)',
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
    fontSize: 14,
    color: '#2C2C2C',
    fontWeight: '400',
    textAlign: 'center',
  },
  barTextCenter: {
    flex: 1,
    textAlign: 'center',
    minWidth: 0,
  },
  barDateText: {
    fontSize: 14,
    fontWeight: '400',
  },
  barDateIn: {
    color: 'rgba(44,44,44,0.75)',
  },
  barDateOut: {
    color: 'rgba(44,44,44,0.75)',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  fixedTop: {
    paddingTop: TOP_INSET,
    // paddingHorizontal задаётся динамически в JSX (16 на узких, 20 на широких)
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
    fontWeight: '600',
    letterSpacing: -0.3,
    color: COLORS.title,
  },
  headerBtn: {
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
    backgroundColor: COLORS.searchBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.searchBorder,
    paddingHorizontal: 12,
    height: 40,
  },
  searchIconIon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.title,
    paddingVertical: 0,
  },
  toolbarBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.searchBg,
    borderWidth: 1,
    borderColor: COLORS.searchBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnActive: {
    borderColor: '#3D7D82',
  },
  viewModeWrap: {
    flexDirection: 'row',
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D1D6',
    overflow: 'hidden',
  },
  viewModeBtn: {
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: '#F7F7F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewModeBtnActiveLeft: {
    borderColor: '#3D7D82',
    backgroundColor: 'rgba(61,125,130,0.06)',
    borderTopLeftRadius: 11,
    borderBottomLeftRadius: 11,
  },
  viewModeBtnActiveRight: {
    borderColor: '#3D7D82',
    backgroundColor: 'rgba(61,125,130,0.06)',
    borderTopRightRadius: 11,
    borderBottomRightRadius: 11,
  },
  viewModeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#666',
  },
  viewModeTextActive: {
    color: '#3D7D82',
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
    backgroundColor: 'rgba(245,245,247,0.85)',
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
    // paddingBottom задаётся динамически через bottomNavPadding в JSX
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
    backgroundColor: '#EFEFEF',
  },
  yearText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.title,
  },
  propertyRow: {
    height: ROW_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    backgroundColor: COLORS.background,
  },
  propertyLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.title,
  },
  propertyLabelLink: {
    color: '#3D7D82',
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
    fontSize: 14,
    color: COLORS.title,
  },
  monthLabelBold: {
    fontWeight: '700',
  },
  monthYearRed: {
    fontWeight: '700',
    color: '#3D7D82',
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
