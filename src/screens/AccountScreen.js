import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Platform,
  Image,
  Linking,
  Alert,
  Modal,
  Pressable,
  TextInput,
} from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { TAB_BAR_CONTENT_HEIGHT } from '../components/BottomNav';
import { IconPencil } from '../components/EditIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MyDetailsEditModal from '../components/MyDetailsEditModal';
import ChangePasswordModal from '../components/ChangePasswordModal';
import LanguageModal from '../components/LanguageModal';
import NotificationsModal from '../components/NotificationsModal';
import CurrencyModal from '../components/CurrencyModal';
import AddLocationsModal from '../components/AddLocationsModal';
import DataUploadModal from '../components/DataUploadModal';
import { useLanguage } from '../context/LanguageContext';
import { useUser } from '../context/UserContext';
import { PLANS } from '../constants/roleFeatures';
import { updateUserProfile, getCurrentUser, canChangePassword, deleteOwnAccount, signOut } from '../services/authService';
import { getLocations, createLocation, updateLocation, deleteLocation, setLocationDistricts } from '../services/locationsService';

const COLORS = {
  background: '#F5F5F7',
  title: '#2C2C2C',
  subtitle: '#5A5A5A',
  iconGray: '#6B6B6B',
};

const BLOCK_VERTICAL_PADDING = 16; // Верхний и нижний отступ блока: от края до первой/последней строки
const BLOCK_ROW_GAP = 8; // Отступ между строками внутри блока (header↔content, content↔content, last↔action)
const LOCATIONS_BOTTOM_PADDING = 10;
const ANIM_DURATION = 280;

