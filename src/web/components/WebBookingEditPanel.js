import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Switch, Animated, Modal, ActivityIndicator,
} from 'react-native';
import dayjs from 'dayjs';
import { createBooking, updateBooking } from '../../services/bookingsService';

const ACCENT = '#D81B60';
const C = {
  bg: '#F4F6F9', surface: '#FFFFFF', border: '#E9ECEF',
  text: '#212529', muted: '#6C757D', light: '#ADB5BD',
  accent: ACCENT, accentBg: '#FCE4EC',
};

const TYPE_COLOR = {
  house:  { border: '#C2920E', bg: '#FFFDE7', text: '#C2920E' },
  resort: { border: '#2E7D32', bg: '#E8F5E9', text: '#2E7D32' },
  condo:  { border: '#1565C0', bg: '#E3F2FD', text: '#1565C0' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toStr(v) { return v != null ? String(v) : ''; }

function buildForm(booking, property) {
  if (booking) {
    return {
      propertyId:             booking.propertyId || '',
      contactId:              booking.contactId  || '',
      notMyCustomer:          !!booking.notMyCustomer,
      passportId:             booking.passportId || '',
      checkIn:                booking.checkIn    || '',
      checkOut:               booking.checkOut   || '',
      checkInTime:            booking.checkInTime || '14:00',
      checkOutTime:           booking.checkOutTime || '12:00',
      priceMonthly:           toStr(booking.priceMonthly),
      totalPrice:             toStr(booking.totalPrice),
      bookingDeposit:         toStr(booking.bookingDeposit),
      saveDeposit:            toStr(booking.saveDeposit),
      commission:             toStr(booking.commission),
      ownerCommissionOneTime: toStr(booking.ownerCommissionOneTime),
      ownerCommissionMonthly: toStr(booking.ownerCommissionMonthly),
      adults:                 toStr(booking.adults),
      children:               toStr(booking.children),
      pets:                   !!booking.pets,
      comments:               booking.comments || '',
    };
  }
  return {
    propertyId:             property?.id || '',
    contactId:              '',
    notMyCustomer:          false,
    passportId:             '',
    checkIn:                '',
    checkOut:               '',
    checkInTime:            '14:00',
    checkOutTime:           '12:00',
    priceMonthly:           toStr(property?.price_monthly),
    totalPrice:             '',
    bookingDeposit:         toStr(property?.booking_deposit),
    saveDeposit:            toStr(property?.save_deposit),
    commission:             toStr(property?.commission),
    ownerCommissionOneTime: '',
    ownerCommissionMonthly: '',
    adults:                 '',
    children:               '',
    pets:                   false,
    comments:               '',
  };
}

function numOrNull(v) {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(/\s/g, ''));
  return isNaN(n) ? null : n;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionDivider({ title }) {
  return (
    <View style={p.divider}>
      <Text style={p.dividerText}>{title}</Text>
    </View>
  );
}

function FieldRow({ label, children, required }) {
  return (
    <View style={p.fieldRow}>
      <Text style={p.fieldLabel}>{label}{required ? <Text style={{ color: ACCENT }}> *</Text> : ''}</Text>
      {children}
    </View>
  );
}

function FieldInput({ value, onChangeText, placeholder, numeric, multiline }) {
  return (
    <TextInput
      style={[p.input, multiline && p.inputMulti]}
      value={String(value ?? '')}
      onChangeText={onChangeText}
      placeholder={placeholder || ''}
      placeholderTextColor={C.light}
      keyboardType={numeric ? 'numeric' : 'default'}
      multiline={multiline}
      numberOfLines={multiline ? 3 : 1}
    />
  );
}

function PropertyPicker({ value, properties, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const prop = properties.find(p => p.id === value);
  const tc = prop ? (TYPE_COLOR[prop.type] || TYPE_COLOR.house) : null;

  const filtered = properties.filter(p => {
    const q = search.toLowerCase();
    return (p.name || '').toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q);
  });

  return (
    <View>
      <TouchableOpacity
        style={[p.pickerBtn, tc && { borderLeftWidth: 3, borderLeftColor: tc.border }]}
        onPress={() => setOpen(!open)}
        activeOpacity={0.8}
      >
        {prop ? (
          <View style={{ flex: 1 }}>
            <Text style={[p.pickerBtnText, { color: tc?.text }]}>
              {prop.code}{prop.code_suffix ? `-${prop.code_suffix}` : ''} — {prop.name}
            </Text>
            {prop.city ? <Text style={p.pickerBtnSub}>{prop.city}</Text> : null}
          </View>
        ) : (
          <Text style={[p.pickerBtnText, { color: C.light }]}>Выберите объект…</Text>
        )}
        <Text style={p.pickerArrow}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {open && (
        <View style={p.pickerDropdown}>
          <TextInput
            style={p.pickerSearch}
            value={search}
            onChangeText={setSearch}
            placeholder="Поиск…"
            placeholderTextColor={C.light}
          />
          <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
            {filtered.map(pr => {
              const tc2 = TYPE_COLOR[pr.type] || TYPE_COLOR.house;
              const isActive = pr.id === value;
              return (
                <TouchableOpacity
                  key={pr.id}
                  style={[p.pickerItem, isActive && { backgroundColor: C.accentBg }, { borderLeftWidth: 3, borderLeftColor: tc2.border }]}
                  onPress={() => { onChange(pr.id); setOpen(false); setSearch(''); }}
                  activeOpacity={0.75}
                >
                  <Text style={[p.pickerItemCode, { color: tc2.text }]}>
                    {pr.code}{pr.code_suffix ? `-${pr.code_suffix}` : ''}
                  </Text>
                  <Text style={p.pickerItemName}>{pr.name}</Text>
                  {pr.city ? <Text style={p.pickerItemSub}>{pr.city}</Text> : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function ContactPicker({ value, contacts, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const contact = contacts.find(c => c.id === value);

  const filtered = contacts.filter(c => {
    const q = search.toLowerCase();
    const name = `${c.name || ''} ${c.lastName || ''}`.toLowerCase();
    return name.includes(q) || (c.phone || '').includes(q);
  });

  return (
    <View>
      <TouchableOpacity style={p.pickerBtn} onPress={() => setOpen(!open)} activeOpacity={0.8}>
        {contact ? (
          <Text style={p.pickerBtnText}>
            {`${contact.name || ''} ${contact.lastName || ''}`.trim() || contact.phone || '—'}
          </Text>
        ) : (
          <Text style={[p.pickerBtnText, { color: C.light }]}>Выберите клиента…</Text>
        )}
        <Text style={p.pickerArrow}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {open && (
        <View style={p.pickerDropdown}>
          <TextInput
            style={p.pickerSearch}
            value={search}
            onChangeText={setSearch}
            placeholder="Поиск…"
            placeholderTextColor={C.light}
          />
          <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
            {value ? (
              <TouchableOpacity
                style={[p.pickerItem, { backgroundColor: '#FFF3F3' }]}
                onPress={() => { onChange(''); setOpen(false); }}
                activeOpacity={0.75}
              >
                <Text style={{ fontSize: 13, color: '#E53935' }}>✕  Убрать клиента</Text>
              </TouchableOpacity>
            ) : null}
            {filtered.map(c => {
              const isActive = c.id === value;
              const name = `${c.name || ''} ${c.lastName || ''}`.trim();
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[p.pickerItem, isActive && { backgroundColor: C.accentBg }]}
                  onPress={() => { onChange(c.id); setOpen(false); setSearch(''); }}
                  activeOpacity={0.75}
                >
                  <Text style={p.pickerItemName}>{name || c.phone || '—'}</Text>
                  {c.phone ? <Text style={p.pickerItemSub}>{c.phone}</Text> : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export default function WebBookingEditPanel({ visible, mode, booking, properties, contacts, onClose, onSaved }) {
  const [form, setForm]       = useState(() => buildForm(booking, null));
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [mounted, setMounted] = useState(false);

  const slideAnim    = useRef(new Animated.Value(540)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  useEffect(() => {
    if (visible) {
      setMounted(true);
      const selectedProp = booking ? properties.find(p => p.id === booking.propertyId) : null;
      setForm(buildForm(booking, selectedProp));
      setError('');
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 540, duration: 280, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [visible, booking]);

  // Auto-compute total price
  useEffect(() => {
    if (form.priceMonthly && form.checkIn && form.checkOut) {
      const nights = dayjs(form.checkOut).diff(dayjs(form.checkIn), 'day');
      if (nights > 0) {
        const monthly = numOrNull(form.priceMonthly);
        if (monthly) {
          const total = Math.round(monthly * nights / 30);
          setForm(f => ({ ...f, totalPrice: String(total) }));
        }
      }
    }
  }, [form.priceMonthly, form.checkIn, form.checkOut]);

  if (!mounted) return null;

  const handleSave = async () => {
    if (!form.propertyId) { setError('Выберите объект'); return; }
    if (!form.checkIn || !form.checkOut) { setError('Укажите даты заезда и выезда'); return; }
    if (form.checkIn >= form.checkOut) { setError('Дата выезда должна быть позже заезда'); return; }

    setSaving(true);
    setError('');
    try {
      const data = {
        propertyId:             form.propertyId,
        contactId:              form.notMyCustomer ? null : (form.contactId || null),
        notMyCustomer:          form.notMyCustomer,
        passportId:             form.passportId || null,
        checkIn:                form.checkIn,
        checkOut:               form.checkOut,
        checkInTime:            form.checkInTime || null,
        checkOutTime:           form.checkOutTime || null,
        priceMonthly:           numOrNull(form.priceMonthly),
        totalPrice:             numOrNull(form.totalPrice),
        bookingDeposit:         numOrNull(form.bookingDeposit),
        saveDeposit:            numOrNull(form.saveDeposit),
        commission:             numOrNull(form.commission),
        ownerCommissionOneTime: numOrNull(form.ownerCommissionOneTime),
        ownerCommissionMonthly: numOrNull(form.ownerCommissionMonthly),
        adults:                 numOrNull(form.adults),
        children:               numOrNull(form.children),
        pets:                   form.pets,
        comments:               form.comments || null,
        photos:                 [],
        reminderDays:           [],
      };

      let saved;
      if (mode === 'edit' && booking?.id) {
        saved = await updateBooking(booking.id, data);
      } else {
        saved = await createBooking(data);
      }
      onSaved(saved);
    } catch (e) {
      setError(e.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const title = mode === 'edit' ? 'Редактировать бронирование' : 'Новое бронирование';
  const selectedProp = properties.find(pr => pr.id === form.propertyId);

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={p.overlay}>
        <Animated.View style={[p.backdrop, { opacity: backdropAnim }]} pointerEvents={visible ? 'auto' : 'none'}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View style={[p.panel, { transform: [{ translateX: slideAnim }] }]}>
          {/* Header */}
          <View style={p.header}>
            <Text style={p.title}>{title}</Text>
            <TouchableOpacity style={p.closeBtn} onPress={onClose}>
              <Text style={p.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <ScrollView style={p.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={p.scrollContent}>

            <SectionDivider title="Объект" />
            <FieldRow label="Объект" required>
              <PropertyPicker
                value={form.propertyId}
                properties={properties}
                onChange={id => {
                  const pr = properties.find(x => x.id === id);
                  setForm(f => ({
                    ...f,
                    propertyId: id,
                    priceMonthly: pr?.price_monthly != null ? String(pr.price_monthly) : f.priceMonthly,
                    bookingDeposit: pr?.booking_deposit != null ? String(pr.booking_deposit) : f.bookingDeposit,
                    saveDeposit: pr?.save_deposit != null ? String(pr.save_deposit) : f.saveDeposit,
                    commission: pr?.commission != null ? String(pr.commission) : f.commission,
                  }));
                }}
              />
            </FieldRow>

            <SectionDivider title="Клиент" />
            <View style={p.toggleRow}>
              <Text style={p.fieldLabel}>Бронь владельца</Text>
              <Switch
                value={form.notMyCustomer}
                onValueChange={v => set('notMyCustomer', v)}
                trackColor={{ false: C.border, true: ACCENT }}
                thumbColor="#FFF"
              />
            </View>

            {!form.notMyCustomer && (
              <>
                <FieldRow label="Клиент">
                  <ContactPicker value={form.contactId} contacts={contacts} onChange={v => set('contactId', v)} />
                </FieldRow>
                <FieldRow label="Документ / Паспорт">
                  <FieldInput value={form.passportId} onChangeText={v => set('passportId', v)} placeholder="AB123456" />
                </FieldRow>
              </>
            )}

            <SectionDivider title="Даты" />
            <View style={p.row2}>
              <View style={{ flex: 1 }}>
                <FieldRow label="Заезд" required>
                  <TextInput
                    style={p.input}
                    value={form.checkIn}
                    onChangeText={v => set('checkIn', v)}
                    placeholder="ГГГГ-ММ-ДД"
                    placeholderTextColor={C.light}
                  />
                </FieldRow>
              </View>
              <View style={{ flex: 1 }}>
                <FieldRow label="Выезд" required>
                  <TextInput
                    style={p.input}
                    value={form.checkOut}
                    onChangeText={v => set('checkOut', v)}
                    placeholder="ГГГГ-ММ-ДД"
                    placeholderTextColor={C.light}
                  />
                </FieldRow>
              </View>
            </View>
            <View style={p.row2}>
              <View style={{ flex: 1 }}>
                <FieldRow label="Время заезда">
                  <TextInput style={p.input} value={form.checkInTime} onChangeText={v => set('checkInTime', v)} placeholder="14:00" placeholderTextColor={C.light} />
                </FieldRow>
              </View>
              <View style={{ flex: 1 }}>
                <FieldRow label="Время выезда">
                  <TextInput style={p.input} value={form.checkOutTime} onChangeText={v => set('checkOutTime', v)} placeholder="12:00" placeholderTextColor={C.light} />
                </FieldRow>
              </View>
            </View>

            {form.checkIn && form.checkOut && form.checkOut > form.checkIn && (
              <View style={p.nightsBadge}>
                <Text style={p.nightsText}>
                  {dayjs(form.checkOut).diff(dayjs(form.checkIn), 'day')} ночей
                </Text>
              </View>
            )}

            <SectionDivider title="Стоимость" />
            <View style={p.row2}>
              <View style={{ flex: 1 }}>
                <FieldRow label="Аренда/мес (฿)">
                  <FieldInput value={form.priceMonthly} onChangeText={v => set('priceMonthly', v)} placeholder="30 000" numeric />
                </FieldRow>
              </View>
              <View style={{ flex: 1 }}>
                <FieldRow label="Итого (฿)">
                  <FieldInput value={form.totalPrice} onChangeText={v => set('totalPrice', v)} placeholder="авто" numeric />
                </FieldRow>
              </View>
            </View>
            <View style={p.row2}>
              <View style={{ flex: 1 }}>
                <FieldRow label="Депозит брони (฿)">
                  <FieldInput value={form.bookingDeposit} onChangeText={v => set('bookingDeposit', v)} placeholder="5 000" numeric />
                </FieldRow>
              </View>
              <View style={{ flex: 1 }}>
                <FieldRow label="Сохранный депозит (฿)">
                  <FieldInput value={form.saveDeposit} onChangeText={v => set('saveDeposit', v)} placeholder="10 000" numeric />
                </FieldRow>
              </View>
            </View>
            <FieldRow label="Комиссия агента (฿)">
              <FieldInput value={form.commission} onChangeText={v => set('commission', v)} placeholder="15 000" numeric />
            </FieldRow>
            <View style={p.row2}>
              <View style={{ flex: 1 }}>
                <FieldRow label="Комиссия влад. разово (฿)">
                  <FieldInput value={form.ownerCommissionOneTime} onChangeText={v => set('ownerCommissionOneTime', v)} placeholder="—" numeric />
                </FieldRow>
              </View>
              <View style={{ flex: 1 }}>
                <FieldRow label="Комиссия влад. в мес. (฿)">
                  <FieldInput value={form.ownerCommissionMonthly} onChangeText={v => set('ownerCommissionMonthly', v)} placeholder="—" numeric />
                </FieldRow>
              </View>
            </View>

            <SectionDivider title="Гости" />
            <View style={p.row2}>
              <View style={{ flex: 1 }}>
                <FieldRow label="Взрослых">
                  <FieldInput value={form.adults} onChangeText={v => set('adults', v)} placeholder="2" numeric />
                </FieldRow>
              </View>
              <View style={{ flex: 1 }}>
                <FieldRow label="Детей">
                  <FieldInput value={form.children} onChangeText={v => set('children', v)} placeholder="0" numeric />
                </FieldRow>
              </View>
            </View>
            <View style={p.toggleRow}>
              <Text style={p.fieldLabel}>Животные</Text>
              <Switch
                value={form.pets}
                onValueChange={v => set('pets', v)}
                trackColor={{ false: C.border, true: ACCENT }}
                thumbColor="#FFF"
              />
            </View>

            <SectionDivider title="Примечания" />
            <FieldRow label="Комментарий">
              <FieldInput value={form.comments} onChangeText={v => set('comments', v)} placeholder="Внутренние заметки…" multiline />
            </FieldRow>

            <View style={{ height: 20 }} />
          </ScrollView>

          {/* Footer */}
          <View style={p.footer}>
            {error ? <Text style={p.errorText}>{error}</Text> : null}
            <View style={p.footerBtns}>
              <TouchableOpacity style={p.cancelBtn} onPress={onClose}>
                <Text style={p.cancelBtnText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity style={p.saveBtn} onPress={handleSave} disabled={saving}>
                {saving
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <Text style={p.saveBtnText}>💾 Сохранить</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const p = StyleSheet.create({
  overlay: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  panel: {
    width: 480, backgroundColor: C.surface,
    shadowColor: '#000', shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 20,
    flexDirection: 'column',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  title: { fontSize: 17, fontWeight: '800', color: C.text },
  closeBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 18, color: C.muted },
  scroll: { flex: 1 },
  scrollContent: { padding: 20 },

  divider: { marginTop: 16, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 6 },
  dividerText: { fontSize: 10, fontWeight: '800', color: C.light, letterSpacing: 1 },

  fieldRow: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: C.muted, marginBottom: 5 },
  input: {
    backgroundColor: C.bg, borderRadius: 8, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: C.text,
    outlineStyle: 'none',
  },
  inputMulti: { minHeight: 72, textAlignVertical: 'top' },

  row2: { flexDirection: 'row', gap: 12 },

  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 8 },

  pickerBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.bg, borderRadius: 8, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 12, paddingVertical: 9, minHeight: 40,
  },
  pickerBtnText: { flex: 1, fontSize: 14, color: C.text },
  pickerBtnSub: { fontSize: 11, color: C.muted, marginTop: 1 },
  pickerArrow: { fontSize: 11, color: C.light, marginLeft: 8 },
  pickerDropdown: { backgroundColor: C.surface, borderRadius: 8, borderWidth: 1, borderColor: C.border, marginTop: 4, overflow: 'hidden' },
  pickerSearch: { borderBottomWidth: 1, borderBottomColor: C.border, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: C.text, outlineStyle: 'none' },
  pickerItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  pickerItemCode: { fontSize: 12, fontWeight: '700' },
  pickerItemName: { fontSize: 13, color: C.text },
  pickerItemSub: { fontSize: 11, color: C.muted, marginTop: 1 },

  nightsBadge: { backgroundColor: '#E8F5E9', borderRadius: 8, padding: 10, alignItems: 'center', marginBottom: 4 },
  nightsText: { fontSize: 14, fontWeight: '700', color: '#2E7D32' },

  footer: { padding: 16, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.surface },
  errorText: { fontSize: 13, color: '#E53935', marginBottom: 10, textAlign: 'center' },
  footerBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  cancelBtnText: { fontSize: 14, color: C.muted, fontWeight: '600' },
  saveBtn: { flex: 2, backgroundColor: ACCENT, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  saveBtnText: { fontSize: 14, color: '#FFF', fontWeight: '700' },
});
