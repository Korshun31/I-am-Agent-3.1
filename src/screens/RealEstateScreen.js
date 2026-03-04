import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
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
import { getProperties, createProperty, updateProperty, deleteProperty } from '../services/propertiesService';
import AddPropertyModal from '../components/AddPropertyModal';
import FilterBottomSheet from '../components/FilterBottomSheet';
import PropertyDetailScreen from './PropertyDetailScreen';

const TYPE_COLORS = {
  resort: { bg: 'rgba(168,230,163,0.7)', border: '#A8E6A3' },
  house:  { bg: '#FFF9C4', border: '#FFD54F' },
  condo:  { bg: '#BBDEFB', border: '#64B5F6' },
};

const TYPE_ICONS = {
  resort: require('../../assets/icon-property-resort.png'),
  house:  require('../../assets/icon-property-house.png'),
  condo:  require('../../assets/icon-property-condo.png'),
};

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

function PropertyItem({ item, expanded, onToggle, onPress, t }) {
  const arrowAnim = useState(() => new Animated.Value(0))[0];

  const cardType = item._parentType
    ? item._parentType
    : (item.type || 'house');
  const colors = TYPE_COLORS[cardType] || TYPE_COLORS.house;
  const icon = TYPE_ICONS[cardType] || TYPE_ICONS.house;
  const displayName = item._parentName ? `${item._parentName} › ${item.name || item.code || ''}`.trim() : item.name;
  const codeDisplay = item.code_suffix ? (item.code ? item.code + ' ' : '') + `(${item.code_suffix})` : item.code;

  useEffect(() => {
    Animated.timing(arrowAnim, {
      toValue: expanded ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [expanded, arrowAnim]);

  const arrowRotate = arrowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '0deg'],
  });

  return (
    <View style={[styles.propertyCard, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      <View style={styles.propertyRow}>
        <TouchableOpacity style={styles.propertyMainArea} onPress={onPress} activeOpacity={0.7}>
          {typeof icon === 'string' ? (
            <Text style={styles.propertyIcon}>{icon}</Text>
          ) : (
            <Image source={icon} style={styles.propertyIconImage} resizeMode="contain" />
          )}
          <Text style={styles.propertyName} numberOfLines={1}>{displayName}</Text>
        </TouchableOpacity>
        <Text style={styles.propertyCode}>{codeDisplay}</Text>
        <TouchableOpacity onPress={onToggle} activeOpacity={0.5} style={styles.expandBtn}>
          <Animated.View style={{ transform: [{ rotate: arrowRotate }] }}>
            <Image source={require('../../assets/icon-arrow-down.png')} style={styles.expandArrowImage} resizeMode="contain" />
          </Animated.View>
        </TouchableOpacity>
      </View>
      {expanded && (
        <View style={styles.expandedContent}>
          {Array.isArray(item.photos) && item.photos.length > 0 ? (
            <Image source={{ uri: item.photos[0] }} style={styles.expandedPhoto} />
          ) : (
            <View style={[styles.expandedPhoto, styles.expandedPhotoPlaceholder]}>
              <Image source={require('../../assets/icon-photo.png')} style={styles.expandedPhotoPlaceholderIcon} resizeMode="contain" />
            </View>
          )}
          <View style={styles.expandedDetails}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('propDistrict')}</Text>
              <Text style={styles.detailColon}>:</Text>
              <Text style={styles.detailValue}>{item.district || '—'}</Text>
            </View>
            {item.type === 'resort' ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('propHouses')}</Text>
                <Text style={styles.detailColon}>:</Text>
                <Text style={styles.detailValue}>
                  {item.houses_count != null ? `${item.houses_count}  pc` : '—'}
                </Text>
              </View>
            ) : item.type === 'house' ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('propBedrooms')}</Text>
                <Text style={styles.detailColon}>:</Text>
                <Text style={styles.detailValue}>
                  {item.bedrooms != null ? item.bedrooms : '—'}
                </Text>
              </View>
            ) : item.type === 'condo' ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('propFloors')}</Text>
                <Text style={styles.detailColon}>:</Text>
                <Text style={styles.detailValue}>
                  {item.floors != null ? item.floors : '—'}
                </Text>
              </View>
            ) : null}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('propBeach')}</Text>
              <Text style={styles.detailColon}>:</Text>
              <Text style={styles.detailValue}>
                {item.beach_distance != null ? `${item.beach_distance}  m` : '—'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('propMarket')}</Text>
              <Text style={styles.detailColon}>:</Text>
              <Text style={styles.detailValue}>
                {item.market_distance != null ? `${item.market_distance}  m` : '—'}
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

