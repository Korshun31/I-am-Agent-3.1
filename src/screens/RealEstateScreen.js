import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  Image,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
  ActivityIndicator,
  Alert,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import Constants from 'expo-constants';
import { useLanguage } from '../context/LanguageContext';
import { useAppData } from '../context/AppDataContext';
import { useUser } from '../context/UserContext';
import { useRoute, useNavigation, useIsFocused } from '@react-navigation/native';
import { createProperty, updateProperty, deleteProperty } from '../services/propertiesService';
import { sendNotification, getUnreadCount, getTotalCount } from '../services/notificationsService';
import { supabase } from '../services/supabase';
import PropertyNotificationsModal from '../components/PropertyNotificationsModal';
import AddPropertyModal from '../components/AddPropertyModal';
import PropertyEditWizard from '../components/PropertyEditWizard';
import FilterBottomSheet from '../components/FilterBottomSheet';
import PropertyDetailScreen from './PropertyDetailScreen';
import PropertyItem from '../components/PropertyItem';

const TOP_INSET = (Constants.statusBarHeight ?? 44) + 12;

/** Parse code/name for sort: letter part + optional trailing digits (e.g. A1, B2, 30). */
function parseSortKey(s) {
  const str = String(s ?? '').trim();
  const m = str.match(/^(.*?)(\d+)$/);
  if (m) return { prefix: m[1], num: parseInt(m[2], 10) };
  return { prefix: str, num: null };
}

/** Sort by code/name: alphabetically by prefix; if same prefix and both end with digits, by numbers ascending. */
function compareByCodeOrName(a, b) {
  const codeA = (a.code || a.name || '').trim();
  const codeB = (b.code || b.name || '').trim();
  const ka = parseSortKey(codeA);
  const kb = parseSortKey(codeB);
  const cmp = ka.prefix.localeCompare(kb.prefix);
  if (cmp !== 0) return cmp;
  if (ka.num != null && kb.num != null) return ka.num - kb.num;
  if (ka.num != null) return 1;
  if (kb.num != null) return -1;
  return 0;
}

const COLORS = {
  background: '#F5F2EB',
  title: '#2C2C2C',
  subtitle: '#6B6B6B',
  searchBg: 'rgba(245,242,235,0.9)',
  searchBorder: '#E0D8CC',
};

const HOUSE_LIKE_TYPES = new Set(['house', 'resort_house', 'condo_apartment']);

