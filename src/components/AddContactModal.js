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
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import DateTimePicker from '@react-native-community/datetimepicker';
import { uploadContactPhoto } from '../services/contactsService';
import ModalScrollFrame from './ModalScrollFrame';

// TD-100: сжатие фото-аватара контакта до 1200px по большей стороне, JPEG 0.85 —
// снижает размер файла в 10-20 раз без видимой потери качества для мобильного экрана.
const PHOTO_MAX_SIDE = 1200;
const PHOTO_QUALITY = 0.85;

async function resizeContactPhoto(uri) {
  if (!uri || uri.startsWith('http')) return uri;
  try {
    const { uri: resized } = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: PHOTO_MAX_SIDE } }],
      { compress: PHOTO_QUALITY, format: ImageManipulator.SaveFormat.JPEG }
    );
    return resized;
  } catch {
    return uri;
  }
}

const COLORS = {
  title: '#2C2C2C',
  inputBg: '#F7F7F9',
  accent: '#3D7D82',
  label: '#6B6B6B',
};

export default function AddContactModal({ visible, onClose, onSave, contactType = 'clients', editContact = null }) {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [nationality, setNationality] = useState('');
  const [birthday, setBirthday] = useState('');
  const [photoUri, setPhotoUri] = useState('');
  const [documents, setDocuments] = useState([]);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [extraPhones, setExtraPhones] = useState([]);
  const [extraEmails, setExtraEmails] = useState([]);
  const [extraTelegrams, setExtraTelegrams] = useState([]);
  const [extraWhatsapps, setExtraWhatsapps] = useState([]);
  const [showAddContactChoices, setShowAddContactChoices] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
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
        setDocumentNumber(editContact.documentNumber || '');
        setNationality(editContact.nationality || '');
        setBirthday(editContact.birthday || '');
        setPhotoUri(editContact.photoUri || '');
        setDocuments(Array.isArray(editContact.documents) ? [...editContact.documents] : []);
        setExtraPhones(Array.isArray(editContact.extraPhones) ? [...editContact.extraPhones] : []);
        setExtraEmails(Array.isArray(editContact.extraEmails) ? [...editContact.extraEmails] : []);
        setExtraTelegrams(Array.isArray(editContact.extraTelegrams) ? [...editContact.extraTelegrams] : (editContact.telegram ? [editContact.telegram] : []));
        setExtraWhatsapps(Array.isArray(editContact.extraWhatsapps) ? [...editContact.extraWhatsapps] : (editContact.whatsapp ? [editContact.whatsapp] : []));
      } else {
        setName('');
        setLastName('');
        setPhone('');
        setEmail('');
        setDocumentNumber('');
        setNationality('');
        setBirthday('');
        setPhotoUri('');
        setDocuments([]);
        setExtraPhones([]);
        setExtraEmails([]);
        setExtraTelegrams([]);
        setExtraWhatsapps([]);
        setShowAddContactChoices(false);
      }
    }
  }, [visible, editContact]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('error'), t('enterName') || 'Please enter a name.');
      return;
    }

    // Upload photo to Supabase Storage if it's a local file
    let finalPhotoUri = photoUri || '';
    if (finalPhotoUri && !finalPhotoUri.startsWith('http')) {
      setUploadingPhoto(true);
      try {
        finalPhotoUri = await resizeContactPhoto(finalPhotoUri);
        finalPhotoUri = await uploadContactPhoto(finalPhotoUri);
      } catch (uploadErr) {
        setUploadingPhoto(false);
        Alert.alert(t('error'), uploadErr.message || t('errorUpload'), [{ text: 'OK' }]);
        return;
      }
      setUploadingPhoto(false);
    }

    onSave?.({
      name: name.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      documentNumber: documentNumber.trim(),
      nationality: nationality.trim(),
      birthday: birthday.trim(),
      photoUri: finalPhotoUri,
      documents,
      extraPhones: extraPhones.filter((p) => (p || '').trim()),
      extraEmails: extraEmails.filter((e) => (e || '').trim()),
      extraTelegrams: extraTelegrams.filter((t) => (t || '').trim()),
      extraWhatsapps: extraWhatsapps.filter((w) => (w || '').trim()),
      type: contactType,
    });
    onClose?.();
  };

  // TD-103: добавить документ к контакту (фото из галереи или съёмка). Сжатие 1200px JPEG 0.85.
  const pickDocument = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('galleryAccess'), t('galleryAccessMessage'), [{ text: 'OK' }]);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.9,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      let uri = result.assets[0].uri;
      setUploadingDocument(true);
      try {
        uri = await resizeContactPhoto(uri);
        const publicUrl = await uploadContactPhoto(uri);
        setDocuments(prev => [...prev, publicUrl]);
      } catch (uploadErr) {
        Alert.alert(t('error'), uploadErr.message, [{ text: 'OK' }]);
      } finally {
        setUploadingDocument(false);
      }
    } catch (e) {
      Alert.alert(t('error'), e.message, [{ text: 'OK' }]);
    }
  };

  const removeDocument = (idx) => {
    setDocuments(prev => prev.filter((_, i) => i !== idx));
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('galleryAccess'), t('galleryAccessMessage'), [{ text: 'OK' }]);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
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
  const addExtraTelegram = () => {
    setExtraTelegrams([...extraTelegrams, '']);
    setShowAddContactChoices(false);
  };
  const addExtraWhatsapp = () => {
    setExtraWhatsapps([...extraWhatsapps, '']);
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
  const updateExtraTelegram = (index, value) => {
    const next = [...extraTelegrams];
    next[index] = value;
    setExtraTelegrams(next);
  };
  const removeExtraTelegram = (index) => {
    setExtraTelegrams(extraTelegrams.filter((_, i) => i !== index));
  };
  const updateExtraWhatsapp = (index, value) => {
    const next = [...extraWhatsapps];
    next[index] = value;
    setExtraWhatsapps(next);
  };
  const removeExtraWhatsapp = (index) => {
    setExtraWhatsapps(extraWhatsapps.filter((_, i) => i !== index));
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
      <Text style={styles.title}>
        {editContact
          ? (contactType === 'owners' ? t('editOwnerTitle') : t('editClientTitle'))
          : (contactType === 'owners' ? t('addOwnerTitle') : t('addClientTitle'))
        }
      </Text>
      <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.8}>
        <Ionicons name="close" size={22} color="#888" />
      </TouchableOpacity>
    </View>
  );

  const footer = (
    <TouchableOpacity
      style={[styles.saveBtn, (uploadingPhoto || uploadingDocument) && { opacity: 0.7 }]}
      onPress={() => { Keyboard.dismiss(); handleSave(); }}
      activeOpacity={0.7}
      disabled={uploadingPhoto || uploadingDocument}
    >
      <Text style={styles.saveBtnText}>
        {(uploadingPhoto || uploadingDocument) ? t('saving') : t('save')}
      </Text>
    </TouchableOpacity>
  );

  const datePickerOverlay = showDatePicker ? (
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
  ) : null;

  return (
    <ModalScrollFrame
      visible={visible}
      onRequestClose={onClose}
      ref={scrollRef}
      header={header}
      footer={footer}
      boxWrapStyle={{ maxWidth: 380 }}
      boxStyle={{ backgroundColor: '#FFFFFF' }}
      scrollContentContainerStyle={styles.scrollContent}
      extraOverlay={datePickerOverlay}
      scrollProps={{
        showsVerticalScrollIndicator: true,
        keyboardShouldPersistTaps: 'handled',
        keyboardDismissMode: 'interactive',
        indicatorStyle: 'black',
      }}
    >
                <TouchableOpacity style={styles.photoWrap} onPress={pickImage} activeOpacity={0.8}>
                  <View style={styles.photoCircle}>
                    {photoUri ? (
                      <Image source={{ uri: photoUri }} style={styles.photoImage} />
                    ) : (
                      <Ionicons name="person" size={56} color="#B8B8B8" />
                    )}
                  </View>
                  <View style={styles.photoPlus}>
                    <Ionicons name="add" size={20} color="#fff" />
                  </View>
                </TouchableOpacity>

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
                <Text style={styles.fieldLabel}>{t('phoneNumber')}</Text>
                <TextInput
                  style={styles.input}
                  placeholderTextColor="#888"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  returnKeyType="done"
                />
                <Text style={styles.fieldLabel}>{t('email')}</Text>
                <TextInput
                  style={styles.input}
                  placeholderTextColor="#888"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                {extraTelegrams.map((val, index) => (
                  <View key={`telegram-${index}`} style={styles.extraRow}>
                    <TextInput
                      style={[styles.input, styles.extraInput]}
                      placeholder={t('telegram')}
                      placeholderTextColor="#888"
                      value={val}
                      onChangeText={(v) => updateExtraTelegram(index, v)}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity style={styles.removeBtn} onPress={() => confirmRemoveContact(() => removeExtraTelegram(index))} activeOpacity={0.8}>
                      <Ionicons name="trash-outline" size={22} color="#888" />
                    </TouchableOpacity>
                  </View>
                ))}

                {extraWhatsapps.map((val, index) => (
                  <View key={`whatsapp-${index}`} style={styles.extraRow}>
                    <TextInput
                      style={[styles.input, styles.extraInput]}
                      placeholder={t('whatsapp')}
                      placeholderTextColor="#888"
                      value={val}
                      onChangeText={(v) => updateExtraWhatsapp(index, v)}
                      keyboardType="phone-pad"
                      returnKeyType="done"
                    />
                    <TouchableOpacity style={styles.removeBtn} onPress={() => confirmRemoveContact(() => removeExtraWhatsapp(index))} activeOpacity={0.8}>
                      <Ionicons name="trash-outline" size={22} color="#888" />
                    </TouchableOpacity>
                  </View>
                ))}

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
                      <Ionicons name="trash-outline" size={22} color="#888" />
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
                      <Ionicons name="trash-outline" size={22} color="#888" />
                    </TouchableOpacity>
                  </View>
                ))}

                <View style={styles.addContactBlockWrap}>
                  {showAddContactChoices ? (
                    <View style={styles.addContactChoicesRow}>
                      <TouchableOpacity style={styles.addContactChoiceBtn} onPress={addExtraPhone} activeOpacity={0.8}>
                        <Ionicons name="call-outline" size={22} color={COLORS.accent} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.addContactChoiceBtn} onPress={addExtraEmail} activeOpacity={0.8}>
                        <Ionicons name="mail-outline" size={22} color={COLORS.accent} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.addContactChoiceBtn} onPress={addExtraTelegram} activeOpacity={0.8}>
                        <Ionicons name="paper-plane-outline" size={22} color={COLORS.accent} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.addContactChoiceBtn} onPress={addExtraWhatsapp} activeOpacity={0.8}>
                        <Ionicons name="logo-whatsapp" size={22} color={COLORS.accent} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.addContactChoiceBtn} onPress={() => setShowAddContactChoices(false)} activeOpacity={0.8}>
                        <Ionicons name="close" size={22} color={COLORS.accent} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Pressable
                      style={styles.addContactBtn}
                      onPress={() => setShowAddContactChoices(true)}
                      hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                    >
                      <Ionicons name="add-circle-outline" size={22} color={COLORS.accent} />
                      <Text style={styles.addContactText}>{t('addNewContact')}</Text>
                    </Pressable>
                  )}
                </View>

                <Text style={styles.fieldLabel}>{t('passportId') || 'Документ'}</Text>
                <TextInput
                  style={styles.input}
                  placeholderTextColor="#888"
                  value={documentNumber}
                  onChangeText={setDocumentNumber}
                />
                <Text style={styles.fieldLabel}>{t('nationality') || 'Гражданство'}</Text>
                <TextInput
                  style={styles.input}
                  placeholderTextColor="#888"
                  value={nationality}
                  onChangeText={setNationality}
                  autoCapitalize="words"
                />
                <Text style={styles.fieldLabel}>{t('birthdayDate')}</Text>
                <TouchableOpacity
                  style={styles.input}
                  onPress={() => { Keyboard.dismiss(); setShowDatePicker(true); }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.inputText}>{birthday}</Text>
                </TouchableOpacity>

                {/* TD-103: документы контакта (паспорт, договор и пр.) */}
                <View style={styles.docsSection}>
                  <Text style={styles.docsLabel}>{t('ctDocsSection') || 'Documents'}</Text>
                  <View style={styles.docsGrid}>
                    {documents.map((uri, i) => (
                      <View key={`${uri}-${i}`} style={styles.docTile}>
                        <Image source={{ uri }} style={styles.docTileImg} resizeMode="cover" />
                        <TouchableOpacity style={styles.docTileRemove} onPress={() => removeDocument(i)} activeOpacity={0.7}>
                          <Text style={styles.docTileRemoveText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                    <TouchableOpacity style={styles.docTileAdd} onPress={pickDocument} activeOpacity={0.7} disabled={uploadingDocument}>
                      <Text style={styles.docTileAddText}>{uploadingDocument ? '⏳' : '+'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
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
  scrollContent: {
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
  inputWithIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
    backgroundColor: COLORS.inputBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D1D6',
    paddingLeft: 14,
    minHeight: 46,
  },
  inputFieldIcon: {
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
  addContactText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.accent,
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
    paddingVertical: 8,
    paddingHorizontal: 0,
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
  // TD-103: документы контакта
  docsSection: { marginTop: 12, paddingHorizontal: 14 },
  docsLabel:   { fontSize: 13, color: '#6C757D', marginBottom: 6 },
  docsGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  docTile:     { width: 72, height: 72, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#D1D1D6', position: 'relative' },
  docTileImg:  { width: '100%', height: '100%' },
  docTileRemove:    { position: 'absolute', top: 3, right: 3, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  docTileRemoveText:{ fontSize: 10, color: '#FFF', fontWeight: '700' },
  docTileAdd:  { width: 72, height: 72, borderRadius: 10, borderWidth: 2, borderColor: '#D1D1D6', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.inputBg },
  docTileAddText:   { fontSize: 26, color: '#ADB5BD', fontWeight: '300' },
});