export default function AccountScreen({ onLogout, onUserUpdate, onOpenCompany, onOpenContacts, onOpenStatistics, isVisible }) {
  const { user = {} } = useUser();
  const insets = useSafeAreaInsets();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsClosing, setSettingsClosing] = useState(false);
  const [locationsOpen, setLocationsOpen] = useState(false);
  const [locationsClosing, setLocationsClosing] = useState(false);
  const [locations, setLocations] = useState([]);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [notificationsModalVisible, setNotificationsModalVisible] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState({});
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const [addLocationsModalVisible, setAddLocationsModalVisible] = useState(false);
  const [editLocationData, setEditLocationData] = useState(null);
  const [changePasswordModalVisible, setChangePasswordModalVisible] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [dataUploadModalVisible, setDataUploadModalVisible] = useState(false);
  const [locationsContentHeight, setLocationsContentHeight] = useState(0);
  const [allowChangePassword, setAllowChangePassword] = useState(false);
  const [settingsContentHeight, setSettingsContentHeight] = useState(0);
  const { language, setLanguage, currency, setCurrency, t } = useLanguage();
  const settingsHeight = useRef(new Animated.Value(0)).current;
  const settingsWasOpen = useRef(false);
  const locationsHeight = useRef(new Animated.Value(0)).current;
  const locationsWasOpen = useRef(false);
  const prevTabVisible = useRef(false);
  const { email = '', name = '', lastName = '', phone = '', telegram = '', documentNumber = '', extraPhones = [], extraEmails = [], whatsapp = '', photoUri = '', workAs = '', companyInfo = {}, plan = 'standard' } = user;
  const isAdmin = plan === PLANS.KORSHUN;

  const displayName = [name, lastName].filter(Boolean).join(' ') || name || null;

  const openPhone = (number) => {
    const clean = (number || '').replace(/\s/g, '');
    if (!clean) return;
    Alert.alert(
      number,
      t('callOrMessage'),
      [
        { text: t('back'), style: 'cancel' },
        { text: t('call'), onPress: () => Linking.openURL('tel:' + clean) },
        { text: t('sendMessage'), onPress: () => Linking.openURL('sms:' + clean) },
      ]
    );
  };

  const openEmail = (address) => {
    if (!address || !address.trim()) return;
    Linking.openURL('mailto:' + encodeURIComponent(address.trim()));
  };

  const openTelegram = (value) => {
    const v = (value || '').trim();
    if (!v) return;
    const isPhone = /^\+?[\d\s-]+$/.test(v);
    const url = isPhone
      ? 'https://t.me/+' + v.replace(/\D/g, '')
      : 'https://t.me/' + (v.startsWith('@') ? v.slice(1) : v);
    Linking.openURL(url);
  };

  const openWhatsApp = (number) => {
    const digits = (number || '').replace(/\D/g, '');
    if (!digits) return;
    Linking.openURL('https://wa.me/' + digits);
  };

  // Анимация запускается только при реальном изменении состояния (открыли/закрыли).
  // На mount и при обновлении contentHeight (через onLayout) — мгновенный setValue,
  // чтобы не блокировать JS-thread и не вызывать задержку при первом тапе на вкладку.
  useEffect(() => {
    const toValue = settingsOpen ? settingsContentHeight : 0;
    const wasOpen = settingsWasOpen.current;
    settingsWasOpen.current = settingsOpen;
    if (wasOpen === settingsOpen) {
      settingsHeight.setValue(toValue);
      return;
    }
    if (wasOpen && !settingsOpen) setSettingsClosing(true);
    Animated.timing(settingsHeight, {
      toValue,
      duration: ANIM_DURATION,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && toValue === 0) setSettingsClosing(false);
    });
  }, [settingsOpen, settingsHeight, settingsContentHeight]);

  useEffect(() => {
    const toValue = locationsOpen ? locationsContentHeight + LOCATIONS_BOTTOM_PADDING : 0;
    const wasOpen = locationsWasOpen.current;
    locationsWasOpen.current = locationsOpen;
    if (wasOpen === locationsOpen) {
      locationsHeight.setValue(toValue);
      return;
    }
    if (wasOpen && !locationsOpen) setLocationsClosing(true);
    Animated.timing(locationsHeight, {
      toValue,
      duration: ANIM_DURATION,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && toValue === 0) setLocationsClosing(false);
    });
  }, [locationsOpen, locationsHeight, locationsContentHeight]);

  const loadLocations = async () => {
    try {
      const locs = await getLocations();
      setLocations(locs);
    } catch {}
  };

  const refreshCanChangePassword = () => {
    canChangePassword().then(setAllowChangePassword).catch(() => setAllowChangePassword(false));
  };
  useEffect(() => {
    if (!user?.id) return;
    refreshCanChangePassword();
  }, [user?.id]);

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim() !== 'DELETE') {
      setDeleteError(t('deleteAccountTypeDelete') || 'Type DELETE to confirm');
      return;
    }
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteOwnAccount();
      await signOut();
      onLogout?.();
    } catch (e) {
      if (e?.message?.includes('CANNOT_DELETE_HAS_AGENTS')) {
        setDeleteError(t('deleteAccountHasAgents') || 'Deactivate all team members before deleting your account.');
      } else {
        setDeleteError(e?.message || 'Error');
      }
      setDeleting(false);
    }
  };

  // При возврате на вкладку — читаем настройки из user пропса (UserContext,
  // грузится при логине, обновляется через realtime). Без сетевого запроса —
  // вкладка открывается мгновенно. Свежесть прав агента уже идёт через
  // companyChannel-подписку.
  useEffect(() => {
    if (!isVisible || prevTabVisible.current) {
      prevTabVisible.current = isVisible;
      return;
    }
    // Защита от гонки: вкладка может стать видимой раньше чем профиль
    // догрузился из БД. В этот момент user.selectedCurrency = null
    // (из initialUser), и записать дефолт 'USD' значит затереть реальный
    // выбор юзера в LanguageContext+AsyncStorage. Откладываем до загрузки.
    if (!user?.id) return;
    setSettingsOpen(false);
    setLocationsOpen(false);
    const lang = ['en', 'th', 'ru'].includes(user.language) ? user.language : 'en';
    setLanguage(lang);
    setNotificationSettings(user.notificationSettings || {});
    prevTabVisible.current = isVisible;
  }, [isVisible, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Локации грузим один раз при появлении email (не каждый возврат на вкладку).
  useEffect(() => {
    if (!email) return;
    loadLocations();
  }, [email]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveAgentSettings = async (updates) => {
    try {
      await updateUserProfile(updates);
    } catch (e) {
      Alert.alert(t('error') || 'Error', e?.message || String(e));
    }
  };

  return (
    <>
    <View style={styles.container}>
      <View style={styles.fixedTop}>
        <View style={styles.header}>
          <View style={styles.headerLeft} />
          <Text style={styles.headerTitle}>{t('account')}</Text>
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={() => {
              Alert.alert(t('logoutConfirmTitle'), t('logoutConfirmMessage'), [
                { text: t('cancel'), style: 'cancel' },
                { text: t('logoutAllDevices'), style: 'destructive', onPress: () => onLogout({ scope: 'global' }) },
                { text: t('logoutThisDevice'), onPress: () => onLogout({ scope: 'local' }) },
              ]);
            }}
            activeOpacity={0.7}
          >
            <View style={styles.logoutIconWrap}>
              <Ionicons name="log-out-outline" size={22} color="#888" />
            </View>
          </TouchableOpacity>
        </View>
        <View style={styles.profileSection}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar} />
          )}
          {displayName ? <Text style={styles.agentName}>{displayName}</Text> : null}
        </View>
      </View>
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + TAB_BAR_CONTENT_HEIGHT + 12 }]}
        showsVerticalScrollIndicator={false}
      >
      <View style={styles.myDetailsBlock}>
        <View style={styles.myDetailsTitleRow}>
          <Text style={styles.myDetailsTitle}>{t('myDetails')}</Text>
          <TouchableOpacity
            style={styles.pencilBtn}
            onPress={() => setEditModalVisible(true)}
            activeOpacity={0.8}
          >
            <IconPencil size={22} color="#888" />
          </TouchableOpacity>
        </View>
        {documentNumber ? (
          <View style={styles.contactRow}>
            <Ionicons name="card-outline" size={22} color="#888" style={styles.contactIcon} />
            <Text style={[styles.contactText, styles.contactTextBold]}>{documentNumber}</Text>
          </View>
        ) : null}
        {phone ? (
          <View style={styles.contactRow}>
            <Ionicons name="call-outline" size={22} color="#888" style={styles.contactIcon} />
            <TouchableOpacity onPress={() => openPhone(phone)} activeOpacity={0.7}>
              <Text style={[styles.contactText, styles.contactTextLink]}>{phone}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {extraPhones && extraPhones.length > 0
          ? extraPhones.map((p, i) => (p ? (
              <View key={i} style={styles.contactRow}>
                <Ionicons name="call-outline" size={22} color="#888" style={styles.contactIcon} />
                <TouchableOpacity onPress={() => openPhone(p)} activeOpacity={0.7}>
                  <Text style={[styles.contactText, styles.contactTextLink]}>{p}</Text>
                </TouchableOpacity>
              </View>
            ) : null))
          : null}
        {whatsapp ? (
          <View style={styles.contactRow}>
            <Ionicons name="logo-whatsapp" size={22} color="#888" style={styles.contactIcon} />
            <TouchableOpacity onPress={() => openWhatsApp(whatsapp)} activeOpacity={0.7}>
              <Text style={[styles.contactText, styles.contactTextLink]}>{whatsapp}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {telegram ? (
          <View style={styles.contactRow}>
            <Ionicons name="paper-plane-outline" size={22} color="#888" style={styles.contactIcon} />
            <TouchableOpacity onPress={() => openTelegram(telegram)} activeOpacity={0.7}>
              <Text style={[styles.contactText, styles.contactTextLink]}>{telegram}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {email ? (
          <View style={styles.contactRow}>
            <Ionicons name="mail-outline" size={22} color="#888" style={styles.contactIcon} />
            <TouchableOpacity onPress={() => openEmail(email)} activeOpacity={0.7}>
              <Text style={[styles.contactText, styles.contactTextLink]}>{email}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {extraEmails && extraEmails.length > 0
          ? extraEmails.map((e, i) => (e ? (
              <View key={`email-${i}`} style={styles.contactRow}>
                <Ionicons name="mail-outline" size={22} color="#888" style={styles.contactIcon} />
                <TouchableOpacity onPress={() => openEmail(e)} activeOpacity={0.7}>
                  <Text style={[styles.contactText, styles.contactTextLink]}>{e}</Text>
                </TouchableOpacity>
              </View>
            ) : null))
          : null}
      </View>

      {/* Company — видим только для админов (не агентов) */}
      {!user?.isAgentRole && (
        <View style={[styles.collapsibleCard, styles.navCardSpacing]}>
          <View style={[styles.collapsibleStripe, { backgroundColor: '#9C8BB6' }]} />
          <TouchableOpacity
            style={styles.collapsibleHeaderRow}
            activeOpacity={0.85}
            onPress={() => {
              const isPremium = ['premium', 'korshun'].includes(user?.plan);
              if (!isPremium) {
                Alert.alert(
                  t('premiumFeature'),
                  t('companyModePremiumOnly'),
                  [{ text: 'OK' }]
                );
                return;
              }
              onOpenCompany?.();
            }}
          >
            <Text style={styles.menuBlockLabel}>{t('company')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Statistics — переход на экран статистики */}
      <View style={[styles.collapsibleCard, styles.navCardSpacing]}>
        <View style={[styles.collapsibleStripe, { backgroundColor: '#C8624A' }]} />
        <TouchableOpacity
          style={styles.collapsibleHeaderRow}
          activeOpacity={0.85}
          onPress={() => onOpenStatistics?.()}
        >
          <Text style={styles.menuBlockLabel}>{t('statistics')}</Text>
        </TouchableOpacity>
      </View>

      {/* Contacts — переход на экран контактов */}
      <View style={[styles.collapsibleCard, styles.navCardSpacing]}>
        <View style={[styles.collapsibleStripe, { backgroundColor: '#C4973A' }]} />
        <TouchableOpacity
          style={styles.collapsibleHeaderRow}
          activeOpacity={0.85}
          onPress={() => onOpenContacts?.()}
        >
          <Text style={styles.menuBlockLabel}>{t('contacts')}</Text>
        </TouchableOpacity>
      </View>

      {/* Locations — раздвижной, единая карточка с полоской слева */}
      <View style={styles.locationsWrap}>
        <View
          style={styles.locationsMeasureWrap}
          onLayout={(e) => setLocationsContentHeight(e.nativeEvent.layout.height)}
        >
          {locations.map((loc) => (
            <View key={loc.id} style={styles.locationsItemWrap}>
              <View style={styles.locationsItemPencilPlaceholder} />
              <Text style={styles.locationsItem} numberOfLines={1}>{loc.displayName}</Text>
            </View>
          ))}
          <TouchableOpacity style={styles.locationsAddRow} activeOpacity={0.7}>
            <Text style={styles.locationsAddLink}>{t('locationsAddRemove')}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.collapsibleCard}>
          <View style={[styles.collapsibleStripe, { backgroundColor: '#8BAF8E' }]} />
          <TouchableOpacity
            style={styles.collapsibleHeaderRow}
            onPress={() => setLocationsOpen(!locationsOpen)}
            activeOpacity={0.85}
          >
            <Text style={styles.menuBlockLabel}>{t('locations')}</Text>
            <Image source={require('../../assets/chevron-down.png')} style={[styles.chevronIcon, locationsOpen && styles.chevronIconOpen]} resizeMode="contain" />
          </TouchableOpacity>
          <Animated.View style={{ height: locationsHeight, overflow: 'hidden' }}>
            <View style={styles.locationsExpandedInner}>
              {locations.map((loc) => (
                <TouchableOpacity
                  key={loc.id}
                  style={styles.locationsItemWrap}
                  onPress={() => {
                    setEditLocationData(loc);
                    setAddLocationsModalVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Image source={require('../../assets/pencil-icon.png')} style={styles.locationsItemPencil} resizeMode="contain" />
                  <Text style={styles.locationsItem} numberOfLines={1}>{loc.displayName}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.locationsAddRow}
                onPress={() => {
                  setEditLocationData(null);
                  setAddLocationsModalVisible(true);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.locationsAddLink}>{t('locationsAddRemove')}</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </View>

      {/* Settings — раздвижной, высота от содержимого (onLayout) */}
      <View style={styles.settingsWrap}>
        <View
          style={styles.settingsMeasureWrap}
          onLayout={(e) => setSettingsContentHeight(e.nativeEvent.layout.height)}
        >
          <TouchableOpacity style={styles.settingsItem} activeOpacity={0.8}>
            <Ionicons name="language-outline" size={22} color="#3D7D82" style={styles.settingsItemIcon} />
            <Text style={styles.settingsItemLabel}>{t('language')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingsItem} activeOpacity={0.8}>
            <Ionicons name="notifications-outline" size={22} color="#3D7D82" style={styles.settingsItemIcon} />
            <Text style={styles.settingsItemLabel}>{t('notifications')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={!isAdmin && !allowChangePassword ? [styles.settingsItem, styles.settingsItemLast] : styles.settingsItem} activeOpacity={0.8}>
            <Ionicons name="wallet-outline" size={22} color="#3D7D82" style={styles.settingsItemIcon} />
            <Text style={styles.settingsItemLabel}>{t('currencySelection')}</Text>
          </TouchableOpacity>
          {isAdmin ? (
            <TouchableOpacity style={allowChangePassword ? styles.settingsItem : [styles.settingsItem, styles.settingsItemLast]} activeOpacity={0.8}>
              <Ionicons name="cloud-upload-outline" size={22} color="#3D7D82" style={styles.settingsItemIcon} />
              <Text style={styles.settingsItemLabel}>{t('dataUploadDb')}</Text>
            </TouchableOpacity>
          ) : null}
          {allowChangePassword ? (
            <TouchableOpacity style={[styles.settingsItem, styles.settingsItemLast]} activeOpacity={0.8}>
              <Ionicons name="lock-closed-outline" size={22} color="#3D7D82" style={styles.settingsItemIcon} />
              <Text style={styles.settingsItemLabel}>{t('changePassword')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={styles.collapsibleCard}>
          <View style={[styles.collapsibleStripe, { backgroundColor: '#7BAEC8' }]} />
          <TouchableOpacity
            style={styles.collapsibleHeaderRow}
            onPress={() => {
              const willOpen = !settingsOpen;
              setSettingsOpen(willOpen);
              if (willOpen) refreshCanChangePassword();
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.menuBlockLabel}>{t('settings')}</Text>
            <Image source={require('../../assets/chevron-down.png')} style={[styles.chevronIcon, settingsOpen && styles.chevronIconOpen]} resizeMode="contain" />
          </TouchableOpacity>
          <Animated.View style={{ height: settingsHeight, overflow: 'hidden' }}>
            <View style={styles.settingsExpandedInner}>
            <TouchableOpacity style={styles.settingsItem} onPress={() => setLanguageModalVisible(true)} activeOpacity={0.8}>
              <Ionicons name="language-outline" size={22} color="#3D7D82" style={styles.settingsItemIcon} />
              <Text style={styles.settingsItemLabel}>{t('language')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingsItem} onPress={() => setNotificationsModalVisible(true)} activeOpacity={0.8}>
              <Ionicons name="notifications-outline" size={22} color="#3D7D82" style={styles.settingsItemIcon} />
              <Text style={styles.settingsItemLabel}>{t('notifications')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={!isAdmin && !allowChangePassword ? [styles.settingsItem, styles.settingsItemLast] : styles.settingsItem} onPress={() => setCurrencyModalVisible(true)} activeOpacity={0.8}>
              <Ionicons name="wallet-outline" size={22} color="#3D7D82" style={styles.settingsItemIcon} />
              <Text style={styles.settingsItemLabel}>{t('currencySelection')}</Text>
            </TouchableOpacity>
            {isAdmin ? (
              <TouchableOpacity style={allowChangePassword ? styles.settingsItem : [styles.settingsItem, styles.settingsItemLast]} onPress={() => setDataUploadModalVisible(true)} activeOpacity={0.8}>
                <Ionicons name="cloud-upload-outline" size={22} color="#3D7D82" style={styles.settingsItemIcon} />
                <Text style={styles.settingsItemLabel}>{t('dataUploadDb')}</Text>
              </TouchableOpacity>
            ) : null}
            {allowChangePassword ? (
              <TouchableOpacity style={[styles.settingsItem, styles.settingsItemLast]} onPress={() => setChangePasswordModalVisible(true)} activeOpacity={0.8}>
                <Ionicons name="lock-closed-outline" size={22} color="#3D7D82" style={styles.settingsItemIcon} />
                <Text style={styles.settingsItemLabel}>{t('changePassword')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          </Animated.View>
        </View>
      </View>

      {/* Delete Account */}
      <TouchableOpacity
        style={{ marginTop: 2, marginBottom: 4, paddingTop: 14, paddingBottom: 0, alignItems: 'center' }}
        onPress={() => { setDeleteConfirmVisible(true); setDeleteConfirmText(''); setDeleteError(''); }}
        activeOpacity={0.7}
      >
        <Text style={{ color: '#C62828', fontSize: 16, fontWeight: '600', textDecorationLine: 'underline' }}>
          {t('deleteAccountBtn') || 'Delete account'}
        </Text>
      </TouchableOpacity>

      <Modal visible={deleteConfirmVisible} transparent animationType="fade">
        <Pressable style={{
          flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center', alignItems: 'center', padding: 24,
        }} onPress={() => setDeleteConfirmVisible(false)}>
          <Pressable style={{
            backgroundColor: '#fff', borderRadius: 20, padding: 24,
            width: '100%', maxWidth: 340,
          }} onPress={e => e.stopPropagation()}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#C62828', marginBottom: 12, textAlign: 'center' }}>
              {t('deleteAccountTitle') || 'Delete account'}
            </Text>
            <Text style={{ fontSize: 14, color: '#5A5A5A', marginBottom: 16, textAlign: 'center', lineHeight: 20 }}>
              {t('deleteAccountWarning') || 'This action cannot be undone. All your data will be permanently deleted.'}
            </Text>
            <Text style={{ fontSize: 13, color: '#5A5A5A', marginBottom: 8, textAlign: 'center' }}>
              {t('deleteAccountTypePrompt') || 'Type DELETE to confirm:'}
            </Text>
            <TextInput
              style={{
                height: 48, borderWidth: 2, borderColor: '#FFCDD2', borderRadius: 12,
                textAlign: 'center', fontSize: 18, fontWeight: '700', color: '#C62828',
                marginBottom: 12,
              }}
              value={deleteConfirmText}
              onChangeText={v => { setDeleteConfirmText(v); setDeleteError(''); }}
              placeholder="DELETE"
              placeholderTextColor="#ccc"
              autoCapitalize="characters"
            />
            {deleteError ? (
              <Text style={{ color: '#C62828', fontSize: 13, textAlign: 'center', marginBottom: 8 }}>
                {deleteError}
              </Text>
            ) : null}
            <TouchableOpacity
              style={{
                backgroundColor: '#C62828', borderRadius: 12, paddingVertical: 14,
                alignItems: 'center', marginBottom: 10,
                opacity: deleting ? 0.5 : 1,
              }}
              onPress={handleDeleteAccount}
              disabled={deleting}
              activeOpacity={0.8}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                {deleting ? '...' : (t('deleteAccountConfirmBtn') || 'Delete permanently')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ paddingVertical: 10, alignItems: 'center' }}
              onPress={() => setDeleteConfirmVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={{ color: '#6B6B6B', fontSize: 14 }}>
                {t('cancel') || 'Cancel'}
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>

    <MyDetailsEditModal
      visible={editModalVisible}
      onClose={() => setEditModalVisible(false)}
      user={user}
      onSave={async (data) => {
        try {
          const updatedUser = await updateUserProfile(data);
          onUserUpdate?.(updatedUser);
        } catch (e) {
          Alert.alert(t('error'), e?.message || t('saveFailed'));
        }
      }}
    />

    <ChangePasswordModal
      visible={changePasswordModalVisible}
      onClose={() => setChangePasswordModalVisible(false)}
    />

    <DataUploadModal
      visible={dataUploadModalVisible}
      onClose={() => setDataUploadModalVisible(false)}
    />

    <LanguageModal
      visible={languageModalVisible}
      onClose={() => setLanguageModalVisible(false)}
      selectedLanguage={language}
      onSave={(lang) => {
        setLanguage(lang);
        setLanguageModalVisible(false);
        saveAgentSettings({ app_language: lang });
      }}
    />

    <NotificationsModal
      visible={notificationsModalVisible}
      onClose={() => setNotificationsModalVisible(false)}
      settings={notificationSettings}
      onSave={(s) => {
        setNotificationSettings(s);
        setNotificationsModalVisible(false);
        saveAgentSettings({ notificationSettings: s });
      }}
    />

    <CurrencyModal
      visible={currencyModalVisible}
      onClose={() => setCurrencyModalVisible(false)}
      selectedCurrency={currency}
      onSave={(c) => {
        setCurrency(c);
        setCurrencyModalVisible(false);
        saveAgentSettings({ selectedCurrency: c });
      }}
    />

    <AddLocationsModal
      visible={addLocationsModalVisible}
      onClose={() => {
        setAddLocationsModalVisible(false);
        setEditLocationData(null);
      }}
      editLocationData={editLocationData}
      editIndex={editLocationData ? 0 : null}
      onDelete={async () => {
        if (!editLocationData?.id) return;
        try {
          await deleteLocation(editLocationData.id);
          setAddLocationsModalVisible(false);
          setEditLocationData(null);
          loadLocations();
        } catch (e) {
          Alert.alert('Error', e.message);
        }
      }}
      onSave={async ({ country, region, city, districts = [] }) => {
        try {
          let locationId;
          if (editLocationData?.id) {
            await updateLocation(editLocationData.id, { country, region, city });
            locationId = editLocationData.id;
          } else {
            const created = await createLocation({ country, region, city });
            locationId = created?.id;
          }
          if (locationId && Array.isArray(districts)) {
            await setLocationDistricts(locationId, districts);
          }
          setAddLocationsModalVisible(false);
          setEditLocationData(null);
          loadLocations();
        } catch (e) {
          const msg = e?.code === 'DUPLICATE_LOCATION' ? t('duplicateLocationError') : e.message;
          Alert.alert('Error', msg);
        }
      }}
    />
    </>
  );
}

const TOP_INSET = (Constants.statusBarHeight ?? 44) + 12;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  fixedTop: {
    paddingTop: TOP_INSET,
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerLeft: {
    width: 52,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.title,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  logoutBtn: {
    width: 52,
    padding: 8,
    alignItems: 'flex-end',
  },
  logoutIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutIconImage: {
    width: 28,
    height: 28,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 15,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#E0D8CC',
    marginBottom: 12,
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: 12,
  },
  agentName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.title,
  },
  myDetailsBlock: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingTop: BLOCK_VERTICAL_PADDING,
    paddingHorizontal: BLOCK_VERTICAL_PADDING,
    paddingBottom: LOCATIONS_BOTTOM_PADDING,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  myDetailsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 17,
  },
  myDetailsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.title,
  },
  pencilBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  contactIcon: {
    marginRight: 10,
  },
  contactText: {
    fontSize: 16,
    color: COLORS.title,
  },
  contactTextLink: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3D7D82',
  },
  contactTextBold: {
    fontWeight: '700',
  },
  settingsWrap: {
    marginBottom: 10,
  },
  collapsibleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  navCardSpacing: {
    marginBottom: 10,
  },
  collapsibleStripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  collapsibleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: BLOCK_VERTICAL_PADDING,
    paddingLeft: 20,
    paddingRight: 16,
  },
  settingsMeasureWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -9999,
    opacity: 0,
    paddingTop: BLOCK_ROW_GAP,
    paddingBottom: BLOCK_VERTICAL_PADDING,
    paddingHorizontal: 16,
    paddingLeft: 32,
  },
  settingsExpandedInner: {
    paddingTop: BLOCK_ROW_GAP,
    paddingBottom: BLOCK_VERTICAL_PADDING,
    paddingHorizontal: 16,
    paddingLeft: 32,
    marginTop: -5,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  settingsItemLast: {
    paddingBottom: 0,
  },
  settingsItemIcon: {
    width: 22,
    height: 22,
    marginRight: 10,
  },
  settingsItemLabel: {
    fontSize: 16,
    fontWeight: '400',
    color: COLORS.title,
  },
  locationsWrap: {
    marginBottom: 10,
  },
  locationsMeasureWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -9999,
    opacity: 0,
    paddingTop: BLOCK_ROW_GAP,
    paddingBottom: LOCATIONS_BOTTOM_PADDING,
    paddingHorizontal: 16,
    paddingLeft: 32,
  },
  locationsExpandedInner: {
    paddingTop: BLOCK_ROW_GAP,
    paddingBottom: LOCATIONS_BOTTOM_PADDING,
    paddingHorizontal: 16,
    paddingLeft: 32,
    marginTop: -5,
  },
  locationsItemWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  locationsItemPencil: {
    width: 14,
    height: 14,
    marginRight: 8,
  },
  locationsItemPencilPlaceholder: {
    width: 14,
    height: 14,
    marginRight: 8,
  },
  locationsItem: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    color: COLORS.title,
  },
  locationsAddRow: {
    marginTop: 5,
  },
  locationsAddLink: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3D7D82',
  },
  menuBlockLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.title,
  },
  chevronIcon: {
    width: 14,
    height: 10,
    marginRight: 4,
  },
  chevronIconOpen: {
    transform: [{ rotate: '180deg' }],
  },
  bottomSpacer: { height: 20 },
});
