import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Image,
  Platform,
  Pressable,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useLanguage } from '../context/LanguageContext';

const COLORS = {
  boxBg: 'rgba(255,255,255,0.92)',
  title: '#2C2C2C',
  border: '#E0D8CC',
};

const PROPERTY_TYPES = [
  { key: 'resort', color: '#C8E6C9', borderColor: '#81C784', icon: require('../../assets/icon-property-resort.png') },
  { key: 'house', color: '#FFF9C4', borderColor: '#FFD54F', icon: require('../../assets/icon-property-house.png') },
  { key: 'condo', color: '#BBDEFB', borderColor: '#64B5F6', icon: require('../../assets/icon-property-condo.png') },
];

export default function AddPropertyModal({ visible, onClose, onTypeSelected }) {
  const { t } = useLanguage();
  const [type, setType] = useState('house');

  if (!visible) return null;

  const handleSelect = (selectedType) => {
    setType(selectedType);
    onTypeSelected?.(selectedType);
    onClose?.();
  };

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
              <Text style={styles.title}>{t('addProperty')}</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.8}>
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.content}>
              <Text style={styles.hint}>{t('propertyType')}</Text>
              <View style={styles.typeRow}>
                {PROPERTY_TYPES.map((pt) => (
                  <TouchableOpacity
                    key={pt.key}
                    style={[
                      styles.typeBtn,
                      type === pt.key
                        ? { backgroundColor: pt.color, borderColor: pt.borderColor, ...styles.typeBtnActive }
                        : styles.typeBtnInactive,
                    ]}
                    onPress={() => handleSelect(pt.key)}
                    activeOpacity={0.7}
                  >
                    <Image
                      source={pt.icon}
                      style={[styles.typeBtnIcon, type !== pt.key && styles.typeBtnIconInactive]}
                      resizeMode="contain"
                    />
                    <Text style={[styles.typeBtnLabel, type === pt.key && styles.typeBtnLabelActive]}>
                      {t(`propertyType_${pt.key}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
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
  content: {
    padding: 20,
  },
  hint: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.title,
    marginBottom: 14,
    textAlign: 'center',
  },
  typeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  typeBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 2,
  },
  typeBtnInactive: {
    backgroundColor: '#EDEDEB',
    borderColor: '#D5D5D0',
  },
  typeBtnActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  typeBtnIcon: {
    width: 36,
    height: 36,
    marginBottom: 6,
  },
  typeBtnIconInactive: {
    opacity: 0.35,
  },
  typeBtnLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#AAAAAA',
  },
  typeBtnLabelActive: {
    color: '#2C2C2C',
    fontWeight: '700',
  },
});
