import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { IconFolderClosed, IconFolderOpen } from '../components/FolderIcons';
import { Ionicons } from '@expo/vector-icons';
import { FONT } from '../utils/scale';
import { compareCode } from '../utils/codeSort';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../context/LanguageContext';
import { useAppData } from '../context/AppDataContext';
import { useUser } from '../context/UserContext';
import { useRoute, useNavigation, useIsFocused } from '@react-navigation/native';
import { createPropertyFull, updateProperty, deleteProperty } from '../services/propertiesService';
import { getUnreadCount, getTotalCount } from '../services/notificationsService';
import { supabase } from '../services/supabase';
import PropertyNotificationsModal from '../components/PropertyNotificationsModal';
import AddPropertyModal from '../components/AddPropertyModal';
import PropertyEditWizard from '../components/PropertyEditWizard';
import FilterBottomSheet from '../components/FilterBottomSheet';
import PropertyDetailScreen from './PropertyDetailScreen';
import PropertyItem from '../components/PropertyItem';
import { TAB_BAR_CONTENT_HEIGHT } from '../components/BottomNav';

const TOP_INSET = (Constants.statusBarHeight ?? 44) + 12;

/** Sort by code/name: natural-sort через общую утилиту codeSort. */
function compareByCodeOrName(a, b) {
  const codeA = (a.code || a.name || '').trim();
  const codeB = (b.code || b.name || '').trim();
  return compareCode(codeA, codeB);
}

const COLORS = {
  background: '#F5F5F7',   // Apple-серый — подложка под белые карточки
  title: '#2C2C2C',
  subtitle: '#6B6B6B',
  searchBg: 'rgba(255,255,255,0.9)',   // белый — на сером смотрится чисто
  searchBorder: '#E5E5EA',             // системный iOS-разделитель
};

const HOUSE_LIKE_TYPES = new Set(['house', 'resort_house', 'condo_apartment']);

