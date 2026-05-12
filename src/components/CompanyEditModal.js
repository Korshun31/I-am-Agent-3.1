import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { uploadCompanyLogo } from '../services/storageService';
import ModalScrollFrame from './ModalScrollFrame';

const COLORS = {
  title: '#2C2C2C',
  inputBg: '#F7F7F9',
  accent: '#3D7D82',
  label: '#6B6B6B',
};

export default function CompanyEditModal({ visible, onClose, companyInfo = {}, onSave }) {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [telegram, setTelegram] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [instagram, setInstagram] = useState('');
  const [workingHours, setWorkingHours] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setName(companyInfo.name || '');
      setPhone(companyInfo.phone || '');
      setEmail(companyInfo.email || '');
      setLogoUrl(companyInfo.logoUrl || '');
      setTelegram(companyInfo.telegram || '');
      setWhatsapp(companyInfo.whatsapp || '');
      setInstagram(companyInfo.instagram || '');
      setWorkingHours(companyInfo.workingHours || '');
    }
  }, [visible, companyInfo]);

  useEffect(() => {
    if (visible) {
      setTimeout(() => {
        scrollRef.current?.flashScrollIndicators();
      }, 400);
    }
  }, [visible]);

  const pickLogo = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          t('galleryAccess') || 'Gallery access',
          t('galleryAccessMessage') || 'Please allow gallery access in settings.',
          [{ text: 'OK' }]
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;

      setUploadingLogo(true);
      const publicUrl = await uploadCompanyLogo(result.assets[0].uri);
      setLogoUrl(publicUrl);
    } catch (e) {
      Alert.alert(t('pickPhotoError'), e?.message || t('pickPhotoFailed'));
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert(t('error'), t('companyNameRequired'));
      return;
    }
    onSave?.({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      logoUrl: logoUrl || '',
      telegram: telegram.trim(),
      whatsapp: whatsapp.trim(),
      instagram: instagram.trim(),
      workingHours: workingHours.trim(),
    });
    onClose?.();
  };

  if (!visible) return null;

  const header = (
    <View style={styles.headerRow}>
      <View style={styles.headerSpacer} />
      <Text style={styles.title}>{t('companyEditTitle')}</Text>
      <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.8}>
        <Ionicons name="close" size={22} color="#888" />
      </TouchableOpacity>
    </View>
  );

  const logoSlot = (
    <View style={styles.logoSection}>
      <TouchableOpacity style={styles.photoWrap} onPress={pickLogo} activeOpacity={0.8} disabled={uploadingLogo}>
        <View style={styles.photoCircle}>
          {uploadingLogo ? (
            <Ionicons name="hourglass-outline" size={32} color="#888" />
          ) : logoUrl ? (
            <Image source={{ uri: logoUrl }} style={styles.logoImage} resizeMode="contain" />
          ) : (
            <Ionicons name="business" size={40} color="#B8B8B8" />
          )}
        </View>
        {!uploadingLogo && (
          <View style={styles.photoPlus}>
            <Ionicons name="add" size={20} color="#fff" />
          </View>
        )}
      </TouchableOpacity>
      <Text style={styles.logoHint}>{t('companyLogo')}</Text>
    </View>
  );

  const footer = (
    <TouchableOpacity style={styles.saveBtn} onPress={() => { Keyboard.dismiss(); handleSave(); }} activeOpacity={0.7}>
      <Text style={styles.saveBtnText}>{t('save')}</Text>
    </TouchableOpacity>
  );

  return (
    <ModalScrollFrame
      visible={visible}
      onRequestClose={onClose}
      ref={scrollRef}
      header={header}
      aboveScrollSlot={logoSlot}
      footer={footer}
      boxWrapStyle={{ maxWidth: 380 }}
      boxStyle={{ backgroundColor: '#FFFFFF' }}
      scrollContentContainerStyle={styles.scrollContent}
      scrollProps={{
        showsVerticalScrollIndicator: false,
        keyboardShouldPersistTaps: 'handled',
        keyboardDismissMode: 'interactive',
      }}
    >
                <Text style={styles.fieldLabel}>{t('companyName')}</Text>
                <TextInput
                  style={styles.input}
                  placeholderTextColor="#888"
                  value={name}
                  onChangeText={setName}
                />
                <Text style={styles.fieldLabel}>{t('companyPhone')}</Text>
                <TextInput
                  style={styles.input}
                  placeholderTextColor="#888"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  returnKeyType="done"
                />
                <Text style={styles.fieldLabel}>{t('companyEmail')}</Text>
                <TextInput
                  style={styles.input}
                  placeholderTextColor="#888"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <Text style={styles.fieldLabel}>{t('companyTelegram')}</Text>
                <TextInput
                  style={styles.input}
                  placeholderTextColor="#888"
                  value={telegram}
                  onChangeText={setTelegram}
                  autoCapitalize="none"
                />
                <Text style={styles.fieldLabel}>{t('companyWhatsapp')}</Text>
                <TextInput
                  style={styles.input}
                  placeholderTextColor="#888"
                  value={whatsapp}
                  onChangeText={setWhatsapp}
                  keyboardType="phone-pad"
                  returnKeyType="done"
                />
                <Text style={styles.fieldLabel}>{t('companyInstagram')}</Text>
                <TextInput
                  style={styles.input}
                  placeholderTextColor="#888"
                  value={instagram}
                  onChangeText={setInstagram}
                  autoCapitalize="none"
                />
                <Text style={styles.fieldLabel}>{t('companyWorkingHours')}</Text>
                <TextInput
                  style={styles.input}
                  placeholderTextColor="#888"
                  value={workingHours}
                  onChangeText={setWorkingHours}
                />
    </ModalScrollFrame>
  );
}

const styles = StyleSheet.create({
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
  logoSection: {
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 8,
  },
  photoWrap: {
    marginBottom: 4,
    alignSelf: 'center',
    position: 'relative',
  },
  photoCircle: {
    width: 140,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#EFEFEF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImage: {
    width: 140,
    height: 80,
    borderRadius: 12,
    resizeMode: 'contain',
  },
  logoHint: {
    fontSize: 12,
    color: '#888',
    marginTop: 6,
  },
  photoPlus: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: 'transparent',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.label,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  input: {
    width: '100%',
    backgroundColor: COLORS.inputBg,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: COLORS.title,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#D1D1D6',
    minHeight: 46,
  },
  saveBtn: {
    marginHorizontal: 20,
    marginBottom: 20,
    marginTop: 4,
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
});
