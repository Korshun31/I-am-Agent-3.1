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
} from 'react-native';
import Constants from 'expo-constants';
import MyDetailsEditModal from '../components/MyDetailsEditModal';
import ChangePasswordModal from '../components/ChangePasswordModal';
import LanguageModal from '../components/LanguageModal';
import NotificationsModal from '../components/NotificationsModal';
import CurrencyModal from '../components/CurrencyModal';
import AddLocationsModal from '../components/AddLocationsModal';
import DataUploadModal from '../components/DataUploadModal';
import { useLanguage } from '../context/LanguageContext';
import { updateUserProfile, getCurrentUser, canChangePassword } from '../services/authService';
import { getLocations, createLocation, updateLocation, deleteLocation, setLocationDistricts } from '../services/locationsService';

const COLORS = {
  background: '#F5F2EB',
  title: '#2C2C2C',
  subtitle: '#5A5A5A',
  myDetailsYellow: '#F7E98E',
  settingsGreen: '#C5E3A8',
  locationsBlue: '#A8D0E6',
  contactsPink: '#E8B8C8',
  statisticsPurple: '#B8A9C8',
  iconGray: '#6B6B6B',
  logoutRed: '#E85D4C',
  contactLink: '#D81B60',
};

const BLOCK_VERTICAL_PADDING = 16; // Верхний и нижний отступ блока: от края до первой/последней строки
const BLOCK_ROW_GAP = 8; // Отступ между строками внутри блока (header↔content, content↔content, last↔action)
const SETTINGS_EXPANDED_HEIGHT = 122;
const LOCATIONS_BOTTOM_PADDING = 10;
const ANIM_DURATION = 280;

