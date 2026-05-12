import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { TAB_BAR_CONTENT_HEIGHT } from '../components/BottomNav';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';
import AddContactModal from '../components/AddContactModal';
import ContactDetailScreen from './ContactDetailScreen';
import { getContacts, createContact, migrateContactPhotos } from '../services/contactsService';
import { useAppData } from '../context/AppDataContext';

const TOP_INSET = (Constants.statusBarHeight ?? 44) + 12;

const COLORS = {
  background: '#F5F5F7',
  title: '#2C2C2C',
  subtitle: '#5A5A5A',
  lastNameHeader: '#6B6B6B',
  searchBg: '#FFFFFF',
  border: '#E0DAD2',
};

const SIDEBAR_TABS = [
  { key: 'owners', labelKey: 'owners', label: 'Собственники' },
  { key: 'clients', labelKey: 'clients', label: 'Клиенты' },
];

export default function ContactsScreen({ onBack }) {
  const { t } = useLanguage();
  const { user } = useUser();
  const { refreshContacts: refreshGlobalContacts } = useAppData();
  const insets = useSafeAreaInsets();
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
      refreshGlobalContacts();
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
            <Ionicons name="chevron-back" size={20} color="#2C2C2C" />
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
          <View style={styles.contactTypeTabs}>
            {SIDEBAR_TABS.map((tab, index) => {
              const isActive = sidebarTabIndex === index;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.contactTypeTab, isActive && styles.contactTypeTabActive]}
                  onPress={() => setSidebarTabIndex(index)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.contactTypeTabText, isActive && styles.contactTypeTabTextActive]}>
                    {tab.label ?? t(tab.labelKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.searchRow}>
            <View style={styles.searchWrap}>
              <Ionicons name="search" size={16} color="#888" style={styles.searchIcon} />
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
              <Ionicons name="add" size={22} color="#3D7D82" />
            </TouchableOpacity>
          </View>
          <View style={styles.listHeaderLine} />

          {/* Фрейм 5: список контактов */}
          <View style={styles.frame5}>
            <ScrollView
              style={styles.listScroll}
              contentContainerStyle={[styles.listScrollContent, { paddingBottom: insets.bottom + TAB_BAR_CONTENT_HEIGHT + 12 }]}
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

      </View>

      <AddContactModal
        visible={addContactVisible}
        onClose={() => setAddContactVisible(false)}
        contactType={activeTab}
        onSave={handleSaveContact}
      />

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
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.title,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  headerRight: {
    width: 36,
    height: 36,
  },
  secondFrame: {
    flex: 1,
    flexDirection: 'row',
    position: 'relative',
  },
  leftColumn: {
    flex: 1,
    marginHorizontal: 20,
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
    color: '#3D7D82',
  },
  frame4Spacer: {
    flex: 1,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
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
  },
  contactRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
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
    fontSize: 14,
    color: COLORS.subtitle,
    textAlign: 'center',
    lineHeight: 20,
  },
  contactTypeTabs: {
    flexDirection: 'row',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#D1D1D6',
    overflow: 'hidden',
    marginBottom: 12,
  },
  contactTypeTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#F7F7F9',
    alignItems: 'center',
  },
  contactTypeTabActive: {
    backgroundColor: 'rgba(61,125,130,0.08)',
  },
  contactTypeTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  contactTypeTabTextActive: {
    color: '#3D7D82',
  },
});
