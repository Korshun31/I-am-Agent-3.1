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
import { uploadAvatar } from '../services/storageService';
import ModalScrollFrame from './ModalScrollFrame';

const COLORS = {
  boxBg: 'rgba(255,255,255,0.72)',
  title: '#2C2C2C',
  inputBg: '#F7F7F9',
  border: '#E0D8CC',
  addPink: '#D85A6A',
  plusGreen: '#5DB87A',
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
  const [showAddContactChoices, setShowAddContactChoices] = useState(false);
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
      setShowAddContactChoices(false);
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

  const closeAddContactChoices = () => {
    setShowAddContactChoices(false);
  };

  const addExtraPhone = () => {
    setExtraPhones([...extraPhones, '']);
    setShowAddContactChoices(false);
  };
  const addExtraEmail = () => {
    setExtraEmails([...extraEmails, '']);
    setShowAddContactChoices(false);
  };
  const addTelegramField = () => {
    setShowTelegramField(true);
    setShowAddContactChoices(false);
  };
  const addWhatsappField = () => {
    setShowWhatsappField(true);
    setShowAddContactChoices(false);
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
        <Text style={styles.closeIcon}>✕</Text>
      </TouchableOpacity>
    </View>
  );

  const photoSlot = (
    <View style={styles.photoSection}>
      <TouchableOpacity style={styles.photoWrap} onPress={pickImage} activeOpacity={0.8} disabled={uploadingAvatar}>
        <View style={styles.photoCircle}>
          {uploadingAvatar ? (
            <Text style={styles.photoIcon}>⏳</Text>
          ) : photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photoImage} />
          ) : (
            <Text style={styles.photoIcon}>👤</Text>
          )}
        </View>
        {!uploadingAvatar && (
          <View style={styles.photoPlus}>
            <Text style={styles.plusText}>+</Text>
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
      scrollContentContainerStyle={styles.scrollContent}
      scrollProps={{
        showsVerticalScrollIndicator: false,
        keyboardShouldPersistTaps: 'handled',
        keyboardDismissMode: 'interactive',
      }}
    >
                <TextInput
                  style={styles.input}
                  placeholder={t('name')}
                  placeholderTextColor="#888"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
                <TextInput
                  style={styles.input}
                  placeholder={t('lastName')}
                  placeholderTextColor="#888"
                  value={lastName}
                  onChangeText={setLastName}
                  autoCapitalize="words"
                />
                <TextInput
                  style={styles.input}
                  placeholder={t('documentNumber')}
                  placeholderTextColor="#888"
                  value={documentNumber}
                  onChangeText={setDocumentNumber}
                  keyboardType="numeric"
                  returnKeyType="done"
                />
                <TextInput
                  style={styles.input}
                  placeholder={t('phone')}
                  placeholderTextColor="#888"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  returnKeyType="done"
                />

                {extraPhones.map((val, index) => (
                  <View key={`phone-${index}`} style={styles.extraPhoneRow}>
                      <TextInput
                      style={[styles.input, styles.extraInput]}
                      placeholder={t('extraPhone')}
                      placeholderTextColor="#888"
                      value={val}
                      onChangeText={(t) => updateExtraPhone(index, t)}
                      keyboardType="phone-pad"
                      returnKeyType="done"
                    />
                    <TouchableOpacity style={styles.removeBtn} onPress={() => confirmRemoveContact(() => removeExtraPhone(index))} activeOpacity={0.8}>
                      <Text style={styles.removeBtnText}>−</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                {extraEmails.map((val, index) => (
                  <View key={`email-${index}`} style={styles.extraPhoneRow}>
                    <TextInput
                      style={[styles.input, styles.extraInput]}
                      placeholder={t('extraEmail')}
                      placeholderTextColor="#888"
                      value={val}
                      onChangeText={(t) => updateExtraEmail(index, t)}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                    <TouchableOpacity style={styles.removeBtn} onPress={() => confirmRemoveContact(() => removeExtraEmail(index))} activeOpacity={0.8}>
                      <Text style={styles.removeBtnText}>−</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                {showTelegramField ? (
                  <TextInput
                    style={styles.input}
                    placeholder="Telegram"
                    placeholderTextColor="#888"
                    value={telegram}
                    onChangeText={setTelegram}
                    autoCapitalize="none"
                  />
                ) : null}

                {showWhatsappField ? (
                  <TextInput
                    style={styles.input}
                    placeholder={t('whatsapp')}
                    placeholderTextColor="#888"
                    value={whatsapp}
                    onChangeText={setWhatsapp}
                    keyboardType="phone-pad"
                    returnKeyType="done"
                  />
                ) : null}

                <View style={styles.addContactBlockWrap}>
                  {showAddContactChoices ? (
                    <View style={styles.addContactChoicesRow}>
                      <TouchableOpacity style={styles.addContactChoiceBtn} onPress={addExtraPhone} activeOpacity={0.8}>
                        <Image source={require('../../assets/icon-contact-phone.png')} style={styles.addContactChoiceIcon} resizeMode="contain" />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.addContactChoiceBtn} onPress={addExtraEmail} activeOpacity={0.8}>
                        <Image source={require('../../assets/icon-contact-email.png')} style={styles.addContactChoiceIcon} resizeMode="contain" />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.addContactChoiceBtn} onPress={addTelegramField} activeOpacity={0.8}>
                        <Image source={require('../../assets/icon-contact-telegram.png')} style={styles.addContactChoiceIcon} resizeMode="contain" />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.addContactChoiceBtn} onPress={addWhatsappField} activeOpacity={0.8}>
                        <Image source={require('../../assets/icon-contact-whatsapp.png')} style={styles.addContactChoiceIcon} resizeMode="contain" />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.addContactChoiceBtn} onPress={closeAddContactChoices} activeOpacity={0.8}>
                        <Image source={require('../../assets/icon-contact-cancel.png')} style={styles.addContactChoiceIcon} resizeMode="contain" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Pressable
                      style={styles.addContactBtn}
                      onPress={() => setShowAddContactChoices(true)}
                      hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                    >
                      <Image source={require('../../assets/add-contact-icon.png')} style={styles.addContactIconImage} resizeMode="contain" />
                      <Text style={styles.addContactText}>{t('addNewContact')}</Text>
                    </Pressable>
                  )}
                </View>


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
  photoSection: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 0,
    alignItems: 'center',
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
    borderColor: 'rgba(46, 125, 50, 0.5)',
    backgroundColor: 'rgba(46, 125, 50, 0.06)',
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
  },
  addContactBlockWrap: {
    width: '100%',
    marginTop: 13,
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
    backgroundColor: '#E0D8CC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  photoImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  photoIcon: {
    fontSize: 40,
  },
  photoPlus: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.plusGreen,
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
  plusText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 20,
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
  inputBeforeAddContact: {
    marginBottom: 12,
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
  removeBtnText: {
    fontSize: 24,
    color: '#C73E3E',
    fontWeight: '300',
  },
  addContactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 10,
    paddingVertical: 0,
    paddingHorizontal: 12,
    marginTop: 0,
    marginBottom: 25,
    justifyContent: 'center',
  },
  addContactIconImage: {
    width: 24,
    height: 24,
  },
  addContactText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.addPink,
  },
  addContactChoicesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    minHeight: 24,
    marginTop: 0,
    marginBottom: 25,
    gap: 2,
  },
  addContactChoiceBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  addContactChoiceIcon: {
    width: 23,
    height: 23,
  },
});
