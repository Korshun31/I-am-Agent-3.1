import React, { useState, useEffect, useRef } from 'react';
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
  Keyboard,
  Image,
  Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import DateTimePicker from '@react-native-community/datetimepicker';

const COLORS = {
  boxBg: 'rgba(255,255,255,0.72)',
  title: '#2C2C2C',
  inputBg: '#F5F2EB',
  border: '#E0D8CC',
  addPink: '#D85A6A',
  plusGreen: '#5DB87A',
  saveGreen: '#2E7D32',
};

export default function AddContactModal({ visible, onClose, onSave, contactType = 'clients', editContact = null }) {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [telegram, setTelegram] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [nationality, setNationality] = useState('');
  const [birthday, setBirthday] = useState('');
  const [photoUri, setPhotoUri] = useState('');
  const [extraPhones, setExtraPhones] = useState([]);
  const [extraEmails, setExtraEmails] = useState([]);
  const [showAddContactChoices, setShowAddContactChoices] = useState(false);
  const [showTelegramField, setShowTelegramField] = useState(true);
  const [showWhatsappField, setShowWhatsappField] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setTimeout(() => {
        scrollRef.current?.flashScrollIndicators();
      }, 400);
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      if (editContact) {
        setName(editContact.name || '');
        setLastName(editContact.lastName || '');
        setPhone(editContact.phone || '');
        setEmail(editContact.email || '');
        setTelegram(editContact.telegram || '');
        setWhatsapp(editContact.whatsapp || '');
        setDocumentNumber(editContact.documentNumber || '');
        setNationality(editContact.nationality || '');
        setBirthday(editContact.birthday || '');
        setPhotoUri(editContact.photoUri || '');
        setExtraPhones(Array.isArray(editContact.extraPhones) ? [...editContact.extraPhones] : []);
        setExtraEmails(Array.isArray(editContact.extraEmails) ? [...editContact.extraEmails] : []);
        setShowTelegramField(!!(editContact.telegram || '').trim());
        setShowWhatsappField(!!(editContact.whatsapp || '').trim());
      } else {
        setName('');
        setLastName('');
        setPhone('');
        setEmail('');
        setTelegram('');
        setWhatsapp('');
        setDocumentNumber('');
        setNationality('');
        setBirthday('');
        setPhotoUri('');
        setExtraPhones([]);
        setExtraEmails([]);
        setShowAddContactChoices(false);
        setShowTelegramField(true);
        setShowWhatsappField(false);
      }
    }
  }, [visible, editContact]);

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert(t('error'), t('enterName') || 'Please enter a name.');
      return;
    }
    onSave?.({
      name: name.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      telegram: telegram.trim(),
      whatsapp: whatsapp.trim(),
      documentNumber: documentNumber.trim(),
      nationality: nationality.trim(),
      birthday: birthday.trim(),
      photoUri: photoUri || '',
      extraPhones: extraPhones.filter((p) => (p || '').trim()),
      extraEmails: extraEmails.filter((e) => (e || '').trim()),
      type: contactType,
    });
    onClose?.();
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('galleryAccess'), t('galleryAccessMessage'), [{ text: 'OK' }]);
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
      const dest = `${dir}contact_${Date.now()}.${ext}`;
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
    Alert.alert(t('removeContact'), t('removeContactConfirm'), [
      { text: t('back'), style: 'cancel' },
      { text: t('remove'), style: 'destructive', onPress: onConfirm },
    ]);
  };

  if (!visible) return null;

  const hasExtraFields = showAddContactChoices || extraPhones.length > 0 || extraEmails.length > 0 || showWhatsappField;

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
            style={[styles.boxWrap, hasExtraFields && styles.boxWrapExpanded]}
            onPress={(e) => { e.stopPropagation(); Keyboard.dismiss(); }}
          >
            <View style={styles.box}>
              <View style={styles.headerRow}>
                <View style={styles.headerSpacer} />
                <Text style={styles.title}>
                  {editContact
                    ? (contactType === 'owners' ? t('editOwnerTitle') : t('editClientTitle'))
                    : (contactType === 'owners' ? t('addOwnerTitle') : t('addClientTitle'))
                  }
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
                  placeholder={t('phoneNumber')}
                  placeholderTextColor="#888"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  returnKeyType="done"
                />
                <TextInput
                  style={styles.input}
                  placeholder={t('email')}
                  placeholderTextColor="#888"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                {showTelegramField ? (
                  <TextInput
                    style={styles.input}
                    placeholder={t('telegram')}
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

                {extraPhones.map((val, index) => (
                  <View key={`phone-${index}`} style={styles.extraRow}>
                    <TextInput
                      style={[styles.input, styles.extraInput]}
                      placeholder={t('extraPhone')}
                      placeholderTextColor="#888"
                      value={val}
                      onChangeText={(v) => updateExtraPhone(index, v)}
                      keyboardType="phone-pad"
                      returnKeyType="done"
                    />
                    <TouchableOpacity style={styles.removeBtn} onPress={() => confirmRemoveContact(() => removeExtraPhone(index))} activeOpacity={0.8}>
                      <Text style={styles.removeBtnText}>−</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                {extraEmails.map((val, index) => (
                  <View key={`email-${index}`} style={styles.extraRow}>
                    <TextInput
                      style={[styles.input, styles.extraInput]}
                      placeholder={t('extraEmail')}
                      placeholderTextColor="#888"
                      value={val}
                      onChangeText={(v) => updateExtraEmail(index, v)}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                    <TouchableOpacity style={styles.removeBtn} onPress={() => confirmRemoveContact(() => removeExtraEmail(index))} activeOpacity={0.8}>
                      <Text style={styles.removeBtnText}>−</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                <View style={styles.addContactBlockWrap}>
                  {showAddContactChoices ? (
                    <View style={styles.addContactChoicesRow}>
                      <TouchableOpacity style={styles.addContactChoiceBtn} onPress={addExtraPhone} activeOpacity={0.8}>
                        <Image source={require('../../assets/icon-contact-phone.png')} style={styles.addContactChoiceIcon} resizeMode="contain" />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.addContactChoiceBtn} onPress={addExtraEmail} activeOpacity={0.8}>
                        <Image source={require('../../assets/icon-contact-email.png')} style={styles.addContactChoiceIcon} resizeMode="contain" />
                      </TouchableOpacity>
                      {!showTelegramField && (
                        <TouchableOpacity style={styles.addContactChoiceBtn} onPress={addTelegramField} activeOpacity={0.8}>
                          <Image source={require('../../assets/icon-contact-telegram.png')} style={styles.addContactChoiceIcon} resizeMode="contain" />
                        </TouchableOpacity>
                      )}
                      {!showWhatsappField && (
                        <TouchableOpacity style={styles.addContactChoiceBtn} onPress={addWhatsappField} activeOpacity={0.8}>
                          <Image source={require('../../assets/icon-contact-whatsapp.png')} style={styles.addContactChoiceIcon} resizeMode="contain" />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity style={styles.addContactChoiceBtn} onPress={() => setShowAddContactChoices(false)} activeOpacity={0.8}>
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

                <View style={styles.inputWithIconRow}>
                  <Image source={require('../../assets/icon-passport-id.png')} style={styles.inputFieldIcon} resizeMode="contain" />
                  <TextInput
                    style={[styles.input, styles.inputWithIconInput]}
                    placeholder=""
                    placeholderTextColor="#888"
                    value={documentNumber}
                    onChangeText={setDocumentNumber}
                  />
                </View>
                <View style={styles.inputWithIconRow}>
                  <Image source={require('../../assets/icon-nationality.png')} style={styles.inputFieldIcon} resizeMode="contain" />
                  <TextInput
                    style={[styles.input, styles.inputWithIconInput]}
                    placeholder=""
                    placeholderTextColor="#888"
                    value={nationality}
                    onChangeText={setNationality}
                    autoCapitalize="words"
                  />
                </View>
                <View style={styles.inputWithIconRow}>
                  <Image source={require('../../assets/icon-birthday.png')} style={styles.inputFieldIcon} resizeMode="contain" />
                  <TouchableOpacity
                    style={[styles.input, styles.inputWithIconInput]}
                    onPress={() => { Keyboard.dismiss(); setShowDatePicker(true); }}
                    activeOpacity={0.7}
                  >
                    <Text style={birthday ? styles.inputText : styles.inputPlaceholder}>
                      {birthday || t('birthdayDate')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>

              <TouchableOpacity style={styles.saveBtn} onPress={() => { Keyboard.dismiss(); handleSave(); }} activeOpacity={0.7}>
                <Text style={styles.saveBtnText}>{t('save')}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>

      {showDatePicker && (
        <Modal transparent animationType="slide" statusBarTranslucent>
          <Pressable style={styles.datePickerOverlay} onPress={() => setShowDatePicker(false)}>
            <Pressable style={styles.datePickerContainer} onPress={(e) => e.stopPropagation()}>
              <View style={styles.datePickerHeader}>
                <Text style={styles.datePickerTitle}>{t('birthdayDate')}</Text>
                <TouchableOpacity onPress={() => setShowDatePicker(false)} activeOpacity={0.7}>
                  <Text style={styles.datePickerDoneText}>OK</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={birthday ? new Date(birthday.split('.').reverse().join('-')) : new Date(1990, 0, 1)}
                mode="date"
                display="spinner"
                maximumDate={new Date()}
                minimumDate={new Date(1920, 0, 1)}
                style={styles.datePickerSpinner}
                onChange={(event, selectedDate) => {
                  if (selectedDate) {
                    const d = selectedDate;
                    const dd = String(d.getDate()).padStart(2, '0');
                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                    const yyyy = d.getFullYear();
                    setBirthday(`${dd}.${mm}.${yyyy}`);
                  }
                }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}
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
  boxWrapExpanded: {},
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
  inputWithIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingLeft: 14,
  },
  inputFieldIcon: {
    width: 22,
    height: 22,
    marginRight: 12,
  },
  inputWithIconInput: {
    flex: 1,
    marginBottom: 0,
    paddingLeft: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  inputText: {
    fontSize: 16,
    color: COLORS.title,
  },
  inputPlaceholder: {
    fontSize: 16,
    color: '#888',
  },
  datePickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  datePickerContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
    alignItems: 'center',
  },
  datePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0D8CC',
  },
  datePickerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#2C2C2C',
  },
  datePickerDoneText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#2E7D32',
  },
  datePickerSpinner: {
    height: 200,
    width: '100%',
  },
  extraRow: {
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
  addContactBlockWrap: {
    width: '100%',
    marginTop: 0,
    marginBottom: 4,
  },
  addContactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginTop: 0,
    marginBottom: 8,
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
