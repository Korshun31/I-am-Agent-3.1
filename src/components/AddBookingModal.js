import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Modal,
  Platform,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Pressable,
  Keyboard,
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Switch,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import ModalScrollFrame from './ModalScrollFrame';
import { IconPhoto } from './PropertyIcons';
import Checkbox from './Checkbox';
import WizardFooter from './WizardFooter';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import dayjs from 'dayjs';
import CalendarRangePicker from 'react-native-calendar-range-picker';
import { useLanguage } from '../context/LanguageContext';
import { getCurrencySymbol } from '../utils/currency';
import { findOrCreateBookingClient, getContactById } from '../services/contactsService';
import { computeTotalPrice, computeMonthlyBreakdown } from '../utils/bookingPricing';
import { SCALE } from '../utils/scale';

import { buildOccupancyArrays, hasOccupiedInRange } from '../utils/bookingOccupancy';
import { createBooking, updateBooking } from '../services/bookingsService';
import { getActiveTeamMembers } from '../services/companyService';
import { useAppData } from '../context/AppDataContext';
import { useUser } from '../context/UserContext';
import { scheduleBookingReminders, cancelBookingReminders } from '../services/bookingRemindersService';
import { scheduleCommissionReminders, cancelCommissionReminders } from '../services/commissionRemindersService';
import { getCommissionEvents, ownerOneTimeAmount, ownerMonthlyTotalAmount, ownerMonthlyByMonth } from '../utils/ownerCommission';
import { requestReminderPermissions } from '../services/calendarRemindersService';
import { getCurrentUser } from '../services/authService';
import { uploadPhoto, isLocalUri } from '../services/storageService';
import AddContactModal from './AddContactModal';

const MAX_PHOTO_SIDE = 1600;
const PHOTO_QUALITY = 0.85;
const MAX_BOOKING_PHOTOS = 10;

async function resizePhotoIfNeeded(uri, width, height) {
  const maxSide = Math.max(width || 0, height || 0);
  if (maxSide <= MAX_PHOTO_SIDE) return uri;
  const actions = width >= (height || 1)
    ? [{ resize: { width: MAX_PHOTO_SIDE } }]
    : [{ resize: { height: MAX_PHOTO_SIDE } }];
  const { uri: resized } = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: PHOTO_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return resized;
}

