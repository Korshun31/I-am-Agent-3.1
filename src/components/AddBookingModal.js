import React, { useState, useEffect, useCallback } from 'react';
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
  KeyboardAvoidingView,
  Keyboard,
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import dayjs from 'dayjs';
import CalendarRangePicker from 'react-native-calendar-range-picker';
import { useLanguage } from '../context/LanguageContext';
import { getCurrencySymbol } from '../utils/currency';
import { createContact, getContactById } from '../services/contactsService';
import { createBooking, updateBooking } from '../services/bookingsService';
import { getActiveTeamMembers } from '../services/companyService';
import { useAppData } from '../context/AppDataContext';
import { useUser } from '../context/UserContext';
import { scheduleBookingReminders, cancelBookingReminders } from '../services/bookingRemindersService';
import { getCommissionDateAmounts, scheduleCommissionReminders, cancelCommissionReminders } from '../services/commissionRemindersService';
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
/** Compute all occupied dates (YYYY-MM-DD) from existing bookings */
function getOccupiedDates(bookings) {
  const set = new Set();
  (bookings || []).forEach((b) => {
    if (!b.checkIn || !b.checkOut) return;
    const start = dayjs(b.checkIn);
    const end = dayjs(b.checkOut);
    let d = start;
    while (d.isBefore(end) || d.isSame(end, 'day')) {
      set.add(d.format('YYYY-MM-DD'));
      d = d.add(1, 'day');
    }
  });
  return Array.from(set);
}

/** Dates that are check-in for some booking */
function getOccupiedCheckInDates(bookings) {
  return (bookings || []).filter((b) => b.checkIn).map((b) => dayjs(b.checkIn).format('YYYY-MM-DD'));
}

/** Dates that are check-out for some booking */
function getOccupiedCheckOutDates(bookings) {
  return (bookings || []).filter((b) => b.checkOut).map((b) => dayjs(b.checkOut).format('YYYY-MM-DD'));
}

/** Check if range [checkIn, checkOut] overlaps with occupied dates */
function hasOverlapWithOccupied(checkIn, checkOut, occupiedDates) {
  if (!checkIn || !checkOut || !occupiedDates?.length) return false;
  const start = dayjs(checkIn);
  const end = dayjs(checkOut);
  const occSet = new Set(occupiedDates);
  let d = start;
  while (d.isBefore(end) || d.isSame(end, 'day')) {
    if (occSet.has(d.format('YYYY-MM-DD'))) return true;
    d = d.add(1, 'day');
  }
  return false;
}

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

function computeTotalPrice(checkIn, checkOut, priceMonthly) {
  if (!checkIn || !checkOut || !priceMonthly || priceMonthly <= 0) return null;
  const p = Number(priceMonthly);
  const start = checkIn instanceof Date ? checkIn : new Date(checkIn);
  const end = checkOut instanceof Date ? checkOut : new Date(checkOut);
  if (start >= end) return null;

  let total = 0;
  let current = new Date(start);

  while (current < end) {
    const nextMonth = new Date(current.getFullYear(), current.getMonth() + 1, current.getDate());

    if (nextMonth <= end) {
      // Полный месяц
      total += p;
      current = nextMonth;
    } else {
      // Неполный остаток — пропорционально дням в текущем месяце
      const daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
      const daysRemaining = Math.round((end - current) / 86400000);
      total += Math.round(p / daysInMonth * daysRemaining);
      current = end;
    }
  }

  return total;
}

const COLORS = {
  boxBg: 'rgba(255,255,255,0.72)',
  title: '#2C2C2C',
  inputBg: '#F5F2EB',
  border: '#E0D8CC',
  saveGreen: '#2E7D32',
  dot: '#D5D5D0',
  dotActive: '#2E7D32',
};