export default function RealEstateScreen({ onReady }) {
  const { user } = useUser();
  const route = useRoute();
  const navigation = useNavigation();
  const isVisible = useIsFocused();
  const propertyToOpen = route.params?.propertyToOpen ?? null;
  const { t } = useLanguage();
  const { properties, propertiesLoading: loading, refreshProperties } = useAppData();
  const canAdd = !user?.teamMembership || user?.teamPermissions?.can_add_property;

  useEffect(() => { onReady?.(); }, []);
  const [filterVisible, setFilterVisible] = useState(false);
  const [filterValues, setFilterValues] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newPropertyType, setNewPropertyType] = useState('house');
  const [wizardVisible, setWizardVisible] = useState(false);
  const [openWizardQueued, setOpenWizardQueued] = useState(false);
  const [allExpanded, setAllExpanded] = useState(false);
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

  const toggleExpandAll = useCallback(() => {
    LayoutAnimation.configureNext(drawerAnimation);
    setAllExpanded(prev => {
      if (!prev) {
        setExpandedIds(new Set(listToShow.map(p => p.id)));
        return true;
      } else {
        setExpandedIds(new Set());
        return false;
      }
    });
  }, [listToShow]);

  const toggleItemExpand = useCallback((id) => {
    LayoutAnimation.configureNext(drawerAnimation);
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSaveProperty = useCallback(async (data) => {
    try {
      const isAgent = !!user?.teamMembership;
      const propertyData = isAgent
        ? { ...data, property_status: 'pending' }
        : data;
      const {
        name,
        code,
        type,
        location_id,
        owner_id,
        property_status,
        ...detailsToUpdate
      } = propertyData;

      const created = await createProperty({
        name: name || '',
        code: code || '',
        type: type || 'house',
        location_id: location_id || null,
        owner_id: owner_id || null,
        property_status: property_status || 'approved',
      });

      const { responsible_agent_id, user_id, company_id, ...safeDetailsToUpdate } = detailsToUpdate;

      if (created?.id && Object.keys(safeDetailsToUpdate).length > 0) {
        await updateProperty(created.id, safeDetailsToUpdate);
      }

      setWizardVisible(false);
      refreshProperties();
      if (isAgent) {
        Alert.alert(t('addProperty'), t('propSentForApproval') || 'Объект отправлен на утверждение администратору');
        const adminId = user?.teamMembership?.adminId;
        if (adminId && created?.id) {
          const agentName = [user?.name, user?.lastName].filter(Boolean).join(' ') || user?.email || '';
          await sendNotification({
            recipientId: adminId,
            senderId: user.id,
            type: 'property_submitted',
            title: `${agentName} ${t('notifPropChangesMiddle')} «${created.name || created.code || ''}»`,
            body: t('notifApprovalRequired'),
            propertyId: created.id,
          });
        }
      }
    } catch (e) {
      Alert.alert(t('error'), e.message);
    }
  }, [refreshProperties, t, user?.teamMembership, user?.id, user?.name, user?.lastName, user?.email]);

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
  const { listToShow, drafts, uniqueCities, uniqueDistricts, hasActiveFilter } = useMemo(() => {
    const draftStatuses = new Set(['pending', 'rejected']);
    const drafts = properties.filter(p => draftStatuses.has(p.property_status));
    const approvedProperties = properties.filter(p => !p.property_status || p.property_status === 'approved');

    // Когда включён inReview — ищем по всем объектам (включая pending/rejected)
    const filterBase = filterValues?.inReview === true ? properties : approvedProperties;
    const topLevel = filterBase.filter(p => !p.resort_id);
    const children = filterBase.filter(p => p.resort_id);
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
      (filterValues.amenities?.length ?? 0) > 0 ||
      filterValues.inReview === true
    );

    const q = searchQuery.trim().toLowerCase();

    const filterFn = (p, parent) => {
      if (!filterValues) return true;
      const f = filterValues;
      // Когда включён фильтр "На проверке" — показываем только pending/rejected
      if (f.inReview === true) {
        return p.property_status === 'pending' || p.property_status === 'rejected';
      }
      const cityVal = p.city ?? parent?.city;
      const districtVal = p.district ?? parent?.district;
      if (f.city && cityVal !== f.city) return false;
      if (f.districts?.length > 0 && !f.districts.includes(districtVal)) return false;
      const unitParentType = parent?.type;
      if (f.types?.length > 0) {
        const matches = f.types.some(tp => {
          if (tp === 'house') return !p.resort_id && HOUSE_LIKE_TYPES.has(p.type);
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
      (parent?.name || '').toLowerCase().includes(q)
    );

    let list;
    if (hasActiveFilter) {
      const flatUnits = [];
      topLevel.filter(p => HOUSE_LIKE_TYPES.has(p.type)).forEach(p => {
        if (filterFn(p, null) && searchMatch(p, null))
          flatUnits.push({ ...p, _parentName: null, _parentType: null });
      });
      children.forEach(p => {
        const parent = getParent(p.resort_id);
        if (filterFn(p, parent) && searchMatch(p, parent)) {
          flatUnits.push({
            ...p,
            _parentName: parent?.name || '',
            _parentType: parent?.type || null,
            district: parent?.district ?? p.district,
          });
        }
      });
      list = [...flatUnits].sort((a, b) => {
        const codeA = (a._parentName ? a._parentName + ' ' : '') + (a.code || '') + (a.code_suffix ? ` ${a.code_suffix}` : '');
        const codeB = (b._parentName ? b._parentName + ' ' : '') + (b.code || '') + (b.code_suffix ? ` ${b.code_suffix}` : '');
        return compareByCodeOrName({ code: codeA, name: a.name }, { code: codeB, name: b.name });
      });
    } else {
      const searchFiltered = q
        ? topLevel.filter(p =>
            (p.name || '').toLowerCase().includes(q) ||
            (p.code || '').toLowerCase().includes(q)
          )
        : topLevel;
      list = [...searchFiltered].sort((a, b) => compareByCodeOrName(a, b));
    }

    const allCities = [
      ...topLevel.map(p => p.city),
      ...children.map(p => (getParent(p.resort_id)?.city ?? p.city)),
    ].filter(Boolean);

    const allDistricts = [
      ...topLevel.map(p => p.district),
      ...children.map(p => (getParent(p.resort_id)?.district ?? p.district)),
    ].filter(Boolean);

    return {
      listToShow: list,
      drafts,
      uniqueCities: [...new Set(allCities)].sort(),
      uniqueDistricts: [...new Set(allDistricts)].sort(),
      hasActiveFilter: Boolean(hasActiveFilter),
    };
  }, [properties, searchQuery, filterValues]);

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
      <View style={styles.fixedTop}>
      <View style={styles.header}>
        <View style={styles.headerActions} />
        <Text style={styles.headerTitle}>{t('realEstate')}</Text>
        {/* Колокольчик уведомлений */}
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => setNotifModalVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.bellIcon}>🔔</Text>
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
          <Text style={styles.searchIcon}>🔍</Text>
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
              <Text style={styles.searchClear}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        {canAdd && (
          <TouchableOpacity style={styles.toolbarBtn} activeOpacity={0.7} onPress={() => setAddModalVisible(true)}>
            <Image source={require('../../assets/icon-add-property.png')} style={styles.toolbarBtnImage} resizeMode="contain" />
          </TouchableOpacity>
        )}
        {hasActiveFilter && (
          <TouchableOpacity style={styles.toolbarBtn} activeOpacity={0.7} onPress={toggleExpandAll}>
            <Image
              source={allExpanded
                ? require('../../assets/icon-folder-open.png')
                : require('../../assets/icon-folder-closed.png')
              }
              style={styles.toolbarBtnImage}
              resizeMode="contain"
            />
          </TouchableOpacity>
        )}
        {/* Фильтр — в тулбаре, стиль как у остальных кнопок */}
        <TouchableOpacity
          style={[styles.toolbarBtn, hasActiveFilter && styles.filterBtnActive]}
          activeOpacity={0.7}
          onPress={() => setFilterVisible(true)}
        >
          <Image
            source={require('../../assets/icon-filter.png')}
            style={[styles.toolbarBtnImage, hasActiveFilter && styles.filterIconActive]}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>
      </View>

      {loading ? (
        <View style={styles.emptyWrap}>
          <ActivityIndicator size="large" color="#999" />
        </View>
      ) : listToShow.length === 0 && (hasActiveFilter || drafts.length === 0) ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>{t('realEstateEmpty')}</Text>
        </View>
      ) : (
        <FlatList
          data={listToShow}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <PropertyItem
              item={item}
              expanded={expandedIds.has(item.id)}
              onToggle={toggleItemExpand}
              onPress={navigateToProperty}
              t={t}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          initialNumToRender={12}
          maxToRenderPerBatch={8}
          windowSize={5}
          ListFooterComponent={drafts.length > 0 && !hasActiveFilter ? (
            <View style={styles.draftsSection}>
              <Text style={styles.draftsSectionTitle}>{t('draftsSectionTitle')}</Text>
              {drafts.map(item => {
                const visualType = item.type === 'resort_house'
                  ? 'resort'
                  : item.type === 'condo_apartment'
                    ? 'condo'
                    : item.type;
                const typeColor = visualType === 'resort' ? '#81C784' : visualType === 'condo' ? '#64B5F6' : '#FFD54F';
                const typeIcon = visualType === 'resort'
                  ? require('../../assets/icon-property-resort.png')
                  : visualType === 'condo'
                    ? require('../../assets/icon-property-condo.png')
                    : require('../../assets/icon-property-house.png');
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.draftCard}
                    onPress={() => navigateToProperty(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.draftCardInfo}>
                      <View style={styles.draftCardMainRow}>
                        <Image source={typeIcon} style={styles.draftCardTypeIcon} resizeMode="contain" />
                        <Text style={styles.draftCardName} numberOfLines={1}>{item.name || '—'}</Text>
                      </View>
                      {!!item.code && <Text style={styles.draftCardCode}>{item.code}</Text>}
                    </View>
                    <View style={[
                      styles.draftStatusBadge,
                      item.property_status === 'rejected' && styles.draftStatusBadgeRejected,
                    ]}>
                      <Text style={[
                        styles.draftStatusText,
                        item.property_status === 'rejected' && styles.draftStatusTextRejected,
                      ]}>
                        {item.property_status === 'rejected'
                          ? t('statusRejected')
                          : t('statusPending')}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.draftDeleteBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={() => {
                        Alert.alert(
                          t('pdDeleteTitle') || 'Удалить',
                          t('pdDeleteConfirm') || 'Удалить черновик?',
                          [
                            { text: t('no') || 'Нет', style: 'cancel' },
                            {
                              text: t('yes') || 'Да', style: 'destructive',
                              onPress: async () => {
                                try {
                                  await deleteProperty(item.id);
                                  refreshProperties();
                                } catch (e) {
                                  Alert.alert(t('error'), e.message);
                                }
                              },
                            },
                          ]
                        );
                      }}
                    >
                      <Text style={styles.draftDeleteIcon}>🗑</Text>
                    </TouchableOpacity>
                    <View style={[styles.draftTypeStripe, { backgroundColor: typeColor }]} />
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}
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
    paddingHorizontal: 20,
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
  bellIcon: {
    fontSize: 22,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E53935',   // красный — новые уведомления
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeRead: {
    backgroundColor: '#AAAAAA',   // серый — только прочитанные
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
    fontWeight: '700',
    color: COLORS.title,
  },
  filterBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnActive: {
    shadowColor: '#5DB87A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 4,
  },
  filterIconImage: {
    width: 24,
    height: 24,
  },
  filterIconActive: {
    shadowColor: '#5DB87A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
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
  searchIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.title,
    paddingVertical: 0,
  },
  searchClear: {
    fontSize: 14,
    color: '#999',
    paddingLeft: 6,
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
  toolbarBtnIcon: {
    fontSize: 20,
  },
  toolbarBtnImage: {
    width: 26,
    height: 26,
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
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  draftsSection: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  draftsSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.subtitle,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  draftCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F3',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D5D5D0',
    borderStyle: 'dashed',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    opacity: 0.75,
  },
  draftCardInfo: {
    flex: 1,
    gap: 2,
  },
  draftCardMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  draftCardTypeIcon: {
    width: 18,
    height: 18,
  },
  draftCardName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.title,
  },
  draftCardCode: {
    fontSize: 12,
    color: COLORS.subtitle,
  },
  draftStatusBadge: {
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#FFE082',
    marginLeft: 8,
  },
  draftStatusBadgeRejected: {
    backgroundColor: '#FFF5F5',
    borderColor: '#FFCDD2',
  },
  draftStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F59E0B',
  },
  draftStatusTextRejected: {
    color: '#E53935',
  },
  draftDeleteBtn: {
    marginLeft: 8,
    padding: 4,
  },
  draftDeleteIcon: {
    fontSize: 13,
  },
  draftTypeStripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
    borderTopLeftRadius: 11,
    borderBottomLeftRadius: 11,
  },
});
