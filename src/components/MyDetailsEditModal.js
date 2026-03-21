import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import {
  View,
  Text,
  TextInput,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Keyboard,
  Image,
  Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { uploadAvatar, uploadCompanyLogo } from '../services/storageService';
import { activateCompany, deactivateCompany, updateCompany } from '../services/companyService';
import { getCurrentUser } from '../services/authService';

function parseWorkingHours(str) {
  const base = new Date(2020, 0, 1); // fixed date for time-only
  const makeTime = (h, m) => new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m || 0);
  if (!str || !str.trim()) return { from: makeTime(9, 0), to: makeTime(18, 0) };
  const parts = str.split(/[\s\-–—]+/).map((p) => p.trim()).filter(Boolean);
  const parseTime = (s) => {
    const m = (s || '').match(/(\d{1,2}):?(\d{2})?/);
    if (!m) return makeTime(9, 0);
    const h = parseInt(m[1], 10) || 9;
    const min = parseInt(m[2], 10) || 0;
    return makeTime(h, min);
  };
  return {
    from: parseTime(parts[0]),
    to: parts[1] ? parseTime(parts[1]) : makeTime(18, 0),
  };
}
function formatWorkingHours(from, to) {
  const f = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${f(from)} - ${f(to)}`;
}

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
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showAddContactChoices, setShowAddContactChoices] = useState(false);
  const [showTelegramField, setShowTelegramField] = useState(false);
  const [showWhatsappField, setShowWhatsappField] = useState(false);
  const [workAs, setWorkAs] = useState('private');
  const [showWorkAsMenu, setShowWorkAsMenu] = useState(false);
  const [companyLogoUrl, setCompanyLogoUrl] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyTelegram, setCompanyTelegram] = useState('');
  const [companyWhatsapp, setCompanyWhatsapp] = useState('');
  const [companyInstagram, setCompanyInstagram] = useState('');
  const [companyWorkingHours, setCompanyWorkingHours] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [scrollHeight, setScrollHeight] = useState(0);
  const [showWorkingHoursPicker, setShowWorkingHoursPicker] = useState(false);
  const [workingHoursFrom, setWorkingHoursFrom] = useState(new Date(0, 0, 0, 9, 0));
  const [workingHoursTo, setWorkingHoursTo] = useState(new Date(0, 0, 0, 18, 0));
  const scrollRef = useRef(null);
  const workAsYRef = useRef(0);

  const onScrollLayout = (e) => {
    const { height } = e.nativeEvent.layout;
    if (height > 0) setScrollHeight(height);
  };

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
      setWorkAs(user.workAs === 'company' ? 'company' : 'private');
      setShowWorkAsMenu(false);
      const ci = user.companyInfo || {};
      setCompanyLogoUrl(ci.logoUrl || '');
      setCompanyName(ci.name || '');
      setCompanyPhone(ci.phone || '');
      setCompanyEmail(ci.email || '');
      setCompanyTelegram(ci.telegram || '');
      setCompanyWhatsapp(ci.whatsapp || '');
      setCompanyInstagram(ci.instagram || '');
      setCompanyWorkingHours(ci.workingHours || '');
    }
  }, [visible, user.name, user.lastName, user.documentNumber, user.phone, user.extraPhones, user.extraEmails, user.telegram, user.whatsapp, user.photoUri, user.workAs, user.companyInfo]);

  const handleSave = async () => {
    const isPremium = ['premium', 'admin'].includes(user?.role);

    // Если выбрана компания но нет Premium — блокируем
    if (workAs === 'company' && !isPremium) {
      Alert.alert(
        'Premium функция',
        'Режим компании доступен только на тарифе Premium. Обновите тариф чтобы создать компанию и пригласить команду.',
        [{ text: 'OK' }]
      );
      return;
    }

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

    const companyPayload = {
      logoUrl: companyLogoUrl || '',
      name: companyName.trim(),
      phone: companyPhone.trim(),
      email: companyEmail.trim(),
      telegram: companyTelegram.trim(),
      whatsapp: companyWhatsapp.trim(),
      instagram: companyInstagram.trim(),
      workingHours: companyWorkingHours.trim(),
    };

    try {
      const prevWorkAs = user?.workAs;

      // Переключение режима если изменилось
      if (workAs === 'company' && prevWorkAs !== 'company') {
        await activateCompany(companyPayload);
      } else if (workAs === 'private' && prevWorkAs === 'company') {
        try {
          await deactivateCompany();
        } catch (e) {
          if (e?.message === 'HAS_ACTIVE_MEMBERS') {
            Alert.alert(
              'Невозможно переключить режим',
              'Нельзя перейти в режим частного агента пока в команде есть активные участники. Сначала удалите всех агентов.',
              [{ text: 'OK' }]
            );
            return;
          }
          throw e;
        }
      } else if (workAs === 'company' && prevWorkAs === 'company' && user?.companyId) {
        // Режим не менялся — просто обновляем данные компании
        await updateCompany(user.companyId, companyPayload);
      }

      // Сохраняем личные данные
      onSave?.({ ...personalPayload, workAs });
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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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

  const openWorkingHoursPicker = () => {
    const { from, to } = parseWorkingHours(companyWorkingHours);
    setWorkingHoursFrom(from);
    setWorkingHoursTo(to);
    setShowWorkingHoursPicker(true);
  };
  const saveWorkingHours = () => {
    setCompanyWorkingHours(formatWorkingHours(workingHoursFrom, workingHoursTo));
    setShowWorkingHoursPicker(false);
  };

  const pickLogo = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          t('galleryAccess') || 'Доступ к галерее',
          t('galleryAccessMessage') || 'Чтобы выбрать фото, разрешите доступ к галерее в настройках.',
          [{ text: 'OK' }]
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;

      setUploadingLogo(true);
      const publicUrl = await uploadCompanyLogo(result.assets[0].uri);
      setCompanyLogoUrl(publicUrl);
    } catch (e) {
      Alert.alert(t('pickPhotoError'), e?.message || t('pickPhotoFailed'));
    } finally {
      setUploadingLogo(false);
    }
  };

  const confirmRemoveContact = (onConfirm) => {
    Alert.alert(t('removeContactConfirmTitle'), t('removeContactConfirm'), [
      { text: t('no'), style: 'cancel' },
      { text: t('yes'), style: 'destructive', onPress: onConfirm },
    ]);
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
          <Pressable style={[styles.boxWrap, (showAddContactChoices || showWorkAsMenu || extraPhones.length > 0 || extraEmails.length > 0 || showTelegramField || showWhatsappField || workAs === 'company') && styles.boxWrapExpanded]} onPress={(e) => { e.stopPropagation(); Keyboard.dismiss(); }}>
            <View style={styles.box}>
              <View style={styles.headerRow}>
                <View style={styles.headerSpacer} />
                <Text style={styles.title}>{t('myDetails')}</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.8}>
                  <Text style={styles.closeIcon}>✕</Text>
                </TouchableOpacity>
              </View>

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

              <ScrollView
                ref={scrollRef}
                style={styles.scroll}
                contentContainerStyle={[
                  styles.scrollContent,
                  scrollHeight > 0 && { minHeight: scrollHeight },
                ]}
                onLayout={onScrollLayout}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                onScrollBeginDrag={Keyboard.dismiss}
              >
                <TouchableOpacity
                  style={styles.scrollContentTouch}
                  activeOpacity={1}
                  onPress={() => {}}
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

                <View
                  style={styles.workAsBlockWrap}
                  onLayout={(e) => { workAsYRef.current = e.nativeEvent.layout.y; }}
                >
                  <Text style={styles.workAsLabel}>{t('workAs')}</Text>
                  <TouchableOpacity
                    style={styles.workAsTouch}
                    onPress={() => {
                      const opening = !showWorkAsMenu;
                      setShowWorkAsMenu(opening);
                      setShowAddContactChoices(false);
                      if (opening) {
                        setTimeout(() => {
                          scrollRef.current?.scrollTo({ y: workAsYRef.current, animated: true });
                        }, 100);
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.workAsText}>
                      {workAs === 'company' ? t('workAsCompany') : t('workAsPrivate')}
                    </Text>
                    <Text style={styles.workAsChevron}>▽</Text>
                  </TouchableOpacity>
                  {showWorkAsMenu && (
                    <View style={styles.workAsDropdown}>
                      <TouchableOpacity
                        style={[styles.workAsOption, workAs === 'private' && styles.workAsOptionSelected]}
                        onPress={() => { setWorkAs('private'); setShowWorkAsMenu(false); }}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.workAsCheckbox, workAs === 'private' && styles.workAsCheckboxChecked]}>
                          {workAs === 'private' ? <Text style={styles.workAsCheckmark}>✓</Text> : null}
                        </View>
                        <Text style={styles.workAsOptionText}>{t('workAsPrivate')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.workAsOption, workAs === 'company' && styles.workAsOptionSelected]}
                        onPress={() => { setWorkAs('company'); setShowWorkAsMenu(false); }}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.workAsCheckbox, workAs === 'company' && styles.workAsCheckboxChecked]}>
                          {workAs === 'company' ? <Text style={styles.workAsCheckmark}>✓</Text> : null}
                        </View>
                        <Text style={styles.workAsOptionText}>{t('workAsCompany')}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {workAs === 'company' && (
                  <View style={styles.companyBlockWrap}>
                    <View style={styles.companyLogoWrap}>
                      <TouchableOpacity style={styles.companyLogoTouch} onPress={pickLogo} activeOpacity={0.8} disabled={uploadingLogo}>
                        <View style={styles.companyLogoCircle}>
                          {uploadingLogo ? (
                            <Text style={styles.companyLogoPlaceholder}>⏳</Text>
                          ) : companyLogoUrl ? (
                            <Image source={{ uri: companyLogoUrl }} style={styles.companyLogoImage} resizeMode="contain" />
                          ) : (
                            <Text style={styles.companyLogoPlaceholder}>🏢</Text>
                          )}
                        </View>
                        {!uploadingLogo && (
                          <View style={styles.companyLogoPlus}>
                            <Text style={styles.plusText}>+</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                      <Text style={styles.companyLogoHint}>{t('companyLogoHint')}</Text>
                    </View>
                    <TextInput
                      style={styles.input}
                      placeholder={t('companyName')}
                      placeholderTextColor="#888"
                      value={companyName}
                      onChangeText={setCompanyName}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder={t('companyPhone')}
                      placeholderTextColor="#888"
                      value={companyPhone}
                      onChangeText={setCompanyPhone}
                      keyboardType="phone-pad"
                    />
                    <TextInput
                      style={styles.input}
                      placeholder={t('companyEmail')}
                      placeholderTextColor="#888"
                      value={companyEmail}
                      onChangeText={setCompanyEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                    <TextInput
                      style={styles.input}
                      placeholder={t('companyTelegram')}
                      placeholderTextColor="#888"
                      value={companyTelegram}
                      onChangeText={setCompanyTelegram}
                      autoCapitalize="none"
                    />
                    <TextInput
                      style={styles.input}
                      placeholder={t('companyWhatsapp')}
                      placeholderTextColor="#888"
                      value={companyWhatsapp}
                      onChangeText={setCompanyWhatsapp}
                      keyboardType="phone-pad"
                    />
                    <TextInput
                      style={styles.input}
                      placeholder={t('companyInstagram')}
                      placeholderTextColor="#888"
                      value={companyInstagram}
                      onChangeText={setCompanyInstagram}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      style={styles.workingHoursInputBtn}
                      onPress={openWorkingHoursPicker}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.workingHoursInputText, !companyWorkingHours && styles.workingHoursPlaceholder]}>
                        {companyWorkingHours || t('companyWorkingHours')}
                      </Text>
                      <Text style={styles.workingHoursArrow}>▽</Text>
                    </TouchableOpacity>
                  </View>
                )}
                </TouchableOpacity>
              </ScrollView>
              <TouchableOpacity style={styles.saveBtn} onPress={async () => { Keyboard.dismiss(); await handleSave(); }} activeOpacity={0.7}>
                <Text style={styles.saveBtnText}>{t('save')}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>

      {showWorkingHoursPicker && (
        <Modal transparent animationType="slide" statusBarTranslucent onRequestClose={() => setShowWorkingHoursPicker(false)}>
          <Pressable style={styles.workingHoursOverlay} onPress={() => setShowWorkingHoursPicker(false)}>
            <Pressable style={styles.workingHoursSheet} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.workingHoursTitle}>{t('companyWorkingHoursWeWork')}</Text>
              <View style={styles.workingHoursRowInline}>
                <View style={styles.workingHoursCol}>
                  <Text style={styles.workingHoursLabel}>{t('companyWorkingHoursFrom')}</Text>
                  <View style={styles.workingHoursPickerWrap}>
                    <View style={styles.workingHoursPickerClip}>
                      <DateTimePicker
                        value={workingHoursFrom}
                        mode="time"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(_, d) => d && setWorkingHoursFrom(d)}
                        style={Platform.OS === 'ios' ? styles.workingHoursSpinner : null}
                      />
                    </View>
                  </View>
                </View>
                <View style={styles.workingHoursCol}>
                  <Text style={styles.workingHoursLabel}>{t('companyWorkingHoursTo')}</Text>
                  <View style={styles.workingHoursPickerWrap}>
                    <View style={styles.workingHoursPickerClip}>
                      <DateTimePicker
                        value={workingHoursTo}
                        mode="time"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(_, d) => d && setWorkingHoursTo(d)}
                        style={Platform.OS === 'ios' ? styles.workingHoursSpinner : null}
                      />
                    </View>
                  </View>
                </View>
              </View>
              <TouchableOpacity style={styles.workingHoursSaveBtn} onPress={saveWorkingHours} activeOpacity={0.7}>
                <Text style={styles.workingHoursSaveBtnText}>{t('save')}</Text>
              </TouchableOpacity>
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
  photoSection: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  scroll: {
    maxHeight: 480,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 0,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  scrollContentTouch: {
    flex: 1,
    width: '100%',
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
  workAsBlockWrap: {
    width: '100%',
    marginTop: 13,
    marginBottom: 13,
  },
  workAsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.title,
    marginBottom: 8,
  },
  workAsTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  workAsText: {
    fontSize: 16,
    color: COLORS.title,
  },
  workAsChevron: {
    fontSize: 12,
    color: '#888',
  },
  workAsDropdown: {
    marginTop: 8,
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  workAsOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  workAsOptionSelected: {
    backgroundColor: 'rgba(91, 141, 238, 0.1)',
  },
  workAsCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  workAsCheckboxChecked: {
    borderColor: COLORS.saveBlue,
    backgroundColor: COLORS.saveBlue,
  },
  workAsCheckmark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  workAsOptionText: {
    fontSize: 16,
    color: COLORS.title,
  },
  companyBlockWrap: {
    width: '100%',
    marginTop: 0,
    marginBottom: 16,
  },
  companyLogoWrap: {
    alignItems: 'center',
    marginBottom: 16,
  },
  companyLogoTouch: {
    position: 'relative',
  },
  companyLogoCircle: {
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
  companyLogoImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
  },
  companyLogoPlaceholder: {
    fontSize: 32,
  },
  companyLogoPlus: {
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
  companyLogoHint: {
    fontSize: 12,
    color: '#888',
    marginTop: 6,
  },
  workingHoursInputBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  workingHoursInputText: {
    fontSize: 16,
    color: COLORS.title,
  },
  workingHoursPlaceholder: {
    color: '#888',
  },
  workingHoursArrow: {
    fontSize: 12,
    color: '#888',
  },
  workingHoursOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  workingHoursSheet: {
    backgroundColor: COLORS.boxBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  workingHoursTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.title,
    textAlign: 'center',
    marginBottom: 20,
  },
  workingHoursRowInline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  workingHoursCol: {
    flex: 1,
    alignItems: 'center',
  },
  workingHoursRow: {
    marginBottom: 12,
  },
  workingHoursLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.title,
    marginBottom: 4,
    textAlign: 'center',
    alignSelf: 'center',
  },
  workingHoursPickerWrap: {
    alignItems: 'center',
  },
  workingHoursPickerClip: {
    overflow: 'hidden',
    width: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workingHoursSpinner: {
    width: '100%',
    height: 140,
  },
  workingHoursSaveBtn: {
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(46, 125, 50, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(46, 125, 50, 0.5)',
    alignItems: 'center',
  },
  workingHoursSaveBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
  },
});
