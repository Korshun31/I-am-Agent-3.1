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
import Checkbox from './Checkbox';

const COLORS = {
  boxBg: 'rgba(255,255,255,0.72)',
  title: '#2C2C2C',
};

/**
 * Модальное окно настроек уведомлений. Открывается при нажатии на Notifications в Settings.
 * Круглые — можно выбрать несколько. Квадратные — только один из вариантов.
 */
export default function NotificationsModal({ visible, onClose, settings = {}, onSave }) {
  const { t } = useLanguage();
  const [sound, setSound] = useState(true);
  const [vibration, setVibration] = useState(false);
  const [unlockedType, setUnlockedType] = useState('');
  const [lockedType, setLockedType] = useState('');

  useEffect(() => {
    if (visible) {
      setSound(settings.sound !== false);
      setVibration(!!settings.vibration);
      setUnlockedType(settings.unlockedType || '');
      setLockedType(settings.lockedType || '');
    }
  }, [visible, settings.sound, settings.vibration, settings.unlockedType, settings.lockedType]);

  const handleSave = () => {
    onSave?.({
      sound,
      vibration,
      unlockedType,
      lockedType,
    });
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
              <Text style={styles.title}>{t('notifications')}</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.8}>
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.content}>
              <View style={styles.section}>
                <View style={styles.radioRow}>
                  <TouchableOpacity style={styles.optionRow} onPress={() => setSound(!sound)} activeOpacity={0.8}>
                    <View style={[styles.radio, sound && styles.radioChecked]}>
                      {sound ? <View style={styles.radioDot} /> : null}
                    </View>
                    <Text style={styles.optionLabel}>{t('notifSound')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.optionRow} onPress={() => setVibration(!vibration)} activeOpacity={0.8}>
                    <View style={[styles.radio, vibration && styles.radioChecked]}>
                      {vibration ? <View style={styles.radioDot} /> : null}
                    </View>
                    <Text style={styles.optionLabel}>{t('notifVibration')}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.sectionTitle}>{t('notifPopupTitle')}</Text>

              <View style={styles.section}>
                <Text style={styles.subTitle}>{t('notifUnlockedScreen')}</Text>
                <TouchableOpacity style={styles.optionRow} onPress={() => setUnlockedType(unlockedType === 'banner' ? '' : 'banner')} activeOpacity={0.8}>
                  <Checkbox checked={unlockedType === 'banner'} />
                  <Text style={styles.optionLabel}>{t('notifBanner')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.optionRow} onPress={() => setUnlockedType(unlockedType === 'popup' ? '' : 'popup')} activeOpacity={0.8}>
                  <Checkbox checked={unlockedType === 'popup'} />
                  <Text style={styles.optionLabel}>{t('notifPopup')}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.section}>
                <Text style={styles.subTitle}>{t('notifLockedScreen')}</Text>
                <TouchableOpacity style={styles.optionRow} onPress={() => setLockedType(lockedType === 'full' ? '' : 'full')} activeOpacity={0.8}>
                  <Checkbox checked={lockedType === 'full'} />
                  <Text style={styles.optionLabel}>{t('notifShowFull')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.optionRow} onPress={() => setLockedType(lockedType === 'fact' ? '' : 'fact')} activeOpacity={0.8}>
                  <Checkbox checked={lockedType === 'fact'} />
                  <Text style={styles.optionLabel}>{t('notifShowFact')}</Text>
                </TouchableOpacity>
              </View>
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
  section: {
    padding: 14,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.title,
    marginBottom: 10,
  },
  subTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.title,
    marginBottom: 10,
  },
  radioRow: {
    gap: 4,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#6B6B6B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioChecked: {
    borderColor: '#5B8DEE',
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#5B8DEE',
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.title,
  },
});
