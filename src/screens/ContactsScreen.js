import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Dimensions,
  Alert,
} from 'react-native';
import Constants from 'expo-constants';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';
import AddContactModal from '../components/AddContactModal';
import ContactDetailScreen from './ContactDetailScreen';
import { getContacts, createContact, migrateContactPhotos } from '../services/contactsService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Пропорции боковых вкладок
// Закрытая вкладка — узкая полоска, почти полностью за активной
const V_TAB_INACTIVE_WIDTH = Math.round(SCREEN_HEIGHT * 0.04);  // ~30px — узкая полоска
const V_TAB_INACTIVE_HEIGHT = Math.round(SCREEN_WIDTH * 0.24);  // ~94px — длина закрытой вкладки увеличена в 2 раза
// Активная вкладка — крупная, с иконкой и вертикальным текстом
const V_TAB_ACTIVE_MIN_HEIGHT = Math.round(SCREEN_WIDTH * 0.33);
const V_TAB_ACTIVE_WIDTH = Math.round(SCREEN_HEIGHT * 0.085 * 0.75);
const V_TAB_STICK_OUT = 12;

// Такой же отступ сверху, как на экране Account (фиксированный первый фрейм)
const TOP_INSET = (Constants.statusBarHeight ?? 44) + 12;

// Тестовая сетка — показывает границы фреймов (удалить после расстановки)
const TEST_GRID_VISIBLE = false;

const COLORS = {
  background: '#F5F2EB',
  title: '#2C2C2C',
  subtitle: '#5A5A5A',
  nameHeader: '#C45C6E',
  lastNameHeader: '#6B6B6B',
  searchBg: '#FFFFFF',
  border: '#E0DAD2',
  addButton: '#5DB87A',
  backArrow: '#5DB8D4',
  tabClients: '#5DB8D4',
  tabOwners: '#F0A84A',
};

const CONTACTS_TABS = [
  { key: 'owners', labelKey: 'owners', color: COLORS.tabOwners, icon: require('../../assets/icon_owners.png') },
  { key: 'clients', labelKey: 'clients', color: COLORS.tabClients, icon: require('../../assets/icon_clients.png') },
];

// Копия двух правых вкладок нижнего меню (календарь, личный кабинет) — развёрнута -90deg во фрейме 2
const SIDEBAR_TABS = [
  { key: 'owners', labelKey: 'owners', label: 'Собственники', color: '#C2920EE6', icon: require('../../assets/icon_sidebar_owners.png') },
  { key: 'clients', labelKey: 'clients', label: 'Клиенты', color: '#449CDAE6', icon: require('../../assets/icon_sidebar_clients.png') },
];
const SIDEBAR_OVERLAP = 11;
const SIDEBAR_TAB_WIDTH = Math.round((SCREEN_WIDTH - 2 * (SCREEN_WIDTH * 0.05)) / 4);
// Ширина контейнера вкладок — только под 2 вкладки, чтобы размещались справа во фрейме 2
const SIDEBAR_NAV_WIDTH = SIDEBAR_TAB_WIDTH * 2 - SIDEBAR_OVERLAP + 24;

// Открытая вкладка накрывает закрытую на 50% высоты закрытой (30% + 20%)
const OVERLAP_V = Math.round(V_TAB_INACTIVE_HEIGHT * 0.50);
const BOTTOM_TAB_OFFSET_DOWN = 25; // дополнительное смещение нижней вкладки вниз