function CheckRow({ label, checked, onPress }) {
  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[s.checkbox, checked && s.checkboxChecked]}>
        {checked && <Text style={s.checkMark}>✓</Text>}
      </View>
      <Text style={s.rowLabel}>{label}</Text>
    </TouchableOpacity>
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
  const [occupiedDates, setOccupiedDates] = useState([]);
  const [occupiedCheckInDates, setOccupiedCheckInDates] = useState([]);
  const [occupiedCheckOutDates, setOccupiedCheckOutDates] = useState([]);
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
    if (!editBooking && computedTotal != null) {
      setTotalPrice(formatMoneyDisplay(String(Math.round(computedTotal))));
    }
  }, [computedTotal, !!editBooking]);

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
      setOccupiedDates(getOccupiedDates(toUse));
      setOccupiedCheckInDates(getOccupiedCheckInDates(toUse));
      setOccupiedCheckOutDates(getOccupiedCheckOutDates(toUse));
    } else {
      setOccupiedDates([]);
      setOccupiedCheckInDates([]);
      setOccupiedCheckOutDates([]);
    }
  }, [step, property?.id, editBooking?.id]);

  useEffect(() => {
    if (selectedClient) {
      setPassportId(selectedClient.documentNumber || '');
    } else {
      setPassportId('');
    }
  }, [selectedClient]);

  const handleSaveContact = async (data) => {
    try {
      const created = await createContact({ ...data, type: 'clients' });
      refreshGlobalContacts();
      setSelectedClient(created);
      setAddContactVisible(false);
      setClientPickerVisible(false);
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
    if (hasOverlapWithOccupied(checkIn, checkOut, occupiedDates)) {
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
    if (hasOverlapWithOccupied(checkIn, checkOut, occupiedDates)) {
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
        const commDateAmounts = getCommissionDateAmounts(checkIn, checkOut, parseMoneyValue(ownerCommissionOneTime), parseMoneyValue(ownerCommissionMonthly));
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
            const commDateAmounts = getCommissionDateAmounts(checkIn, checkOut, parseMoneyValue(ownerCommissionOneTime), parseMoneyValue(ownerCommissionMonthly));
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

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={Keyboard.dismiss}>
        {Platform.OS === 'web' ? (
          <View style={[StyleSheet.absoluteFill, s.backdropWeb]} />
        ) : (
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        )}
        <KeyboardAvoidingView
          style={s.keyboardWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={40}
        >
          <View style={[s.boxWrap, (step === 3 || step === 4) && s.boxWrapStep3]} pointerEvents="box-none">
            <View style={[s.box, (step === 3 || step === 4) && s.boxStep3]}>
              <View style={s.headerRow}>
                <View style={s.headerSpacer} />
                <Text style={s.title}>{editBooking ? t('editBookingTitle') : t('addBookingTitle')}</Text>
                <TouchableOpacity onPress={onClose} style={s.closeBtn} activeOpacity={0.8}>
                  <Text style={s.closeIcon}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={s.dotsRow}>
                {(notMyCustomer ? [1, 2] : [1, 2, 3, 4]).map((i) => (
                  <View key={i} style={[s.dot, i <= step && s.dotActive]} />
                ))}
              </View>

              {step === 2 ? (
                <ScrollView style={s.step2Scroll} contentContainerStyle={s.step2Content} showsVerticalScrollIndicator keyboardShouldPersistTaps="handled">
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
                      disabledDates={occupiedDates}
                        occupiedCheckInDates={occupiedCheckInDates}
                        occupiedCheckOutDates={occupiedCheckOutDates}
                      onChange={({ startDate, endDate }) => {
                        if (startDate) setCheckIn(new Date(startDate));
                        if (endDate) setCheckOut(new Date(endDate));
                      }}
                      pastYearRange={1}
                      futureYearRange={2}
isMonthFirst
                        dimPastDates
                      style={{
                        container: { backgroundColor: 'transparent' },
                        dayNameText: { color: '#bababe' },
                        monthOverlayContainer: {
                          width: Math.round((Math.min(Dimensions.get('window').width - 72, 368)) * 0.8),
                          backgroundColor: '#FFFFFF',
                          borderRadius: 16,
                          overflow: 'hidden',
                          marginRight: 16,
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.08,
                          shadowRadius: 8,
                          elevation: 3,
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
                </ScrollView>
              ) : step === 4 ? (
                <ScrollView style={[s.scroll, s.scrollStep3]} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator>
                  <View style={s.mediaSectionTitleRow}>
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
                    <Text style={s.reminderChevron}>{reminderPickerOpen ? '▲' : '▼'}</Text>
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
                    <Image source={require('../../assets/icon-photo.png')} style={s.mediaSectionTitleIcon} resizeMode="contain" />
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
                          <ActivityIndicator size="small" color={COLORS.saveGreen} />
                        ) : (
                          <>
                            <Text style={s.mediaAddIcon}>+</Text>
                            <Text style={s.mediaAddLabel}>{t('wizAddPhoto')}</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                  {photos.length >= MAX_BOOKING_PHOTOS && (
                    <Text style={s.mediaLimitNote}>{t('wizPhotoLimit')}</Text>
                  )}
                </ScrollView>
              ) : (
              <ScrollView
                style={[s.scroll, step === 3 && s.scrollStep3]}
                contentContainerStyle={s.scrollContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                onScrollBeginDrag={Keyboard.dismiss}
                scrollEventThrottle={16}
                nestedScrollEnabled
                indicatorStyle="black"
              >
                {step === 1 ? (
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
                      <Text style={[s.chevron, notMyCustomer && s.chevronDisabled]}>▽</Text>
                    </TouchableOpacity>

                    <View style={[s.inputWithIconRow, notMyCustomer && s.inputWithIconRowDisabled]}>
                      <Image source={require('../../assets/icon-passport-id.png')} style={s.inputFieldIcon} resizeMode="contain" />
                      <TextInput
                        style={[s.input, s.inputWithIconInput, notMyCustomer && s.inputDisabled]}
                        value={passportId}
                        onChangeText={setPassportId}
                        placeholder={t('bookingPassportIdPlaceholder')}
                        placeholderTextColor="#999"
                        editable={!notMyCustomer}
                      />
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={s.fieldLabel}>{t('pdPriceMonthly')} {sym}</Text>
                    <TextInput
                      style={s.input}
                      value={priceMonthly}
                      onChangeText={(v) => setPriceMonthly(formatMoneyDisplay(v))}
                      placeholder="0"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
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

                    <Text style={s.fieldLabel}>{t('ownerCommissionOneTime')} {sym}</Text>
                    <TextInput
                      style={s.input}
                      value={ownerCommissionOneTime}
                      onChangeText={(v) => setOwnerCommissionOneTime(formatMoneyDisplay(v))}
                      placeholder="0"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                    />

                    <Text style={s.fieldLabel}>{t('ownerCommissionMonthly')} {sym}</Text>
                    <TextInput
                      style={s.input}
                      value={ownerCommissionMonthly}
                      onChangeText={(v) => setOwnerCommissionMonthly(formatMoneyDisplay(v))}
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
                )}
              </ScrollView>
              )}

              <View style={s.footerNav}>
                {step === 1 ? (
                  <View style={s.stepNavRow}>
                    <TouchableOpacity style={s.nextBtn} onPress={handleNext} activeOpacity={0.7}>
                      <Text style={s.nextBtnText}>{t('next')}</Text>
                      <Text style={s.nextBtnArrow}>→</Text>
                    </TouchableOpacity>
                  </View>
                ) : step === 2 ? (
                  <View style={s.stepNavRow}>
                    <TouchableOpacity style={s.backBtn} onPress={handleBack} activeOpacity={0.7}>
                      <Text style={s.backBtnArrow}>←</Text>
                      <Text style={s.backBtnText}>{t('wizBack')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.nextBtn} onPress={handleNextFromDates} activeOpacity={0.7}>
                      <Text style={s.nextBtnText}>{notMyCustomer ? t('save') : t('next')}</Text>
                      {!notMyCustomer && <Text style={s.nextBtnArrow}>→</Text>}
                    </TouchableOpacity>
                  </View>
                ) : step === 4 ? (
                  <View style={s.stepNavRow}>
                    <TouchableOpacity style={s.backBtn} onPress={handleBack} activeOpacity={0.7}>
                      <Text style={s.backBtnArrow}>←</Text>
                      <Text style={s.backBtnText}>{t('wizBack')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.saveBtn, saving && s.saveBtnDisabled]}
                      onPress={handleSave}
                      activeOpacity={0.7}
                      disabled={saving}
                    >
                      {saving ? (
                        <ActivityIndicator size="small" color={COLORS.saveGreen} />
                      ) : (
                        <Text style={s.saveBtnText}>{t('save')}</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={s.stepNavRow}>
                    <TouchableOpacity style={s.backBtn} onPress={handleBack} activeOpacity={0.7}>
                      <Text style={s.backBtnArrow}>←</Text>
                      <Text style={s.backBtnText}>{t('wizBack')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.nextBtn} onPress={handleNextFromStep3} activeOpacity={0.7}>
                      <Text style={s.nextBtnText}>{t('next')}</Text>
                      <Text style={s.nextBtnArrow}>→</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Pressable>

      {clientPickerVisible && (
        <Modal
          transparent
          animationType="fade"
          onRequestClose={() => setClientPickerVisible(false)}
          statusBarTranslucent
        >
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
                  activeOpacity={0.8}
                >
                  <Text style={s.closeIcon}>✕</Text>
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
                  <ActivityIndicator size="small" color={COLORS.saveGreen} />
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
        </Modal>
      )}

      <AddContactModal
        visible={addContactVisible}
        onClose={() => setAddContactVisible(false)}
        onSave={handleSaveContact}
        contactType="clients"
        editContact={null}
      />

      {timePickerFor && (
        <Modal transparent animationType="fade" statusBarTranslucent>
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
        </Modal>
      )}

      {datePickerFor && (
        <Modal transparent animationType="slide" statusBarTranslucent>
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
        </Modal>
      )}
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  backdropWeb: {
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  keyboardWrap: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  boxWrap: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
    alignSelf: 'center',
  },
  boxWrapStep3: { height: '90%' },
  box: {
    flexShrink: 0,
    minHeight: 0,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: COLORS.boxBg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  boxStep3: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  headerSpacer: { width: 36 },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.title,
    textAlign: 'center',
    flex: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 20,
    color: '#E85D4C',
    fontWeight: '600',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.dot },
  dotActive: { backgroundColor: COLORS.dotActive },
  mediaSectionTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  mediaSectionTitleIcon: { width: 22, height: 22 },
  mediaSectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.title },
  reminderTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
  },
  reminderTriggerText: { fontSize: 16, fontWeight: '600', color: COLORS.title },
  reminderTriggerPlaceholder: { color: '#999' },
  reminderChevron: { fontSize: 12, color: '#6B6B6B' },
  reminderOptionsWrap: {
    marginBottom: 14,
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  reminderOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  reminderOptionSelected: { backgroundColor: 'rgba(46,125,50,0.08)' },
  reminderOptionText: { fontSize: 16, color: COLORS.title },
  reminderOptionTextSelected: { fontWeight: '600', color: COLORS.saveGreen },
  reminderSelectBtn: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: COLORS.saveGreen,
  },
  reminderSelectBtnText: { fontSize: 16, fontWeight: '600', color: '#FFF' },
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
  mediaAddIcon: { fontSize: 28, color: COLORS.saveGreen, fontWeight: '300', marginTop: -2 },
  mediaAddLabel: { fontSize: 10, color: '#999', marginTop: 2 },
  mediaLimitNote: { fontSize: 12, color: '#999', fontStyle: 'italic', marginTop: 6 },
  scroll: { flexShrink: 1 },
  scrollStep3: { flex: 1, minHeight: 0 },
  scrollContent: {
    padding: 20,
    paddingBottom: 0,
    flexGrow: 0,
  },
  scrollContentStep2: {
    padding: 14,
    paddingBottom: 14,
    flexGrow: 0,
  },
  step2Scroll: { flexGrow: 0, maxHeight: Dimensions.get('window').height * 0.75 },
  step2Content: {
    padding: 16,
    paddingBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  fieldLabelStep2: { marginBottom: 8 },
  readOnlyField: {
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  readOnlyText: {
    fontSize: 16,
    color: COLORS.title,
    fontWeight: '500',
  },
  section: { marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#9A9090',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxChecked: { borderColor: COLORS.saveGreen },
  checkMark: { color: COLORS.saveGreen, fontSize: 14, fontWeight: '700' },
  rowLabel: { fontSize: 15, color: COLORS.title, flex: 1 },
  selectField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  selectFieldDisabled: {
    backgroundColor: '#EDEDEB',
    opacity: 0.7,
  },
  selectFieldText: { fontSize: 16, color: COLORS.title, flex: 1 },
  selectFieldPlaceholder: { color: '#999' },
  chevron: { fontSize: 12, color: '#6B6B6B', marginLeft: 8 },
  chevronDisabled: { color: '#BBB' },
  input: {
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: COLORS.title,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  inputDisabled: {
    backgroundColor: '#EDEDEB',
    opacity: 0.7,
    color: '#999',
  },
  inputWithIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingLeft: 16,
    marginBottom: 20,
  },
  inputWithIconRowDisabled: {
    backgroundColor: '#EDEDEB',
    opacity: 0.7,
  },
  inputFieldIcon: {
    width: 22,
    height: 22,
    marginRight: 12,
  },
  inputWithIconInput: {
    flex: 1,
    marginBottom: 0,
    paddingLeft: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  nextBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(46, 125, 50, 0.5)',
    backgroundColor: 'rgba(46, 125, 50, 0.06)',
    gap: 8,
  },
  nextBtnText: { fontSize: 16, fontWeight: '600', color: COLORS.saveGreen },
  nextBtnArrow: { fontSize: 18, color: COLORS.saveGreen, fontWeight: '700' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  dateRowReadonly: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  dateRowReadonlyStep2: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  dateField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dateFieldText: { fontSize: 16, color: COLORS.title },
  dateFieldPlaceholder: { color: '#999' },
  dateDash: { fontSize: 16, color: '#888' },
  inputMultiline: { minHeight: 80 },
  step2Buttons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  footerNav: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  stepNavRow: { flexDirection: 'row', gap: 12 },
  backBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(232, 93, 76, 0.5)',
    backgroundColor: 'rgba(232, 93, 76, 0.06)',
    gap: 8,
  },
  backBtnArrow: { fontSize: 18, color: '#E85D4C', fontWeight: '700' },
  backBtnText: { fontSize: 16, fontWeight: '600', color: '#E85D4C' },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(46, 125, 50, 0.5)',
    backgroundColor: 'rgba(46, 125, 50, 0.06)',
    gap: 8,
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { fontSize: 16, fontWeight: '600', color: COLORS.saveGreen },
  calendarInline: {
    marginBottom: 16,
  },
  calendarInlineStep2: { marginBottom: 16 },
  timeBlock: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timeFieldWrap: {
    flex: 1,
  },
  timeInput: {
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: COLORS.title,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 6,
  },
  timeSelectRow: {
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  timeSelectText: {
    fontSize: 16,
    color: COLORS.title,
  },
  timeSelectBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.saveGreen,
  },
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  datePickerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.title },
  datePickerDoneText: { fontSize: 16, fontWeight: '600', color: COLORS.saveGreen },
  datePickerSpinner: { height: 200 },
  timePickerSpinnerWrap: {
    alignItems: 'center',
  },
  pickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  pickerBox: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    backgroundColor: COLORS.boxBg,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  pickerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: COLORS.title },
  addNewRow: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  addNewText: { fontSize: 16, color: COLORS.saveGreen, fontWeight: '600' },
  searchInput: {
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    color: COLORS.title,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  loadingWrap: { padding: 40, alignItems: 'center' },
  pickerScroll: { maxHeight: 280 },
  pickerScrollContent: { paddingBottom: 8 },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  pickerItemText: { fontSize: 16, color: COLORS.title, flex: 1 },
  pickerItemSelected: { fontWeight: '600', color: COLORS.saveGreen },
  pickerCheck: { fontSize: 16, fontWeight: '700', color: COLORS.saveGreen },
  selectBtn: {
    paddingVertical: 14,
    marginHorizontal: 20,
    marginVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(46, 125, 50, 0.5)',
    backgroundColor: 'rgba(46, 125, 50, 0.06)',
  },
  selectBtnText: { fontSize: 16, fontWeight: '600', color: COLORS.saveGreen },
});
