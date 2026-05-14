import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo, useId } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Pressable,
} from 'react-native';
import dayjs from 'dayjs';
import Svg, { Defs, Pattern, Line as SvgLine, Rect, Text as SvgText } from 'react-native-svg';
import { useLanguage } from '../../context/LanguageContext';
import { getCurrencySymbol } from '../../utils/currency';
import { getPropertyTypeColors } from '../constants/propertyTypeColors';

import { deleteBooking } from '../../services/bookingsService';
import { useAppData } from '../../context/AppDataContext';
import { supabase } from '../../services/supabase';
import WebBookingEditPanel from '../components/WebBookingEditPanel';
import WebBookingDetailPanel from '../components/WebBookingDetailPanel';
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
// Дневной режим: единица — неделя (7 столбиков-дней).
// 52 недели = ~год вокруг сегодня, ~9.5k px ленты — комфортная нагрузка для
// react-native-web ScrollView (выше 15k px начинаются лаги repaint).
const DAY_W = 26;
const WEEK_W = DAY_W * 7; // 182
// Пастельно-красный для чисел выходных в шапке D режима (как на мобайле).
const WEEKEND_TEXT_COLOR = '#C97A7A';
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

  // Build timeline: 36 months back → 36 months forward (~6 лет вокруг сегодня).
  // TD-097: расширили окно, чтобы пикер года мог скроллить по диапазону
  // и старые брони (2023–2024) оставались видны.
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

// ─── Gantt Chart ──────────────────────────────────────────────────────────────


// ─── Main Screen ──────────────────────────────────────────────────────────────

