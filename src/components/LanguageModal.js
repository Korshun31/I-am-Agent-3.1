import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Pressable,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../context/LanguageContext';
import Checkbox from './Checkbox';

const COLORS = {
  title: '#2C2C2C',
  accent: '#3D7D82',
};

const LANGUAGES = [
  { id: 'en', label: 'English' },
  { id: 'th', label: 'ภาษาไทย' },
  { id: 'ru', label: 'Русский' },
];

/**
 * Модальное окно выбора языка. Открывается при нажатии на Language в Settings.
 */
export default function LanguageModal({ visible, onClose, selectedLanguage = '', onSave }) {
  const { t } = useLanguage();
  const [selected, setSelected] = useState('');

  useEffect(() => {
    if (visible) {
      setSelected(selectedLanguage && ['en', 'th', 'ru'].includes(selectedLanguage) ? selectedLanguage : 'en');
    }
  }, [visible, selectedLanguage]);

  const handleSave = () => {
    onSave?.(selected || 'en');
    onClose?.();
  };

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {Platform.OS === 'web' ? (
          <View style={[StyleSheet.absoluteFill, styles.backdropWeb]} />
        ) : (
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        )}
        <Pressable style={styles.boxWrap} onPress={(e) => e.stopPropagation()}>
          <View style={styles.box}>
            <View style={styles.headerRow}>
              <View style={styles.headerSpacer} />
              <Text style={styles.title}>{t('language')}</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.8}>
                <Ionicons name="close" size={22} color="#888" />
              </TouchableOpacity>
            </View>
            <View style={styles.optionsWrap}>
              {LANGUAGES.map((lang) => (
                <TouchableOpacity
                  key={lang.id}
                  style={styles.optionRow}
                  onPress={() => setSelected(lang.id)}
                  activeOpacity={0.8}
                >
                  <Checkbox checked={selected === lang.id} />
                  <Text style={styles.optionLabel}>{lang.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.7}>
              <Text style={styles.saveBtnText}>{t('save')}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  backdropWeb: {
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  boxWrap: {
    width: '100%',
    maxWidth: 360,
  },
  box: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
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
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.07)',
  },
  headerSpacer: {
    width: 36,
    height: 36,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.title,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionsWrap: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  saveBtn: {
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(61,125,130,0.08)',
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.accent,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.title,
  },
});
