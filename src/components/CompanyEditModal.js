import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Keyboard,
  Image,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { uploadCompanyLogo } from '../services/storageService';
import ModalScrollFrame from './ModalScrollFrame';

const COLORS = {
  boxBg: 'rgba(255,255,255,0.72)',
  title: '#2C2C2C',
  inputBg: '#F7F7F9',
  border: '#E0D8CC',
  addPink: '#D85A6A',
  plusGreen: '#5DB87A',
  saveGreen: '#2E7D32',
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
  const [showAddContactChoices, setShowAddContactChoices] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [showTelegram, setShowTelegram] = useState(false);
  const [showWhatsapp, setShowWhatsapp] = useState(false);
  const [showInstagram, setShowInstagram] = useState(false);
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
      setShowAddContactChoices(false);
      setShowTelegram(!!companyInfo.telegram);
      setShowWhatsapp(!!companyInfo.whatsapp);
      setShowInstagram(!!companyInfo.instagram);
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
        <Text style={styles.closeIcon}>✕</Text>
      </TouchableOpacity>
    </View>
  );

  const logoSlot = (
    <View style={styles.logoSection}>
      <TouchableOpacity style={styles.photoWrap} onPress={pickLogo} activeOpacity={0.8} disabled={uploadingLogo}>
        <View style={styles.photoCircle}>
          {uploadingLogo ? (
            <Text style={styles.logoPlaceholder}>⏳</Text>
          ) : logoUrl ? (
            <Image source={{ uri: logoUrl }} style={styles.logoImage} />
          ) : (
            <Text style={styles.logoPlaceholder}>🏢</Text>
          )}
        </View>
        {!uploadingLogo && (
          <View style={styles.photoPlus}>
            <Text style={styles.plusText}>+</Text>
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
      scrollContentContainerStyle={styles.scrollContent}
      scrollProps={{
        showsVerticalScrollIndicator: false,
        keyboardShouldPersistTaps: 'handled',
        keyboardDismissMode: 'interactive',
      }}
    >
                <TextInput
                  style={styles.input}
                  placeholder={t('companyName')}
                  placeholderTextColor="#888"
                  value={name}
                  onChangeText={setName}
                />
                <TextInput
                  style={styles.input}
                  placeholder={t('companyPhone')}
                  placeholderTextColor="#888"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  returnKeyType="done"
                />
                <TextInput
                  style={styles.input}
                  placeholder={t('companyEmail')}
                  placeholderTextColor="#888"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                {showTelegram && (
                  <TextInput
                    style={styles.input}
                    placeholder={t('companyTelegram')}
                    placeholderTextColor="#888"
                    value={telegram}
                    onChangeText={setTelegram}
                    autoCapitalize="none"
                  />
                )}

                {showWhatsapp && (
                  <TextInput
                    style={styles.input}
                    placeholder={t('companyWhatsapp')}
                    placeholderTextColor="#888"
                    value={whatsapp}
                    onChangeText={setWhatsapp}
                    keyboardType="phone-pad"
                    returnKeyType="done"
                  />
                )}

                {showInstagram && (
                  <TextInput
                    style={styles.input}
                    placeholder={t('companyInstagram')}
                    placeholderTextColor="#888"
                    value={instagram}
                    onChangeText={setInstagram}
                    autoCapitalize="none"
                  />
                )}

                {/* Add contact button */}
                <View style={styles.addContactBlockWrap}>
                  {showAddContactChoices ? (
                    <View style={styles.addContactChoicesRow}>
                      {!showTelegram && (
                        <TouchableOpacity
                          style={styles.addContactChoiceBtn}
                          onPress={() => { setShowTelegram(true); setShowAddContactChoices(false); }}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.addContactChoiceText}>Telegram</Text>
                        </TouchableOpacity>
                      )}
                      {!showWhatsapp && (
                        <TouchableOpacity
                          style={styles.addContactChoiceBtn}
                          onPress={() => { setShowWhatsapp(true); setShowAddContactChoices(false); }}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.addContactChoiceText}>WhatsApp</Text>
                        </TouchableOpacity>
                      )}
                      {!showInstagram && (
                        <TouchableOpacity
                          style={styles.addContactChoiceBtn}
                          onPress={() => { setShowInstagram(true); setShowAddContactChoices(false); }}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.addContactChoiceText}>Instagram</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles.addContactChoiceBtn}
                        onPress={() => setShowAddContactChoices(false)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.addContactChoiceText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    (!showTelegram || !showWhatsapp || !showInstagram) && (
                      <Pressable
                        style={styles.addContactBtn}
                        onPress={() => setShowAddContactChoices(true)}
                        hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                      >
                        <Text style={styles.addContactIcon}>📞</Text>
                        <Text style={styles.addContactText}>{t('addContact')}</Text>
                      </Pressable>
                    )
                  )}
                </View>

                <TextInput
                  style={styles.input}
                  placeholder={t('companyWorkingHours')}
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
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#E0D8CC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  logoImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
  },
  logoPlaceholder: {
    fontSize: 32,
  },
  logoHint: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  photoPlus: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.plusGreen,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  plusText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 18,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  input: {
    width: '100%',
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: COLORS.title,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addContactBlockWrap: {
    width: '100%',
    marginTop: 4,
    marginBottom: 12,
  },
  addContactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingHorizontal: 4,
  },
  addContactIcon: {
    fontSize: 18,
  },
  addContactText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.addPink,
  },
  addContactChoicesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  addContactChoiceBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: COLORS.inputBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addContactChoiceText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.title,
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
    borderColor: 'rgba(46, 125, 50, 0.5)',
    backgroundColor: 'rgba(46, 125, 50, 0.06)',
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.saveGreen,
  },
});
