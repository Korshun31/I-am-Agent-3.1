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
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BlurView } from 'expo-blur';
import dayjs from 'dayjs';
import CalendarRangePicker from 'react-native-calendar-range-picker';
import { useLanguage } from '../context/LanguageContext';
import { getContacts, createContact } from '../services/contactsService';
import { getBookings, createBooking } from '../services/bookingsService';
import AddContactModal from './AddContactModal';

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

function formatDateDisplay(d) {
  if (!d) return '';
  const x = d instanceof Date ? d : new Date(d);
  const day = String(x.getDate()).padStart(2, '0');
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const y = x.getFullYear();
  return `${day}.${m}.${y}`;
}

/** Compute total price: full months * price_monthly + proportional for partial days */
function computeTotalPrice(checkIn, checkOut, priceMonthly) {
  if (!checkIn || !checkOut || !priceMonthly || priceMonthly <= 0) return null;
  const p = Number(priceMonthly);
  const start = checkIn instanceof Date ? checkIn : new Date(checkIn);
  const end = checkOut instanceof Date ? checkOut : new Date(checkOut);
  if (start >= end) return null;
  const msPerDay = 86400000;
  const totalDays = Math.round((end - start) / msPerDay);
  if (totalDays <= 0) return null;
  let total = 0;
  let d = new Date(start);
  let remaining = totalDays;
  while (remaining > 0 && d < end) {
    const year = d.getFullYear();
    const month = d.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dayOfMonth = d.getDate();
    const daysLeftInMonth = daysInMonth - dayOfMonth + 1;
    const daysToUse = Math.min(remaining, daysLeftInMonth);
    if (daysToUse >= daysInMonth) {
      total += p;
    } else {
      total += (p / daysInMonth) * daysToUse;
    }
    remaining -= daysToUse;
    d.setDate(d.getDate() + daysToUse);
  }
  return Math.round(total * 100) / 100;
}

