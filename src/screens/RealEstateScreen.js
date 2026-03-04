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

const COLORS = {
  background: '#F5F2EB',
  title: '#2C2C2C',
  subtitle: '#6B6B6B',
  searchBg: 'rgba(245,242,235,0.9)',
  searchBorder: '#E0D8CC',
};

function PropertyItem({ item, expanded, onToggle, onPress, t }) {
  const arrowAnim = useState(() => new Animated.Value(0))[0];

  const colors = TYPE_COLORS[item.type] || TYPE_COLORS.house;
  const icon = TYPE_ICONS[item.type] || TYPE_ICONS.house;

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
          <Text style={styles.propertyName} numberOfLines={1}>{item.name}</Text>
        </TouchableOpacity>
        <Text style={styles.propertyCode}>{item.code}</Text>
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
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [allExpanded, setAllExpanded] = useState(false);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [selectedProperty, setSelectedProperty] = useState(null);

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
      setExpandedIds(new Set(sorted.map(p => p.id)));
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

  const filtered = searchQuery.trim()
    ? topLevel.filter(p =>
        p.name.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
        p.code.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : topLevel;

  const sorted = [...filtered].sort((a, b) => {
    const typeOrder = { resort: 0, house: 1, condo: 2 };
    const diff = (typeOrder[a.type] ?? 1) - (typeOrder[b.type] ?? 1);
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name);
  });

  if (selectedProperty) {
    return (
      <PropertyDetailScreen
        property={selectedProperty}
        onBack={() => setSelectedProperty(null)}
        onDelete={() => handleDeleteProperty(selectedProperty)}
        onPropertyUpdated={loadProperties}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>{t('realEstate')}</Text>
        <TouchableOpacity style={styles.filterBtn} activeOpacity={0.7}>
          <Text style={styles.filterIcon}>⚙️</Text>
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
      ) : sorted.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>{t('realEstateEmpty')}</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.listScroll}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {sorted.map((item) => (
            <PropertyItem key={item.id} item={item} expanded={expandedIds.has(item.id)} onToggle={() => toggleItemExpand(item.id)} onPress={() => setSelectedProperty(item)} t={t} />
          ))}
        </ScrollView>
      )}

      <AddPropertyModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onSave={handleSaveProperty}
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
  filterIcon: {
    fontSize: 22,
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