export default function RealEstateScreen() {
  const { t } = useLanguage();
  const [properties, setProperties] = useState([]);
  const [filterVisible, setFilterVisible] = useState(false);
  const [filterValues, setFilterValues] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [allExpanded, setAllExpanded] = useState(false);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [backTarget, setBackTarget] = useState(null);

  const navigateToProperty = (property) => {
    setBackTarget(selectedProperty);
    setSelectedProperty(property);
  };

  const handleBack = () => {
    const target = backTarget;
    setBackTarget(null);
    setSelectedProperty(target ?? null);
  };

  const loadProperties = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getProperties();
      setProperties(data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    loadProperties();
  }, [loadProperties]);

  const drawerAnimation = {
    duration: 300,
    create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    update: { type: LayoutAnimation.Types.easeInEaseOut },
    delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  };

  const toggleExpandAll = () => {
    LayoutAnimation.configureNext(drawerAnimation);
    if (!allExpanded) {
      setExpandedIds(new Set(listToShow.map(p => p.id)));
      setAllExpanded(true);
    } else {
      setExpandedIds(new Set());
      setAllExpanded(false);
    }
  };

  const toggleItemExpand = (id) => {
    LayoutAnimation.configureNext(drawerAnimation);
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSaveProperty = async (data) => {
    try {
      await createProperty(data);
      setAddModalVisible(false);
      loadProperties();
    } catch (e) {
      Alert.alert(t('error'), e.message);
    }
  };

  const handleDeleteProperty = (prop) => {
    Alert.alert(t('pdDeleteTitle'), t('pdDeleteConfirm'), [
      { text: t('no'), style: 'cancel' },
      {
        text: t('yes'), style: 'destructive', onPress: async () => {
          try {
            await deleteProperty(prop.id);
            setSelectedProperty(null);
            loadProperties();
          } catch (e) {
            Alert.alert(t('error'), e.message);
          }
        },
      },
    ]);
  };

  const topLevel = properties.filter(p => !p.resort_id);
  const children = properties.filter(p => p.resort_id);
  const getParent = (id) => properties.find(pr => pr.id === id);

  const filterFn = (p, parent) => {
    if (!filterValues) return true;
    const f = filterValues;
    const cityVal = p.city ?? parent?.city;
    const districtVal = p.district ?? parent?.district;
    if (f.city && cityVal !== f.city) return false;
    if (f.districts?.length > 0 && !f.districts.includes(districtVal)) return false;
    const unitParentType = parent?.type;
    if (f.types?.length > 0) {
      const matches = f.types.some(t => {
        if (t === 'house') return !p.resort_id && p.type === 'house';
        if (t === 'resort') return unitParentType === 'resort';
        if (t === 'condo') return unitParentType === 'condo';
        return false;
      });
      if (!matches) return false;
    }
    if (f.bedrooms != null && (p.type !== 'house' || p.bedrooms !== f.bedrooms)) return false;
    const price = p.price_monthly != null ? Number(p.price_monthly) : null;
    if (f.priceMin != null && (price == null || price < f.priceMin)) return false;
    if (f.priceMax != null && (price == null || price > f.priceMax)) return false;
    if (f.pets === true && !p.pets_allowed) return false;
    if (f.pets === false && p.pets_allowed) return false;
    if (f.longTerm === true && !p.long_term_booking) return false;
    if (f.amenities?.length > 0) {
      const am = p.amenities || {};
      if (!f.amenities.every(k => am[k])) return false;
    }
    return true;
  };

  const hasActiveFilter = filterValues && (
    filterValues.city ||
    (filterValues.districts?.length ?? 0) > 0 ||
    (filterValues.types?.length ?? 0) > 0 ||
    filterValues.bedrooms != null ||
    filterValues.priceMin != null ||
    filterValues.priceMax != null ||
    filterValues.pets !== 'any' ||
    filterValues.longTerm === true ||
    (filterValues.amenities?.length ?? 0) > 0
  );

  const q = searchQuery.trim().toLowerCase();
  const searchMatch = (p, parent) => !q || (
    (p.name || '').toLowerCase().includes(q) ||
    (p.code || '').toLowerCase().includes(q) ||
    (p.code_suffix || '').toLowerCase().includes(q) ||
    (parent?.name || '').toLowerCase().includes(q)
  );

  let listToShow;
  if (hasActiveFilter) {
    const flatUnits = [];
    topLevel.filter(p => p.type === 'house').forEach(p => {
      if (filterFn(p, null) && searchMatch(p, null)) flatUnits.push({ ...p, _parentName: null, _parentType: null });
    });
    children.forEach(p => {
      const parent = getParent(p.resort_id);
      if (filterFn(p, parent) && searchMatch(p, parent)) {
        flatUnits.push({ ...p, _parentName: parent?.name || '', _parentType: parent?.type || null });
      }
    });
    listToShow = [...flatUnits].sort((a, b) => {
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
    listToShow = [...searchFiltered].sort((a, b) => compareByCodeOrName(a, b));
  }

  const allCities = [
    ...topLevel.map(p => p.city),
    ...children.map(p => (getParent(p.resort_id)?.city ?? p.city)),
  ].filter(Boolean);
  const uniqueCities = [...new Set(allCities)].sort();
  const allDistricts = [
    ...topLevel.map(p => p.district),
    ...children.map(p => (getParent(p.resort_id)?.district ?? p.district)),
  ].filter(Boolean);
  const uniqueDistricts = [...new Set(allDistricts)].sort();

  if (selectedProperty) {
    return (
      <PropertyDetailScreen
        property={selectedProperty}
        onBack={handleBack}
        onDelete={() => handleDeleteProperty(selectedProperty)}
        onPropertyUpdated={loadProperties}
        onSelectProperty={navigateToProperty}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>{t('realEstate')}</Text>
        <TouchableOpacity style={[styles.filterBtn, hasActiveFilter && styles.filterBtnActive]} onPress={() => setFilterVisible(true)} activeOpacity={0.7}>
          <Image source={require('../../assets/icon-filter.png')} style={[styles.filterIconImage, hasActiveFilter && styles.filterIconActive]} resizeMode="contain" />
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
        </View>
        <TouchableOpacity style={styles.toolbarBtn} activeOpacity={0.7} onPress={() => setAddModalVisible(true)}>
          <Image source={require('../../assets/icon-add-property.png')} style={styles.toolbarBtnImage} resizeMode="contain" />
        </TouchableOpacity>
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
        <ScrollView
          style={styles.listScroll}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {listToShow.map((item) => (
            <PropertyItem key={item.id} item={item} expanded={expandedIds.has(item.id)} onToggle={() => toggleItemExpand(item.id)} onPress={() => navigateToProperty(item)} t={t} />
          ))}
        </ScrollView>
      )}

      <AddPropertyModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: TOP_INSET,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  headerSpacer: {
    width: 36,
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
    paddingHorizontal: 20,
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
  propertyCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 10,
    overflow: 'hidden',
  },
  propertyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  propertyMainArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  propertyIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  propertyIconImage: {
    width: 32,
    height: 32,
    marginRight: 10,
  },
  propertyName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#2C2C2C',
  },
  propertyCode: {
    fontSize: 14,
    fontWeight: '700',
    color: '#D81B60',
    marginRight: 10,
  },
  expandBtn: {
    paddingVertical: 8,
    paddingLeft: 12,
    paddingRight: 4,
  },
  expandArrowImage: {
    width: 14,
    height: 14,
    tintColor: '#888888',
  },
  expandedContent: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
    paddingTop: 10,
    gap: 12,
  },
  expandedPhoto: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  expandedPhotoPlaceholder: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedPhotoPlaceholderIcon: {
    width: 36,
    height: 36,
    opacity: 0.5,
  },
  expandedDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 2,
  },
  detailLabel: {
    fontSize: 13,
    color: '#6B6B6B',
    width: 70,
  },
  detailColon: {
    fontSize: 13,
    color: '#6B6B6B',
    marginRight: 8,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2C2C2C',
    flex: 1,
    textAlign: 'right',
  },
});