export default function AccountScreen({ onLogout, user = {}, onUserUpdate, onOpenContacts, onOpenStatistics, isVisible }) {
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
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  const [addLocationsModalVisible, setAddLocationsModalVisible] = useState(false);
  const [editLocationData, setEditLocationData] = useState(null);
  const [changePasswordModalVisible, setChangePasswordModalVisible] = useState(false);
  const [dataUploadModalVisible, setDataUploadModalVisible] = useState(false);
  const [locationsContentHeight, setLocationsContentHeight] = useState(0);
  const [allowChangePassword, setAllowChangePassword] = useState(false);
  const [companySectionOpen, setCompanySectionOpen] = useState(false);
  const [companyClosing, setCompanyClosing] = useState(false);
  const [companyContentHeight, setCompanyContentHeight] = useState(0);
  const [settingsContentHeight, setSettingsContentHeight] = useState(0);
  const { language, setLanguage, t } = useLanguage();
  const settingsHeight = useRef(new Animated.Value(0)).current;
  const settingsWasOpen = useRef(false);
  const locationsHeight = useRef(new Animated.Value(0)).current;
  const locationsWasOpen = useRef(false);
  const companyHeight = useRef(new Animated.Value(0)).current;
  const companyWasOpen = useRef(false);
  const prevTabVisible = useRef(false);
  const { email = '', name = '', lastName = '', phone = '', telegram = '', documentNumber = '', extraPhones = [], extraEmails = [], whatsapp = '', photoUri = '', workAs = '', companyInfo = {} } = user;

  const displayName = [name, lastName].filter(Boolean).join(' ') || name || null;

  const hasCompanyInfo = workAs === 'company' && companyInfo && (companyInfo.name || companyInfo.phone || companyInfo.email);

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

  useEffect(() => {
    const toValue = settingsOpen ? settingsContentHeight : 0;
    const wasOpen = settingsWasOpen.current;
    settingsWasOpen.current = settingsOpen;
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
    const toValue = companySectionOpen ? companyContentHeight : 0;
    const wasOpen = companyWasOpen.current;
    companyWasOpen.current = companySectionOpen;
    if (wasOpen && !companySectionOpen) setCompanyClosing(true);
    Animated.timing(companyHeight, {
      toValue,
      duration: ANIM_DURATION,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && toValue === 0) setCompanyClosing(false);
    });
  }, [companySectionOpen, companyHeight, companyContentHeight]);

  useEffect(() => {
    const toValue = locationsOpen ? locationsContentHeight + LOCATIONS_BOTTOM_PADDING : 0;
    const wasOpen = locationsWasOpen.current;
    locationsWasOpen.current = locationsOpen;
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

  useEffect(() => {
    if (isVisible && !prevTabVisible.current) {
      setCompanySectionOpen(false);
      setSettingsOpen(false);
      setLocationsOpen(false);
    }
    prevTabVisible.current = isVisible;
  }, [isVisible]);

  useEffect(() => {
    if (!email) return;
    getCurrentUser().then((profile) => {
      if (!profile) return;
      const lang = ['en', 'th', 'ru'].includes(profile.language) ? profile.language : 'en';
      const curr = ['USD', 'EUR', 'RUB', 'THB'].includes(profile.selectedCurrency) ? profile.selectedCurrency : 'USD';
      setLanguage(lang);
      setNotificationSettings(profile.notificationSettings || {});
      setSelectedCurrency(curr);
    }).catch(() => {});
    loadLocations();
  }, [email, setLanguage]);

  const saveAgentSettings = async (updates) => {
    try {
      await updateUserProfile(updates);
    } catch {}
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
                { text: t('no'), style: 'cancel' },
                { text: t('yes'), style: 'destructive', onPress: () => onLogout() },
              ]);
            }}
            activeOpacity={0.7}
          >
            <View style={styles.logoutIconWrap}>
              <Image source={require('../../assets/logout-icon.png')} style={styles.logoutIconImage} resizeMode="contain" />
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
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
      <View style={[styles.myDetailsBlock, hasCompanyInfo && styles.myDetailsBlockWithCompany]}>
        <View style={styles.myDetailsTitleRow}>
          <Text style={styles.myDetailsTitle}>{t('myDetails')}</Text>
          <TouchableOpacity
            style={styles.pencilBtn}
            onPress={() => setEditModalVisible(true)}
            activeOpacity={0.8}
          >
            <Image source={require('../../assets/pencil-icon.png')} style={styles.pencilIconImage} resizeMode="contain" />
          </TouchableOpacity>
        </View>
        {phone ? (
          <View style={styles.contactRow}>
            <Image source={require('../../assets/icon-contact-phone.png')} style={styles.contactIconImage} resizeMode="contain" />
            <TouchableOpacity onPress={() => openPhone(phone)} activeOpacity={0.7}>
              <Text style={[styles.contactText, styles.contactTextLink]}>{phone}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {extraPhones && extraPhones.length > 0
          ? extraPhones.map((p, i) => (p ? (
              <View key={i} style={styles.contactRow}>
                <Image source={require('../../assets/icon-contact-phone.png')} style={styles.contactIconImage} resizeMode="contain" />
                <TouchableOpacity onPress={() => openPhone(p)} activeOpacity={0.7}>
                  <Text style={[styles.contactText, styles.contactTextLink]}>{p}</Text>
                </TouchableOpacity>
              </View>
            ) : null))
          : null}
        {email ? (
          <View style={styles.contactRow}>
            <Image source={require('../../assets/icon-contact-email.png')} style={styles.contactIconImage} resizeMode="contain" />
            <TouchableOpacity onPress={() => openEmail(email)} activeOpacity={0.7}>
              <Text style={[styles.contactText, styles.contactTextLink]}>{email}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {documentNumber ? (
          <View style={styles.contactRow}>
            <Image source={require('../../assets/icon-passport-id.png')} style={styles.contactIconImage} resizeMode="contain" />
            <Text style={[styles.contactText, styles.contactTextBold]}>{documentNumber}</Text>
          </View>
        ) : null}
        {extraEmails && extraEmails.length > 0
          ? extraEmails.map((e, i) => (e ? (
              <View key={`email-${i}`} style={styles.contactRow}>
                <Image source={require('../../assets/icon-contact-email.png')} style={styles.contactIconImage} resizeMode="contain" />
                <TouchableOpacity onPress={() => openEmail(e)} activeOpacity={0.7}>
                  <Text style={[styles.contactText, styles.contactTextLink]}>{e}</Text>
                </TouchableOpacity>
              </View>
            ) : null))
          : null}
        {telegram ? (
          <View style={styles.contactRow}>
            <Image source={require('../../assets/icon-contact-telegram.png')} style={styles.contactIconImage} resizeMode="contain" />
            <TouchableOpacity onPress={() => openTelegram(telegram)} activeOpacity={0.7}>
              <Text style={[styles.contactText, styles.contactTextLink]}>{telegram}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {whatsapp ? (
          <View style={styles.contactRow}>
            <Image source={require('../../assets/icon-contact-whatsapp.png')} style={styles.contactIconImage} resizeMode="contain" />
            <TouchableOpacity onPress={() => openWhatsApp(whatsapp)} activeOpacity={0.7}>
              <Text style={[styles.contactText, styles.contactTextLink]}>{whatsapp}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {hasCompanyInfo ? (
          <>
            <TouchableOpacity
              style={styles.companyTriangleCorner}
              onPress={() => setCompanySectionOpen(!companySectionOpen)}
              activeOpacity={0.8}
            >
              <Image
                source={require('../../assets/chevron-down.png')}
                style={[styles.companyChevronSame, companySectionOpen && styles.companyChevronRotated]}
                resizeMode="contain"
              />
            </TouchableOpacity>
            <View
              style={styles.companyMeasureWrap}
              onLayout={(e) => setCompanyContentHeight(e.nativeEvent.layout.height)}
            >
              <View style={[styles.myDetailsTitleRow, styles.companyToggleRow]}>
                <Text style={styles.myDetailsTitle}>{t('myCompany')}</Text>
              </View>
              {companyInfo.name ? <View style={styles.contactRow}><Text style={[styles.contactText, styles.contactTextBold]}>{companyInfo.name}</Text></View> : null}
              {companyInfo.phone ? <View style={styles.contactRow}><Image source={require('../../assets/icon-contact-phone.png')} style={styles.contactIconImage} resizeMode="contain" /><TouchableOpacity onPress={() => openPhone(companyInfo.phone)} activeOpacity={0.7}><Text style={[styles.contactText, styles.contactTextLink]}>{companyInfo.phone}</Text></TouchableOpacity></View> : null}
              {companyInfo.email ? <View style={styles.contactRow}><Image source={require('../../assets/icon-contact-email.png')} style={styles.contactIconImage} resizeMode="contain" /><TouchableOpacity onPress={() => openEmail(companyInfo.email)} activeOpacity={0.7}><Text style={[styles.contactText, styles.contactTextLink]}>{companyInfo.email}</Text></TouchableOpacity></View> : null}
            </View>
            <Animated.View style={[styles.companyExpandedWrap, { height: companyHeight, overflow: 'hidden' }]}>
              <View style={[styles.myDetailsTitleRow, styles.companyToggleRow]}>
                <Text style={styles.myDetailsTitle}>{t('myCompany')}</Text>
              </View>
              {companyInfo.name ? <View style={styles.contactRow}><Text style={[styles.contactText, styles.contactTextBold]}>{companyInfo.name}</Text></View> : null}
              {companyInfo.phone ? <View style={styles.contactRow}><Image source={require('../../assets/icon-contact-phone.png')} style={styles.contactIconImage} resizeMode="contain" /><TouchableOpacity onPress={() => openPhone(companyInfo.phone)} activeOpacity={0.7}><Text style={[styles.contactText, styles.contactTextLink]}>{companyInfo.phone}</Text></TouchableOpacity></View> : null}
              {companyInfo.email ? <View style={styles.contactRow}><Image source={require('../../assets/icon-contact-email.png')} style={styles.contactIconImage} resizeMode="contain" /><TouchableOpacity onPress={() => openEmail(companyInfo.email)} activeOpacity={0.7}><Text style={[styles.contactText, styles.contactTextLink]}>{companyInfo.email}</Text></TouchableOpacity></View> : null}
            </Animated.View>
          </>
        ) : null}
      </View>

      {/* Settings — раздвижной, высота от содержимого (onLayout) */}
      <View style={styles.settingsWrap}>
        <View
          style={styles.settingsMeasureWrap}
          onLayout={(e) => setSettingsContentHeight(e.nativeEvent.layout.height)}
        >
          <TouchableOpacity style={styles.settingsItem} activeOpacity={0.8}>
            <Image source={require('../../assets/icon-settings-language.png')} style={styles.settingsItemIcon} resizeMode="contain" />
            <Text style={styles.settingsItemLabel}>{t('language')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingsItem} activeOpacity={0.8}>
            <Image source={require('../../assets/icon-settings-notifications.png')} style={styles.settingsItemIcon} resizeMode="contain" />
            <Text style={styles.settingsItemLabel}>{t('notifications')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingsItem} activeOpacity={0.8}>
            <Image source={require('../../assets/icon-settings-currency.png')} style={styles.settingsItemIcon} resizeMode="contain" />
            <Text style={styles.settingsItemLabel}>{t('currencySelection')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={allowChangePassword ? styles.settingsItem : [styles.settingsItem, styles.settingsItemLast]} activeOpacity={0.8}>
            <Image source={require('../../assets/icon-sum.png')} style={styles.settingsItemIcon} resizeMode="contain" />
            <Text style={styles.settingsItemLabel}>{t('dataUploadDb')}</Text>
          </TouchableOpacity>
          {allowChangePassword ? (
            <TouchableOpacity style={[styles.settingsItem, styles.settingsItemLast]} activeOpacity={0.8}>
              <Image source={require('../../assets/icon-change-password.png')} style={styles.settingsItemIcon} resizeMode="contain" />
              <Text style={styles.settingsItemLabel}>{t('changePassword')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          style={[
            styles.menuBlock,
            styles.settingsBlock,
            (settingsOpen || settingsClosing) && styles.settingsBlockOpen,
          ]}
          onPress={() => {
            const willOpen = !settingsOpen;
            setSettingsOpen(willOpen);
            if (willOpen) refreshCanChangePassword();
          }}
          activeOpacity={0.85}
        >
          <View style={styles.menuBlockLeft}>
            <Image source={require('../../assets/settings-icon.png')} style={styles.settingsIconImage} resizeMode="contain" />
            <Text style={styles.menuBlockLabel}>{t('settings')}</Text>
          </View>
          <Image source={require('../../assets/chevron-down.png')} style={[styles.chevronIcon, settingsOpen && styles.chevronIconOpen]} resizeMode="contain" />
        </TouchableOpacity>
        <Animated.View style={[styles.settingsExpandedWrap, { height: settingsHeight, overflow: 'hidden' }]}>
          <View style={styles.settingsExpandedInner}>
            <TouchableOpacity style={styles.settingsItem} onPress={() => setLanguageModalVisible(true)} activeOpacity={0.8}>
              <Image source={require('../../assets/icon-settings-language.png')} style={styles.settingsItemIcon} resizeMode="contain" />
              <Text style={styles.settingsItemLabel}>{t('language')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingsItem} onPress={() => setNotificationsModalVisible(true)} activeOpacity={0.8}>
              <Image source={require('../../assets/icon-settings-notifications.png')} style={styles.settingsItemIcon} resizeMode="contain" />
              <Text style={styles.settingsItemLabel}>{t('notifications')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingsItem} onPress={() => setCurrencyModalVisible(true)} activeOpacity={0.8}>
              <Image source={require('../../assets/icon-settings-currency.png')} style={styles.settingsItemIcon} resizeMode="contain" />
              <Text style={styles.settingsItemLabel}>{t('currencySelection')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={allowChangePassword ? styles.settingsItem : [styles.settingsItem, styles.settingsItemLast]} onPress={() => setDataUploadModalVisible(true)} activeOpacity={0.8}>
              <Image source={require('../../assets/icon-sum.png')} style={styles.settingsItemIcon} resizeMode="contain" />
              <Text style={styles.settingsItemLabel}>{t('dataUploadDb')}</Text>
            </TouchableOpacity>
            {allowChangePassword ? (
              <TouchableOpacity style={[styles.settingsItem, styles.settingsItemLast]} onPress={() => setChangePasswordModalVisible(true)} activeOpacity={0.8}>
                <Image source={require('../../assets/icon-change-password.png')} style={styles.settingsItemIcon} resizeMode="contain" />
                <Text style={styles.settingsItemLabel}>{t('changePassword')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </Animated.View>
      </View>

      {/* Locations — раздвижной, высота от содержимого + 14px снизу */}
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
        <TouchableOpacity
          style={[
            styles.menuBlock,
            styles.locationsBlock,
            (locationsOpen || locationsClosing) && styles.locationsBlockOpen,
          ]}
          onPress={() => setLocationsOpen(!locationsOpen)}
          activeOpacity={0.85}
        >
          <View style={styles.menuBlockLeft}>
            <Image source={require('../../assets/icon-locations.png')} style={styles.menuBlockIconImage} resizeMode="contain" />
            <Text style={styles.menuBlockLabel}>{t('locations')}</Text>
          </View>
          <Image source={require('../../assets/chevron-down.png')} style={[styles.chevronIcon, locationsOpen && styles.chevronIconOpen]} resizeMode="contain" />
        </TouchableOpacity>
        <Animated.View style={[styles.locationsExpandedWrap, { height: locationsHeight, overflow: 'hidden' }]}>
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

      {/* Contacts — переход на экран контактов */}
      <TouchableOpacity
        style={[styles.menuBlock, styles.contactsBlock]}
        activeOpacity={0.85}
        onPress={() => onOpenContacts?.()}
      >
        <View style={styles.menuBlockLeft}>
          <Image source={require('../../assets/icon-contacts.png')} style={styles.menuBlockIconImage} resizeMode="contain" />
          <Text style={styles.menuBlockLabel}>{t('contacts')}</Text>
        </View>
      </TouchableOpacity>

      {/* Statistics — переход на экран статистики */}
      <TouchableOpacity
        style={[styles.menuBlock, styles.statisticsBlock]}
        activeOpacity={0.85}
        onPress={() => onOpenStatistics?.()}
      >
        <View style={styles.menuBlockLeft}>
          <Image source={require('../../assets/icon-sum.png')} style={styles.menuBlockIconImage} resizeMode="contain" />
          <Text style={styles.menuBlockLabel}>{t('statistics')}</Text>
        </View>
      </TouchableOpacity>

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
        saveAgentSettings({ language: lang });
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
      selectedCurrency={selectedCurrency}
      onSave={(c) => {
        setSelectedCurrency(c);
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
          Alert.alert('Error', e.message);
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
    paddingBottom: 88,
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
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.title,
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
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E0D8CC',
    marginBottom: 12,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 12,
  },
  agentName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.title,
  },
  myDetailsBlock: {
    backgroundColor: COLORS.myDetailsYellow,
    borderRadius: 16,
    paddingTop: BLOCK_VERTICAL_PADDING,
    paddingHorizontal: BLOCK_VERTICAL_PADDING,
    paddingBottom: LOCATIONS_BOTTOM_PADDING,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  myDetailsBlockWithCompany: {
    position: 'relative',
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
    padding: 6,
  },
  pencilIconImage: {
    width: 22,
    height: 22,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  contactIconImage: {
    width: 22,
    height: 22,
    marginRight: 10,
  },
  contactText: {
    fontSize: 15,
    color: COLORS.title,
  },
  contactTextLink: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.contactLink,
  },
  contactTextBold: {
    fontWeight: '700',
  },
  menuBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    paddingVertical: BLOCK_VERTICAL_PADDING,
    paddingHorizontal: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  menuBlockLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsWrap: {
    marginBottom: 10,
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
  settingsBlock: { backgroundColor: COLORS.settingsGreen },
  settingsBlockOpen: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  settingsIconImage: {
    width: 26,
    height: 26,
    marginRight: 12,
  },
  settingsExpandedWrap: {
    backgroundColor: COLORS.settingsGreen,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    marginTop: -10,
    marginHorizontal: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
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
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.title,
  },
  locationsWrap: {
    marginBottom: 10,
  },
  locationsBlock: { backgroundColor: COLORS.locationsBlue },
  locationsBlockOpen: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
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
  locationsExpandedWrap: {
    backgroundColor: COLORS.locationsBlue,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    marginTop: -10,
    marginHorizontal: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
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
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.title,
  },
  locationsAddRow: {
    marginTop: 5,
  },
  locationsAddLink: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.contactLink,
  },
  contactsBlock: { backgroundColor: COLORS.contactsPink },
  statisticsBlock: { backgroundColor: COLORS.statisticsPurple },
  menuBlockIcon: { fontSize: 22, marginRight: 12 },
  menuBlockIconImage: {
    width: 26,
    height: 26,
    marginRight: 12,
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
  companyToggleRow: {
    marginTop: 20,
  },
  companyTriangleCorner: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    padding: 4,
    zIndex: 10,
    elevation: 10,
  },
  companyMeasureWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -9999,
    opacity: 0,
  },
  companyExpandedWrap: {
    marginTop: 0,
  },
  companyChevronSame: {
    width: 14,
    height: 10,
    transform: [{ rotate: '0deg' }],
  },
  companyChevronRotated: {
    transform: [{ rotate: '180deg' }],
  },
  bottomSpacer: { height: 20 },
});
