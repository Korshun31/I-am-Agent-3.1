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
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BlurView } from 'expo-blur';
import { useLanguage } from '../context/LanguageContext';
import { getContacts, createContact } from '../services/contactsService';
import { createBooking } from '../services/bookingsService';
import AddContactModal from './AddContactModal';

function formatDateYMD(d) {
  if (!d) return '';
  const x = d instanceof Date ? d : new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

export default function AddBookingModal({ visible, onClose, onSaved, property }) {
  const { t } = useLanguage();
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
  const [datePickerFor, setDatePickerFor] = useState(null); // 'checkIn' | 'checkOut'
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
    }
  }, [visible]);

  useEffect(() => {
    if (step === 2 && property) {
      setPriceMonthly(property.price_monthly != null ? String(property.price_monthly) : '');
      setBookingDeposit(property.booking_deposit != null ? String(property.booking_deposit) : '');
      setSaveDeposit(property.save_deposit != null ? String(property.save_deposit) : '');
    }
  }, [step, property]);

  const computedTotal = computeTotalPrice(checkIn, checkOut, priceMonthly ? parseFloat(priceMonthly) : null);
  useEffect(() => {
    if (computedTotal != null) setTotalPrice(String(computedTotal));
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

  const handleBack = () => {
    Keyboard.dismiss();
    setStep(1);
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
    setSaving(true);
    try {
      await createBooking({
        propertyId: property?.id,
        contactId: notMyCustomer ? null : selectedClient?.id,
        passportId: notMyCustomer ? '' : passportId.trim(),
        notMyCustomer,
        checkIn: formatDateYMD(checkIn),
        checkOut: formatDateYMD(checkOut),
        priceMonthly: priceMonthly.trim() ? parseFloat(priceMonthly) : null,
        totalPrice: totalPrice.trim() ? parseFloat(totalPrice) : null,
        bookingDeposit: bookingDeposit.trim() ? parseFloat(bookingDeposit) : null,
        saveDeposit: saveDeposit.trim() ? parseFloat(saveDeposit) : null,
        commission: commission.trim() ? parseFloat(commission) : null,
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
          <View style={s.boxWrap} pointerEvents="box-none">
            <View style={s.box}>
              <View style={s.headerRow}>
                <View style={s.headerSpacer} />
                <Text style={s.title}>{t('addBookingTitle')}</Text>
                <TouchableOpacity onPress={onClose} style={s.closeBtn} activeOpacity={0.8}>
                  <Text style={s.closeIcon}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                style={s.scroll}
                contentContainerStyle={s.scrollContent}
                showsVerticalScrollIndicator={true}
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

                    <TouchableOpacity style={s.nextBtn} onPress={handleNext} activeOpacity={0.7}>
                      <Text style={s.nextBtnText}>{t('next')}</Text>
                      <Text style={s.nextBtnArrow}>→</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Text style={s.fieldLabel}>{t('bookingDates')}</Text>
                    <View style={s.dateRow}>
                      <TouchableOpacity
                        style={s.dateField}
                        onPress={() => setDatePickerFor('checkIn')}
                        activeOpacity={0.8}
                      >
                        <Text style={[s.dateFieldText, !checkIn && s.dateFieldPlaceholder]}>{checkIn ? formatDateDisplay(checkIn) : t('bookingCheckIn')}</Text>
                        <Text style={s.chevron}>▽</Text>
                      </TouchableOpacity>
                      <Text style={s.dateDash}>—</Text>
                      <TouchableOpacity
                        style={s.dateField}
                        onPress={() => setDatePickerFor('checkOut')}
                        activeOpacity={0.8}
                      >
                        <Text style={[s.dateFieldText, !checkOut && s.dateFieldPlaceholder]}>{checkOut ? formatDateDisplay(checkOut) : t('bookingCheckOut')}</Text>
                        <Text style={s.chevron}>▽</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={s.fieldLabel}>{t('pdPriceMonthly')}</Text>
                    <TextInput
                      style={s.input}
                      value={priceMonthly}
                      onChangeText={setPriceMonthly}
                      placeholder="0"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                    />

                    <Text style={s.fieldLabel}>{t('bookingTotalPrice')}</Text>
                    <TextInput
                      style={s.input}
                      value={totalPrice}
                      onChangeText={setTotalPrice}
                      placeholder="0"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                    />

                    <Text style={s.fieldLabel}>{t('pdBookingDeposit')}</Text>
                    <TextInput
                      style={s.input}
                      value={bookingDeposit}
                      onChangeText={setBookingDeposit}
                      placeholder="0"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                    />

                    <Text style={s.fieldLabel}>{t('pdSaveDeposit')}</Text>
                    <TextInput
                      style={s.input}
                      value={saveDeposit}
                      onChangeText={setSaveDeposit}
                      placeholder="0"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                    />

                    <Text style={s.fieldLabel}>{t('pdCommission')}</Text>
                    <TextInput
                      style={s.input}
                      value={commission}
                      onChangeText={setCommission}
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

                    <View style={s.step2Buttons}>
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
                          <>
                            <Text style={s.saveBtnText}>{t('save')}</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </ScrollView>
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
    width: '100%',
    alignItems: 'center',
  },
  boxWrap: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '85%',
  },
  box: {
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
  scroll: { maxHeight: 500 },
  scrollContent: { padding: 20 },
  fieldLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
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
    borderColor: COLORS.border,
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
  backBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.inputBg,
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
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { fontSize: 16, fontWeight: '600', color: COLORS.saveGreen },
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
    maxWidth: 340,
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
