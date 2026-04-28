import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Switch, Animated, Modal, ActivityIndicator, Platform, Image,
} from 'react-native';
import dayjs from 'dayjs';
import { createBooking, updateBooking, getBookings } from '../../services/bookingsService';
import { getActiveTeamMembers } from '../../services/companyService';
import WebContactEditPanel from './WebContactEditPanel';
import WebBookingCalendarPicker from './WebBookingCalendarPicker';
import { supabase } from '../../services/supabase';
import { useLanguage } from '../../context/LanguageContext';
import { getCurrencySymbol } from '../../utils/currency';

const ACCENT = '#3D7D82';
const C = {
  bg:       '#F4F6F9',
  surface:  '#FFFFFF',
  card:     '#FFFFFF',
  border:   '#E9ECEF',
  borderFocus: '#3D7D82',
  text:     '#212529',
  muted:    '#6C757D',
  light:    '#ADB5BD',
  accent:   ACCENT,
  accentBg: '#EAF4F5',
  green:    '#4AA87D',
  greenBg:  '#F0FAF5',
};

const TYPE_COLOR = {
  house:  { border: '#C2920E', bg: '#FFFBEB', text: '#92680A', pill: '#FEF3C7' },
  resort: { border: '#16A34A', bg: '#F0FDF4', text: '#15803D', pill: '#DCFCE7' },
  condo:  { border: '#2563EB', bg: '#EFF6FF', text: '#1D4ED8', pill: '#DBEAFE' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toStr(v) { return v != null ? String(v) : ''; }

function sanitizeISODate(dateStr) {
  if (typeof dateStr !== 'string') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const d = dayjs(dateStr);
  if (!d.isValid()) return null;
  return d.format('YYYY-MM-DD') === dateStr ? dateStr : null;
}

function buildForm(booking, property) {
  if (booking) {
    return {
      propertyId:             booking.propertyId || '',
      contactId:              booking.contactId  || '',
      notMyCustomer:          !!booking.notMyCustomer,
      responsibleAgentId:     booking.responsibleAgentId ?? null,
      passportId:             booking.passportId || '',
      checkIn:                sanitizeISODate(booking.checkIn) || '',
      checkOut:               sanitizeISODate(booking.checkOut) || '',
      checkInTime:            booking.checkInTime || '14:00',
      checkOutTime:           booking.checkOutTime || '12:00',
      priceMonthly:           toStr(booking.priceMonthly),
      totalPrice:             toStr(booking.totalPrice),
      bookingDeposit:         toStr(booking.bookingDeposit),
      saveDeposit:            toStr(booking.saveDeposit),
      commission:             toStr(booking.commission),
      ownerCommissionOneTime:          toStr(booking.ownerCommissionOneTime),
      ownerCommissionOneTimeIsPercent: booking.ownerCommissionOneTimeIsPercent ?? false,
      ownerCommissionMonthly:          toStr(booking.ownerCommissionMonthly),
      ownerCommissionMonthlyIsPercent: booking.ownerCommissionMonthlyIsPercent ?? false,
      adults:                 toStr(booking.adults),
      children:               toStr(booking.children),
      pets:                   !!booking.pets,
      comments:               booking.comments || '',
      photos:                 booking.photos || [],
      reminderDays:           booking.reminderDays || [],
    };
  }
  return {
    propertyId:             property?.id || '',
    contactId:              '',
    notMyCustomer:          false,
    responsibleAgentId:     null,
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
    ownerCommissionOneTime:          '',
    ownerCommissionOneTimeIsPercent: false,
    ownerCommissionMonthly:          '',
    ownerCommissionMonthlyIsPercent: false,
    adults:                 '',
    children:               '',
    pets:                   false,
    comments:               '',
    photos:                 [],
    reminderDays:           [],
  };
}

function numOrNull(v) {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(/\s/g, ''));
  return isNaN(n) ? null : n;
}

function nightsLabel(checkIn, checkOut, t) {
  if (!checkIn || !checkOut || checkOut <= checkIn) return null;
  const n = dayjs(checkOut).diff(dayjs(checkIn), 'day');
  if (n <= 0) return null;
  return `${n} ${t('nights')}`;
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({ title, icon, children }) {
  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        {icon ? <Text style={s.cardIcon}>{icon}</Text> : null}
        <Text style={s.cardTitle}>{title}</Text>
      </View>
      <View style={s.cardBody}>{children}</View>
    </View>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────

function Field({ label, required, half, children }) {
  return (
    <View style={[s.field, half && s.fieldHalf]}>
      <Text style={s.label}>
        {label}
        {required ? <Text style={{ color: ACCENT }}> *</Text> : ''}
      </Text>
      {children}
    </View>
  );
}

// ─── Text Input ───────────────────────────────────────────────────────────────

function FInput({ value, onChangeText, placeholder, numeric, multiline, prefix }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[s.inputWrap, focused && s.inputWrapFocused, multiline && s.inputWrapMulti]}>
      {prefix ? <Text style={s.inputPrefix}>{prefix}</Text> : null}
      <TextInput
        style={[s.input, multiline && s.inputMulti]}
        value={String(value ?? '')}
        onChangeText={onChangeText}
        placeholder={placeholder || ''}
        placeholderTextColor={C.light}
        keyboardType={numeric ? 'numeric' : 'default'}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </View>
  );
}

// ─── Date Input ───────────────────────────────────────────────────────────────


// ─── Property Picker ──────────────────────────────────────────────────────────

function PropertyPicker({ value, properties, onChange, t }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef(null);
  const prop = properties.find(p => p.id === value);
  const tc = prop ? (TYPE_COLOR[prop.type] || TYPE_COLOR.house) : null;

  const filtered = properties.filter(pr => {
    const q = search.toLowerCase();
    return (pr.name || '').toLowerCase().includes(q) ||
           (pr.code || '').toLowerCase().includes(q) ||
           (pr.city || '').toLowerCase().includes(q);
  });

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  return (
    <View>
      <TouchableOpacity
        style={[s.pickerTrigger, tc && { borderLeftWidth: 3, borderLeftColor: tc.border }]}
        onPress={() => setOpen(!open)}
        activeOpacity={0.8}
      >
        {prop ? (
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[s.typePill, { backgroundColor: tc?.pill }]}>
                <Text style={[s.typePillText, { color: tc?.text }]}>
                  {prop.code}{prop.code_suffix ? ` (${prop.code_suffix})` : ''}
                </Text>
              </View>
              <Text style={s.pickerMainText} numberOfLines={1}>{prop.name}</Text>
            </View>
            {prop.city ? <Text style={s.pickerSubText}>{prop.city}</Text> : null}
          </View>
        ) : (
          <Text style={s.pickerPlaceholder}>{t('bkPickProperty')}</Text>
        )}
        <Text style={s.pickerChevron}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {open && (
        <View style={s.dropdown}>
          <View style={s.searchWrap}>
            <Text style={s.searchIcon}>🔍</Text>
            <TextInput
              ref={searchRef}
              style={s.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder={t('bkSearchProperty')}
              placeholderTextColor={C.light}
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Text style={s.searchClear}>✕</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
            {filtered.length === 0 && (
              <Text style={s.dropdownEmpty}>{t('noResults')}</Text>
            )}
            {filtered.map(pr => {
              const tc2 = TYPE_COLOR[pr.type] || TYPE_COLOR.house;
              const isActive = pr.id === value;
              return (
                <TouchableOpacity
                  key={pr.id}
                  style={[s.dropdownItem, isActive && { backgroundColor: C.accentBg }]}
                  onPress={() => { onChange(pr.id); setOpen(false); setSearch(''); }}
                  activeOpacity={0.75}
                >
                  <View style={[s.dropdownItemLeft, { borderLeftColor: tc2.border }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={[s.typePill, { backgroundColor: tc2.pill }]}>
                        <Text style={[s.typePillText, { color: tc2.text }]}>
                          {pr.code}{pr.code_suffix ? ` (${pr.code_suffix})` : ''}
                        </Text>
                      </View>
                      <Text style={s.dropdownItemName} numberOfLines={1}>{pr.name}</Text>
                    </View>
                    {pr.city ? <Text style={s.dropdownItemSub}>{pr.city}</Text> : null}
                  </View>
                  {isActive && <Text style={{ color: ACCENT, fontSize: 16 }}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// ─── Contact Picker ───────────────────────────────────────────────────────────

function ContactPicker({ value, contacts, onChange, onRequestNewContact, t, canCreateContact }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef(null);
  const contact = contacts.find(c => c.id === value);

  const filtered = contacts.filter(c => {
    const q = search.toLowerCase();
    const name = `${c.name || ''} ${c.lastName || ''}`.toLowerCase();
    return name.includes(q) || (c.phone || '').includes(q);
  });

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  return (
    <View>
      <TouchableOpacity style={s.pickerTrigger} onPress={() => setOpen(!open)} activeOpacity={0.8}>
        {contact ? (
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={s.contactAvatar}>
              <Text style={s.contactAvatarText}>
                {(contact.name || contact.lastName || '?')[0].toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={s.pickerMainText}>
                {`${contact.name || ''} ${contact.lastName || ''}`.trim() || '—'}
              </Text>
              {contact.phone ? <Text style={s.pickerSubText}>{contact.phone}</Text> : null}
            </View>
          </View>
        ) : (
          <Text style={s.pickerPlaceholder}>{t('bkPickClient')}</Text>
        )}
        <Text style={s.pickerChevron}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {open && (
        <View style={s.dropdown}>
          <View style={s.searchWrap}>
            <Text style={s.searchIcon}>🔍</Text>
            <TextInput
              ref={searchRef}
              style={s.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder={t('bkSearchClient')}
              placeholderTextColor={C.light}
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Text style={s.searchClear}>✕</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <ScrollView style={{ maxHeight: 240 }} nestedScrollEnabled>
            {/* ── Добавить нового клиента — только если есть разрешение ── */}
            {canCreateContact && (
              <TouchableOpacity
                style={s.addNewContactRow}
                onPress={() => {
                  setOpen(false);
                  onRequestNewContact?.(search);
                }}
              >
                <View style={s.addNewContactIcon}>
                  <Text style={{ fontSize: 15, color: '#FFF', lineHeight: 18, marginTop: -1 }}>+</Text>
                </View>
                <Text style={s.addNewContactText}>
                  {search ? `${t('bkAddNewContact')} "${search}"` : t('bkAddNewContact')}
                </Text>
              </TouchableOpacity>
            )}

            {/* ── Убрать выбранного ── */}
            {value ? (
              <TouchableOpacity
                style={[s.dropdownItem, { backgroundColor: '#FFF5F5' }]}
                onPress={() => { onChange(''); setOpen(false); }}
              >
                <Text style={{ fontSize: 13, color: '#DC2626' }}>✕  {t('bkRemoveClient')}</Text>
              </TouchableOpacity>
            ) : null}

            {filtered.length === 0 && (
              <Text style={s.dropdownEmpty}>{t('noResults')}</Text>
            )}
            {filtered.map(c => {
              const isActive = c.id === value;
              const name = `${c.name || ''} ${c.lastName || ''}`.trim();
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[s.dropdownItem, isActive && { backgroundColor: C.accentBg }]}
                  onPress={() => { onChange(c.id); setOpen(false); setSearch(''); }}
                  activeOpacity={0.75}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <View style={s.contactAvatar}>
                      <Text style={s.contactAvatarText}>
                        {(name || c.phone || '?')[0].toUpperCase()}
                      </Text>
                    </View>
                    <View>
                      <Text style={s.dropdownItemName}>{name || '—'}</Text>
                      {c.phone ? <Text style={s.dropdownItemSub}>{c.phone}</Text> : null}
                    </View>
                  </View>
                  {isActive && <Text style={{ color: ACCENT, fontSize: 16 }}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// ─── Counter Input ────────────────────────────────────────────────────────────

function CounterInput({ value, onChange }) {
  const n = parseInt(value) || 0;
  return (
    <View style={s.counter}>
      <TouchableOpacity style={s.counterBtn} onPress={() => onChange(String(Math.max(0, n - 1)))}>
        <Text style={s.counterBtnText}>−</Text>
      </TouchableOpacity>
      <Text style={s.counterValue}>{n}</Text>
      <TouchableOpacity style={s.counterBtn} onPress={() => onChange(String(n + 1))}>
        <Text style={s.counterBtnText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Photo Grid ───────────────────────────────────────────────────────────────

function PhotoGrid({ photos, onAdd, onRemove, uploading, t }) {
  return (
    <View style={s.photoGrid}>
      {photos.map((uri, i) => (
        <View key={i} style={s.photoThumb}>
          <Image source={{ uri }} style={s.photoImg} />
          <TouchableOpacity style={s.photoRemove} onPress={() => onRemove(i)}>
            <Text style={s.photoRemoveText}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity style={s.photoAdd} onPress={onAdd} disabled={uploading}>
        {uploading
          ? <ActivityIndicator size="small" color={ACCENT} />
          : <>
              <Text style={s.photoAddIcon}>+</Text>
              <Text style={s.photoAddText}>{t('tabPhotos')}</Text>
            </>
        }
      </TouchableOpacity>
    </View>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export default function WebBookingEditPanel({ visible, mode, booking, properties, contacts, onClose, onSaved, user }) {
  const { t, currency: userCurrency } = useLanguage();

  // Разрешения агента
  const isAgent = !!user?.teamMembership;
  const canCreateContact = !isAgent || !!user?.teamPermissions?.can_book;

  const [form, setForm]             = useState(() => buildForm(booking, null));
  const [saving, setSaving]         = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError]           = useState('');
  const [mounted, setMounted]       = useState(false);
  const [newContactVisible, setNewContactVisible] = useState(false);
  const [newContactInitialName, setNewContactInitialName] = useState('');
  const [localContacts, setLocalContacts] = useState(contacts);
  const [reminderPickerOpen, setReminderPickerOpen] = useState(false);

  const BOOKING_REMINDER_OPTIONS = [
    { days: 1, key: 'bookingReminder1d' },
    { days: 3, key: 'bookingReminder3d' },
    { days: 7, key: 'bookingReminder1w' },
    { days: 30, key: 'bookingReminder1m' },
  ];
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [propertyBookings, setPropertyBookings] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const fileInputRef                = useRef(null);
  const prevContactIdRef            = useRef(null);

  // Sync contacts when prop changes
  useEffect(() => { setLocalContacts(contacts); }, [contacts]);

  // Load active team members for the responsible-agent picker (admin only).
  useEffect(() => {
    if (isAgent || !user?.companyId) return;
    let cancelled = false;
    getActiveTeamMembers(user.companyId)
      .then(list => { if (!cancelled) setTeamMembers(Array.isArray(list) ? list : []); })
      .catch(() => { if (!cancelled) setTeamMembers([]); });
    return () => { cancelled = true; };
  }, [isAgent, user?.companyId]);

  const slideAnim    = useRef(new Animated.Value(540)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  useEffect(() => {
    if (visible) {
      setMounted(true);
      const selectedProp = booking ? properties.find(p => p.id === booking.propertyId) : null;
      const builtForm = buildForm(booking, selectedProp);
      setForm(builtForm);
      prevContactIdRef.current = builtForm.contactId || null; // seed ref so opening doesn't re-trigger fill
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

  // Загружаем бронирования выбранного объекта для отображения занятых дат
  useEffect(() => {
    if (!form.propertyId) { setPropertyBookings([]); return; }
    const pid = form.propertyId;
    getBookings().then(all => {
      if (pid !== form.propertyId) return;
      setPropertyBookings((all || []).filter(b => b.propertyId === pid));
    }).catch(() => setPropertyBookings([]));
  }, [form.propertyId]);


  // Auto-fill passportId when contactId changes (not when user edits passportId manually)
  useEffect(() => {
    if (form.notMyCustomer) return;
    if (!form.contactId) {
      prevContactIdRef.current = null;
      return;
    }
    if (form.contactId === prevContactIdRef.current) return; // contactId didn't change — keep manual edits
    prevContactIdRef.current = form.contactId;
    const contact = localContacts.find(c => c.id === form.contactId);
    if (contact) {
      setForm(f => ({ ...f, passportId: contact.documentNumber || '' }));
    }
  }, [form.contactId, form.notMyCustomer, localContacts]);

  // Auto-compute total price (monthly calculation with real days)
  useEffect(() => {
    if (form.priceMonthly && form.checkIn && form.checkOut) {
      const monthly = numOrNull(form.priceMonthly);
      if (!monthly || monthly <= 0) return;
      const start = new Date(form.checkIn);
      const end = new Date(form.checkOut);
      if (start >= end) return;

      let total = 0;
      let current = new Date(start);

      while (current < end) {
        const nextMonth = new Date(current.getFullYear(), current.getMonth() + 1, current.getDate());

        if (nextMonth <= end) {
          total += monthly;
          current = nextMonth;
        } else {
          const daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
          const daysRemaining = Math.round((end - current) / 86400000);
          total += Math.round(monthly / daysInMonth * daysRemaining);
          current = end;
        }
      }

      setForm(f => ({ ...f, totalPrice: String(total) }));
    }
  }, [form.priceMonthly, form.checkIn, form.checkOut]);

  // Web file input handler
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.style.display = 'none';
    input.onchange = async (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      setUploadingPhoto(true);
      try {
        const urls = await Promise.all(files.map(async file => {
          const ext = file.name.split('.').pop();
          const path = `bookings/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
          const { error: upErr } = await supabase.storage.from('property-photos').upload(path, file);
          if (upErr) throw upErr;
          const { data } = supabase.storage.from('property-photos').getPublicUrl(path);
          return data.publicUrl;
        }));
        setForm(f => ({ ...f, photos: [...(f.photos || []), ...urls] }));
      } catch (e) {
        setError(t('errorUpload'));
      } finally {
        setUploadingPhoto(false);
        input.value = '';
      }
    };
    fileInputRef.current = input;
    document.body.appendChild(input);
    return () => document.body.removeChild(input);
  }, []);

  if (!mounted) return null;

  const bookedRanges = propertyBookings
    .filter(b => b.id !== booking?.id)
    .map(b => ({ checkIn: b.checkIn, checkOut: b.checkOut }));

  const handlePhotoAdd = () => fileInputRef.current?.click();
  const handlePhotoRemove = (i) => setForm(f => ({ ...f, photos: f.photos.filter((_, idx) => idx !== i) }));

  const handleRequestNewContact = (prefillName) => {
    setNewContactInitialName(prefillName || '');
    setNewContactVisible(true);
  };

  const handleNewContactSaved = (saved) => {
    const contact = Array.isArray(saved) ? saved[0] : saved;
    if (contact?.id) {
      setLocalContacts(prev => [contact, ...prev]);
      set('contactId', contact.id);
      set('passportId', contact.documentNumber || '');
    }
    setNewContactVisible(false);
  };

  const handleSave = async () => {
    if (!form.propertyId) { setError(t('bkErrNoProperty')); return; }
    if (!form.checkIn || !form.checkOut) { setError(t('bkErrNoDates')); return; }
    if (form.checkIn >= form.checkOut) { setError(t('bkErrDateOrder')); return; }
    if (!form.notMyCustomer && !form.contactId) { setError(t('bookingSelectClient') || 'Please select a client'); return; }

    setSaving(true);
    setError('');
    try {
      const data = {
        propertyId:             form.propertyId,
        contactId:              form.notMyCustomer ? null : (form.contactId || null),
        notMyCustomer:          form.notMyCustomer,
        responsibleAgentId:     form.responsibleAgentId ?? null,
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
        ownerCommissionOneTime:          numOrNull(form.ownerCommissionOneTime),
        ownerCommissionOneTimeIsPercent: form.ownerCommissionOneTimeIsPercent,
        ownerCommissionMonthly:          numOrNull(form.ownerCommissionMonthly),
        ownerCommissionMonthlyIsPercent: form.ownerCommissionMonthlyIsPercent,
        adults:                 numOrNull(form.adults),
        children:               numOrNull(form.children),
        pets:                   form.pets,
        comments:               form.comments || null,
        photos:                 form.photos || [],
        reminderDays:           form.reminderDays || [],
        currency:               activeCurrency,
      };

      let saved;
      if (mode === 'edit' && booking?.id) {
        saved = await updateBooking(booking.id, data);
      } else {
        saved = await createBooking(data);
      }
      onSaved(saved);
    } catch (e) {
      if (e.message === 'BOOKING_CONFLICT') {
        setError(t('bookingConflictError'));
      } else if (e.message === 'BOOKING_UPDATE_FORBIDDEN') {
        setError(t('bookingUpdateForbidden') || 'Нет прав на редактирование этого бронирования.');
      } else if (e.message === 'BOOKING_NO_COMPANY') {
        setError(t('bookingNoCompany') || 'Не удалось определить компанию объекта. Убедитесь, что объект привязан к компании.');
      } else if (e.message === 'CONTACT_NO_COMPANY') {
        setError(t('contactNoCompany') || 'Не удалось определить компанию контакта. Обратитесь к администратору.');
      } else {
        setError(e.message || t('errorSave'));
      }
    } finally {
      setSaving(false);
    }
  };

  // Use currency from the selected property; fall back to user's selected currency
  const selectedProp = properties.find(p => p.id === form.propertyId);
  const activeCurrency = selectedProp?.currency || userCurrency || 'THB';
  const sym = getCurrencySymbol(activeCurrency);
  const L = (key) => t(key).replace('฿', sym);

  const title = mode === 'edit' ? t('bkEditTitle') : t('bkNewTitle');
  const nights = nightsLabel(form.checkIn, form.checkOut, t);
  const safeCalendarCheckIn = sanitizeISODate(form.checkIn);
  const safeCalendarCheckOut = sanitizeISODate(form.checkOut);

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Animated.View style={[s.backdrop, { opacity: backdropAnim }]} pointerEvents={visible ? 'auto' : 'none'}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View style={[s.panel, { transform: [{ translateX: slideAnim }] }]}>

          {/* ── Header ──────────────────────────────────────────── */}
          <View style={s.header}>
            <View style={s.headerAccent} />
            <View style={s.headerContent}>
              <Text style={s.headerTitle}>{title}</Text>
              <Text style={s.headerSub}>
                {mode === 'edit' ? t('bkEditSub') : t('bkNewSub')}
              </Text>
            </View>
            <TouchableOpacity style={s.closeBtn} onPress={onClose}>
              <Text style={s.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* ── Body ────────────────────────────────────────────── */}
          <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>

            {/* Объект */}
            <SectionCard title={t('bkSectionProperty')} icon="🏠">
              <Field label={t('bkSectionProperty')} required>
                <PropertyPicker
                  value={form.propertyId}
                  properties={properties}
                  t={t}
                  onChange={id => {
                    const pr = properties.find(x => x.id === id);
                    setForm(f => ({
                      ...f,
                      propertyId:     id,
                      // When the property changes, the responsible agent must be re-picked:
                      // the previous agent is unlikely to be responsible for the new property,
                      // and the DB integrity trigger would reject the save otherwise.
                      responsibleAgentId: f.propertyId === id ? f.responsibleAgentId : null,
                      priceMonthly:   pr?.price_monthly   != null ? String(pr.price_monthly)   : f.priceMonthly,
                      bookingDeposit: pr?.booking_deposit != null ? String(pr.booking_deposit) : f.bookingDeposit,
                      saveDeposit:    pr?.save_deposit    != null ? String(pr.save_deposit)    : f.saveDeposit,
                      commission:             pr?.commission                  != null ? String(pr.commission)                  : f.commission,
                      ownerCommissionOneTime:          pr?.owner_commission_one_time         != null ? String(pr.owner_commission_one_time)         : f.ownerCommissionOneTime,
                      ownerCommissionOneTimeIsPercent: pr?.owner_commission_one_time_is_percent ?? f.ownerCommissionOneTimeIsPercent,
                      ownerCommissionMonthly:          pr?.owner_commission_monthly           != null ? String(pr.owner_commission_monthly)           : f.ownerCommissionMonthly,
                      ownerCommissionMonthlyIsPercent: pr?.owner_commission_monthly_is_percent ?? f.ownerCommissionMonthlyIsPercent,
                    }));
                  }}
                />
              </Field>
            </SectionCard>

            {/* Ответственный за бронь — только для админа на доме с responsible_agent_id */}
            {(() => {
              if (isAgent) return null;
              const sp = properties.find(p => p.id === form.propertyId);
              const houseAgentId = sp?.responsible_agent_id || null;
              if (!houseAgentId) return null;
              const houseAgent = teamMembers.find(m => m.user_id === houseAgentId);
              const houseAgentLabel = houseAgent
                ? ([houseAgent.name, houseAgent.last_name].filter(Boolean).join(' ') || houseAgent.email || 'Agent')
                : 'Agent';
              const companyLabel = user?.companyInfo?.name || user?.teamMembership?.companyName || t('workAsCompany') || 'Company';
              const selected = form.responsibleAgentId || null;
              return (
                <SectionCard title={t('bkResponsible') || 'Responsible'} icon="🧑‍💼">
                  <Field label={t('bkResponsible') || 'Responsible'}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity
                        onPress={() => set('responsibleAgentId', null)}
                        style={{
                          flex: 1, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 8,
                          borderWidth: 1,
                          borderColor: selected === null ? ACCENT : C.border,
                          backgroundColor: selected === null ? C.accentBg : C.surface,
                        }}
                      >
                        <Text style={{ color: C.text, fontSize: 14 }} numberOfLines={1}>{companyLabel}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => set('responsibleAgentId', houseAgentId)}
                        style={{
                          flex: 1, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 8,
                          borderWidth: 1,
                          borderColor: selected === houseAgentId ? ACCENT : C.border,
                          backgroundColor: selected === houseAgentId ? C.accentBg : C.surface,
                        }}
                      >
                        <Text style={{ color: C.text, fontSize: 14 }} numberOfLines={1}>{houseAgentLabel}</Text>
                      </TouchableOpacity>
                    </View>
                  </Field>
                </SectionCard>
              );
            })()}

            {/* Клиент */}
            <SectionCard title={t('bkSectionClient')} icon="👤">
              <View style={s.toggleRow}>
                <View>
                  <Text style={s.toggleLabel}>{t('bkOwnerBooking')}</Text>
                  <Text style={s.toggleSub}>{t('bkOwnerBookingSub')}</Text>
                </View>
                <Switch
                  value={form.notMyCustomer}
                  onValueChange={v => set('notMyCustomer', v)}
                  trackColor={{ false: C.border, true: ACCENT }}
                  thumbColor="#FFF"
                />
              </View>

              {!form.notMyCustomer && (
              <>
                <Field label={t('client')}>
                  <ContactPicker
                    value={form.contactId}
                    contacts={localContacts}
                    onChange={v => set('contactId', v)}
                    onRequestNewContact={handleRequestNewContact}
                    t={t}
                    canCreateContact={canCreateContact}
                  />
                </Field>
                  <Field label={t('bkPassport')}>
                    <FInput value={form.passportId} onChangeText={v => set('passportId', v)} placeholder="AB123456" />
                  </Field>
                </>
              )}
            </SectionCard>

            {/* Даты */}
            <SectionCard title={t('bkSectionDates')} icon="📅">
              <View style={s.row2}>
                <Field label={t('checkIn')} required half>
                  <TouchableOpacity style={s.dateBtn} onPress={() => setCalendarVisible(true)}>
                    <Text style={safeCalendarCheckIn ? s.dateBtnText : s.dateBtnPlaceholder}>
                      {safeCalendarCheckIn ? dayjs(safeCalendarCheckIn).format(t('dateFormat')) : t('datePlaceholder')}
                    </Text>
                  </TouchableOpacity>
                </Field>
                <Field label={t('checkOut')} required half>
                  <TouchableOpacity style={s.dateBtn} onPress={() => setCalendarVisible(true)}>
                    <Text style={safeCalendarCheckOut ? s.dateBtnText : s.dateBtnPlaceholder}>
                      {safeCalendarCheckOut ? dayjs(safeCalendarCheckOut).format(t('dateFormat')) : t('datePlaceholder')}
                    </Text>
                  </TouchableOpacity>
                </Field>
              </View>
              <View style={s.row2}>
                <Field label={t('bkCheckInTime')} half>
                  <FInput value={form.checkInTime} onChangeText={v => set('checkInTime', v)} placeholder="14:00" />
                </Field>
                <Field label={t('bkCheckOutTime')} half>
                  <FInput value={form.checkOutTime} onChangeText={v => set('checkOutTime', v)} placeholder="12:00" />
                </Field>
              </View>

              {nights && (
                <View style={s.nightsBadge}>
                  <Text style={s.nightsIcon}>🌙</Text>
                  <Text style={s.nightsText}>{nights}</Text>
                </View>
              )}
            </SectionCard>

            <WebBookingCalendarPicker
              visible={calendarVisible}
              onClose={() => setCalendarVisible(false)}
              checkIn={safeCalendarCheckIn}
              checkOut={safeCalendarCheckOut}
              onSelect={(ci, co) => {
                set('checkIn', ci);
                set('checkOut', co);
                setCalendarVisible(false);
              }}
              bookedRanges={bookedRanges}
            />

            {/* Стоимость, Гости, Фото — только для обычного бронирования */}
            {!form.notMyCustomer && (
              <>
                {/* Стоимость */}
                <SectionCard title={t('bkSectionCost')} icon="💰">
                  <View style={s.row2}>
                    <Field label={L('propPriceMonthly')} half>
                      <FInput value={form.priceMonthly} onChangeText={v => set('priceMonthly', v)} placeholder="30 000" numeric />
                    </Field>
                    <Field label={L('bkTotalPrice')} half>
                      <FInput value={form.totalPrice} onChangeText={v => set('totalPrice', v)} placeholder={t('bkAuto')} numeric />
                    </Field>
                  </View>
                  <View style={s.row2}>
                    <Field label={L('propBookingDeposit2')} half>
                      <FInput value={form.bookingDeposit} onChangeText={v => set('bookingDeposit', v)} placeholder="5 000" numeric />
                    </Field>
                    <Field label={L('propSaveDeposit2')} half>
                      <FInput value={form.saveDeposit} onChangeText={v => set('saveDeposit', v)} placeholder="10 000" numeric />
                    </Field>
                  </View>
                  <Field label={L('bkAgentCommission')}>
                    <FInput value={form.commission} onChangeText={v => set('commission', v)} placeholder="15 000" numeric />
                  </Field>
                  {/* Owner commission one-time */}
                  <Field label={t('bookingOwnerCommOnce')}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {form.ownerCommissionOneTimeIsPercent ? (
                        <>
                          <View style={[s.inputWrap, { flex: 1 }]}>
                            <TextInput
                              style={s.input}
                              value={form.ownerCommissionOneTime != null ? String(form.ownerCommissionOneTime) : ''}
                              onChangeText={v => set('ownerCommissionOneTime', v.replace(/[^0-9.]/g, '') || null)}
                              placeholder="10"
                              placeholderTextColor={C.light}
                              keyboardType="numeric"
                            />
                          </View>
                          <View style={[s.inputWrap, { flex: 2, backgroundColor: '#F8F9FA' }]}>
                            <Text style={{ fontSize: 13, color: form.ownerCommissionOneTime && form.priceMonthly ? C.text : C.light }}>
                              {form.ownerCommissionOneTime && form.priceMonthly
                                ? `= ${Math.round(parseFloat(form.ownerCommissionOneTime) / 100 * parseFloat(form.priceMonthly)).toLocaleString()} ${sym}`
                                : `— ${sym}`}
                            </Text>
                          </View>
                        </>
                      ) : (
                        <FInput value={form.ownerCommissionOneTime} onChangeText={v => set('ownerCommissionOneTime', v)} placeholder="—" numeric />
                      )}
                      <View style={{ flexDirection: 'row', borderRadius: 7, borderWidth: 1, borderColor: C.border, overflow: 'hidden' }}>
                        <TouchableOpacity onPress={() => set('ownerCommissionOneTimeIsPercent', false)} style={{ paddingHorizontal: 10, paddingVertical: 8, backgroundColor: !form.ownerCommissionOneTimeIsPercent ? ACCENT : C.bg }}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: !form.ownerCommissionOneTimeIsPercent ? '#FFF' : C.muted }}>{sym}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => set('ownerCommissionOneTimeIsPercent', true)} style={{ paddingHorizontal: 10, paddingVertical: 8, backgroundColor: form.ownerCommissionOneTimeIsPercent ? ACCENT : C.bg }}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: form.ownerCommissionOneTimeIsPercent ? '#FFF' : C.muted }}>%</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </Field>
                  {/* Owner commission monthly */}
                  <Field label={t('bookingOwnerCommMonthly')}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {form.ownerCommissionMonthlyIsPercent ? (
                        <>
                          <View style={[s.inputWrap, { flex: 1 }]}>
                            <TextInput
                              style={s.input}
                              value={form.ownerCommissionMonthly != null ? String(form.ownerCommissionMonthly) : ''}
                              onChangeText={v => set('ownerCommissionMonthly', v.replace(/[^0-9.]/g, '') || null)}
                              placeholder="10"
                              placeholderTextColor={C.light}
                              keyboardType="numeric"
                            />
                          </View>
                          <View style={[s.inputWrap, { flex: 2, backgroundColor: '#F8F9FA' }]}>
                            <Text style={{ fontSize: 13, color: form.ownerCommissionMonthly && form.priceMonthly ? C.text : C.light }}>
                              {form.ownerCommissionMonthly && form.priceMonthly
                                ? `= ${Math.round(parseFloat(form.ownerCommissionMonthly) / 100 * parseFloat(form.priceMonthly)).toLocaleString()} ${sym}`
                                : `— ${sym}`}
                            </Text>
                          </View>
                        </>
                      ) : (
                        <FInput value={form.ownerCommissionMonthly} onChangeText={v => set('ownerCommissionMonthly', v)} placeholder="—" numeric />
                      )}
                      <View style={{ flexDirection: 'row', borderRadius: 7, borderWidth: 1, borderColor: C.border, overflow: 'hidden' }}>
                        <TouchableOpacity onPress={() => set('ownerCommissionMonthlyIsPercent', false)} style={{ paddingHorizontal: 10, paddingVertical: 8, backgroundColor: !form.ownerCommissionMonthlyIsPercent ? ACCENT : C.bg }}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: !form.ownerCommissionMonthlyIsPercent ? '#FFF' : C.muted }}>{sym}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => set('ownerCommissionMonthlyIsPercent', true)} style={{ paddingHorizontal: 10, paddingVertical: 8, backgroundColor: form.ownerCommissionMonthlyIsPercent ? ACCENT : C.bg }}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: form.ownerCommissionMonthlyIsPercent ? '#FFF' : C.muted }}>%</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </Field>
                </SectionCard>

                {/* Гости */}
                <SectionCard title={t('bkSectionGuests')} icon="👥">
                  <View style={s.row2}>
                    <Field label={t('bkAdults')} half>
                      <CounterInput value={form.adults} onChange={v => set('adults', v)} />
                    </Field>
                    <Field label={t('bkChildren')} half>
                      <CounterInput value={form.children} onChange={v => set('children', v)} />
                    </Field>
                  </View>
                  <View style={s.toggleRow}>
                    <View>
                  <Text style={s.toggleLabel}>{t('bkPets')}</Text>
                  <Text style={s.toggleSub}>{t('bkPetsAllowed')}</Text>
                    </View>
                    <Switch
                      value={form.pets}
                      onValueChange={v => set('pets', v)}
                      trackColor={{ false: C.border, true: ACCENT }}
                      thumbColor="#FFF"
                    />
                  </View>
                </SectionCard>

                {/* Фотографии */}
                <SectionCard title={t('pdPhotos')} icon="📷">
                  <Text style={s.photoHint}>{t('bkPhotoHint')}</Text>
                  <PhotoGrid
                    photos={form.photos || []}
                    onAdd={handlePhotoAdd}
                    onRemove={handlePhotoRemove}
                    uploading={uploadingPhoto}
                    t={t}
                  />
                </SectionCard>
              </>
            )}

            {/* Напоминания — скрыты для "Клиент собственника" */}
            {!form.notMyCustomer && (
              <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#212529', marginBottom: 8 }}>
                  {t('bookingNotifications') || 'Reminders'}
                </Text>
                <TouchableOpacity
                  style={{ borderWidth: 1, borderColor: '#E9ECEF', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 }}
                  onPress={() => setReminderPickerOpen(!reminderPickerOpen)}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 14, color: (form.reminderDays || []).length > 0 ? '#212529' : '#ADB5BD' }}>
                    {(form.reminderDays || []).length > 0
                      ? (form.reminderDays || []).map(d => t(BOOKING_REMINDER_OPTIONS.find(o => o.days === d)?.key || 'bookingReminder1d')).join(', ')
                      : t('bookingAddNotification') || 'Add reminder'}
                  </Text>
                </TouchableOpacity>
                {reminderPickerOpen && (
                  <View style={{ marginTop: 8, borderWidth: 1, borderColor: '#E9ECEF', borderRadius: 8, overflow: 'hidden' }}>
                    {BOOKING_REMINDER_OPTIONS.map(opt => {
                      const isSelected = (form.reminderDays || []).includes(opt.days);
                      return (
                        <TouchableOpacity
                          key={opt.days}
                          style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: isSelected ? '#EAF4F5' : '#fff', borderBottomWidth: 1, borderBottomColor: '#E9ECEF' }}
                          onPress={() => {
                            setForm(f => ({
                              ...f,
                              reminderDays: isSelected
                                ? (f.reminderDays || []).filter(d => d !== opt.days)
                                : [...(f.reminderDays || []), opt.days].sort((a, b) => a - b),
                            }));
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: isSelected ? '#3D7D82' : '#ADB5BD', backgroundColor: isSelected ? '#3D7D82' : '#fff', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                            {isSelected && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text>}
                          </View>
                          <Text style={{ fontSize: 14, color: isSelected ? '#3D7D82' : '#212529', fontWeight: isSelected ? '600' : '400' }}>{t(opt.key)}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* Примечания */}
            <SectionCard title={t('pdComments')} icon="📝">
              <Field label={t('pdComments')}>
                <FInput
                  value={form.comments}
                  onChangeText={v => set('comments', v)}
                  placeholder={t('bkCommentsPlaceholder')}
                  multiline
                />
              </Field>
            </SectionCard>

            <View style={{ height: 8 }} />
          </ScrollView>

          {/* ── Footer ──────────────────────────────────────────── */}
          <View style={s.footer}>
            {error ? (
              <View style={s.errorBanner}>
                <Text style={s.errorIcon}>⚠️</Text>
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : null}
            <View style={s.footerBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
                <Text style={s.cancelBtnText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
                {saving
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <Text style={s.saveBtnText}>{t('save')}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>

        </Animated.View>
      </View>

      {/* Панель создания нового контакта — открывается поверх */}
      <WebContactEditPanel
        visible={newContactVisible}
        mode="add"
        lockType="clients"
        contact={newContactInitialName ? {
          name: newContactInitialName.split(' ')[0] || '',
          lastName: newContactInitialName.split(' ').slice(1).join(' ') || '',
        } : null}
        onClose={() => setNewContactVisible(false)}
        onSaved={handleNewContactSaved}
      />
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  overlay:  { flex: 1, flexDirection: 'row', justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  panel: {
    width: 500, backgroundColor: C.bg,
    shadowColor: '#000', shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.18, shadowRadius: 24, elevation: 24,
    flexDirection: 'column',
  },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface,
    borderBottomWidth: 1, borderBottomColor: C.border,
    paddingRight: 16,
  },
  headerAccent: { width: 4, alignSelf: 'stretch', backgroundColor: ACCENT, borderTopRightRadius: 0 },
  headerContent: { flex: 1, paddingVertical: 16, paddingHorizontal: 16 },
  headerTitle:   { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 2 },
  headerSub:     { fontSize: 12, color: C.muted },
  closeBtn:      { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: C.bg },
  closeBtnText:  { fontSize: 15, color: C.muted },

  // Scroll
  scroll:        { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },

  // Cards
  card: {
    backgroundColor: C.card, borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 11,
    backgroundColor: C.bg,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  cardIcon:  { fontSize: 15 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: C.text, letterSpacing: 0.3 },
  cardBody:  { padding: 14, gap: 12 },

  // Fields
  field:     { gap: 5 },
  fieldHalf: { flex: 1 },
  label:     { fontSize: 12, fontWeight: '600', color: C.muted },

  // Inputs
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface, borderRadius: 8,
    borderWidth: 1.5, borderColor: C.border,
    paddingHorizontal: 11, paddingVertical: 9, minHeight: 42,
  },
  inputWrapFocused: { borderColor: ACCENT },
  inputWrapMulti:   { alignItems: 'flex-start', paddingVertical: 10 },
  inputPrefix:      { fontSize: 13, color: C.muted, marginRight: 6 },
  input: {
    flex: 1, fontSize: 14, color: C.text,
    outlineStyle: 'none', padding: 0,
  },
  inputMulti: { minHeight: 64, textAlignVertical: 'top' },

  // Rows
  row2: { flexDirection: 'row', gap: 10 },

  // Toggle rows
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 6,
  },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: C.text },
  toggleSub:   { fontSize: 11, color: C.muted, marginTop: 1 },

  // Picker trigger
  pickerTrigger: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface, borderRadius: 8,
    borderWidth: 1.5, borderColor: C.border,
    paddingHorizontal: 12, paddingVertical: 9, minHeight: 44,
  },
  pickerMainText:  { fontSize: 14, color: C.text, fontWeight: '500' },
  pickerSubText:   { fontSize: 11, color: C.muted, marginTop: 2 },
  pickerPlaceholder: { flex: 1, fontSize: 14, color: C.light },
  pickerChevron:   { fontSize: 10, color: C.light, marginLeft: 8 },

  // Type pill
  typePill:     { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 },
  typePillText: { fontSize: 11, fontWeight: '700' },

  // Dropdown
  dropdown: {
    backgroundColor: C.surface, borderRadius: 10,
    borderWidth: 1.5, borderColor: C.border,
    marginTop: 4, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 8,
  },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 9,
    backgroundColor: C.bg,
    borderBottomWidth: 1, borderBottomColor: C.border, gap: 8,
  },
  searchIcon:  { fontSize: 14 },
  searchInput: {
    flex: 1, fontSize: 13, color: C.text,
    outlineStyle: 'none', padding: 0,
  },
  searchClear:  { fontSize: 13, color: C.muted, paddingHorizontal: 4 },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  dropdownItemLeft: { flex: 1, borderLeftWidth: 3, paddingLeft: 10 },
  dropdownItemName: { fontSize: 13, fontWeight: '500', color: C.text },
  dropdownItemSub:  { fontSize: 11, color: C.muted, marginTop: 2 },
  dropdownEmpty:    { padding: 16, textAlign: 'center', color: C.muted, fontSize: 13 },

  // Contact avatar
  contactAvatar:     { width: 30, height: 30, borderRadius: 15, backgroundColor: C.accentBg, alignItems: 'center', justifyContent: 'center' },
  contactAvatarText: { fontSize: 13, fontWeight: '700', color: ACCENT },

  // Add new contact row
  addNewContactRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: C.border,
    backgroundColor: '#EAF4F5',
  },
  addNewContactIcon: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center',
  },
  addNewContactText: { fontSize: 13, fontWeight: '600', color: ACCENT },


  // Counter
  counter:        { flexDirection: 'row', alignItems: 'center', gap: 0 },
  counterBtn:     { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.border, borderRadius: 8 },
  counterBtnText: { fontSize: 20, color: C.text, lineHeight: 24 },
  counterValue:   { minWidth: 40, textAlign: 'center', fontSize: 16, fontWeight: '600', color: C.text },

  // Nights badge
  nightsBadge: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.greenBg, borderRadius: 10, paddingVertical: 10,
    borderWidth: 1, borderColor: '#BBF7D0',
  },
  nightsIcon: { fontSize: 16 },
  nightsText: { fontSize: 15, fontWeight: '700', color: C.green },

  // Photos
  photoHint: { fontSize: 12, color: C.muted, marginBottom: 4 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoThumb: {
    width: 76, height: 76, borderRadius: 10, overflow: 'hidden',
    borderWidth: 1, borderColor: C.border, position: 'relative',
  },
  photoImg:    { width: '100%', height: '100%' },
  photoRemove: {
    position: 'absolute', top: 3, right: 3,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  photoRemoveText: { fontSize: 10, color: '#FFF', fontWeight: '700' },
  photoAdd: {
    width: 76, height: 76, borderRadius: 10,
    borderWidth: 2, borderColor: C.border, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  photoAddIcon: { fontSize: 22, color: C.light },
  photoAddText: { fontSize: 11, color: C.muted },

  // Error
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF5F5', borderRadius: 8, borderWidth: 1, borderColor: '#FCA5A5',
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10,
  },
  errorIcon: { fontSize: 15 },
  errorText: { fontSize: 13, color: '#DC2626', flex: 1 },

  // Footer
  footer: {
    padding: 16, borderTopWidth: 1, borderTopColor: C.border,
    backgroundColor: C.surface,
  },
  footerBtns:    { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#E9ECEF',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  cancelBtnText: { fontSize: 14, color: '#6C757D', fontWeight: '600' },
  saveBtn: {
    flex: 2,
    backgroundColor: '#EAF4F5',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#B2D8DB',
  },
  saveBtnText: { fontSize: 14, color: '#3D7D82', fontWeight: '700', letterSpacing: 0.3 },
  dateBtn: {
    borderWidth: 1, borderColor: '#DEE2E6', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff',
  },
  dateBtnText: { fontSize: 14, color: '#212529' },
  dateBtnPlaceholder: { fontSize: 14, color: '#ADB5BD' },
});