const COLORS = {
  boxBg: 'rgba(255,255,255,0.72)',
  title: '#2C2C2C',
  inputBg: '#F5F2EB',
  border: '#E0D8CC',
  saveGreen: '#2E7D32',
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

export default function AddBookingModal({ visible, onClose, onSaved, property }) {
  const { t, language } = useLanguage();
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
  const [occupiedDates, setOccupiedDates] = useState([]);
  const [occupiedCheckInDates, setOccupiedCheckInDates] = useState([]);
  const [occupiedCheckOutDates, setOccupiedCheckOutDates] = useState([]);
  const [datePickerFor, setDatePickerFor] = useState(null); // 'checkIn' | 'checkOut' (legacy)
  const [priceMonthly, setPriceMonthly] = useState('');
  const [totalPrice, setTotalPrice] = useState('');
  const [bookingDeposit, setBookingDeposit] = useState('');
  const [saveDeposit, setSaveDeposit] = useState('');
  const [commission, setCommission] = useState('');
  const [adults, setAdults] = useState('');
  const [children, setChildren] = useState('');
  const [pets, setPets] = useState(false);
  const [comments, setComments] = useState('');
  const [saving, setSaving] = useState(false);

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

  const loadClients = useCallback(async () => {
    setLoadingClients(true);
    try {
      const data = await getContacts('clients');
      setClients(data);
    } catch (e) {
      console.error('Load clients error:', e);
    } finally {
      setLoadingClients(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setStep(1);
      setNotMyCustomer(false);
      setSelectedClient(null);
      setPassportId('');
      setCheckIn(null);
      setCheckOut(null);
    }
  }, [visible]);

  useEffect(() => {
    if (step === 3 && property) {
      setPriceMonthly(property.price_monthly != null ? formatMoneyDisplay(String(Math.round(property.price_monthly))) : '');
      setBookingDeposit(property.booking_deposit != null ? formatMoneyDisplay(String(Math.round(property.booking_deposit))) : '');
      setSaveDeposit(property.save_deposit != null ? formatMoneyDisplay(String(Math.round(property.save_deposit))) : '');
    }
  }, [step, property]);

  const computedTotal = computeTotalPrice(checkIn, checkOut, parseMoneyValue(priceMonthly));
  useEffect(() => {
    if (computedTotal != null) setTotalPrice(formatMoneyDisplay(String(Math.round(computedTotal))));
  }, [computedTotal]);

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
    if (step === 2 && property?.id) {
      getBookings(property.id).then((bookings) => {
        setOccupiedDates(getOccupiedDates(bookings));
        setOccupiedCheckInDates(getOccupiedCheckInDates(bookings));
        setOccupiedCheckOutDates(getOccupiedCheckOutDates(bookings));
      }).catch(() => { setOccupiedDates([]); setOccupiedCheckInDates([]); setOccupiedCheckOutDates([]); });
    } else {
      setOccupiedDates([]);
      setOccupiedCheckInDates([]);
      setOccupiedCheckOutDates([]);
    }
  }, [step, property?.id]);

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
    setStep(3);
  };

  const handleBack = () => {
    Keyboard.dismiss();
    setStep(s => (s === 1 ? 1 : s - 1));
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
    setSaving(true);
    try {
      await createBooking({
        propertyId: property?.id,
        contactId: notMyCustomer ? null : selectedClient?.id,
        passportId: notMyCustomer ? '' : passportId.trim(),
        notMyCustomer,
        checkIn: formatDateYMD(checkIn),
        checkOut: formatDateYMD(checkOut),
        priceMonthly: parseMoneyValue(priceMonthly),
        totalPrice: parseMoneyValue(totalPrice),
        bookingDeposit: parseMoneyValue(bookingDeposit),
        saveDeposit: parseMoneyValue(saveDeposit),
        commission: parseMoneyValue(commission),
        adults: adults.trim() ? parseInt(adults, 10) : null,
        children: children.trim() ? parseInt(children, 10) : null,
        pets,
        comments: comments.trim() || null,
      });
      onSaved?.();
      onClose?.();
    } catch (e) {
      Alert.alert(t('error'), e.message || 'Failed to save booking');
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
          <View style={[s.boxWrap, step === 3 && s.boxWrapStep3]} pointerEvents="box-none">
            <View style={[s.box, step === 3 && s.boxStep3]}>
              <View style={s.headerRow}>
                <View style={s.headerSpacer} />
                <Text style={s.title}>{t('addBookingTitle')}</Text>
                <TouchableOpacity onPress={onClose} style={s.closeBtn} activeOpacity={0.8}>
                  <Text style={s.closeIcon}>✕</Text>
                </TouchableOpacity>
              </View>

              {step === 2 ? (
                <View style={s.step2Content}>
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
                        monthOverlayContainer: {
                          width: Math.round((Math.min(Dimensions.get('window').width - 72, 368)) * 0.8),
                          height: 360,
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
                </View>
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

                    <Text style={s.fieldLabel}>{t('bookingPassportId')}</Text>
                    <TextInput
                      style={[s.input, notMyCustomer && s.inputDisabled]}
                      value={passportId}
                      onChangeText={setPassportId}
                      placeholder={t('bookingPassportIdPlaceholder')}
                      placeholderTextColor="#999"
                      editable={!notMyCustomer}
                    />
                  </>
                ) : (
                  <>
                    <Text style={s.fieldLabel}>{t('pdPriceMonthly')}</Text>
                    <TextInput
                      style={s.input}
                      value={priceMonthly}
                      onChangeText={(v) => setPriceMonthly(formatMoneyDisplay(v))}
                      placeholder="0"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                    />

                    <Text style={s.fieldLabel}>{t('bookingTotalPrice')}</Text>
                    <TextInput
                      style={s.input}
                      value={totalPrice}
                      onChangeText={(v) => setTotalPrice(formatMoneyDisplay(v))}
                      placeholder="0"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                    />

                    <Text style={s.fieldLabel}>{t('pdBookingDeposit')}</Text>
                    <TextInput
                      style={s.input}
                      value={bookingDeposit}
                      onChangeText={(v) => setBookingDeposit(formatMoneyDisplay(v))}
                      placeholder="0"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                    />

                    <Text style={s.fieldLabel}>{t('pdSaveDeposit')}</Text>
                    <TextInput
                      style={s.input}
                      value={saveDeposit}
                      onChangeText={(v) => setSaveDeposit(formatMoneyDisplay(v))}
                      placeholder="0"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                    />

                    <Text style={s.fieldLabel}>{t('pdCommission')}</Text>
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
                      <Text style={s.nextBtnText}>{t('next')}</Text>
                      <Text style={s.nextBtnArrow}>→</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
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
    maxHeight: '85%',
    alignSelf: 'center',
  },
  boxWrapStep3: { height: '85%' },
  box: {
    flexShrink: 1,
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
  step2Content: {
    flexShrink: 1,
    padding: 14,
    paddingBottom: 0,
  },
  fieldLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  fieldLabelStep2: { marginBottom: 14 },
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
  dateRowReadonlyStep2: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
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
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 28,
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
  calendarInlineStep2: { marginBottom: 14 },
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