export default function RealEstateScreen({ onReady }) {
  const { width } = useWindowDimensions();
  // Адаптивные отступы: SE (< 390pt) → 16, стандартные и Pro Max → 20
  const hPad = width < 390 ? 16 : 20;
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const route = useRoute();
  const navigation = useNavigation();
  const isVisible = useIsFocused();
  const propertyToOpen = route.params?.propertyToOpen ?? null;
  const { t } = useLanguage();
  const { properties, propertiesLoading: loading, refreshProperties, contacts } = useAppData();
  const canAdd = !user?.teamMembership || user?.teamPermissions?.can_manage_property;

  useEffect(() => { onReady?.(); }, []);
  const [filterVisible, setFilterVisible] = useState(false);
  const [filterValues, setFilterValues] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newPropertyType, setNewPropertyType] = useState('house');
  const [wizardVisible, setWizardVisible] = useState(false);
  const [openWizardQueued, setOpenWizardQueued] = useState(false);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [backTarget, setBackTarget] = useState(null);
  const [notifModalVisible, setNotifModalVisible] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalCount, setTotalCount]   = useState(0);
  const [notifRefreshKey, setNotifRefreshKey] = useState(0);
  // Ref для стабильного чтения notifModalVisible внутри realtime-колбэка
  const notifModalVisibleRef = useRef(false);

  // Refs so callbacks stay stable (no stale closure issues)
  const selectedPropertyRef = useRef(null);
  const backTargetRef = useRef(null);
  useEffect(() => { selectedPropertyRef.current = selectedProperty; }, [selectedProperty]);
  useEffect(() => { backTargetRef.current = backTarget; }, [backTarget]);

  const navigateToProperty = useCallback((property) => {
    setBackTarget(selectedPropertyRef.current);
    setSelectedProperty(property);
  }, []);

  const handleBack = useCallback(() => {
    const target = backTargetRef.current;
    setBackTarget(null);
    setSelectedProperty(target ?? null);
  }, []);

  useEffect(() => {
    if (propertyToOpen) {
      setSelectedProperty(propertyToOpen);
      navigation.setParams({ propertyToOpen: undefined });
    }
  }, [propertyToOpen]);

  const prevVisible = useRef(false);
  useEffect(() => {
    if (prevVisible.current && !isVisible) {
      setSelectedProperty(null);
      setBackTarget(null);
    }
    prevVisible.current = isVisible;
  }, [isVisible]);

  // Open create wizard only after selected type state is applied.
  useEffect(() => {
    if (!openWizardQueued) return;
    setWizardVisible(true);
    setOpenWizardQueued(false);
  }, [openWizardQueued, newPropertyType]);

  // Загружаем оба счётчика при каждом появлении вкладки
  const refreshBadge = useCallback(() => {
    getUnreadCount().then(setUnreadCount).catch(() => {});
    getTotalCount().then(setTotalCount).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    refreshBadge();
  }, [isVisible]);

  // Синхронизируем ref с текущим значением — нужен для стабильного чтения в realtime callback
  useEffect(() => {
    notifModalVisibleRef.current = notifModalVisible;
  }, [notifModalVisible]);

  // Realtime ping: Supabase слушает INSERT/UPDATE/DELETE в notifications для текущего юзера.
  // При событии — обновляем бейдж; если модалка открыта — тригерим reload списка.
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`notif-mobile-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${user.id}`,
        },
        () => {
          refreshBadge();
          if (notifModalVisibleRef.current) {
            setNotifRefreshKey(k => k + 1);
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, refreshBadge]);

  useEffect(() => {
    if (!selectedProperty) return;
    const fresh = properties.find(p => p.id === selectedProperty.id);
    if (!fresh) {
      setSelectedProperty(null);
      return;
    }
    if (fresh !== selectedProperty) {
      setSelectedProperty(fresh);
    }
  }, [properties]);

  const drawerAnimation = {
    duration: 150,
    create: { type: LayoutAnimation.Types.linear, property: LayoutAnimation.Properties.opacity },
    update: { type: LayoutAnimation.Types.linear },
    delete: { type: LayoutAnimation.Types.linear, property: LayoutAnimation.Properties.opacity },
  };


  const toggleItemExpand = useCallback((id) => {
    LayoutAnimation.configureNext(drawerAnimation);
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const keyExtractor = useCallback((item) => item.id, []);
  const renderItem = useCallback(({ item }) => (
    <PropertyItem
      item={item}
      expanded={expandedIds.has(item.id)}
      onToggle={toggleItemExpand}
      onPress={navigateToProperty}
      t={t}
    />
  ), [expandedIds, toggleItemExpand, navigateToProperty, t]);

  const handleSaveProperty = useCallback(async (data) => {
    try {
      await createPropertyFull(data);
      setWizardVisible(false);
      refreshProperties();
    } catch (e) {
      const msg = e?.code === 'DUPLICATE_PROPERTY_CODE' ? t('duplicatePropertyCodeError') : e.message;
      Alert.alert(t('error'), msg);
    }
  }, [refreshProperties, t]);

  const handleDeleteProperty = useCallback((prop) => {
    Alert.alert(t('pdDeleteTitle'), t('pdDeleteConfirm'), [
      { text: t('no'), style: 'cancel' },
      {
        text: t('yes'), style: 'destructive', onPress: async () => {
          try {
            await deleteProperty(prop.id);
            setSelectedProperty(null);
            refreshProperties();
          } catch (e) {
            Alert.alert(t('error'), e.message);
          }
        },
      },
    ]);
  }, [refreshProperties, t]);

  // ─── Derived data — memoized so they only recompute when inputs change ─────
  const { listToShow, uniqueCities, uniqueDistricts, hasActiveFilter } = useMemo(() => {
    const topLevel = properties.filter(p => !p.parent_id);
    const children = properties.filter(p => p.parent_id);
    const getParent = (id) => properties.find(pr => pr.id === id);

    const hasActiveFilter = filterValues && (
      filterValues.city ||
      (filterValues.districts?.length ?? 0) > 0 ||
      (filterValues.types?.length ?? 0) > 0 ||
      (filterValues.bedrooms?.length ?? 0) > 0 ||
      filterValues.priceMin != null ||
      filterValues.priceMax != null ||
      filterValues.pets === true ||
      filterValues.longTerm === true ||
      (filterValues.amenities?.length ?? 0) > 0
    );

    const q = searchQuery.trim().toLowerCase();

    const filterFn = (p, parent) => {
      if (!filterValues) return true;
      const f = filterValues;
      const cityVal = p.city ?? parent?.city;
      const districtVal = p.district ?? parent?.district;
      if (f.city && cityVal !== f.city) return false;
      if (f.districts?.length > 0 && !f.districts.includes(districtVal)) return false;
      const unitParentType = parent?.type;
      if (f.types?.length > 0) {
        const matches = f.types.some(tp => {
          if (tp === 'house') return !p.parent_id && HOUSE_LIKE_TYPES.has(p.type);
          if (tp === 'resort') return unitParentType === 'resort';
          if (tp === 'condo') return unitParentType === 'condo';
          return false;
        });
        if (!matches) return false;
      }
      if (f.bedrooms?.length > 0) {
        const br = p.bedrooms;
        if (br == null) return false;
        const matches = f.bedrooms.some(b => b === 5 ? br >= 5 : br === b);
        if (!matches) return false;
      }
      const price = p.price_monthly != null ? Number(p.price_monthly) : null;
      if (f.priceMin != null && (price == null || price < f.priceMin)) return false;
      if (f.priceMax != null && (price == null || price > f.priceMax)) return false;
      if (f.pets === true && !p.pets_allowed) return false;
      if (f.longTerm === true && !p.long_term_booking) return false;
      if (f.amenities?.length > 0) {
        const am = p.amenities || {};
        if (!f.amenities.every(k => am[k])) return false;
      }
      return true;
    };

    const searchMatch = (p, parent) => !q || (
      (p.name || '').toLowerCase().includes(q) ||
      (p.code || '').toLowerCase().includes(q) ||
      (p.code_suffix || '').toLowerCase().includes(q) ||
      (parent?.name || '').toLowerCase().includes(q) ||
      (() => {
        const owner = p.owner_id ? contacts.find(c => c.id === p.owner_id) : null;
        const owner2 = p.owner_id_2 ? contacts.find(c => c.id === p.owner_id_2) : null;
        const ownerName = `${owner?.name || ''} ${owner?.lastName || ''}`.trim().toLowerCase();
        const owner2Name = `${owner2?.name || ''} ${owner2?.lastName || ''}`.trim().toLowerCase();
        return ownerName.includes(q) || owner2Name.includes(q);
      })()
    );

    let list;
    if (hasActiveFilter) {
      const flatUnits = [];
      topLevel.filter(p => HOUSE_LIKE_TYPES.has(p.type)).forEach(p => {
        if (filterFn(p, null) && searchMatch(p, null))
          flatUnits.push({ ...p, _parentName: null, _parentType: null, _parentCode: p.code || '' });
      });
      children.forEach(p => {
        const parent = getParent(p.parent_id);
        if (filterFn(p, parent) && searchMatch(p, parent)) {
          flatUnits.push({
            ...p,
            _parentName: parent?.name || '',
            _parentType: parent?.type || null,
            _parentCode: parent?.code || '',
            district: parent?.district ?? p.district,
          });
        }
      });
      list = [...flatUnits].sort((a, b) => {
        const codeA = (a._parentCode ? a._parentCode + ' ' : '') + (a.code_suffix ?? a.code ?? '');
        const codeB = (b._parentCode ? b._parentCode + ' ' : '') + (b.code_suffix ?? b.code ?? '');
        return compareCode(codeA, codeB);
      });
    } else {
      const searchFiltered = q
        ? topLevel.filter(p =>
            (p.name || '').toLowerCase().includes(q) ||
            (p.code || '').toLowerCase().includes(q) ||
            (() => {
              const owner = p.owner_id ? contacts.find(c => c.id === p.owner_id) : null;
              const owner2 = p.owner_id_2 ? contacts.find(c => c.id === p.owner_id_2) : null;
              const ownerName = `${owner?.name || ''} ${owner?.lastName || ''}`.trim().toLowerCase();
              const owner2Name = `${owner2?.name || ''} ${owner2?.lastName || ''}`.trim().toLowerCase();
              return ownerName.includes(q) || owner2Name.includes(q);
            })()
          )
        : topLevel;
      list = [...searchFiltered].sort((a, b) => compareByCodeOrName(a, b));
    }

    const allCities = [
      ...topLevel.map(p => p.city),
      ...children.map(p => (getParent(p.parent_id)?.city ?? p.city)),
    ].filter(Boolean);

    const allDistricts = [
      ...topLevel.map(p => p.district),
      ...children.map(p => (getParent(p.parent_id)?.district ?? p.district)),
    ].filter(Boolean);

    return {
      listToShow: list,
      uniqueCities: [...new Set(allCities)].sort(),
      uniqueDistricts: [...new Set(allDistricts)].sort(),
      hasActiveFilter: Boolean(hasActiveFilter),
    };
  }, [properties, searchQuery, filterValues]);

  const allExpanded = expandedIds.size > 0 && listToShow.every(p => expandedIds.has(p.id));

  useEffect(() => {
    if (!hasActiveFilter && searchQuery.length === 0) setExpandedIds(new Set());
  }, [hasActiveFilter, searchQuery]);

  const expandTimersRef = useRef([]);

  const toggleExpandAll = useCallback(() => {
    expandTimersRef.current.forEach(t => clearTimeout(t));
    expandTimersRef.current = [];
    if (!allExpanded) {
      const ids = listToShow.map(p => p.id);
      const chunkSize = 5;
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const t = setTimeout(() => {
          setExpandedIds(prev => {
            const next = new Set(prev);
            chunk.forEach(id => next.add(id));
            return next;
          });
        }, (i / chunkSize) * 50);
        expandTimersRef.current.push(t);
      }
    } else {
      LayoutAnimation.configureNext(drawerAnimation);
      setExpandedIds(new Set());
    }
  }, [listToShow, allExpanded]);

  if (selectedProperty) {
    return (
      <PropertyDetailScreen
        property={selectedProperty}
        onBack={handleBack}
        onDelete={() => handleDeleteProperty(selectedProperty)}
        onPropertyUpdated={refreshProperties}
        onSelectProperty={navigateToProperty}
        user={user}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.fixedTop, { paddingHorizontal: hPad }]}>
      <View style={styles.header}>
        <View style={styles.headerActions} />
        <Text style={styles.headerTitle}>{t('realEstate')}</Text>
        {/* Колокольчик уведомлений */}
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => setNotifModalVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={unreadCount > 0 ? 'notifications' : 'notifications-outline'}
              size={22}
              color={unreadCount > 0 ? '#3D7D82' : '#888'}
            />
            {unreadCount > 0 ? (
              // Новые уведомления — красный бейдж с числом непрочитанных
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            ) : totalCount > 0 ? (
              // Только прочитанные — серый бейдж с общим числом
              <View style={[styles.badge, styles.badgeRead]}>
                <Text style={[styles.badgeText, styles.badgeTextRead]}>
                  {totalCount > 9 ? '9+' : totalCount}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
      </View>

      <View style={styles.toolbarRow}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={FONT.body} color="#999" style={styles.searchIconIon} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('search')}
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={16} color="#BBBBBB" />
            </TouchableOpacity>
          )}
        </View>
        {canAdd && (
          <TouchableOpacity style={styles.toolbarBtn} activeOpacity={0.7} onPress={() => setAddModalVisible(true)}>
            <Ionicons name="add-outline" size={22} color="#888" />
          </TouchableOpacity>
        )}
        {(hasActiveFilter || searchQuery.length > 0) && (
          <TouchableOpacity style={styles.toolbarBtn} activeOpacity={0.7} onPress={toggleExpandAll}>
            {allExpanded
              ? <IconFolderOpen  size={22} color="#888" />
              : <IconFolderClosed size={22} color="#888" />
            }
          </TouchableOpacity>
        )}
        {/* Фильтр — в тулбаре, стиль как у остальных кнопок */}
        <TouchableOpacity
          style={[styles.toolbarBtn, hasActiveFilter && styles.filterBtnActive]}
          activeOpacity={0.7}
          onPress={() => setFilterVisible(true)}
        >
          <Ionicons
            name="funnel-outline"
            size={18}
            color={hasActiveFilter ? '#3D7D82' : '#888'}
          />
        </TouchableOpacity>
      </View>
      </View>

      {loading ? (
        <View style={styles.emptyWrap}>
          <ActivityIndicator size="large" color="#999" />
        </View>
      ) : listToShow.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>{t('realEstateEmpty')}</Text>
        </View>
      ) : (
        <FlatList
          data={listToShow}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={[styles.listContent, { paddingHorizontal: hPad, paddingBottom: insets.bottom + TAB_BAR_CONTENT_HEIGHT + 12 }]}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          initialNumToRender={12}
          maxToRenderPerBatch={8}
          windowSize={5}
        />
      )}

      <AddPropertyModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onTypeSelected={(type) => {
          setNewPropertyType(type);
          setOpenWizardQueued(true);
        }}
      />

      <PropertyEditWizard
        mode="create"
        initialType={newPropertyType}
        visible={wizardVisible}
        onClose={() => setWizardVisible(false)}
        onSave={handleSaveProperty}
      />

      <FilterBottomSheet
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        filter={filterValues}
        onApply={setFilterValues}
        cities={uniqueCities}
        districts={uniqueDistricts}
        showBookingsFilter={false}
      />

      <PropertyNotificationsModal
        visible={notifModalVisible}
        onClose={() => setNotifModalVisible(false)}
        onBadgeUpdate={refreshBadge}
        refreshSignal={notifRefreshKey}
        onOpenProperty={(propertyId) => {
          const found = properties.find(p => p.id === propertyId);
          if (found) navigateToProperty(found);
        }}
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
    // paddingHorizontal задаётся динамически через hPad в JSX
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerActions: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E53935',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeRead: {
    backgroundColor: '#AAAAAA',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 16,
  },
  badgeTextRead: {
    color: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',      // было 700 — semibold по-яблочному приятнее
    letterSpacing: -0.3,
    color: COLORS.title,
  },
  filterBtnActive: {
    borderColor: '#3D7D82',
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.searchBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.searchBorder,
    paddingHorizontal: 12,
    height: 40,
  },
  searchIconIon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.title,
    paddingVertical: 0,
  },
  toolbarBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.searchBg,
    borderWidth: 1,
    borderColor: COLORS.searchBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 80,
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.subtitle,
    textAlign: 'center',
  },
  listScroll: {
    flex: 1,
  },
  listContent: {
    // paddingHorizontal и paddingBottom задаются динамически в JSX
  },
});