export default function ContactsScreen({ onBack }) {
  const { t } = useLanguage();
  const { user } = useUser();
  const [sidebarTabIndex, setSidebarTabIndex] = useState(1);
  const activeTab = SIDEBAR_TABS[sidebarTabIndex]?.key ?? 'clients';
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [addContactVisible, setAddContactVisible] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getContacts(activeTab);
      setContacts(data);
    } catch (e) {
      console.error('Load contacts error:', e);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // One-time migration: upload local photos to Supabase Storage
  useEffect(() => {
    migrateContactPhotos().then(() => {
      // Reload contacts so new https:// URLs are reflected
      loadContacts();
    });
  }, []);

  const handleSaveContact = async (data) => {
    try {
      await createContact(data);
      loadContacts();
    } catch (e) {
      Alert.alert(t('error'), e.message);
    }
  };

  const query = searchQuery.trim().toLowerCase();
  const filteredContacts = query
    ? contacts.filter(c =>
        (c.name + ' ' + c.lastName).toLowerCase().includes(query) ||
        (c.phone || '').includes(query)
      )
    : contacts;

  const sortedContacts = [...filteredContacts].sort((a, b) => {
    if (sortBy === 'lastName') {
      return (a.lastName || '').localeCompare(b.lastName || '');
    }
    return (a.name || '').localeCompare(b.name || '');
  });

  const emptyMessage = activeTab === 'clients' ? t('contactsEmptyClients') : t('contactsEmptyOwners');

  if (selectedContact) {
    return (
      <ContactDetailScreen
        contact={selectedContact}
        onBack={() => setSelectedContact(null)}
        onContactUpdated={(updated) => {
          setContacts(prev => prev.map(c => c.id === updated.id ? updated : c));
          setSelectedContact(updated);
        }}
        onContactDeleted={(id) => {
          setContacts(prev => prev.filter(c => c.id !== id));
          setSelectedContact(null);
        }}
        user={user}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Верхний фрейм: как в Account — фиксированная строка с заголовком */}
      <View style={styles.fixedTop}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.8}>
            <Text style={styles.backArrowText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('contacts')}</Text>
          <View style={styles.headerRight} />
        </View>
      </View>

      {/* Второй фрейм: слева — поиск (Фрейм 3), кнопки (Фрейм 4), список (Фрейм 5); справа — Фрейм 2 (вкладки сверху) */}
      <View style={styles.secondFrame}>
        {/* Левая колонка: поиск + фрейм 4 + фрейм 5 */}
        <View style={styles.leftColumn}>
          {/* Фрейм 3: поисковая строка */}
          <View style={styles.searchRow}>
            <View style={styles.searchWrap}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder={t('search')}
                placeholderTextColor={COLORS.subtitle}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>

          {/* Фрейм 4: три кнопки — Имя (сортировка по имени), Фамилия (сортировка по фамилии), + (добавить) */}
          <View style={styles.frame4}>
            <TouchableOpacity
              style={[styles.sortBtn, sortBy === 'name' && styles.sortBtnActive]}
              onPress={() => setSortBy('name')}
              activeOpacity={0.8}
            >
              <Text style={[styles.sortBtnText, sortBy === 'name' && styles.sortBtnTextActive]}>{t('name')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortBtn, sortBy === 'lastName' && styles.sortBtnActive]}
              onPress={() => setSortBy('lastName')}
              activeOpacity={0.8}
            >
              <Text style={[styles.sortBtnText, sortBy === 'lastName' && styles.sortBtnTextActive]}>{t('lastName')}</Text>
            </TouchableOpacity>
            <View style={styles.frame4Spacer} />
            <TouchableOpacity style={styles.addBtn} onPress={() => setAddContactVisible(true)} activeOpacity={0.85}>
              <Text style={styles.addBtnText}>+</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.listHeaderLine} />

          {/* Фрейм 5: список контактов */}
          <View style={styles.frame5}>
            <ScrollView
              style={styles.listScroll}
              contentContainerStyle={styles.listScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {sortedContacts.length === 0 ? (
                <View style={styles.emptyList}>
                  <Text style={styles.emptyText}>{emptyMessage}</Text>
                </View>
              ) : (
                sortedContacts.map((contact) => (
                  <TouchableOpacity
                    key={contact.id}
                    style={styles.contactRow}
                    activeOpacity={0.7}
                    onPress={() => setSelectedContact(contact)}
                  >
                    <Text style={styles.contactName}>
                      {contact.name}{contact.lastName ? ' ' + contact.lastName : ''}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>

        {/* Фрейм 2: две вкладки (календарь, личный кабинет) — вертикально, повёрнуты -90°, в правом верхнем углу */}
        <View style={styles.frame2} pointerEvents="box-none">
          <View style={styles.rotatedNavWrap}>
            <View style={styles.rotatedNavInner}>
              {SIDEBAR_TABS.map((tab, index) => {
                const isActive = sidebarTabIndex === index;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    style={[
                      styles.rotatedTabWrapper,
                      index > 0 && { marginLeft: -SIDEBAR_OVERLAP },
                      isActive ? styles.rotatedTabWrapperActive : { zIndex: index },
                    ]}
                    onPress={() => setSidebarTabIndex(index)}
                    activeOpacity={0.85}
                  >
                    {isActive ? (
                      <View style={[styles.rotatedTabActive, { backgroundColor: tab.color }]}>
                        <Image source={tab.icon} style={styles.rotatedTabActiveIcon} resizeMode="contain" />
                        <Text style={styles.rotatedTabActiveLabel} numberOfLines={1}>
                          {tab.label ?? t(tab.labelKey)}
                        </Text>
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.rotatedTabInactive,
                          { backgroundColor: tab.color },
                          index === 0 && styles.rotatedTabInactiveFirst,
                          index > 0 && styles.rotatedTabInactiveOverlap,
                        ]}
                      >
                        <Image source={tab.icon} style={styles.rotatedTabInactiveIcon} resizeMode="contain" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </View>

      <AddContactModal
        visible={addContactVisible}
        onClose={() => setAddContactVisible(false)}
        contactType={activeTab}
        onSave={handleSaveContact}
      />

      {/* Тестовая сетка — слой с серыми полосками для визуализации фреймов */}
      {TEST_GRID_VISIBLE && (
        <View style={styles.testGridLayer} pointerEvents="none">
          <View style={[styles.testGridFrame, styles.testGridFrame1]}>
            <Text style={styles.testGridLabel}>Фрейм 1</Text>
          </View>
          <View style={[styles.testGridFrame, styles.testGridFrame2]}>
            <Text style={styles.testGridLabel}>Фрейм 2</Text>
          </View>
          <View style={[styles.testGridFrame, styles.testGridFrame3]}>
            <Text style={styles.testGridLabel}>Фрейм 3</Text>
          </View>
          <View style={[styles.testGridFrame, styles.testGridFrame4]}>
            <Text style={styles.testGridLabel}>Фрейм 4</Text>
          </View>
          <View style={[styles.testGridFrame, styles.testGridFrame5]}>
            <Text style={styles.testGridLabel}>Фрейм 5</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  fixedTop: {
    paddingTop: TOP_INSET,
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backBtn: {
    width: 52,
    padding: 8,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  backArrowText: {
    fontSize: 24,
    color: COLORS.backArrow,
  },
  headerTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.title,
    textAlign: 'center',
  },
  headerRight: {
    width: 52,
  },
  secondFrame: {
    flex: 1,
    flexDirection: 'row',
    position: 'relative',
  },
  leftColumn: {
    flex: 1,
    marginHorizontal: 20,
    paddingRight: V_TAB_ACTIVE_WIDTH + V_TAB_STICK_OUT,
    minWidth: 0,
  },
  searchRow: {
    marginBottom: 12,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.searchBg,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.title,
    paddingVertical: 0,
  },
  frame4: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  sortBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginRight: 12,
  },
  sortBtnActive: {},
  sortBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.lastNameHeader,
  },
  sortBtnTextActive: {
    color: COLORS.nameHeader,
  },
  frame4Spacer: {
    flex: 1,
  },
  addBtn: {
    width: 23,
    height: 23,
    borderRadius: 12,
    backgroundColor: COLORS.addButton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '300',
    lineHeight: 16,
  },
  listHeaderLine: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: 8,
  },
  frame5: {
    flex: 1,
    minHeight: 0,
  },
  listScroll: {
    flex: 1,
  },
  listScrollContent: {
    flexGrow: 1,
    paddingBottom: 100,
  },
  contactRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  contactName: {
    fontSize: 16,
    color: COLORS.title,
  },
  emptyList: {
    flexGrow: 1,
    paddingTop: 80,
    paddingBottom: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.subtitle,
    textAlign: 'center',
    lineHeight: 22,
  },
  testGridLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    pointerEvents: 'none',
  },
  testGridFrame: {
    position: 'absolute',
    backgroundColor: 'rgba(150,150,150,0.25)',
    borderWidth: 2,
    borderColor: 'rgba(100,100,100,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  testGridFrame1: {
    top: 0,
    left: 0,
    right: 0,
    height: TOP_INSET + 52 + 20,
  },
  testGridFrame2: {
    top: TOP_INSET + 52 + 20,
    right: 0,
    bottom: 0,
    width: V_TAB_ACTIVE_WIDTH + V_TAB_STICK_OUT + 16,
  },
  testGridFrame3: {
    top: TOP_INSET + 52 + 20,
    left: 20,
    right: V_TAB_ACTIVE_WIDTH + V_TAB_STICK_OUT + 16 + 20 + 8,
    height: 44 + 12,
  },
  testGridFrame4: {
    top: TOP_INSET + 52 + 20 + 44 + 12 + 1 + 8,
    left: 20,
    right: V_TAB_ACTIVE_WIDTH + V_TAB_STICK_OUT + 16 + 20 + 8,
    height: 36 + 16 + 8,
  },
  testGridFrame5: {
    top: TOP_INSET + 52 + 20 + 44 + 12 + 1 + 8 + 36 + 16 + 8 + 8,
    left: 20,
    right: V_TAB_ACTIVE_WIDTH + V_TAB_STICK_OUT + 16 + 20 + 8,
    bottom: 0,
  },
  testGridLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(80,80,80,0.9)',
  },
  frame2: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: V_TAB_ACTIVE_WIDTH + V_TAB_STICK_OUT + 16,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    flexDirection: 'column',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
  rotatedNavWrap: {
    transform: [{ rotate: '-90deg' }, { translateY: 80 }, { translateX: -32 }],
    height: 62,
    width: SIDEBAR_NAV_WIDTH,
    alignSelf: 'flex-end',
    marginTop: 52,
  },
  rotatedNavInner: {
    flexDirection: 'row',
    height: 62,
    width: SIDEBAR_NAV_WIDTH,
    alignItems: 'flex-end',
    paddingHorizontal: 8,
  },
  rotatedTabWrapper: {
    width: SIDEBAR_TAB_WIDTH,
    alignItems: 'stretch',
    justifyContent: 'flex-end',
    minHeight: 52,
  },
  rotatedTabWrapperActive: {
    width: Math.round(SIDEBAR_TAB_WIDTH * 1.28),
    zIndex: 10,
  },
  rotatedTabInactive: {
    height: 50,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  rotatedTabInactiveFirst: {
    borderTopLeftRadius: 20,
  },
  rotatedTabInactiveOverlap: {
    borderTopLeftRadius: 16,
  },
  rotatedTabInactiveIcon: {
    width: 31,
    height: 31,
    transform: [{ rotate: '90deg' }],
  },
  rotatedTabActive: {
    minHeight: 62,
    paddingVertical: 12,
    paddingHorizontal: 7,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -12,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 5,
    elevation: 5,
  },
  rotatedTabActiveIcon: {
    width: 41,
    height: 41,
    marginBottom: 4,
    marginTop: -5,
    transform: [{ rotate: '90deg' }],
  },
  rotatedTabActiveLabel: {
    marginTop: -5,
    fontSize: 12,
    fontWeight: '700',
    color: '#2C2C2C',
  },
  verticalTabsInner: {
    width: V_TAB_ACTIVE_WIDTH + V_TAB_STICK_OUT,
    flexDirection: 'column',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  vTabWrapper: {
    minHeight: V_TAB_INACTIVE_HEIGHT,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  vTabWrapperActive: {
    flex: 1.28,
    minHeight: V_TAB_ACTIVE_MIN_HEIGHT,
    zIndex: 10,
  },
  vTabInactive: {
    width: V_TAB_INACTIVE_WIDTH,
    height: V_TAB_INACTIVE_HEIGHT,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: -1, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  vTabInactiveFirst: {
    borderTopLeftRadius: 20,
  },
  vTabInactiveOverlap: {
    borderTopLeftRadius: 16,
  },
  vTabInactiveIcon: {
    width: 24,
    height: 24,
  },
  vTabActive: {
    width: V_TAB_ACTIVE_WIDTH,
    minHeight: V_TAB_ACTIVE_MIN_HEIGHT,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginRight: -V_TAB_STICK_OUT,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 5,
    elevation: 5,
  },
  vTabActiveIcon: {
    width: 28,
    height: 28,
  },
});