function WebBookingsScreenInner({ user }) {
  const { t } = useLanguage();
  const {
    bookings,
    properties: ctxProperties,
    contacts,
    teamMembers,
    bookingsLoading, propertiesLoading, contactsLoading,
    refreshBookings, refreshProperties,
  } = useAppData();
  const owners = useMemo(() => (contacts || []).filter(c => c.type === 'owners'), [contacts]);
  const properties = useMemo(() => {
    const parentMap = {};
    (ctxProperties || []).forEach(p => { parentMap[p.id] = p; });
    return (ctxProperties || [])
      .filter(p => p.parent_id || HOUSE_LIKE_TYPES.has(p.type))
      .map(p => {
        if (p.parent_id) {
          const parent = parentMap[p.parent_id];
          return { ...p, effectiveType: parent?.type || 'resort' };
        }
        return { ...p, effectiveType: 'house' };
      });
  }, [ctxProperties]);
  const loading = bookingsLoading || propertiesLoading || contactsLoading;
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
  // Режим отображения календаря. 'month' — единица «месяц», 'day' — «неделя»
  // с дневной разметкой внутри. Выбор сохраняется в localStorage.
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window === 'undefined') return 'month';
    const saved = window.localStorage?.getItem('webBookings:viewMode');
    return saved === 'day' || saved === 'month' ? saved : 'month';
  });
  // Уникальный id SVG-паттерна разделителей дней — защищает от коллизий,
  // если на странице окажется два экземпляра календаря.
  const headerDayDividerPatternId = `hdd-${useId()}`;
  const handleViewModeChange = (next) => {
    if (next !== 'month' && next !== 'day') return;
    if (next === viewMode) return;
    setViewMode(next);
    try { window.localStorage?.setItem('webBookings:viewMode', next); } catch {}
  };

  const months   = useMemo(() => buildMonths(), []);
  // Массив недель для дневного режима. 10 назад + 42 вперёд = 52 единицы.
  // Понедельник считается руками: dayjs.startOf('week') зависит от локали
  // (англ — воскресенье, рус — понедельник), плагин isoWeek в проект не
  // подключён.
  const weeks = useMemo(() => {
    const today = dayjs();
    // Начало диапазона — понедельник недели, в которой лежит «сегодня минус 3 месяца».
    const back = today.subtract(3, 'month').startOf('day');
    const backDow = back.day();
    const backOffsetToMonday = backDow === 0 ? -6 : 1 - backDow;
    const firstMonday = back.add(backOffsetToMonday, 'day');
    // Конец диапазона — последний день месяца, который через 12 месяцев от текущего.
    const forwardEnd = today.add(12, 'month').endOf('month');
    const totalDays = forwardEnd.diff(firstMonday, 'day') + 1;
    const numWeeks = Math.ceil(totalDays / 7);
    const arr = [];
    for (let i = 0; i < numWeeks; i++) {
      const start = firstMonday.add(i * 7, 'day');
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
  }, []);
  // Прекомпьют дня ленты в число/день недели — для чисел в шапке D режима.
  // 52 × 7 = 364 элемента, считается один раз.
  const monthOfDay = useMemo(() => {
    if (viewMode !== 'day') return null;
    const startStr = weeks[0]?.startDate;
    if (!startStr) return null;
    const start = dayjs(startStr);
    const total = weeks.length * 7;
    const arr = new Array(total);
    for (let i = 0; i < total; i++) {
      const d = start.add(i, 'day');
      arr[i] = { date: d.date(), dow: d.day(), year: d.year(), month: d.month() };
    }
    return arr;
  }, [viewMode, weeks]);
  // Блоки месяцев для верхнего яруса шапки D. Сливаем соседние дни одного месяца.
  const monthBlocks = useMemo(() => {
    if (!monthOfDay) return null;
    const blocks = [];
    let current = null;
    for (let i = 0; i < monthOfDay.length; i++) {
      const d = monthOfDay[i];
      if (current && current.year === d.year && current.month === d.month) {
        current.days += 1;
      } else {
        current = { startIdx: i, days: 1, year: d.year, month: d.month };
        blocks.push(current);
      }
    }
    return blocks.map(b => {
      const first = dayjs().year(b.year).month(b.month).date(1);
      return {
        ...b,
        label: `${first.format('MMMM')[0].toUpperCase()}${first.format('MMMM').slice(1)} ${b.year}`,
        isCurrent: dayjs().year() === b.year && dayjs().month() === b.month,
      };
    });
  }, [monthOfDay]);
  // Геометрия ленты — единая точка правды на оба режима.
  const unitWidth = viewMode === 'day' ? WEEK_W : MONTH_W;
  const unitCount = viewMode === 'day' ? weeks.length : months.length;
  const totalW = unitCount * unitWidth;
  // Позиция даты в пикселях на ленте. В M режиме считаем пропорцию внутри
  // месяца (как раньше), в D — «дни от старта × DAY_W».
  const dateToPx = useCallback((dateStr) => {
    if (!dateStr) return 0;
    const d = dayjs(dateStr);
    if (viewMode === 'day') {
      const startStr = weeks[0]?.startDate;
      if (!startStr) return 0;
      const start = dayjs(startStr);
      const totalDays = weeks.length * 7;
      const dayOffset = d.diff(start, 'day');
      if (dayOffset < 0) return 0;
      if (dayOffset >= totalDays) return totalDays * DAY_W;
      return dayOffset * DAY_W;
    }
    const start = months[0];
    const end = months[months.length - 1].endOf('month');
    if (d.isBefore(start)) return 0;
    if (d.isAfter(end)) return months.length * MONTH_W;
    const totalDays = end.diff(start, 'day') + 1;
    const dayOffset = d.diff(start, 'day');
    return (dayOffset / totalDays) * months.length * MONTH_W;
  }, [viewMode, months, weeks]);

  // Обратная функция: пиксель → дата YYYY-MM-DD. Нужна для клика по пустой
  // ячейке (создание новой брони на дате клика).
  const pxToDate = useCallback((x) => {
    if (!Number.isFinite(x)) return null;
    if (viewMode === 'day') {
      const startStr = weeks[0]?.startDate;
      if (!startStr) return null;
      const start = dayjs(startStr);
      const totalDays = weeks.length * 7;
      if (x < 0 || x > totalDays * DAY_W) return null;
      const dayOffset = Math.min(Math.round(x / DAY_W), totalDays - 1);
      return start.add(dayOffset, 'day').format('YYYY-MM-DD');
    }
    if (!months || months.length === 0) return null;
    const start = months[0];
    const end = months[months.length - 1].endOf('month');
    const totalDays = end.diff(start, 'day') + 1;
    const tW = months.length * MONTH_W;
    if (x < 0 || x > tW) return null;
    const dayOffset = Math.min(Math.round((x / tW) * totalDays), totalDays - 1);
    return start.add(dayOffset, 'day').format('YYYY-MM-DD');
  }, [viewMode, months, weeks]);
  // TD-097: список годов для пикера — на основе диапазона months.
  const yearOptions = useMemo(() => {
    const set = new Set(months.map(m => m.year()));
    return [...set].sort((a, b) => a - b);
  }, [months]);
  const handleYearJump = (year) => {
    const targetX = dateToPx(`${year}-01-01`);
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

  const reload = useCallback(() => {
    refreshBookings();
    refreshProperties();
  }, [refreshBookings, refreshProperties]);


  // Auto-scroll gantt: M → текущий месяц вторым видимым; D → текущая неделя
  // примерно по центру видимой части (за вычетом левой колонки).
  // useLayoutEffect — синхронно до отрисовки кадра, чтобы при переключении
  // режима не мелькала старая позиция скролла на новой ленте.
  useLayoutEffect(() => {
    if (loading) return;
    const node = ganttScrollRef.current;
    if (!node) return;
    const targetX = dateToPx(dayjs().format('YYYY-MM-DD'));
    const viewportW = Math.max(1, node.clientWidth - LEFT_W);
    const offset = Math.max(0, targetX - Math.max(unitWidth, viewportW / 2 - unitWidth / 2));
    node.scrollLeft = offset;
  }, [loading, viewMode, dateToPx, unitWidth]);

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
          <View style={s.viewModeWrap}>
            <TouchableOpacity
              style={[s.viewModeBtn, viewMode === 'month' && s.viewModeBtnActiveLeft]}
              activeOpacity={0.7}
              onPress={() => handleViewModeChange('month')}
            >
              <Text style={[s.viewModeText, viewMode === 'month' && s.viewModeTextActive]}>M</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.viewModeBtn, viewMode === 'day' && s.viewModeBtnActiveRight]}
              activeOpacity={0.7}
              onPress={() => handleViewModeChange('day')}
            >
              <Text style={[s.viewModeText, viewMode === 'day' && s.viewModeTextActive]}>D</Text>
            </TouchableOpacity>
          </View>
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
        <View style={s.mainArea}>
          {/* Gantt: single overflow:auto container — CSS sticky works for both axes */}
          <View style={s.ganttOuter}>
                <View ref={ganttScrollRef} style={s.ganttScroll}>
                  <View style={{ minWidth: LEFT_W + totalW }}>
                    {/* Sticky header row */}
                    <View style={[s.ganttHeaderRow, { position: 'sticky', top: 0, zIndex: 10 }]}>
                      {/* Corner cell — sticky left + top */}
                      <View style={[s.ganttLeftHeader, { position: 'sticky', left: 0, zIndex: 11 }]} />
                      {viewMode === 'day' ? (
                        <View style={{ flexDirection: 'column', width: totalW }}>
                          {/* Верхний ярус — месяц/год, 18px */}
                          <View style={{ flexDirection: 'row', height: 18, backgroundColor: '#F7F7F7' }}>
                            {monthBlocks && monthBlocks.map((b, bi) => {
                              const yearStr = String(b.year);
                              const headPart = `${b.label.replace(/\s\d{4}$/, '')} ${yearStr.slice(0, 2)}`;
                              const tailPart = yearStr.slice(2);
                              return (
                                <View
                                  key={bi}
                                  style={{
                                    width: b.days * DAY_W,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRightWidth: 2,
                                    borderRightColor: 'rgba(0,0,0,0.22)',
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 10,
                                      fontWeight: '600',
                                      color: b.isCurrent ? '#2A7A50' : '#6B6B6B',
                                      textAlign: 'center',
                                    }}
                                    numberOfLines={1}
                                  >
                                    {headPart}<Text style={{ color: WEEKEND_TEXT_COLOR }}>{tailPart}</Text>
                                  </Text>
                                </View>
                              );
                            })}
                          </View>
                          {/* Нижний ярус — числа дней + делители, 29px */}
                          <View style={{ flexDirection: 'row', height: 29, backgroundColor: '#FFFFFF', position: 'relative' }}>
                            {weeks.map((w) => (
                              <View key={w.key} style={{ width: WEEK_W, height: 29 }} />
                            ))}
                            {monthOfDay && (
                              <Svg
                                style={{ position: 'absolute', top: 0, left: 0 }}
                                width={totalW}
                                height={29}
                                pointerEvents="none"
                              >
                                <Defs>
                                  <Pattern
                                    id={headerDayDividerPatternId}
                                    width={DAY_W}
                                    height={29}
                                    patternUnits="userSpaceOnUse"
                                  >
                                    <SvgLine
                                      x1={DAY_W - 0.5}
                                      y1="0"
                                      x2={DAY_W - 0.5}
                                      y2={29}
                                      stroke="rgba(0,0,0,0.12)"
                                      strokeWidth="1"
                                    />
                                  </Pattern>
                                </Defs>
                                <Rect width={totalW} height={29} fill={`url(#${headerDayDividerPatternId})`} />
                                {monthOfDay.map((entry, i) => {
                                  const isWeekend = entry.dow === 0 || entry.dow === 6;
                                  return (
                                    <SvgText
                                      key={i}
                                      x={i * DAY_W + DAY_W / 2}
                                      y={29 / 2 + 4}
                                      textAnchor="middle"
                                      fontSize="12"
                                      fontWeight="700"
                                      fill={isWeekend ? WEEKEND_TEXT_COLOR : '#2C2C2C'}
                                    >
                                      {entry.date}
                                    </SvgText>
                                  );
                                })}
                              </Svg>
                            )}
                          </View>
                        </View>
                      ) : (
                        months.map((m, i) => {
                          const today = dayjs();
                          const isCurrent = m.isSame(today, 'month');
                          const isPast = m.isBefore(today, 'month');
                          return (
                            <View key={i} style={[s.monthCell, isCurrent && s.monthCellCurrent, isPast && s.monthCellPast]}>
                              <Text style={[s.monthName, isCurrent && s.monthNameCurrent]}>{m.format('MMM')}</Text>
                              <Text style={[s.yearName, isCurrent && { color: '#E53935' }]}>{m.format('YY')}</Text>
                            </View>
                          );
                        })
                      )}
                    </View>

                    {/* Property rows */}
                    {visibleProps.map((prop, pi) => {
                      const tc = getPropertyTypeColors(getEffectiveType(prop));
                      const fullCode = prop.code + (prop.code_suffix ? ` (${prop.code_suffix})` : '');
                      const propBookings = bookings.filter(b => b.propertyId === prop.id);
                      // Contract flags (company-first)
                      const isAgent              = !!user?.teamMembership;
                      const isResponsibleProperty = isAgent && prop.responsible_agent_id === user?.id;
                      const todayX = dateToPx(dayjs().format('YYYY-MM-DD'));
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
                            style={[
                              s.ganttRow,
                              { width: totalW },
                              viewMode === 'day' && {
                                backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent ${WEEK_W - 1}px, rgba(0,0,0,0.22) ${WEEK_W - 1}px, rgba(0,0,0,0.22) ${WEEK_W}px), repeating-linear-gradient(to right, transparent 0, transparent ${DAY_W - 0.5}px, rgba(0,0,0,0.12) ${DAY_W - 0.5}px, rgba(0,0,0,0.12) ${DAY_W}px)`,
                              },
                            ]}
                            onPress={canCreate ? (e) => {
                              const x = e.nativeEvent.locationX;
                              const date = pxToDate(x);
                              if (date) handleGanttCellPress(prop, date);
                            } : undefined}
                          >
                            {viewMode === 'day' ? (() => {
                              // Дневной режим: подсветка прошлого одним прямоугольником
                              // от начала ленты до сегодняшнего столбика, и один
                              // тонкий столбик DAY_W для сегодня.
                              const startStr = weeks[0]?.startDate;
                              if (!startStr) return null;
                              const start = dayjs(startStr);
                              const totalDays = weeks.length * 7;
                              const daysSinceStart = dayjs().startOf('day').diff(start, 'day');
                              const pastWidth = Math.max(0, Math.min(daysSinceStart, totalDays)) * DAY_W;
                              const todayLeft = daysSinceStart >= 0 && daysSinceStart < totalDays
                                ? daysSinceStart * DAY_W
                                : -1;
                              return (
                                <>
                                  {pastWidth > 0 && (
                                    <View
                                      pointerEvents="none"
                                      style={[s.monthBand, s.monthBandPast, { left: 0, width: pastWidth, borderRightWidth: 0 }]}
                                    />
                                  )}
                                  {todayLeft >= 0 && (
                                    <View
                                      pointerEvents="none"
                                      style={[s.monthBand, s.monthBandCurrent, { left: todayLeft, width: DAY_W, borderRightWidth: 0 }]}
                                    />
                                  )}
                                </>
                              );
                            })() : (
                              <>
                                {months.map((m, mi) => {
                                  const now = dayjs();
                                  const isMPast = m.isBefore(now, 'month');
                                  const isMCurrent = m.isSame(now, 'month');
                                  if (!isMPast && !isMCurrent) return null;
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
                                    />
                                  );
                                })}
                                <View style={[s.todayLine, { left: todayX }]} />
                              </>
                            )}
                            {propBookings.map(bk => {
                              // Полудневный сдвиг в D-режиме: полоска начинается с середины
                              // дня заезда и заканчивается серединой дня выезда — стыковые
                              // брони визуально не наезжают друг на друга. На мобайле так же.
                              const bookingBarInset = viewMode === 'day' ? DAY_W / 2 : 0;
                              const checkOutPx = viewMode === 'day'
                                ? dateToPx(dayjs(bk.checkOut).add(1, 'day').format('YYYY-MM-DD'))
                                : dateToPx(bk.checkOut);
                              const x1 = dateToPx(bk.checkIn) + bookingBarInset;
                              const x2 = checkOutPx - bookingBarInset;
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

      </View>

      {/* Booking detail panel — slides from RIGHT */}
      <WebBookingDetailPanel
        visible={!!selectedBooking && editPanelMode === null}
        booking={selectedBooking}
        property={selectedProperty}
        contact={selectedContact}
        user={user}
        teamMembers={teamMembers}
        onEdit={() => setEditPanelMode('edit')}
        onDelete={() => { setSelectedBooking(null); reload(); }}
        onClose={() => setSelectedBooking(null)}
        onPrint={() => selectedBooking && handlePrintConfirmation(selectedBooking)}
      />

      {/* Property detail panel — slides from RIGHT */}
      <WebPropertyDetailPanel
        visible={propDetailProperty !== null}
        property={propDetailProperty}
        bookings={bookings}
        owners={owners}
        teamMembers={teamMembers}
        onClose={() => setPropDetailProperty(null)}
        onCreateBooking={canCreate ? (prop) => {
          setPropDetailProperty(null);
          setCreateTemplate({ propertyId: prop.id });
          setSelectedBooking(null);
          setEditPanelMode('create');
        } : undefined}
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
          reload();
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

  // View mode toggle (M/D)
  viewModeWrap: {
    flexDirection: 'row',
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D1D6',
    overflow: 'hidden',
    flexShrink: 0,
  },
  viewModeBtn: {
    paddingHorizontal: 14,
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
  viewModeText: { fontSize: 13, fontWeight: '700', color: '#666' },
  viewModeTextActive: { color: '#3D7D82' },

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
  monthCell: { width: MONTH_W, minHeight: 47, flexShrink: 0, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRightWidth: 1, borderRightColor: C.border, backgroundColor: '#FAFAFA' },
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
  ganttRow: {
    height: ROW_H,
    position: 'relative',
    // Фоновая сетка через CSS вместо тысяч DOM-элементов:
    // — широкие линии границ месяцев (каждые MONTH_W пикселей),
    // — тонкие линии разделителей недель (каждые MONTH_W/4 = 32.5 пикселя).
    backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent ${MONTH_W - 1}px, rgba(0,0,0,0.1) ${MONTH_W - 1}px, rgba(0,0,0,0.1) ${MONTH_W}px), repeating-linear-gradient(to right, transparent 0, transparent ${MONTH_W / 4 - 0.5}px, rgba(0,0,0,0.045) ${MONTH_W / 4 - 0.5}px, rgba(0,0,0,0.045) ${MONTH_W / 4}px)`,
  },
  monthBand: {
    position: 'absolute', top: 0, bottom: 1, width: MONTH_W,
    borderRightWidth: 1, borderRightColor: 'rgba(0,0,0,0.1)',
  },
  monthBandPast:    { backgroundColor: 'rgba(237,233,227,0.55)' },
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

export default React.memo(WebBookingsScreenInner);
