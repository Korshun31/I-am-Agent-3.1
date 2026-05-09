import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Pressable,
  Image as RNImage,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../context/LanguageContext';
import { TYPE_COLORS } from './PropertyItem';
import { IconHouseType, IconCondoType } from './PropertyIcons';

// Iconка резорта взята как PNG-референс, перекрашивается через tintColor
// в текущий цвет (TYPE_COLORS.resort для выбранного, серый для неактивного).
function IconResortPng({ size = 28, color = '#888' }) {
  return (
    <RNImage
      source={require('../../assets/icon-property-resort-new.png')}
      style={{ width: size, height: size, tintColor: color }}
      resizeMode="contain"
    />
  );
}

const PROPERTY_TYPES = [
  { key: 'resort', Icon: IconResortPng },
  { key: 'house',  Icon: IconHouseType },
  { key: 'condo',  Icon: IconCondoType },
];

function TypeTile({ typeKey, Icon, label, selected, onPress }) {
  const typeColor = TYPE_COLORS[typeKey] || TYPE_COLORS.house;
  const iconColor  = selected ? typeColor : '#C7C7CC';
  const labelColor = selected ? typeColor : '#C7C7CC';

  return (
    <TouchableOpacity
      style={[
        styles.tile,
        selected && { borderColor: typeColor, borderWidth: 1.5 },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Icon size={28} color={iconColor} />
      <Text style={[styles.tileLabel, { color: labelColor }]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function AddPropertyModal({ visible, onClose, onTypeSelected }) {
  const { t } = useLanguage();
  const [type, setType] = useState('house');

  useEffect(() => {
    if (visible) setType('house');
  }, [visible]);

  if (!visible) return null;

  const handleNext = () => {
    onTypeSelected?.(type);
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
            {/* Шапка */}
            <View style={styles.headerRow}>
              <View style={styles.headerSpacer} />
              <Text style={styles.title}>{t('addProperty')}</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
                <Ionicons name="close" size={20} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            {/* Контент */}
            <View style={styles.content}>
              <Text style={styles.sectionLabel}>{t('propertyType')}</Text>

              <View style={styles.typeRow}>
                {PROPERTY_TYPES.map((pt) => (
                  <TypeTile
                    key={pt.key}
                    typeKey={pt.key}
                    Icon={pt.Icon}
                    label={t(`propertyType_${pt.key}`)}
                    selected={type === pt.key}
                    onPress={() => setType(pt.key)}
                  />
                ))}
              </View>

              {/* Кнопка «Далее» — outline, деликатная */}
              <TouchableOpacity
                style={[styles.nextBtn, !type && styles.nextBtnDisabled]}
                onPress={handleNext}
                activeOpacity={0.75}
                disabled={!type}
              >
                <Text style={[styles.nextBtnText, !type && styles.nextBtnTextDisabled]}>
                  {t('next') || 'Next'}
                </Text>
              </TouchableOpacity>
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
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 10,
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
  headerSpacer: { width: 36 },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#2C2C2C',
    textAlign: 'center',
    flex: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  content: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E8E93',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginBottom: 16,
  },

  typeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  tile: {
    flex: 1,
    height: 88,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  tileLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Кнопка «Далее» — outline: прозрачный фон, teal-обводка, teal-текст
  nextBtn: {
    marginTop: 40,
    height: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#3D7D82',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtnDisabled: {
    borderColor: '#C7C7CC',
  },
  nextBtnText: {
    color: '#3D7D82',
    fontSize: 15,
    fontWeight: '600',
  },
  nextBtnTextDisabled: {
    color: '#C7C7CC',
  },
});
