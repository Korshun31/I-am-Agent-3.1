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
import { uploadAvatar } from '../services/storageService';
import ModalScrollFrame from './ModalScrollFrame';

const COLORS = {
  boxBg: 'rgba(255,255,255,0.72)',
  title: '#2C2C2C',
  inputBg: '#F7F7F9',
  accent: '#3D7D82',
  label: '#6B6B6B',
};

/**
 * Модальное окно редактирования данных пользователя (My details).
 * Поля: фото (заглушка), Имя, Фамилия, Номер документа, Телефон, кнопка «Добавить контакт».
 */
export default function MyDetailsEditModal({ visible, onClose, user = {}, onSave }) {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [lastName, setLastName] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [extraPhones, setExtraPhones] = useState([]);
  const [extraEmails, setExtraEmails] = useState([]);
  const [telegram, setTelegram] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [photoUri, setPhotoUri] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showTelegramField, setShowTelegramField] = useState(false);
  const [showWhatsappField, setShowWhatsappField] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setName(user.name || '');
      setLastName(user.lastName || '');
      setDocumentNumber(user.documentNumber || '');
      setPhone(user.phone || '');
      const extras = Array.isArray(user.extraPhones) ? [...user.extraPhones] : [];
      setExtraPhones(extras);
      const extEmails = Array.isArray(user.extraEmails) ? [...user.extraEmails] : [];
      setExtraEmails(extEmails);
      setTelegram(user.telegram || '');
      setWhatsapp(user.whatsapp || '');
      setPhotoUri(user.photoUri || '');
      setShowTelegramField(!!(user.telegram || '').trim());
      setShowWhatsappField(!!(user.whatsapp || '').trim());
    }
  }, [visible, user.name, user.lastName, user.documentNumber, user.phone, user.extraPhones, user.extraEmails, user.telegram, user.whatsapp, user.photoUri]);

  const handleSave = async () => {
    const personalPayload = {
      name: name.trim(),
      lastName: lastName.trim(),
      documentNumber: documentNumber.trim(),
      phone: phone.trim(),
      extraPhones: extraPhones.filter((p) => (p || '').trim()),
      extraEmails: extraEmails.filter((e) => (e || '').trim()),
      telegram: telegram.trim(),
      whatsapp: whatsapp.trim(),
      photoUri: photoUri || '',
    };
    try {
      onSave?.(personalPayload);
      onClose?.();
    } catch (e) {
      console.error('Save error:', e);
      Alert.alert('Ошибка', 'Не удалось сохранить данные. Попробуйте ещё раз.');
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Доступ к галерее',
          'Чтобы выбрать фото, разрешите доступ к галерее в настройках.',
          [{ text: 'OK' }]
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;

      setUploadingAvatar(true);
      const uri = result.assets[0].uri;
      const publicUrl = await uploadAvatar(uri);
      setPhotoUri(publicUrl);
    } catch (e) {
      Alert.alert(t('pickPhotoError'), e?.message || t('pickPhotoFailed'));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const updateExtraPhone = (index, value) => {
    const next = [...extraPhones];
    next[index] = value;
    setExtraPhones(next);
  };
  const removeExtraPhone = (index) => {
    setExtraPhones(extraPhones.filter((_, i) => i !== index));
  };
  const updateExtraEmail = (index, value) => {
    const next = [...extraEmails];
    next[index] = value;
    setExtraEmails(next);
  };
  const removeExtraEmail = (index) => {
    setExtraEmails(extraEmails.filter((_, i) => i !== index));
  };

  const confirmRemoveContact = (onConfirm) => {
    Alert.alert(t('removeContactConfirmTitle'), t('removeContactConfirm'), [
      { text: t('no'), style: 'cancel' },
      { text: t('yes'), style: 'destructive', onPress: onConfirm },
    ]);
  };

  if (!visible) return null;

  const header = (
    <View style={styles.headerRow}>
      <View style={styles.headerSpacer} />
      <Text style={styles.title}>{t('myDetails')}</Text>
      <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.8}>
        <Ionicons name="close" size={22} color="#888" />
      </TouchableOpacity>
    </View>
  );

  const photoSlot = (
    <View style={styles.photoSection}>
      <TouchableOpacity style={styles.photoWrap} onPress={pickImage} activeOpacity={0.8} disabled={uploadingAvatar}>
        <View style={styles.photoCircle}>
          {uploadingAvatar ? (
            <Ionicons name="hourglass-outline" size={40} color="#888" />
          ) : photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photoImage} />
          ) : (
            <Ionicons name="person" size={56} color="#B8B8B8" />
          )}
        </View>
        {!uploadingAvatar && (
          <View style={styles.photoPlus}>
            <Ionicons name="add" size={20} color="#fff" />
          </View>
        )}
      </TouchableOpacity>
    </View>
  );

  const footer = (
    <TouchableOpacity style={styles.saveBtn} onPress={async () => { Keyboard.dismiss(); await handleSave(); }} activeOpacity={0.7}>
      <Text style={styles.saveBtnText}>{t('save')}</Text>
    </TouchableOpacity>
  );

  return (
    <ModalScrollFrame
      visible={visible}
      onRequestClose={onClose}
      ref={scrollRef}
      header={header}
      aboveScrollSlot={photoSlot}
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
                <Text style={styles.fieldLabel}>{t('name')}</Text>
                <TextInput
                  style={styles.input}
                  placeholderTextColor="#888"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
                <Text style={styles.fieldLabel}>{t('lastName')}</Text>
                <TextInput
                  style={styles.input}
                  placeholderTextColor="#888"
                  value={lastName}
                  onChangeText={setLastName}
                  autoCapitalize="words"
                />
                <Text style={styles.fieldLabel}>{t('documentNumber')}</Text>
                <TextInput
                  style={styles.input}
                  placeholderTextColor="#888"
                  value={documentNumber}
                  onChangeText={setDocumentNumber}
                  keyboardType="numeric"
                  returnKeyType="done"
                />
                <Text style={styles.fieldLabel}>{t('phone')}</Text>
                <TextInput
                  style={styles.input}
                  placeholderTextColor="#888"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  returnKeyType="done"
                />

                {extraPhones.map((val, index) => (
                  <View key={`phone-${index}`}>
                    <Text style={styles.fieldLabel}>{t('extraPhone')}</Text>
                    <View style={styles.extraPhoneRow}>
                      <TextInput
                        style={[styles.input, styles.extraInput]}
                        placeholderTextColor="#888"
                        value={val}
                        onChangeText={(t) => updateExtraPhone(index, t)}
                        keyboardType="phone-pad"
                        returnKeyType="done"
                      />
                      <TouchableOpacity style={styles.removeBtn} onPress={() => confirmRemoveContact(() => removeExtraPhone(index))} activeOpacity={0.8}>
                        <Ionicons name="trash-outline" size={22} color="#888" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}

                {extraEmails.map((val, index) => (
                  <View key={`email-${index}`}>
                    <Text style={styles.fieldLabel}>{t('extraEmail')}</Text>
                    <View style={styles.extraPhoneRow}>
                      <TextInput
                        style={[styles.input, styles.extraInput]}
                        placeholderTextColor="#888"
                        value={val}
                        onChangeText={(t) => updateExtraEmail(index, t)}
                        keyboardType="email-address"
                        autoCapitalize="none"
                      />
                      <TouchableOpacity style={styles.removeBtn} onPress={() => confirmRemoveContact(() => removeExtraEmail(index))} activeOpacity={0.8}>
                        <Ionicons name="trash-outline" size={22} color="#888" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}

                {showTelegramField ? (
                  <>
                    <Text style={styles.fieldLabel}>{t('telegram')}</Text>
                    <TextInput
                      style={styles.input}
                      placeholderTextColor="#888"
                      value={telegram}
                      onChangeText={setTelegram}
                      autoCapitalize="none"
                    />
                  </>
                ) : null}

                {showWhatsappField ? (
                  <>
                    <Text style={styles.fieldLabel}>{t('whatsapp')}</Text>
                    <TextInput
                      style={styles.input}
                      placeholderTextColor="#888"
                      value={whatsapp}
                      onChangeText={setWhatsapp}
                      keyboardType="phone-pad"
                      returnKeyType="done"
                    />
                  </>
                ) : null}

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
  photoSection: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: 'transparent',
  },
  saveBtn: {
    marginHorizontal: 20,
    marginBottom: 20,
    marginTop: 0,
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
  photoWrap: {
    marginBottom: 20,
    alignSelf: 'center',
    position: 'relative',
  },
  photoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#EFEFEF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
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
  extraPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
    gap: 8,
  },
  extraInput: {
    flex: 1,
    marginBottom: 0,
  },
  removeBtn: {
    padding: 8,
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