function formatDateYMD(d) {
  if (!d) return '';
  const x = d instanceof Date ? d : new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Format number with spaces every 3 digits (e.g. 50000 → "50 000") */
function formatMoneyDisplay(val) {
  const s = String(val ?? '').replace(/\D/g, '');
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
// TD-119: расчёт занятости вынесен в общий util src/utils/bookingOccupancy.js,
// единый для веба и мобайла. День выезда (checkOut) не считается занятым —
// можно поставить заезд новому гостю в этот же день.

/** Parse formatted money string to number */
function parseMoneyValue(val) {
  if (!val || !String(val).trim()) return null;
  const n = parseFloat(String(val).replace(/\s/g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
}

function parseTimeToDate(timeStr) {
  if (!timeStr) return new Date(2000, 0, 1, 14, 0);
  const parts = String(timeStr).trim().split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return new Date(2000, 0, 1, h, m);
}

function formatDateToTime(d) {
  if (!d) return '14:00';
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function formatDateDisplay(d) {
  if (!d) return '';
  const x = d instanceof Date ? d : new Date(d);
  const day = String(x.getDate()).padStart(2, '0');
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const y = x.getFullYear();
  return `${day}.${m}.${y}`;
}

// computeTotalPrice вынесен в src/utils/bookingPricing.js — единый алгоритм для веб и мобильного.

const COLORS = {
  boxBg: 'rgba(255,255,255,0.72)',
  title: '#2C2C2C',
  inputBg: '#F7F7F9',
  border: '#D1D1D6',
  accent: '#3D7D82',
  accentBg: 'rgba(61,125,130,0.06)',
  accentBorder: 'rgba(61,125,130,0.5)',
  dot: '#E5E5EA',
  dotPassed: '#B0B0B5',
  dotActive: '#3D7D82',
  label: '#6B6B6B',
  placeholder: '#C7C7CC',
};

function CheckRow({ label, checked, onPress }) {
  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.7}>
      <Checkbox checked={checked} style={{ marginRight: 12 }} />
      <Text style={s.rowLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function PercentMoneyField({ label, sym, priceMonthly, checkIn, checkOut, monthlyBreakdown, kind, value, onChangeValue, isPercent, onChangePercent }) {
  const numericValue = isPercent ? parseFloat((value || '').toString().replace(/[^0-9.]/g, '')) : null;
  let computed = null;
  let breakdownStr = null;
  if (isPercent && numericValue) {
    const fakeBooking = {
      priceMonthly: parseMoneyValue(priceMonthly),
      checkIn,
      checkOut,
      monthlyBreakdown,
    };
    if (kind === 'oneTime') {
      fakeBooking.ownerCommissionOneTime = numericValue;
      fakeBooking.ownerCommissionOneTimeIsPercent = true;
      computed = ownerOneTimeAmount(fakeBooking) || null;
    } else {
      fakeBooking.ownerCommissionMonthly = numericValue;
      fakeBooking.ownerCommissionMonthlyIsPercent = true;
      const months = ownerMonthlyByMonth(fakeBooking);
      computed = months.reduce((s, r) => s + r.amount, 0) || null;
      if (months.length > 1) {
        breakdownStr = `${months.map(r => formatMoneyDisplay(String(r.amount))).join(' + ')} = ${formatMoneyDisplay(String(computed))} ${sym}`;
      }
    }
  }
  const handlePercentInput = (v) => {
    const cleaned = v.replace(/[^0-9.]/g, '');
    if (cleaned === '') return onChangeValue('');
    const n = parseFloat(cleaned);
    if (isNaN(n)) return onChangeValue('');
    if (n > 100) return onChangeValue('100');
    onChangeValue(cleaned);
  };
  const handleToggle = (next) => {
    if (next === isPercent) return;
    onChangeValue('');
    onChangePercent(next);
  };
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={s.fieldLabel}>{label} {isPercent ? '%' : sym}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TextInput
          style={[s.input, { flex: 1, marginBottom: 0 }]}
          value={value}
          onChangeText={(v) => isPercent ? handlePercentInput(v) : onChangeValue(formatMoneyDisplay(v))}
          placeholder={isPercent ? '10' : '0'}
          placeholderTextColor="#999"
          keyboardType="numeric"
        />
        <View style={{ flexDirection: 'row', borderRadius: 7, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' }}>
          <TouchableOpacity onPress={() => handleToggle(false)} style={{ paddingHorizontal: 12, paddingVertical: 13, backgroundColor: !isPercent ? COLORS.accentBg : COLORS.inputBg }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: !isPercent ? COLORS.accent : '#666' }}>{sym}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleToggle(true)} style={{ paddingHorizontal: 12, paddingVertical: 13, backgroundColor: isPercent ? COLORS.accentBg : COLORS.inputBg }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: isPercent ? COLORS.accent : '#666' }}>%</Text>
          </TouchableOpacity>
        </View>
      </View>
      {isPercent && (
        <Text style={{ fontSize: 12, color: '#6B6B6B', fontStyle: 'italic', marginTop: 4, marginLeft: 2, marginBottom: 8 }}>
          {breakdownStr
            ? breakdownStr
            : computed != null ? `≈ ${formatMoneyDisplay(String(computed))} ${sym}` : `— ${sym}`}
        </Text>
      )}
    </View>
  );
}

const CALENDAR_LOCALES = {
  en: { monthNames: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'], dayNames: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], today: 'Today', year: '' },
  ru: { monthNames: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'], dayNames: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'], today: 'Сегодня', year: '' },
  th: { monthNames: ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'], dayNames: ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'], today: 'วันนี้', year: '' },
};

export default function AddBookingModal({ visible, onClose, onSaved, property, editBooking, initialMonth }) {
  const { t, language, currency, currencySymbol: globalSym } = useLanguage();
  const { contacts, bookings, refreshContacts: refreshGlobalContacts } = useAppData();
  const { user } = useUser();
  const isAgent = !!user?.teamMembership;
  const activeCurrency = property?.currency || currency || 'THB';
  const sym = getCurrencySymbol(activeCurrency);
  const [step, setStep] = useState(1);
  const [notMyCustomer, setNotMyCustomer] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [passportId, setPassportId] = useState('');
  const [clientPickerVisible, setClientPickerVisible] = useState(false);
  const [pickerSelectedClient, setPickerSelectedClient] = useState(null);
  const [clientSearch, setClientSearch] = useState('');
  const [addContactVisible, setAddContactVisible] = useState(false);
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  // Step 2
  const [checkIn, setCheckIn] = useState(null);
  const [checkOut, setCheckOut] = useState(null);
  const [checkInTime, setCheckInTime] = useState('14:00');
  const [checkOutTime, setCheckOutTime] = useState('12:00');
  const [timePickerFor, setTimePickerFor] = useState(null); // 'checkIn' | 'checkOut'
  // TD-119: единый формат вместо трёх массивов. bookedRanges — [{checkIn, checkOut}, ...].
  const [bookedRanges, setBookedRanges] = useState([]);
  // Раскладка для CalendarRangePicker (требует три отдельных списка дат).
  const calendarOccupancy = useMemo(() => buildOccupancyArrays(bookedRanges), [bookedRanges]);
  const [datePickerFor, setDatePickerFor] = useState(null); // 'checkIn' | 'checkOut' (legacy)
  const [priceMonthly, setPriceMonthly] = useState('');
  const [totalPrice, setTotalPrice] = useState('');
  const [bookingDeposit, setBookingDeposit] = useState('');
  const [saveDeposit, setSaveDeposit] = useState('');
  const [commission, setCommission] = useState('');
  const [ownerCommissionOneTime, setOwnerCommissionOneTime] = useState('');
  const [ownerCommissionOneTimeIsPercent, setOwnerCommissionOneTimeIsPercent] = useState(false);
  const [ownerCommissionMonthly, setOwnerCommissionMonthly] = useState('');
  const [ownerCommissionMonthlyIsPercent, setOwnerCommissionMonthlyIsPercent] = useState(false);
  const [adults, setAdults] = useState('');
  const [children, setChildren] = useState('');
  const [pets, setPets] = useState(false);
  const [comments, setComments] = useState('');
  const [photos, setPhotos] = useState([]);
  const [photoProcessing, setPhotoProcessing] = useState(false);
  const [reminderDays, setReminderDays] = useState([]);
  const [reminderPickerOpen, setReminderPickerOpen] = useState(false);
  const [monthlyBreakdown, setMonthlyBreakdown] = useState([]); // TD-082
  const [saving, setSaving] = useState(false);
  // Responsible agent picker (admin only)
  const [responsibleAgentId, setResponsibleAgentId] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);

  // Load active team members for the responsible-agent picker
  useEffect(() => {
    if (isAgent || !user?.companyId) return;
    let cancelled = false;
    getActiveTeamMembers(user.companyId)
      .then(list => { if (!cancelled) setTeamMembers(Array.isArray(list) ? list : []); })
      .catch(() => { if (!cancelled) setTeamMembers([]); });
    return () => { cancelled = true; };
  }, [isAgent, user?.companyId]);

  const BOOKING_REMINDER_OPTIONS = [
    { days: 1, key: 'bookingReminder1d' },
    { days: 3, key: 'bookingReminder3d' },
    { days: 7, key: 'bookingReminder1w' },
    { days: 30, key: 'bookingReminder1m' },
  ];

  const filteredClients = clientSearch.trim()
    ? clients.filter(c => {
        const q = clientSearch.trim().toLowerCase();
        const name = `${c.name || ''} ${c.lastName || ''}`.trim().toLowerCase();
        const phone = (c.phone || '').toLowerCase();
        return name.includes(q) || phone.includes(q);
      })
    : clients;

  const houseCode = property
    ? (property.code || '') + (property.code_suffix ? ` (${property.code_suffix})` : '')
    : '';

  const loadClients = useCallback(() => {
    setLoadingClients(true);
    setClients(contacts.filter(c => c.type === 'clients'));
    setLoadingClients(false);
  }, [contacts]);

  useEffect(() => {
    if (visible) {
      setStep(1);
      if (editBooking) {
        setNotMyCustomer(!!editBooking.notMyCustomer);
        setPassportId(editBooking.passportId || '');
        setCheckIn(editBooking.checkIn ? new Date(editBooking.checkIn) : null);
        setCheckOut(editBooking.checkOut ? new Date(editBooking.checkOut) : null);
        setCheckInTime(editBooking.checkInTime || '14:00');
        setCheckOutTime(editBooking.checkOutTime || '12:00');
        setPriceMonthly(editBooking.priceMonthly != null ? formatMoneyDisplay(String(Math.round(editBooking.priceMonthly))) : '');
        setTotalPrice(editBooking.totalPrice != null ? formatMoneyDisplay(String(Math.round(editBooking.totalPrice))) : '');
        setBookingDeposit(editBooking.bookingDeposit != null ? formatMoneyDisplay(String(Math.round(editBooking.bookingDeposit))) : '');
        setSaveDeposit(editBooking.saveDeposit != null ? formatMoneyDisplay(String(Math.round(editBooking.saveDeposit))) : '');
        setCommission(editBooking.commission != null ? formatMoneyDisplay(String(Math.round(editBooking.commission))) : '');
        setOwnerCommissionOneTime(editBooking.ownerCommissionOneTime != null ? formatMoneyDisplay(String(Math.round(editBooking.ownerCommissionOneTime))) : '');
        setOwnerCommissionOneTimeIsPercent(!!editBooking.ownerCommissionOneTimeIsPercent);
        setOwnerCommissionMonthly(editBooking.ownerCommissionMonthly != null ? formatMoneyDisplay(String(Math.round(editBooking.ownerCommissionMonthly))) : '');
        setOwnerCommissionMonthlyIsPercent(!!editBooking.ownerCommissionMonthlyIsPercent);
        setAdults(editBooking.adults != null ? String(editBooking.adults) : '');
        setChildren(editBooking.children != null ? String(editBooking.children) : '');
        setPets(!!editBooking.pets);
        setComments(editBooking.comments || '');
        setPhotos(Array.isArray(editBooking.photos) ? [...editBooking.photos] : []);
        setReminderDays(Array.isArray(editBooking.reminderDays) ? [...editBooking.reminderDays] : []);
        setMonthlyBreakdown(Array.isArray(editBooking.monthlyBreakdown) ? [...editBooking.monthlyBreakdown] : []);
        setResponsibleAgentId(editBooking.responsibleAgentId ?? null);
      } else {
        setNotMyCustomer(false);
        setSelectedClient(null);
        setResponsibleAgentId(null);
        setPassportId('');
        if (initialMonth && initialMonth.year != null && initialMonth.month != null) {
          setCheckIn(new Date(initialMonth.year, initialMonth.month, 1));
          setCheckOut(null);
        } else {
          setCheckIn(null);
          setCheckOut(null);
        }
        setCheckInTime('14:00');
        setCheckOutTime('12:00');
        setPhotos([]);
        setReminderDays([]);
        setMonthlyBreakdown([]);
      }
    }
  }, [visible, editBooking?.id, initialMonth?.year, initialMonth?.month]);

  useEffect(() => {
    if (step === 3 && property && !editBooking) {
      setPriceMonthly(property.price_monthly != null ? formatMoneyDisplay(String(Math.round(property.price_monthly))) : '');
      setBookingDeposit(property.booking_deposit != null ? formatMoneyDisplay(String(Math.round(property.booking_deposit))) : '');
      setSaveDeposit(property.save_deposit != null ? formatMoneyDisplay(String(Math.round(property.save_deposit))) : '');
      setCommission(property.commission != null ? formatMoneyDisplay(String(Math.round(property.commission))) : '');
      setOwnerCommissionOneTime(property.owner_commission_one_time != null ? formatMoneyDisplay(String(Math.round(property.owner_commission_one_time))) : '');
      setOwnerCommissionOneTimeIsPercent(!!property.owner_commission_one_time_is_percent);
      setOwnerCommissionMonthly(property.owner_commission_monthly != null ? formatMoneyDisplay(String(Math.round(property.owner_commission_monthly))) : '');
      setOwnerCommissionMonthlyIsPercent(!!property.owner_commission_monthly_is_percent);
    }
  }, [step, property, editBooking]);

  const computedTotal = computeTotalPrice(checkIn, checkOut, parseMoneyValue(priceMonthly));
  useEffect(() => {
    // Если включена помесячная разбивка — total = сумма amount по месяцам.
    if (Array.isArray(monthlyBreakdown) && monthlyBreakdown.length > 0) {
      const sum = monthlyBreakdown.reduce((acc, m) => acc + (Number(m.amount) || 0), 0);
      setTotalPrice(formatMoneyDisplay(String(sum)));
      return;
    }
    if (!editBooking && computedTotal != null) {
      setTotalPrice(formatMoneyDisplay(String(Math.round(computedTotal))));
    }
  }, [computedTotal, !!editBooking, monthlyBreakdown]);

  useEffect(() => {
    if (clientPickerVisible) {
      setClientSearch('');
      setPickerSelectedClient(selectedClient);
    }
  }, [clientPickerVisible, selectedClient]);

  useEffect(() => {
    if (clientPickerVisible || addContactVisible) {
      loadClients();
    }
  }, [clientPickerVisible, addContactVisible, loadClients]);

  useEffect(() => {
    if (visible && editBooking?.contactId && !editBooking.notMyCustomer) {
      getContactById(editBooking.contactId).then((c) => {
        if (c) setSelectedClient(c);
      }).catch(() => {});
    } else if (visible && !editBooking) {
      setSelectedClient(null);
    }
  }, [visible, editBooking?.contactId, editBooking?.notMyCustomer]);

  useEffect(() => {
    if (step === 2 && property?.id) {
      const propertyBookings = bookings.filter(b => b.propertyId === property.id);
      const toUse = editBooking?.id ? propertyBookings.filter(b => b.id !== editBooking.id) : propertyBookings;
      setBookedRanges(toUse.map(b => ({ checkIn: b.checkIn, checkOut: b.checkOut })));
    } else {
      setBookedRanges([]);
    }
  }, [step, property?.id, editBooking?.id, bookings]);

  useEffect(() => {
    if (selectedClient) {
      setPassportId(selectedClient.documentNumber || '');
    } else {
      setPassportId('');
    }
  }, [selectedClient]);

  const handleSaveContact = async (data) => {
    try {
      const { contact, existed } = await findOrCreateBookingClient({ ...data, type: 'clients' });
      refreshGlobalContacts();
      setSelectedClient(contact);
      setAddContactVisible(false);
      setClientPickerVisible(false);
      if (existed) {
        Alert.alert(t('info') || '', t('clientLinkedExisting'));
      }
    } catch (e) {
      return Promise.reject(e);
    }
  };

  const handleNext = () => {
    Keyboard.dismiss();
    setStep(2);
  };

  const handleNextFromDates = () => {
    Keyboard.dismiss();
    if (!checkIn || !checkOut) {
      Alert.alert(t('error'), t('bookingSelectDates'));
      return;
    }
    if (checkIn >= checkOut) {
      Alert.alert(t('error'), t('bookingCheckIn') + ' / ' + t('bookingCheckOut'));
      return;
    }
    if (hasOccupiedInRange(checkIn, checkOut, bookedRanges)) {
      Alert.alert(t('error'), t('bookingDatesOccupied'));
      return;
    }
    // Бронь владельца — пропускаем шаги 3 и 4, сразу сохраняем
    if (notMyCustomer) {
      handleSave();
      return;
    }
    setStep(3);
  };

  const handleNextFromStep3 = () => {
    Keyboard.dismiss();
    setStep(4);
  };

  const handleBack = () => {
    Keyboard.dismiss();
    setStep(s => (s === 1 ? 1 : s - 1));
  };

  const pickPhoto = async () => {
    const remain = MAX_BOOKING_PHOTOS - photos.length;
    if (remain <= 0) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsMultipleSelection: true,
      selectionLimit: remain,
    });
    if (!result.canceled && result.assets?.length > 0) {
      setPhotoProcessing(true);
      try {
        const uris = [];
        const toProcess = result.assets.slice(0, remain);
        for (const a of toProcess) {
          const uri = await resizePhotoIfNeeded(a.uri, a.width, a.height);
          uris.push(uri);
        }
        setPhotos((prev) => [...prev, ...uris].slice(0, MAX_BOOKING_PHOTOS));
      } finally {
        setPhotoProcessing(false);
      }
    }
  };

  const removePhoto = (index) => {
    setPhotos((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  };

  const canSave = useMemo(() => {
    if (editBooking) return true;
    if (!checkIn || !checkOut) return false;
    if (checkIn >= checkOut) return false;
    if (hasOccupiedInRange(checkIn, checkOut, bookedRanges)) return false;
    if (!notMyCustomer && !selectedClient?.id) return false;
    return true;
  }, [editBooking, checkIn, checkOut, bookedRanges, notMyCustomer, selectedClient]);

  const handleSave = async () => {
    Keyboard.dismiss();
    if (!checkIn || !checkOut) {
      Alert.alert(t('error'), t('bookingSelectDates'));
      return;
    }
    if (checkIn >= checkOut) {
      Alert.alert(t('error'), t('bookingCheckIn') + ' / ' + t('bookingCheckOut'));
      return;
    }
    if (hasOccupiedInRange(checkIn, checkOut, bookedRanges)) {
      Alert.alert(t('error'), t('bookingDatesOccupied'));
      return;
    }
    if (!notMyCustomer && !selectedClient?.id) {
      Alert.alert(t('error'), t('bookingSelectClient') || 'Please select a client');
      return;
    }
    setSaving(true);
    try {
      let photoUrls = photos.filter((u) => !isLocalUri(u));
      const localPhotos = photos.filter(isLocalUri);
      for (let i = 0; i < localPhotos.length; i++) {
        const url = await uploadPhoto(localPhotos[i]);
        photoUrls.push(url);
      }
      const payload = {
        propertyId: property?.id,
        contactId: notMyCustomer ? null : selectedClient?.id,
        passportId: notMyCustomer ? '' : passportId.trim(),
        notMyCustomer,
        responsibleAgentId: isAgent ? null : (responsibleAgentId ?? null),
        checkIn: formatDateYMD(checkIn),
        checkOut: formatDateYMD(checkOut),
        checkInTime: checkInTime.trim() || null,
        checkOutTime: checkOutTime.trim() || null,
        priceMonthly: parseMoneyValue(priceMonthly),
        totalPrice: parseMoneyValue(totalPrice),
        bookingDeposit: parseMoneyValue(bookingDeposit),
        saveDeposit: parseMoneyValue(saveDeposit),
        commission: parseMoneyValue(commission),
        ownerCommissionOneTime: parseMoneyValue(ownerCommissionOneTime),
        ownerCommissionOneTimeIsPercent: ownerCommissionOneTimeIsPercent,
        ownerCommissionMonthly: parseMoneyValue(ownerCommissionMonthly),
        ownerCommissionMonthlyIsPercent: ownerCommissionMonthlyIsPercent,
        adults: adults.trim() ? parseInt(adults, 10) : null,
        children: children.trim() ? parseInt(children, 10) : null,
        pets,
        comments: comments.trim() || null,
        photos: photoUrls.length > 0 ? photoUrls : null,
        reminderDays: reminderDays.length > 0 ? reminderDays : [],
        monthlyBreakdown: Array.isArray(monthlyBreakdown) ? monthlyBreakdown : [],
        currency: activeCurrency,
      };
      if (editBooking?.id) {
        await cancelBookingReminders(editBooking.id);
        await cancelCommissionReminders(editBooking.id);
        const updated = await updateBooking(editBooking.id, payload);
        if (reminderDays.length > 0) {
          const granted = await requestReminderPermissions();
          if (granted) {
            const profile = await getCurrentUser();
            const settings = profile?.notificationSettings || {};
            await scheduleBookingReminders(editBooking.id, payload.checkIn, reminderDays, property?.name || houseCode, settings);
          }
        }
        const commDateAmounts = getCommissionEvents(payload);
        if (commDateAmounts.length > 0) {
          const granted = await requestReminderPermissions();
          if (granted) {
            const profile = await getCurrentUser();
            const settings = profile?.notificationSettings || {};
            await scheduleCommissionReminders(updated.id, commDateAmounts, property?.name || houseCode, settings);
          }
        }
        onSaved?.(updated);
      } else {
        const created = await createBooking(payload);
        if (created?.id) {
          const granted = await requestReminderPermissions();
          if (granted) {
            const profile = await getCurrentUser();
            const settings = profile?.notificationSettings || {};
            if (reminderDays.length > 0) {
              await scheduleBookingReminders(created.id, payload.checkIn, reminderDays, property?.name || houseCode, settings);
            }
            const commDateAmounts = getCommissionEvents(payload);
            if (commDateAmounts.length > 0) {
              await scheduleCommissionReminders(created.id, commDateAmounts, property?.name || houseCode, settings);
            }
          }
        }
        onSaved?.();
      }
      onClose?.();
    } catch (e) {
      const msg = e.message === 'BOOKING_CONFLICT'
        ? t('bookingConflictError')
        : (e.message || 'Failed to save booking');
      Alert.alert(t('error'), msg);
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  const header = (
    <>
      <View style={s.headerRow}>
        <View style={s.headerSpacer} />
        <View style={s.headerCenter}>
          <Text style={s.title} numberOfLines={1}>
            {editBooking ? t('editBookingTitle') : t('addBookingTitle')}
          </Text>
        </View>
        <TouchableOpacity onPress={onClose} style={s.closeBtn} activeOpacity={0.7}>
          <Ionicons name="close" size={22} color="#888" />
        </TouchableOpacity>
      </View>
      <View style={s.dotsRow}>
        {(notMyCustomer ? [1, 2] : [1, 2, 3, 4]).map((i) => {
          const dotStyle = i < step ? s.dotPassed : i === step ? s.dotActive : s.dot;
          return <View key={i} style={dotStyle} />;
        })}
      </View>
    </>
  );

  const isFirstStep = step === 1;
  const isLastStep = step === 4 || (step === 2 && notMyCustomer);
  const showSaveIcon = !isLastStep;
  const handlePrimaryPress =
    step === 1 ? handleNext :
    step === 2 ? handleNextFromDates :
    step === 4 ? handleSave :
    handleNextFromStep3;

  const footer = (
    <WizardFooter
      isFirstStep={isFirstStep}
      isLastStep={isLastStep}
      onBack={handleBack}
      onNext={handlePrimaryPress}
      onSave={handleSave}
      canSave={canSave}
      saving={saving}
      showSaveIcon={showSaveIcon}
      backLabel={`‹  ${t('wizBack')}`}
      nextLabel={`${t('wizNext')}  ›`}
      saveLabel={t('save')}
    />
  );

  const extraOverlay = (
    <>
      {clientPickerVisible && (
        <Pressable style={s.pickerBackdrop} onPress={() => setClientPickerVisible(false)}>
          {Platform.OS === 'web' ? (
            <View style={[StyleSheet.absoluteFill, s.backdropWeb]} />
          ) : (
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          )}
          <Pressable style={s.pickerBox} onPress={(e) => e.stopPropagation()}>
            <View style={s.pickerHeader}>
              <Text style={s.pickerTitle}>{t('bookingChooseClient')}</Text>
              <TouchableOpacity
                onPress={() => setClientPickerVisible(false)}
                style={s.closeBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={22} color="#888" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={s.addNewRow}
              onPress={() => { setClientPickerVisible(false); setAddContactVisible(true); }}
              activeOpacity={0.7}
            >
              <Text style={s.addNewText}>+ {t('addNewContact')}</Text>
            </TouchableOpacity>
            <TextInput
              style={s.searchInput}
              placeholder={t('search')}
              placeholderTextColor="#999"
              value={clientSearch}
              onChangeText={setClientSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {loadingClients ? (
              <View style={s.loadingWrap}>
                <ActivityIndicator size="small" color={COLORS.accent} />
              </View>
            ) : (
              <ScrollView
                style={s.pickerScroll}
                contentContainerStyle={s.pickerScrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={true}
              >
                {filteredClients.map((c) => {
                  const display = `${c.name} ${c.lastName}`.trim() || c.phone || '—';
                  const isSelected = pickerSelectedClient?.id === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={s.pickerItem}
                      onPress={() => setPickerSelectedClient(c)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[s.pickerItemText, isSelected && s.pickerItemSelected]}
                        numberOfLines={1}
                      >
                        {display}
                      </Text>
                      {isSelected && <Text style={s.pickerCheck}>✓</Text>}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
            <TouchableOpacity
              style={s.selectBtn}
              onPress={() => {
                setSelectedClient(pickerSelectedClient);
                setClientPickerVisible(false);
              }}
              activeOpacity={0.7}
            >
              <Text style={s.selectBtnText}>{t('filterSelect')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      )}

      {timePickerFor && (
        <Pressable style={s.datePickerOverlay} onPress={() => setTimePickerFor(null)}>
          <Pressable style={s.datePickerContainer} onPress={(e) => e.stopPropagation()}>
            <View style={s.datePickerHeader}>
              <Text style={s.datePickerTitle}>
                {timePickerFor === 'checkIn' ? t('bookingCheckInTime') : t('bookingCheckOutTime')}
              </Text>
              <TouchableOpacity onPress={() => setTimePickerFor(null)} activeOpacity={0.7}>
                <Text style={s.timeSelectBtnText}>{t('agentCalendarTimeSelectBtn')}</Text>
              </TouchableOpacity>
            </View>
            <View style={s.timePickerSpinnerWrap}>
              <DateTimePicker
                value={timePickerFor === 'checkIn' ? parseTimeToDate(checkInTime) : parseTimeToDate(checkOutTime)}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                style={Platform.OS === 'ios' ? s.datePickerSpinner : null}
                onChange={(event, selectedDate) => {
                  if (selectedDate && event.type !== 'dismissed') {
                    const str = formatDateToTime(selectedDate);
                    if (timePickerFor === 'checkIn') setCheckInTime(str);
                    else setCheckOutTime(str);
                    if (Platform.OS === 'android') setTimePickerFor(null);
                  }
                }}
              />
            </View>
          </Pressable>
        </Pressable>
      )}

      {datePickerFor && (
        <Pressable style={s.datePickerOverlay} onPress={() => setDatePickerFor(null)}>
          <Pressable style={s.datePickerContainer} onPress={(e) => e.stopPropagation()}>
            <View style={s.datePickerHeader}>
              <Text style={s.datePickerTitle}>
                {datePickerFor === 'checkIn' ? t('bookingCheckIn') : t('bookingCheckOut')}
              </Text>
              <TouchableOpacity onPress={() => setDatePickerFor(null)} activeOpacity={0.7}>
                <Text style={s.datePickerDoneText}>OK</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={
                datePickerFor === 'checkIn'
                  ? (checkIn || new Date())
                  : (checkOut || checkIn || new Date())
              }
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              minimumDate={datePickerFor === 'checkOut' && checkIn ? checkIn : new Date()}
              style={Platform.OS === 'ios' ? s.datePickerSpinner : null}
              onChange={(event, selectedDate) => {
                if (selectedDate) {
                  if (datePickerFor === 'checkIn') {
                    setCheckIn(selectedDate);
                    if (checkOut && selectedDate >= checkOut) setCheckOut(null);
                  } else {
                    setCheckOut(selectedDate);
                  }
                  if (Platform.OS === 'android') setDatePickerFor(null);
                }
              }}
            />
          </Pressable>
        </Pressable>
      )}
    </>
  );

  return (
    <>
      <ModalScrollFrame
        visible={visible}
        onRequestClose={onClose}
        header={header}
        footer={footer}
        extraOverlay={extraOverlay}
        boxWrapStyle={{ maxWidth: 380 }}
        boxStyle={{ backgroundColor: '#FFFFFF' }}
        scrollContentContainerStyle={step === 2 ? s.step2Content : s.scrollContent}
        scrollProps={{
          showsVerticalScrollIndicator: true,
          keyboardShouldPersistTaps: 'handled',
          keyboardDismissMode: 'on-drag',
          onScrollBeginDrag: Keyboard.dismiss,
          indicatorStyle: 'black',
          nestedScrollEnabled: true,
          scrollEventThrottle: 16,
          bounces: true,
        }}
      >
              {step === 2 ? (
                <>
                  <Text style={[s.fieldLabel, s.fieldLabelStep2]}>{t('bookingDates')}</Text>
                  <View style={s.dateRowReadonlyStep2}>
                    <View style={s.dateField}>
                      <Text style={[s.dateFieldText, !checkIn && s.dateFieldPlaceholder]}>{checkIn ? formatDateDisplay(checkIn) : t('bookingCheckIn')}</Text>
                    </View>
                    <Text style={s.dateDash}>—</Text>
                    <View style={s.dateField}>
                      <Text style={[s.dateFieldText, !checkOut && s.dateFieldPlaceholder]}>{checkOut ? formatDateDisplay(checkOut) : t('bookingCheckOut')}</Text>
                    </View>
                  </View>
                  <View style={[s.calendarInline, s.calendarInlineStep2]} collapsable={false}>
                    <CalendarRangePicker
                      locale={CALENDAR_LOCALES[language] || CALENDAR_LOCALES.en}
                      startDate={checkIn ? formatDateYMD(checkIn) : null}
                      endDate={checkOut ? formatDateYMD(checkOut) : null}
                      disabledDates={calendarOccupancy.disabledDates}
                        occupiedCheckInDates={calendarOccupancy.checkInDates}
                        occupiedCheckOutDates={calendarOccupancy.checkOutDates}
                      onChange={({ startDate, endDate }) => {
                        if (startDate) setCheckIn(new Date(startDate));
                        if (endDate) setCheckOut(new Date(endDate));
                      }}
                      pastYearRange={1}
                      futureYearRange={2}
isMonthFirst
                        dimPastDates
                      style={{
                        container: { backgroundColor: 'transparent', paddingTop: 11, paddingBottom: 11 },
                        dayNameText: { color: '#bababe' },
                        monthOverlayContainer: {
                          width: Math.round((Math.min(Dimensions.get('window').width - 72, 368)) * 0.8),
                          backgroundColor: '#FFFFFF',
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: '#E5E5EA',
                          overflow: 'hidden',
                          marginRight: 16,
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.15,
                          shadowRadius: 12,
                          elevation: 6,
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
                        const w = Math.round((Math.min(Dimensions.get('window').width - 72, 368)) * 0.8);
                        const slot = w + 16;
                        const boxWidth = Math.min(400, Dimensions.get('window').width - 40);
                        const viewportW = boxWidth - 40;
                        const padH = Math.max(20, (viewportW - w) / 2);
                        const monthCount = (1 + 2) * 12;
                        return {
                          horizontal: true,
                          nestedScrollEnabled: true,
                          removeClippedSubviews: false,
                          scrollEventThrottle: 16,
                          bounces: true,
                          alwaysBounceHorizontal: true,
                          snapToOffsets: Array.from({ length: monthCount }, (_, i) => i * slot),
                          snapToAlignment: 'center',
                          decelerationRate: 'fast',
                          getItemLayout: (_, index) => ({ length: slot, offset: slot * index, index }),
                          contentContainerStyle: { paddingHorizontal: padH },
                          showsHorizontalScrollIndicator: false,
                        };
                      })()}
                    />
                  </View>

                  <View style={s.timeBlock}>
                    <View style={s.timeRow}>
                      <View style={s.timeFieldWrap}>
                        <Text style={s.fieldLabel}>{t('bookingCheckInTime')}</Text>
                        <TouchableOpacity
                          style={s.timeSelectRow}
                          onPress={() => { Keyboard.dismiss(); setTimePickerFor('checkIn'); }}
                          activeOpacity={0.7}
                        >
                          <Text style={s.timeSelectText}>{checkInTime || '14:00'}</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={s.timeFieldWrap}>
                        <Text style={s.fieldLabel}>{t('bookingCheckOutTime')}</Text>
                        <TouchableOpacity
                          style={s.timeSelectRow}
                          onPress={() => { Keyboard.dismiss(); setTimePickerFor('checkOut'); }}
                          activeOpacity={0.7}
                        >
                          <Text style={s.timeSelectText}>{checkOutTime || '12:00'}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </>
              ) : step === 4 ? (
                <>
                  <View style={s.mediaSectionTitleRow}>
                    <Ionicons name="notifications-outline" size={22} color="#888" />
                    <Text style={s.mediaSectionTitle}>{t('bookingNotifications')}</Text>
                  </View>
                  <TouchableOpacity
                    style={s.reminderTriggerBtn}
                    onPress={() => setReminderPickerOpen(!reminderPickerOpen)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.reminderTriggerText, reminderDays.length === 0 && s.reminderTriggerPlaceholder]}>
                      {reminderDays.length > 0
                        ? reminderDays.map((d) => t(BOOKING_REMINDER_OPTIONS.find(o => o.days === d)?.key || 'bookingReminder1d')).join(', ')
                        : t('bookingAddNotification')}
                    </Text>
                    <Ionicons name={reminderPickerOpen ? 'chevron-up' : 'chevron-down'} size={14} color="#6B6B6B" />
                  </TouchableOpacity>
                  {reminderPickerOpen && (
                    <View style={s.reminderOptionsWrap}>
                      {BOOKING_REMINDER_OPTIONS.map((opt) => {
                        const isSelected = reminderDays.includes(opt.days);
                        return (
                          <TouchableOpacity
                            key={opt.days}
                            style={[s.reminderOption, isSelected && s.reminderOptionSelected]}
                            onPress={() => {
                              setReminderDays((prev) =>
                                isSelected ? prev.filter((x) => x !== opt.days) : [...prev, opt.days].sort((a, b) => a - b)
                              );
                            }}
                            activeOpacity={0.7}
                          >
                            <Text style={[s.reminderOptionText, isSelected && s.reminderOptionTextSelected]}>{t(opt.key)}</Text>
                          </TouchableOpacity>
                        );
                      })}
                      <TouchableOpacity style={s.reminderSelectBtn} onPress={() => setReminderPickerOpen(false)} activeOpacity={0.7}>
                        <Text style={s.reminderSelectBtnText}>{t('bookingReminderSelect')}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  <View style={[s.mediaSectionTitleRow, { marginTop: 20 }]}>
                    <IconPhoto size={22} color="#888" />
                    <Text style={s.mediaSectionTitle}>{t('pdPhoto')}</Text>
                  </View>
                  <View style={s.mediaGrid}>
                    {photos.map((uri, i) => (
                      <View key={i} style={s.mediaThumbWrap}>
                        <Image source={{ uri }} style={s.mediaThumb} resizeMode="cover" />
                        <TouchableOpacity style={s.mediaRemoveBtn} onPress={() => removePhoto(i)} activeOpacity={0.7}>
                          <Text style={s.mediaRemoveText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                    {photos.length < MAX_BOOKING_PHOTOS && (
                      <TouchableOpacity style={s.mediaAddBtn} onPress={pickPhoto} activeOpacity={0.7} disabled={photoProcessing}>
                        {photoProcessing ? (
                          <ActivityIndicator size="small" color={COLORS.accent} />
                        ) : (
                          <>
                            <Ionicons name="add-outline" size={28} color="#888" />
                            <Text style={s.mediaAddLabel}>{t('wizAddPhoto')}</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                  {photos.length >= MAX_BOOKING_PHOTOS && (
                    <Text style={s.mediaLimitNote}>{t('wizPhotoLimit')}</Text>
                  )}
                </>
              ) : (
                step === 1 ? (
                  <>
                    <Text style={s.fieldLabel}>{t('bookingHouseCode')}</Text>
                    <View style={s.readOnlyField}>
                      <Text style={s.readOnlyText}>{houseCode || '—'}</Text>
                    </View>

                    <View style={s.section}>
                      <CheckRow
                        label={t('bookingNotMyCustomer')}
                        checked={notMyCustomer}
                        onPress={() => setNotMyCustomer(!notMyCustomer)}
                      />
                    </View>

                    <Text style={s.fieldLabel}>{t('bookingChooseClient')}</Text>
                    <TouchableOpacity
                      style={[s.selectField, notMyCustomer && s.selectFieldDisabled]}
                      onPress={() => !notMyCustomer && setClientPickerVisible(true)}
                      activeOpacity={0.8}
                      disabled={notMyCustomer}
                    >
                      <Text
                        style={[s.selectFieldText, !selectedClient && s.selectFieldPlaceholder]}
                        numberOfLines={1}
                      >
                        {selectedClient
                          ? `${selectedClient.name} ${selectedClient.lastName}`.trim() || selectedClient.phone
                          : t('bookingChooseClientPlaceholder')}
                      </Text>
                      <Ionicons
                        name="chevron-down"
                        size={14}
                        color={notMyCustomer ? '#C7C7CC' : '#6B6B6B'}
                      />
                    </TouchableOpacity>

                    <View style={[s.inputWithIconRow, notMyCustomer && s.inputWithIconRowDisabled]}>
                      <Ionicons name="card-outline" size={16} color="#6B6B6B" style={{ marginRight: 10 }} />
                      <TextInput
                        style={[s.input, s.inputWithIconInput, notMyCustomer && s.inputDisabled]}
                        value={passportId}
                        onChangeText={setPassportId}
                        placeholder={t('bookingPassportIdPlaceholder')}
                        placeholderTextColor={COLORS.placeholder}
                        editable={!notMyCustomer}
                      />
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={s.fieldLabel}>{t('pdPriceMonthly')} {sym}</Text>
                    <TextInput
                      style={[s.input, monthlyBreakdown.length > 0 && s.inputDisabled]}
                      value={priceMonthly}
                      onChangeText={(v) => setPriceMonthly(formatMoneyDisplay(v))}
                      placeholder="0"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                      editable={monthlyBreakdown.length === 0}
                    />

                    <Text style={s.fieldLabel}>{t('bookingTotalPrice')} {sym}</Text>
                    <TextInput
                      style={s.input}
                      value={totalPrice}
                      onChangeText={(v) => setTotalPrice(formatMoneyDisplay(v))}
                      placeholder="0"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                    />

                    {/* TD-082: помесячная разбивка стоимости */}
                    <View style={s.breakdownBlock}>
                      <View style={s.breakdownHeader}>
                        <Text style={s.breakdownTitle}>{t('breakdownTitle')}</Text>
                        <Switch
                          style={{ transform: [{ scale: SCALE }] }}
                          trackColor={{ false: '#D1D1D6', true: '#3D7D82' }}
                          thumbColor="#FFFFFF"
                          ios_backgroundColor="#D1D1D6"
                          value={monthlyBreakdown.length > 0}
                          onValueChange={(on) => {
                            if (on) {
                              const auto = computeMonthlyBreakdown(checkIn, checkOut, parseMoneyValue(priceMonthly));
                              setMonthlyBreakdown(auto);
                            } else {
                              setMonthlyBreakdown([]);
                            }
                          }}
                        />
                      </View>
                      {monthlyBreakdown.length > 0 && (
                        <>
                          {monthlyBreakdown.map((row, idx) => (
                            <View key={`${row.month}-${idx}`} style={s.breakdownRow}>
                              <Text style={s.breakdownMonth}>{dayjs(row.month + '-01').format('MMMM YYYY')}</Text>
                              <TextInput
                                style={[s.input, s.breakdownAmountInput]}
                                value={row.amount != null ? String(row.amount) : ''}
                                onChangeText={(v) => {
                                  const cleaned = v.replace(/[^0-9]/g, '');
                                  const next = monthlyBreakdown.map((r, i) =>
                                    i === idx ? { ...r, amount: cleaned ? Number(cleaned) : 0 } : r
                                  );
                                  setMonthlyBreakdown(next);
                                }}
                                keyboardType="numeric"
                                placeholder="0"
                                placeholderTextColor="#999"
                              />
                              <Text style={s.breakdownCurrency}>{sym}</Text>
                            </View>
                          ))}
                          <TouchableOpacity
                            style={s.breakdownRecalcBtn}
                            onPress={() => {
                              const auto = computeMonthlyBreakdown(checkIn, checkOut, parseMoneyValue(priceMonthly));
                              setMonthlyBreakdown(auto);
                            }}
                            activeOpacity={0.7}
                          >
                            <Text style={s.breakdownRecalcText}>↻ {t('breakdownRecalc')}</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>

                    <Text style={s.fieldLabel}>{t('pdBookingDeposit')} {sym}</Text>
                    <TextInput
                      style={s.input}
                      value={bookingDeposit}
                      onChangeText={(v) => setBookingDeposit(formatMoneyDisplay(v))}
                      placeholder="0"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                    />

                    <Text style={s.fieldLabel}>{t('pdSaveDeposit')} {sym}</Text>
                    <TextInput
                      style={s.input}
                      value={saveDeposit}
                      onChangeText={(v) => setSaveDeposit(formatMoneyDisplay(v))}
                      placeholder="0"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                    />

                    <Text style={s.fieldLabel}>{t('pdCommission')} {sym}</Text>
                    <TextInput
                      style={s.input}
                      value={commission}
                      onChangeText={(v) => setCommission(formatMoneyDisplay(v))}
                      placeholder="0"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                    />

                    <PercentMoneyField
                      label={t('bookingOwnerCommOnce')}
                      sym={sym}
                      priceMonthly={priceMonthly}
                      checkIn={checkIn}
                      checkOut={checkOut}
                      monthlyBreakdown={monthlyBreakdown}
                      kind="oneTime"
                      value={ownerCommissionOneTime}
                      onChangeValue={setOwnerCommissionOneTime}
                      isPercent={ownerCommissionOneTimeIsPercent}
                      onChangePercent={setOwnerCommissionOneTimeIsPercent}
                    />

                    <PercentMoneyField
                      label={t('ownerCommissionMonthly')}
                      sym={sym}
                      priceMonthly={priceMonthly}
                      checkIn={checkIn}
                      checkOut={checkOut}
                      monthlyBreakdown={monthlyBreakdown}
                      kind="monthly"
                      value={ownerCommissionMonthly}
                      onChangeValue={setOwnerCommissionMonthly}
                      isPercent={ownerCommissionMonthlyIsPercent}
                      onChangePercent={setOwnerCommissionMonthlyIsPercent}
                    />

                    <Text style={s.fieldLabel}>{t('bookingAdults')}</Text>
                    <TextInput
                      style={s.input}
                      value={adults}
                      onChangeText={setAdults}
                      placeholder="0"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                    />

                    <Text style={s.fieldLabel}>{t('bookingChildren')}</Text>
                    <TextInput
                      style={s.input}
                      value={children}
                      onChangeText={setChildren}
                      placeholder="0"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                    />

                    <View style={s.section}>
                      <CheckRow label={t('pdPets')} checked={pets} onPress={() => setPets(!pets)} />
                    </View>

                    {/* Responsible agent picker — admin only, when the property has a responsible agent */}
                    {!isAgent && property?.responsible_agent_id && (() => {
                      const houseAgentId = property.responsible_agent_id;
                      const houseAgent = teamMembers.find(m => m.user_id === houseAgentId);
                      const houseAgentLabel = houseAgent
                        ? ([houseAgent.name, houseAgent.last_name].filter(Boolean).join(' ') || houseAgent.email || 'Agent')
                        : 'Agent';
                      const companyLabel = user?.companyInfo?.name || user?.teamMembership?.companyName || t('workAsCompany') || 'Company';
                      const selected = responsibleAgentId || null;
                      return (
                        <>
                          <Text style={s.fieldLabel}>{t('bkResponsible') || 'Responsible'}</Text>
                          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                            <TouchableOpacity
                              onPress={() => setResponsibleAgentId(null)}
                              style={{
                                flex: 1, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 8,
                                borderWidth: 1,
                                borderColor: selected === null ? '#3D7D82' : '#E0E0E0',
                                backgroundColor: selected === null ? '#EAF4F5' : '#FFF',
                              }}
                            >
                              <Text style={{ color: '#212529', fontSize: 14 }} numberOfLines={1}>{companyLabel}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => setResponsibleAgentId(houseAgentId)}
                              style={{
                                flex: 1, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 8,
                                borderWidth: 1,
                                borderColor: selected === houseAgentId ? '#3D7D82' : '#E0E0E0',
                                backgroundColor: selected === houseAgentId ? '#EAF4F5' : '#FFF',
                              }}
                            >
                              <Text style={{ color: '#212529', fontSize: 14 }} numberOfLines={1}>{houseAgentLabel}</Text>
                            </TouchableOpacity>
                          </View>
                        </>
                      );
                    })()}

                    <Text style={s.fieldLabel}>{t('pdComments')}</Text>
                    <TextInput
                      style={[s.input, s.inputMultiline]}
                      value={comments}
                      onChangeText={setComments}
                      placeholder={t('wizCommPlaceholder')}
                      placeholderTextColor="#999"
                      multiline
                    />
                  </>
                )
              )}

        <AddContactModal
          visible={addContactVisible}
          onClose={() => setAddContactVisible(false)}
          onSave={handleSaveContact}
          contactType="clients"
          editContact={null}
        />
      </ModalScrollFrame>
    </>
  );
}

const s = StyleSheet.create({
  backdropWeb: {
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 16, paddingHorizontal: 16, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.07)',
  },
  headerSpacer: { width: 36 },
  headerCenter: { flex: 1, alignItems: 'center' },
  title: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.3,
    color: COLORS.title,
    textAlign: 'center',
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 6,
    paddingTop: 14, paddingBottom: 16,
  },
  dot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.dot },
  dotPassed: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.dotPassed },
  dotActive: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.dotActive },
  mediaSectionTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  mediaSectionTitleIcon: { width: 22, height: 22 },
  mediaSectionTitle: { fontSize: 16, fontWeight: '600', color: COLORS.title },
  reminderTriggerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 14,
    backgroundColor: COLORS.inputBg, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.border,
    marginBottom: 10, minHeight: 46,
  },
  reminderTriggerText: { fontSize: 16, fontWeight: '600', color: COLORS.title },
  reminderTriggerPlaceholder: { color: '#999' },
  reminderChevron: { fontSize: 12, color: '#6B6B6B' },
  reminderOptionsWrap: {
    marginBottom: 14,
    backgroundColor: COLORS.inputBg, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden',
  },
  reminderOption: {
    paddingVertical: 12, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  reminderOptionSelected: { backgroundColor: 'rgba(61,125,130,0.08)' },
  reminderOptionText: { fontSize: 16, color: COLORS.title },
  reminderOptionTextSelected: { fontWeight: '600', color: COLORS.accent },
  reminderSelectBtn: {
    marginTop: 8, paddingVertical: 10, paddingHorizontal: 20,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 12, borderWidth: 1.5,
    borderColor: COLORS.accent, backgroundColor: 'transparent',
  },
  reminderSelectBtnText: { fontSize: 16, fontWeight: '600', color: COLORS.accent },
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  mediaThumbWrap: { width: 90, height: 90, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  mediaThumb: { width: '100%', height: '100%' },
  mediaRemoveBtn: {
    position: 'absolute', top: 4, right: 4,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  mediaRemoveText: { fontSize: 12, color: '#FFF', fontWeight: '700' },
  mediaAddBtn: {
    width: 90, height: 90, borderRadius: 12,
    borderWidth: 1.5, borderColor: COLORS.border, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.inputBg,
  },
  mediaAddLabel: { fontSize: 10, color: '#999', marginTop: 2, textAlign: 'center' },
  mediaLimitNote: { fontSize: 12, color: '#999', fontStyle: 'italic', marginTop: 6 },
  scroll: { flexShrink: 1 },
  scrollContent: {
    padding: 20, paddingBottom: 0,
    flexGrow: 0,
  },
  step2Content: {
    padding: 16, paddingBottom: 16,
  },
  fieldLabel: {
    fontSize: 12, fontWeight: '600', color: COLORS.label,
    letterSpacing: 0.7, textTransform: 'uppercase',
    marginBottom: 8,
  },
  fieldLabelStep2: { marginBottom: 6 },
  readOnlyField: {
    backgroundColor: COLORS.inputBg, borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 14,
    borderWidth: 1, borderColor: COLORS.border,
    marginBottom: 16, minHeight: 46,
  },
  readOnlyText: {
    fontSize: 16, color: COLORS.title,
  },
  section: { marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  rowLabel: { fontSize: 16, color: COLORS.title, flex: 1 },
  selectField: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.inputBg, borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 14,
    borderWidth: 1, borderColor: COLORS.border,
    marginBottom: 16, minHeight: 46,
  },
  selectFieldDisabled: {
    backgroundColor: '#EDEDEC',
    opacity: 0.7,
  },
  selectFieldText: { fontSize: 16, color: COLORS.title, flex: 1 },
  selectFieldPlaceholder: { color: COLORS.placeholder },
  input: {
    backgroundColor: COLORS.inputBg, borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 14,
    fontSize: 16, color: COLORS.title,
    borderWidth: 1, borderColor: COLORS.border,
    marginBottom: 16, minHeight: 46,
  },
  inputDisabled: {
    backgroundColor: '#EDEDEC',
    opacity: 0.7,
    color: '#999',
  },
  inputWithIconRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.inputBg, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.border,
    paddingLeft: 14, marginBottom: 16, minHeight: 46,
  },
  inputWithIconRowDisabled: {
    backgroundColor: '#EDEDEC',
    opacity: 0.7,
  },
  inputWithIconInput: {
    flex: 1, marginBottom: 0,
    paddingLeft: 0, borderWidth: 0,
    backgroundColor: 'transparent',
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  dateRowReadonly: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  dateRowReadonlyStep2: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  dateField: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.inputBg, borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 14,
    borderWidth: 1, borderColor: COLORS.border,
    minHeight: 46,
  },
  dateFieldText: { fontSize: 16, color: COLORS.title },
  dateFieldPlaceholder: { color: '#999' },
  dateDash: { fontSize: 16, color: '#888' },
  inputMultiline: { minHeight: 80 },
  calendarInline: { marginBottom: 16 },
  calendarInlineStep2: { marginBottom: 16 },
  timeBlock: {
    marginTop: 14, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)',
  },
  timeRow: { flexDirection: 'row', gap: 12 },
  timeFieldWrap: { flex: 1 },
  timeSelectRow: {
    backgroundColor: COLORS.inputBg, borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 14,
    borderWidth: 1, borderColor: COLORS.border,
    marginTop: 6, minHeight: 46,
  },
  timeSelectText: { fontSize: 16, color: COLORS.title },
  timeSelectBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.accent },
  datePickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  datePickerContainer: {
    backgroundColor: COLORS.boxBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  datePickerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  datePickerTitle: { fontSize: 16, fontWeight: '600', color: COLORS.title },
  datePickerDoneText: { fontSize: 16, fontWeight: '600', color: COLORS.accent },
  datePickerSpinner: { height: 200 },
  timePickerSpinnerWrap: {
    alignItems: 'center',
  },
  pickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center',
    padding: 24,
  },
  pickerBox: {
    width: '100%', maxWidth: 400, maxHeight: '80%',
    backgroundColor: COLORS.boxBg, borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)',
  },
  pickerHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  pickerTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: COLORS.title },
  addNewRow: {
    paddingVertical: 14, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  addNewText: { fontSize: 16, color: COLORS.accent, fontWeight: '600' },
  searchInput: {
    marginHorizontal: 16, marginVertical: 8,
    backgroundColor: COLORS.inputBg, borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 14,
    fontSize: 16, color: COLORS.title,
    borderWidth: 1, borderColor: COLORS.border,
  },
  loadingWrap: { padding: 40, alignItems: 'center' },
  pickerScroll: { maxHeight: 280 },
  pickerScrollContent: { paddingBottom: 8 },
  pickerItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 20,
  },
  pickerItemText: { fontSize: 16, color: COLORS.title, flex: 1 },
  pickerItemSelected: { fontWeight: '600', color: COLORS.accent },
  pickerCheck: { fontSize: 16, fontWeight: '700', color: COLORS.accent },
  selectBtn: {
    paddingVertical: 10, paddingHorizontal: 20,
    marginHorizontal: 20, marginVertical: 16,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 12, borderWidth: 1.5,
    borderColor: COLORS.accent,
    backgroundColor: 'transparent',
  },
  selectBtnText: { fontSize: 16, fontWeight: '600', color: COLORS.accent },
  // TD-082: помесячная разбивка
  breakdownBlock:        { marginTop: 12, marginBottom: 12, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(255,255,255,0.5)' },
  breakdownHeader:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  breakdownTitle:        { fontSize: 14, fontWeight: '600', color: COLORS.title },
  breakdownRow:          { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  breakdownMonth:        { flex: 1, fontSize: 14, color: COLORS.title, textTransform: 'capitalize' },
  breakdownAmountInput:  { flex: 1, marginTop: 0 },
  breakdownCurrency:     { fontSize: 14, color: '#888', minWidth: 28 },
  breakdownRecalcBtn:    { marginTop: 12, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: COLORS.accent, alignSelf: 'flex-start' },
  breakdownRecalcText:   { fontSize: 14, color: COLORS.accent, fontWeight: '600' },
});
