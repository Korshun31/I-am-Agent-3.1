import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Platform,
  Pressable,
  KeyboardAvoidingView,
  Keyboard,
  Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useLanguage } from '../context/LanguageContext';

const COLORS = {
  boxBg: 'rgba(255,255,255,0.72)',
  title: '#2C2C2C',
  inputBg: '#F5F2EB',
  border: '#E0D8CC',
  saveGreen: '#2E7D32',
};

const PROPERTY_TYPES = [
  { key: 'resort', color: '#C8E6C9', borderColor: '#81C784', icon: require('../../assets/icon-property-resort.png') },
  { key: 'house', color: '#FFF9C4', borderColor: '#FFD54F', icon: require('../../assets/icon-property-house.png') },
  { key: 'condo', color: '#BBDEFB', borderColor: '#64B5F6', icon: require('../../assets/icon-property-condo.png') },
];

export default function AddPropertyModal({ visible, onClose, onSave, editProperty = null }) {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [type, setType] = useState('house');
  const scrollRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setTimeout(() => scrollRef.current?.flashScrollIndicators(), 400);
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      if (editProperty) {
        setName(editProperty.name || '');
        setCode(editProperty.code || '');
        setType(editProperty.type || 'house');
      } else {
        setName('');
        setCode('');
        setType('house');
      }
    }
  }, [visible, editProperty]);

  const handleSave = () => {
    Keyboard.dismiss();
    if (!name.trim()) {
      Alert.alert(t('error'), t('enterPropertyName'));
      return;
    }
    if (!code.trim()) {
      Alert.alert(t('error'), t('enterPropertyCode'));
      return;
    }
    onSave?.({
      name: name.trim(),
      code: code.trim(),
      type,
    });
  };

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={Keyboard.dismiss}>
        {Platform.OS === 'web' ? (
          <View style={[StyleSheet.absoluteFill, styles.backdropWeb]} />
        ) : (
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        )}
        <KeyboardAvoidingView
          style={styles.keyboardWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={40}
        >
          <Pressable
            style={styles.boxWrap}
            onPress={(e) => { e.stopPropagation(); Keyboard.dismiss(); }}
          >
            <View style={styles.box}>
              <View style={styles.headerRow}>
                <View style={styles.headerSpacer} />
                <Text style={styles.title}>
                  {editProperty ? t('editProperty') : t('addProperty')}
                </Text>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.8}>
                  <Text style={styles.closeIcon}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                ref={scrollRef}
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={true}
                keyboardShouldPersistTaps="handled"
                onScrollBeginDrag={Keyboard.dismiss}
                indicatorStyle="black"
              >
                <Text style={styles.fieldLabel}>{t('propertyType')}</Text>
                <View style={styles.typeRow}>
                  {PROPERTY_TYPES.map((pt) => {
                    const isActive = type === pt.key;
                    return (
                      <TouchableOpacity
                        key={pt.key}
                        style={[
                          styles.typeBtn,
                          isActive
                            ? { backgroundColor: pt.color, borderColor: pt.borderColor }
                            : styles.typeBtnInactive,
                          isActive && styles.typeBtnActive,
                        ]}
                        onPress={() => setType(pt.key)}
                        activeOpacity={0.7}
                      >
                        <Image source={pt.icon} style={[styles.typeBtnIcon, !isActive && styles.typeBtnIconInactive]} resizeMode="contain" />
                        <Text style={[
                          styles.typeBtnLabel,
                          isActive && styles.typeBtnLabelActive,
                        ]}>
                          {t(`propertyType_${pt.key}`)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.fieldLabel}>{t('propertyName')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('propertyNamePlaceholder')}
                  placeholderTextColor="#999"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />

                <Text style={styles.fieldLabel}>{t('propertyCode')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('propertyCodePlaceholder')}
                  placeholderTextColor="#999"
                  value={code}
                  onChangeText={setCode}
                  autoCapitalize="characters"
                  returnKeyType="done"
                />

                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={handleSave}
                  activeOpacity={0.7}
                >
                  <Text style={styles.saveBtnText}>{t('save')}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
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
  keyboardWrap: {
    width: '100%',
    alignItems: 'center',
  },
  boxWrap: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '85%',
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
  headerSpacer: {
    width: 36,
  },
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
  scroll: {
    maxHeight: 420,
  },
  scrollContent: {
    padding: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.title,
    marginBottom: 8,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  typeBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
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
    width: 32,
    height: 32,
    marginBottom: 4,
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
  input: {
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: COLORS.title,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  saveBtn: {
    marginTop: 8,
    paddingVertical: 14,
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
    color: COLORS.saveGreen,
  },
});
