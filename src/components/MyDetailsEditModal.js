import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import {
  View,
  Text,
  TextInput,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Pressable,
  KeyboardAvoidingView,
  Image,
  Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

const COLORS = {
  boxBg: 'rgba(255,255,255,0.72)',
  title: '#2C2C2C',
  inputBg: '#F5F2EB',
  border: '#E0D8CC',
  saveBlue: '#5B8DEE',
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
  const [showAddContactChoices, setShowAddContactChoices] = useState(false);
  const [showTelegramField, setShowTelegramField] = useState(false);
  const [showWhatsappField, setShowWhatsappField] = useState(false);

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

  const handleSave = () => {
    onSave?.({
      name: name.trim(),
      lastName: lastName.trim(),
      documentNumber: documentNumber.trim(),
      phone: phone.trim(),
      extraPhones: extraPhones.filter((p) => (p || '').trim()),
      extraEmails: extraEmails.filter((e) => (e || '').trim()),
      telegram: telegram.trim(),
      whatsapp: whatsapp.trim(),
      photoUri: photoUri || '',
    });
    onClose?.();
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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const uri = result.assets[0].uri;
      const dir = FileSystem.documentDirectory;
      if (!dir) {
        setPhotoUri(uri);
        return;
      }
      const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const dest = `${dir}avatar_${Date.now()}.${ext}`;
      try {
        await FileSystem.copyAsync({ from: uri, to: dest });
        setPhotoUri(dest);
      } catch (_) {
        setPhotoUri(uri);
      }
    } catch (e) {
      Alert.alert(t('pickPhotoError'), e?.message || t('pickPhotoFailed'));
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
    Alert.alert(
      t('removeContact'),
      t('removeContactConfirm'),
      [
        { text: t('back'), style: 'cancel' },
        { text: t('remove'), style: 'destructive', onPress: onConfirm },
      ]
    );
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
          <KeyboardAvoidingView
          style={styles.keyboardWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={40}
        >
          <Pressable style={[styles.boxWrap, (showAddContactChoices || extraPhones.length > 0 || extraEmails.length > 0 || showTelegramField || showWhatsappField) && styles.boxWrapExpanded]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.box}>
              <View style={styles.headerRow}>
                <View style={styles.headerSpacer} />
                <Text style={styles.title}>{t('myContacts')}</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.8}>
                  <Text style={styles.closeIcon}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="always"
              >
                {/* Фото: круг с иконкой и плюсом; по нажатию — выбор из галереи */}
                <TouchableOpacity style={styles.photoWrap} onPress={pickImage} activeOpacity={0.8}>
                  <View style={styles.photoCircle}>
                    {photoUri ? (
                      <Image source={{ uri: photoUri }} style={styles.photoImage} />
                    ) : (
                      <Text style={styles.photoIcon}>👤</Text>
                    )}
                  </View>
                  <View style={styles.photoPlus}>
                    <Text style={styles.plusText}>+</Text>
                  </View>
                </TouchableOpacity>

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
                />
                <TextInput
                  style={styles.input}
                  placeholder={t('phone')}
                  placeholderTextColor="#888"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
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
              </ScrollView>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.7}>
                <Text style={styles.saveBtnText}>{t('save')}</Text>
              </TouchableOpacity>
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
    maxHeight: '90%',
    maxWidth: 360,
  },
  boxWrap: {
    width: '100%',
    maxHeight: '90%',
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
  scroll: {
    maxHeight: 480,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    alignItems: 'center',
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
    color: '#2E7D32',
  },
  addContactBlockWrap: {
    width: '100%',
    marginTop: 12,
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
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginTop: 0,
    marginBottom: 20,
    minHeight: 48,
    justifyContent: 'center',
  },
  addContactIconImage: {
    width: 30,
    height: 30,
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
    marginTop: 0,
    marginBottom: 12,
    gap: 2,
  },
  addContactChoiceBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    paddingHorizontal: 0,
  },
  addContactChoiceIcon: {
    width: 23,
    height: 23,
  },
});
