import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, Modal, ActivityIndicator,
} from 'react-native';
import { updateUserProfile } from '../../services/authService';
import { useLanguage } from '../../context/LanguageContext';

const ACCENT = '#3D7D82';
const C = {
  bg: '#F4F6F9', surface: '#FFFFFF', border: '#E9ECEF',
  text: '#212529', muted: '#6C757D', light: '#ADB5BD',
  accent: ACCENT, accentBg: '#EAF4F5',
};

const LANGUAGES = [
  { id: 'ru', label: 'Russian', icon: '🇷🇺' },
  { id: 'en', label: 'English', icon: '🇺🇸' },
  { id: 'th', label: 'Thai', icon: '🇹🇭' },
];

const CURRENCIES = [
  { id: 'THB', label: 'Thai Baht (฿)', icon: '฿' },
  { id: 'USD', label: 'US Dollar ($)', icon: '$' },
  { id: 'EUR', label: 'Euro (€)', icon: '€' },
  { id: 'RUB', label: 'Russian Ruble (₽)', icon: '₽' },
];

export default function WebSettingsModal({ visible, type, user, onClose, onSaved }) {
  const { t, setLanguage, setCurrency } = useLanguage();
  const [saving, setSaving] = useState(false);
  const slideAnim = useRef(new Animated.Value(540)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
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
  }, [visible]);

  const handleSelect = async (value) => {
    setSaving(true);
    try {
      const updates = type === 'language' ? { web_language: value } : { selectedCurrency: value };
      const updated = await updateUserProfile(updates);
      if (type === 'language') {
        setLanguage(value);
      } else if (type === 'currency') {
        setCurrency(value);
      }
      onSaved(updated);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  const options = type === 'language' ? LANGUAGES : CURRENCIES;
  const currentValue = type === 'language' ? user?.language : user?.selectedCurrency;
  const title = type === 'language' ? t('settingsLanguageTitle') : t('settingsCurrencyTitle');

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Animated.View style={[s.backdrop, { opacity: backdropAnim }]}>
          <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
        </Animated.View>

        <Animated.View style={[s.panel, { transform: [{ translateX: slideAnim }] }]}>
          <View style={s.panelHeader}>
            <Text style={s.panelTitle}>{title}</Text>
            <TouchableOpacity style={s.closeBtn} onPress={onClose}>
              <Text style={s.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={s.content}>
            {saving && (
              <View style={s.loadingOverlay}>
                <ActivityIndicator size="large" color={ACCENT} />
              </View>
            )}
            {options.map((opt) => (
              <TouchableOpacity
                key={opt.id}
                style={[s.option, currentValue === opt.id && s.optionActive]}
                onPress={() => handleSelect(opt.id)}
                disabled={saving}
              >
                <View style={s.optionLeft}>
                  <Text style={s.optionIcon}>{opt.icon}</Text>
                  <Text style={[s.optionLabel, currentValue === opt.id && s.optionLabelActive]}>
                    {opt.label}
                  </Text>
                </View>
                {currentValue === opt.id && <Text style={s.checkIcon}>✓</Text>}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', flexDirection: 'row' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  panel: { width: 380, backgroundColor: C.surface, shadowColor: '#000', shadowOffset: { width: -8, height: 0 }, shadowOpacity: 0.15, shadowRadius: 24, flexDirection: 'column' },
  panelHeader: { flexDirection: 'row', alignItems: 'center', padding: 24, borderBottomWidth: 1, borderBottomColor: C.border, justifyContent: 'space-between' },
  panelTitle: { fontSize: 20, fontWeight: '800', color: C.text },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 16, color: C.muted },
  content: { flex: 1, padding: 16 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.6)', zIndex: 10, alignItems: 'center', justifyContent: 'center' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 14,
    marginBottom: 8,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: C.border,
  },
  optionActive: {
    borderColor: ACCENT,
    backgroundColor: ACCENT + '08',
  },
  optionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  optionIcon: { fontSize: 20 },
  optionLabel: { fontSize: 15, fontWeight: '600', color: C.text },
  optionLabelActive: { color: ACCENT },
  checkIcon: { fontSize: 18, fontWeight: '700', color: ACCENT },
});
