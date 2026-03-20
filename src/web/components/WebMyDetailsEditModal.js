import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Animated, Modal, ActivityIndicator, Image, Platform,
} from 'react-native';
import { supabase } from '../../services/supabase';
import { updateUserProfile } from '../../services/authService';

const ACCENT = '#3D7D82';
const C = {
  bg: '#F4F6F9', surface: '#FFFFFF', border: '#E9ECEF',
  text: '#212529', muted: '#6C757D', light: '#ADB5BD',
  accent: ACCENT, accentBg: '#EAF4F5',
};

function FieldLabel({ text, required }) {
  return (
    <Text style={s.fieldLabel}>
      {text}{required && <Text style={{ color: ACCENT }}> *</Text>}
    </Text>
  );
}

function FieldInput({ value, onChangeText, placeholder, numeric, multiline }) {
  return (
    <TextInput
      style={[s.fieldInput, multiline && s.fieldInputMulti]}
      value={value != null ? String(value) : ''}
      onChangeText={onChangeText}
      placeholder={placeholder || ''}
      placeholderTextColor={C.light}
      keyboardType={numeric ? 'numeric' : 'default'}
      multiline={multiline}
      numberOfLines={multiline ? 3 : 1}
    />
  );
}

export default function WebMyDetailsEditModal({ visible, user, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: '',
    lastName: '',
    phone: '',
    telegram: '',
    whatsapp: '',
    documentNumber: '',
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const slideAnim = useRef(new Animated.Value(540)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setForm({
        name: user?.name || '',
        lastName: user?.lastName || '',
        phone: user?.phone || '',
        telegram: user?.telegram || '',
        whatsapp: user?.whatsapp || '',
        documentNumber: user?.documentNumber || '',
      });
      setError('');
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 540, duration: 220, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, user]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Введите имя'); return; }
    setSaving(true);
    setError('');

    try {
      const updated = await updateUserProfile({
        name: form.name.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim(),
        telegram: form.telegram.trim(),
        whatsapp: form.whatsapp.trim(),
        documentNumber: form.documentNumber.trim(),
      });
      onSaved(updated);
      onClose();
    } catch (e) {
      setError(e.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Animated.View style={[s.backdrop, { opacity: backdropAnim }]}>
          <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
        </Animated.View>

        <Animated.View style={[s.panel, { transform: [{ translateX: slideAnim }] }]}>
          <View style={s.panelHeader}>
            <Text style={s.panelTitle}>Личные данные</Text>
            <TouchableOpacity style={s.closeBtn} onPress={onClose}>
              <Text style={s.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={s.formScroll} contentContainerStyle={s.formContent}>
            <View style={s.row2}>
              <View style={{ flex: 1 }}>
                <FieldLabel text="Имя" required />
                <FieldInput value={form.name} onChangeText={v => set('name', v)} placeholder="Иван" />
              </View>
              <View style={{ flex: 1 }}>
                <FieldLabel text="Фамилия" />
                <FieldInput value={form.lastName} onChangeText={v => set('lastName', v)} placeholder="Иванов" />
              </View>
            </View>

            <View style={s.fieldRow}>
              <FieldLabel text="Телефон" />
              <FieldInput value={form.phone} onChangeText={v => set('phone', v)} placeholder="+7..." />
            </View>

            <View style={s.fieldRow}>
              <FieldLabel text="Telegram" />
              <FieldInput value={form.telegram} onChangeText={v => set('telegram', v)} placeholder="@username" />
            </View>

            <View style={s.fieldRow}>
              <FieldLabel text="WhatsApp" />
              <FieldInput value={form.whatsapp} onChangeText={v => set('whatsapp', v)} placeholder="+7..." />
            </View>

            <View style={s.fieldRow}>
              <FieldLabel text="Номер документа (ID / Паспорт)" />
              <FieldInput value={form.documentNumber} onChangeText={v => set('documentNumber', v)} placeholder="0000 000000" />
            </View>
          </ScrollView>

          <View style={s.footer}>
            {error ? <Text style={s.footerError}>{error}</Text> : null}
            <View style={s.footerBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
                <Text style={s.cancelBtnText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color={ACCENT} /> : <Text style={s.saveBtnText}>Сохранить</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', flexDirection: 'row' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  panel: { width: 440, backgroundColor: C.surface, shadowColor: '#000', shadowOffset: { width: -8, height: 0 }, shadowOpacity: 0.15, shadowRadius: 24, flexDirection: 'column' },
  panelHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: C.border, justifyContent: 'space-between' },
  panelTitle: { fontSize: 20, fontWeight: '800', color: C.text },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 16, color: C.muted },
  formScroll: { flex: 1 },
  formContent: { padding: 24 },
  fieldRow: { marginBottom: 20 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: C.muted, marginBottom: 8 },
  fieldInput: { height: 44, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, fontSize: 15, color: C.text, backgroundColor: C.bg, outlineWidth: 0 },
  row2: { flexDirection: 'row', gap: 16, marginBottom: 20 },
  footer: { padding: 24, borderTopWidth: 1, borderTopColor: C.border },
  footerError: { color: '#E53935', fontSize: 13, marginBottom: 12, textAlign: 'center' },
  footerBtns: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, height: 48, borderRadius: 14, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: C.muted },
  saveBtn: { flex: 1, height: 48, borderRadius: 14, backgroundColor: '#EAF4F5', borderWidth: 1.5, borderColor: '#B2D8DB', alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: ACCENT },
});
