import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Animated, ActivityIndicator, Platform,
} from 'react-native';
import { createContact, updateContact } from '../../services/contactsService';

const ACCENT = '#D81B60';
const C = {
  bg: '#F4F6F9', surface: '#FFFFFF', border: '#E9ECEF',
  text: '#212529', muted: '#6C757D', light: '#ADB5BD',
};

// ─── Field ───────────────────────────────────────────────────────────────────

function Field({ label, value, onChangeText, placeholder, keyboardType, multiline }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={[s.fieldInput, multiline && s.fieldInputMulti]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || ''}
        placeholderTextColor={C.light}
        keyboardType={keyboardType || 'default'}
        multiline={!!multiline}
        numberOfLines={multiline ? 3 : 1}
      />
    </View>
  );
}

// ─── TypeSelect ───────────────────────────────────────────────────────────────

function TypeSelect({ value, onChange }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>Тип контакта *</Text>
      <View style={s.typeRow}>
        {[
          { key: 'clients', label: 'Клиент',       color: '#1565C0', bg: '#E3F2FD' },
          { key: 'owners',  label: 'Собственник',  color: '#C2920E', bg: '#FFF8E1' },
        ].map(opt => (
          <TouchableOpacity
            key={opt.key}
            style={[
              s.typeBtn,
              value === opt.key && { backgroundColor: opt.bg, borderColor: opt.color },
            ]}
            onPress={() => onChange(opt.key)}
            activeOpacity={0.8}
          >
            <Text style={[s.typeBtnText, value === opt.key && { color: opt.color, fontWeight: '700' }]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function WebContactEditPanel({ visible, mode, contact, onClose, onSaved }) {
  const slideAnim = useRef(new Animated.Value(420)).current;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    type: 'clients',
    name: '', lastName: '',
    phone: '', email: '',
    telegram: '', whatsapp: '',
    phone2: '', email2: '',
    telegram2: '', whatsapp2: '',
    nationality: '', birthday: '',
    documentNumber: '',
  });

  // Slide animation
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : 420,
      useNativeDriver: true,
      tension: 80, friction: 12,
    }).start();
  }, [visible]);

  // Fill form when editing
  useEffect(() => {
    if (visible) {
      setError('');
      if (mode === 'edit' && contact) {
        const tgs = contact.extraTelegrams || (contact.telegram ? [contact.telegram] : []);
        const was = contact.extraWhatsapps || (contact.whatsapp ? [contact.whatsapp] : []);
        const phs = contact.extraPhones || [];
        const ems = contact.extraEmails  || [];
        setForm({
          type:           contact.type || 'clients',
          name:           contact.name || '',
          lastName:       contact.lastName || '',
          phone:          contact.phone || '',
          email:          contact.email || '',
          telegram:       tgs[0] || '',
          whatsapp:       was[0] || '',
          phone2:         phs[0] || '',
          email2:         ems[0] || '',
          telegram2:      tgs[1] || '',
          whatsapp2:      was[1] || '',
          nationality:    contact.nationality || '',
          birthday:       contact.birthday || '',
          documentNumber: contact.documentNumber || '',
        });
      } else {
        setForm({
          type: 'clients', name: '', lastName: '',
          phone: '', email: '', telegram: '', whatsapp: '',
          phone2: '', email2: '', telegram2: '', whatsapp2: '',
          nationality: '', birthday: '', documentNumber: '',
        });
      }
    }
  }, [visible, mode, contact]);

  const set = (key) => (val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Введите имя'); return; }
    setError('');
    setSaving(true);
    try {
      const payload = {
        type:           form.type,
        name:           form.name.trim(),
        lastName:       form.lastName.trim(),
        phone:          form.phone.trim(),
        email:          form.email.trim(),
        nationality:    form.nationality.trim(),
        birthday:       form.birthday.trim(),
        documentNumber: form.documentNumber.trim(),
        extraPhones:    [form.phone2].filter(Boolean),
        extraEmails:    [form.email2].filter(Boolean),
        extraTelegrams: [form.telegram, form.telegram2].filter(Boolean),
        extraWhatsapps: [form.whatsapp, form.whatsapp2].filter(Boolean),
      };

      let saved;
      if (mode === 'edit' && contact) {
        saved = await updateContact(contact.id, payload);
      } else {
        saved = await createContact(payload);
      }
      onSaved(saved);
    } catch (e) {
      setError(e.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  const title = mode === 'edit' ? 'Редактировать контакт' : 'Новый контакт';

  return (
    <Animated.View style={[s.panel, { transform: [{ translateX: slideAnim }] }]}>

      {/* Header */}
      <View style={s.panelHeader}>
        <Text style={s.panelTitle}>{title}</Text>
        <TouchableOpacity onPress={onClose} style={s.closeBtn} activeOpacity={0.7}>
          <Text style={s.closeBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Form */}
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

        <TypeSelect value={form.type} onChange={set('type')} />

        <View style={s.section}>
          <Text style={s.sectionLabel}>ОСНОВНОЕ</Text>
          <Field label="Имя *"       value={form.name}     onChangeText={set('name')}     placeholder="Иван" />
          <Field label="Фамилия"     value={form.lastName} onChangeText={set('lastName')} placeholder="Петров" />
          <Field label="Гражданство" value={form.nationality} onChangeText={set('nationality')} placeholder="Россия" />
          <Field label="Дата рождения" value={form.birthday} onChangeText={set('birthday')} placeholder="YYYY-MM-DD" />
          <Field label="Номер документа" value={form.documentNumber} onChangeText={set('documentNumber')} placeholder="AB1234567" />
        </View>

        <View style={s.section}>
          <Text style={s.sectionLabel}>ТЕЛЕФОНЫ</Text>
          <Field label="Телефон"      value={form.phone}  onChangeText={set('phone')}  placeholder="+66 99 999 9999" keyboardType="phone-pad" />
          <Field label="Доп. телефон" value={form.phone2} onChangeText={set('phone2')} placeholder="+7 999 999 9999" keyboardType="phone-pad" />
        </View>

        <View style={s.section}>
          <Text style={s.sectionLabel}>МЕССЕНДЖЕРЫ</Text>
          <Field label="Telegram"      value={form.telegram}  onChangeText={set('telegram')}  placeholder="@username или +79991234567" />
          <Field label="Доп. Telegram" value={form.telegram2} onChangeText={set('telegram2')} placeholder="@username2" />
          <Field label="WhatsApp"      value={form.whatsapp}  onChangeText={set('whatsapp')}  placeholder="+66 99 999 9999" keyboardType="phone-pad" />
          <Field label="Доп. WhatsApp" value={form.whatsapp2} onChangeText={set('whatsapp2')} placeholder="+7 999 999 9999" keyboardType="phone-pad" />
        </View>

        <View style={s.section}>
          <Text style={s.sectionLabel}>EMAIL</Text>
          <Field label="Email"       value={form.email}  onChangeText={set('email')}  placeholder="mail@example.com" keyboardType="email-address" />
          <Field label="Доп. Email"  value={form.email2} onChangeText={set('email2')} placeholder="other@example.com" keyboardType="email-address" />
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}

      </ScrollView>

      {/* Footer */}
      <View style={s.footer}>
        <TouchableOpacity style={s.cancelBtn} onPress={onClose} activeOpacity={0.7}>
          <Text style={s.cancelBtnText}>Отмена</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.saveBtn} onPress={handleSave} activeOpacity={0.8} disabled={saving}>
          {saving
            ? <ActivityIndicator color="#FFF" size="small" />
            : <Text style={s.saveBtnText}>Сохранить</Text>
          }
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  panel: {
    position: 'absolute', top: 0, right: 0, bottom: 0,
    width: 420,
    backgroundColor: C.surface,
    borderLeftWidth: 1,
    borderLeftColor: C.border,
    flexDirection: 'column',
    zIndex: 100,
    ...Platform.select({ web: { boxShadow: '-4px 0 24px rgba(0,0,0,0.10)' } }),
  },
  panelHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  panelTitle: { fontSize: 18, fontWeight: '800', color: C.text },
  closeBtn:   { padding: 6 },
  closeBtnText: { fontSize: 18, color: C.light },

  scroll:        { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 10 },

  section:      { marginBottom: 20 },
  sectionLabel: {
    fontSize: 11, fontWeight: '800', color: C.light,
    letterSpacing: 0.8, marginBottom: 10,
  },

  field:       { marginBottom: 12 },
  fieldLabel:  { fontSize: 12, fontWeight: '600', color: C.muted, marginBottom: 5 },
  fieldInput: {
    backgroundColor: C.bg, borderRadius: 8, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: C.text,
    ...Platform.select({ web: { outlineStyle: 'none' } }),
  },
  fieldInputMulti: { minHeight: 80, textAlignVertical: 'top' },

  typeRow: { flexDirection: 'row', gap: 10 },
  typeBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 8,
    borderWidth: 1.5, borderColor: C.border,
    alignItems: 'center', backgroundColor: C.bg,
  },
  typeBtnText: { fontSize: 14, color: C.muted },

  error: {
    color: '#C62828', fontSize: 13, textAlign: 'center',
    paddingVertical: 8, marginTop: 4,
  },

  footer: {
    flexDirection: 'row', gap: 10, padding: 16,
    borderTopWidth: 1, borderTopColor: C.border,
  },
  cancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 8,
    borderWidth: 1, borderColor: C.border, alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: C.muted },
  saveBtn: {
    flex: 2, paddingVertical: 12, borderRadius: 8,
    backgroundColor: ACCENT, alignItems: 'center',
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
