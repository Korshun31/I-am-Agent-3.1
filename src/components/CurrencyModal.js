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
import { useLanguage } from '../context/LanguageContext';

const COLORS = {
  boxBg: 'rgba(255,255,255,0.72)',
  title: '#2C2C2C',
};

const CURRENCIES = [
  { id: 'USD', labelKey: 'currencyUSD' },
  { id: 'EUR', labelKey: 'currencyEUR' },
  { id: 'RUB', labelKey: 'currencyRUB' },
  { id: 'THB', labelKey: 'currencyTHB' },
];

/**
 * Модальное окно выбора валют. Агент выбирает валюту, с которой работает.
 * Квадратные чекбоксы — только один из вариантов.
 */
export default function CurrencyModal({ visible, onClose, selectedCurrency = '', onSave }) {
  const { t } = useLanguage();
  const [selected, setSelected] = useState('');

  useEffect(() => {
    if (visible) {
      const cur = typeof selectedCurrency === 'string' ? selectedCurrency : (Array.isArray(selectedCurrency) && selectedCurrency[0]) || '';
      setSelected(cur);
    }
  }, [visible, selectedCurrency]);

  const handleSave = () => {
    onSave?.(selected);
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
              <Text style={styles.title}>{t('currencySelection')}</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.8}>
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.content}>
              {CURRENCIES.map((cur) => (
                <TouchableOpacity
                  key={cur.id}
                  style={styles.optionRow}
                  onPress={() => setSelected(selected === cur.id ? '' : cur.id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.checkbox, selected === cur.id && styles.checkboxChecked]}>
                    {selected === cur.id ? <Text style={styles.checkmark}>✓</Text> : null}
                  </View>
                  <Text style={styles.optionLabel}>{t(cur.labelKey)}</Text>
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
  },
  headerSpacer: {
    width: 36,
    height: 36,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.title,
    textAlign: 'center',
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
  content: {
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
    borderColor: 'rgba(46, 125, 50, 0.5)',
    backgroundColor: 'rgba(46, 125, 50, 0.06)',
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#6B6B6B',
    backgroundColor: '#F5F2EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#5B8DEE',
    borderColor: '#3A6FCC',
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.title,
  },
});
