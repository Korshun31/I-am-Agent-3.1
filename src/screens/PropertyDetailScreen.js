import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Linking,
  FlatList,
  Animated,
  Alert,
  Modal,
  Dimensions,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import Constants from 'expo-constants';
import { useLanguage } from '../context/LanguageContext';
import { getProperties, updateProperty } from '../services/propertiesService';
import { deletePhotoFromStorage } from '../services/storageService';
import { getContacts } from '../services/contactsService';
import PropertyEditWizard from '../components/PropertyEditWizard';
import ContactDetailScreen from './ContactDetailScreen';

const TOP_INSET = (Constants.statusBarHeight ?? 44) + 12;

const BLOCK_COLORS = {
  resort: { bg: 'rgba(168,230,163,0.7)', border: '#A8E6A3' },
  house:  { bg: '#FFF9C4', border: '#FFD54F' },
  condo:  { bg: '#BBDEFB', border: '#64B5F6' },
};

const AMENITY_KEYS = [
  'swimming_pool', 'gym', 'parking', 'internet', 'tv', 'washing_machine',
  'dishwasher', 'fridge', 'stove', 'oven', 'hood', 'microwave',
  'kettle', 'toaster', 'coffee_machine', 'multi_cooker', 'blender',
];

const AMENITY_ICONS = {
  swimming_pool: '🏊', gym: '💪', parking: '🅿️', internet: '📶',
  tv: '📺', washing_machine: '🫧', dishwasher: '🍽️', fridge: '🧊',
  stove: '🔥', oven: '♨️', hood: '🌀', microwave: '📡',
  kettle: '☕', toaster: '🍞', coffee_machine: '☕', multi_cooker: '🍲', blender: '🥤',
};

function SectionBlock({ color, border, children }) {
  return (
    <View style={[styles.sectionBlock, { backgroundColor: color, borderColor: border }]}>
      {children}
    </View>
  );
}

function InfoRow({ label, value, isLink, onPress }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel} numberOfLines={1}>{label}</Text>
      <Text style={styles.infoColon}>:</Text>
      {isLink ? (
        <TouchableOpacity onPress={onPress} style={styles.infoValueWrap}>
          <Text style={[styles.infoValue, styles.infoLink]} numberOfLines={1}>{value}</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.infoValue} numberOfLines={1}>{value || '—'}</Text>
      )}
    </View>
  );
}

function PriceRow({ icon, label, value }) {
  return (
    <View style={styles.priceRow}>
      <Text style={styles.priceIcon}>{icon}</Text>
      <Text style={styles.priceLabel}>{label}</Text>
      <Text style={styles.priceValue}>{value || '—'}</Text>
    </View>
  );
}

function ResortHouseItem({ item, expanded, onToggle }) {
  const arrowAnim = useState(() => new Animated.Value(0))[0];

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
    <View style={[styles.resortHouseCard, { backgroundColor: '#FFF9C4', borderColor: '#FFD54F' }]}>
      <View style={styles.resortHouseRow}>
        <Image source={require('../../assets/icon-property-house.png')} style={styles.resortHouseIcon} resizeMode="contain" />
        <Text style={styles.resortHouseName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.resortHouseCode}>{item.code}</Text>
        <TouchableOpacity onPress={onToggle} activeOpacity={0.5} style={styles.resortHouseExpandBtn}>
          <Animated.View style={{ transform: [{ rotate: arrowRotate }] }}>
            <Image source={require('../../assets/icon-arrow-down.png')} style={styles.resortHouseArrow} resizeMode="contain" />
          </Animated.View>
        </TouchableOpacity>
      </View>
      {expanded && (
        <View style={styles.resortHouseExpanded}>
          <InfoRow label="Bedrooms" value={item.bedrooms != null ? `${item.bedrooms}` : '—'} />
          <InfoRow label="Area" value={item.area != null ? `${item.area} m2` : '—'} />
        </View>
      )}
    </View>
  );
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

function PhotoGalleryModal({ visible, photos, initialIndex, onClose, onDeletePhoto, t }) {
  const flatListRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      setSaveMenuOpen(false);
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: initialIndex, animated: false });
      }, 50);
    }
  }, [visible, initialIndex]);

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const savePhotosToGallery = async (uris) => {
    setSaving(true);
    setSaveMenuOpen(false);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Allow access to save photos');
        setSaving(false);
        return;
      }
      let saved = 0;
      for (const uri of uris) {
        try {
          let localUri = uri;
          if (uri.startsWith('http://') || uri.startsWith('https://')) {
            const ext = uri.split('.').pop()?.split('?')[0] || 'jpg';
            const fileName = `photo_${Date.now()}_${saved}.${ext}`;
            const download = await FileSystem.downloadAsync(uri, FileSystem.cacheDirectory + fileName);
            localUri = download.uri;
          }
          await MediaLibrary.saveToLibraryAsync(localUri);
          saved++;
        } catch {}
      }
      Alert.alert('✓', saved === 1 ? 'Photo saved' : `${saved} photos saved`);
    } catch {
      Alert.alert('Error', 'Failed to save');
    }
    setSaving(false);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={galleryStyles.backdrop}>
        <StatusBar barStyle="light-content" />

        <TouchableOpacity style={galleryStyles.closeBtn} onPress={onClose} activeOpacity={0.7}>
          <Text style={galleryStyles.closeText}>✕</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={galleryStyles.saveBtn}
          onPress={() => setSaveMenuOpen(!saveMenuOpen)}
          activeOpacity={0.7}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={galleryStyles.saveBtnIcon}>↓</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={galleryStyles.deleteBtn}
          onPress={() => {
            if (photos.length === 0) return;
            Alert.alert(
              photos.length === 1 ? (t?.('pdDeletePhoto') || 'Delete photo?') : (t?.('pdDeleteThisPhoto') || 'Delete this photo?'),
              '',
              [
                { text: t?.('cancel') || 'Cancel', style: 'cancel' },
                {
                  text: t?.('delete') || 'Delete',
                  style: 'destructive',
                  onPress: () => {
                    const deletedUrl = photos[currentIndex];
                    const next = photos.filter((_, i) => i !== currentIndex);
                    onDeletePhoto?.(next, deletedUrl);
                  },
                },
              ]
            );
          }}
          activeOpacity={0.7}
        >
          <Image source={require('../../assets/trash-icon.png')} style={galleryStyles.deleteBtnIcon} resizeMode="contain" />
        </TouchableOpacity>

        <FlatList
          ref={flatListRef}
          data={photos}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(_, i) => `gallery-${i}`}
          getItemLayout={(_, index) => ({ length: SCREEN_W, offset: SCREEN_W * index, index })}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          renderItem={({ item }) => (
            <View style={galleryStyles.page}>
              <Image source={{ uri: item }} style={galleryStyles.fullImage} resizeMode="contain" />
            </View>
          )}
        />

        <Text style={galleryStyles.counter}>{currentIndex + 1} / {photos.length}</Text>

        {saveMenuOpen && (
          <View style={galleryStyles.saveMenu}>
            <TouchableOpacity
              style={galleryStyles.saveMenuItem}
              onPress={() => savePhotosToGallery([photos[currentIndex]])}
              activeOpacity={0.7}
            >
              <Text style={galleryStyles.saveMenuIcon}>📷</Text>
              <Text style={galleryStyles.saveMenuText}>Save this photo</Text>
            </TouchableOpacity>
            {photos.length > 1 && (
              <TouchableOpacity
                style={[galleryStyles.saveMenuItem, { borderBottomWidth: 0 }]}
                onPress={() => savePhotosToGallery(photos)}
                activeOpacity={0.7}
              >
                <Text style={galleryStyles.saveMenuIcon}>📦</Text>
                <Text style={galleryStyles.saveMenuText}>Save all ({photos.length})</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

const galleryStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center' },
  closeBtn: {
    position: 'absolute', top: 54, right: 20, zIndex: 10,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeText: { fontSize: 20, color: '#FFF', fontWeight: '600' },
  saveBtn: {
    position: 'absolute', bottom: 60, left: 20, zIndex: 10,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnIcon: { fontSize: 22, color: '#FFF', fontWeight: '700' },
  deleteBtn: {
    position: 'absolute', bottom: 60, right: 20, zIndex: 10,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  deleteBtnIcon: { width: 20, height: 20, tintColor: '#FFF' },
  page: { width: SCREEN_W, height: SCREEN_H, justifyContent: 'center', alignItems: 'center' },
  fullImage: { width: SCREEN_W - 20, height: SCREEN_H * 0.7 },
  counter: {
    position: 'absolute', bottom: 50, alignSelf: 'center',
    color: '#FFF', fontSize: 16, fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20,
  },
  saveMenu: {
    position: 'absolute', bottom: 110, left: 20, zIndex: 20,
    backgroundColor: 'rgba(40,40,40,0.95)', borderRadius: 14,
    minWidth: 200, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12,
  },
  saveMenuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  saveMenuIcon: { fontSize: 18, marginRight: 12 },
  saveMenuText: { fontSize: 15, color: '#FFF', fontWeight: '500' },
});

function getVideoThumbnailUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const u = url.trim();
  let id = null;
  const ytMatch = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) id = { type: 'youtube', id: ytMatch[1] };
  const vimeoMatch = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeoMatch) id = { type: 'vimeo', id: vimeoMatch[1] };
  if (!id) return null;
  if (id.type === 'youtube') return `https://img.youtube.com/vi/${id.id}/hqdefault.jpg`;
  if (id.type === 'vimeo') return `https://vumbnail.com/${id.id}.jpg`;
  return null;
}

function MediaSection({ photos, videos, t, onPhotoPress, onVideoPress }) {
  return (
    <SectionBlock color="rgba(168,230,163,0.35)" border="#A8E6A3">
      <Text style={styles.sectionTitle}>📷  {t('pdPhoto')}</Text>
      {photos.length > 0 ? (
        <FlatList
          data={photos}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(_, i) => `photo-${i}`}
          renderItem={({ item, index }) => (
            <TouchableOpacity onPress={() => onPhotoPress(index)} activeOpacity={0.85}>
              <Image source={{ uri: item }} style={styles.mediaThumb} resizeMode="cover" />
            </TouchableOpacity>
          )}
          style={styles.mediaList}
        />
      ) : (<Text style={styles.emptyMedia}>{t('pdNoPhotos')}</Text>)}
      <Text style={[styles.sectionTitle, { marginTop: 12 }]}>🎬  {t('pdVideo')}</Text>
      {videos.length > 0 ? (
        <FlatList
          data={videos}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(_, i) => `video-${i}`}
          renderItem={({ item }) => {
            const thumbUri = getVideoThumbnailUrl(item);
            return (
              <TouchableOpacity onPress={() => onVideoPress(item)} activeOpacity={0.7}>
                <View style={[styles.mediaThumb, styles.videoThumb]}>
                  {thumbUri ? (
                    <Image source={{ uri: thumbUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  ) : null}
                  <View style={styles.videoPlayOverlay}>
                    <Text style={styles.videoPlayIcon}>▶</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          style={styles.mediaList}
        />
      ) : (<Text style={styles.emptyMedia}>{t('pdNoVideos')}</Text>)}
    </SectionBlock>
  );
}

function HouseDetailContent({ p, t, typeColors, formatPrice, waterPriceLabel, onOwnerPress, onPhotoPress, onVideoPress }) {
  const amenities = p.amenities || {};
  const photos = Array.isArray(p.photos) ? p.photos : [];
  const videos = Array.isArray(p.videos) ? p.videos : [];
  const ownerName = p.ownerName || '';

  return (
    <>
      <SectionBlock color="rgba(255,204,0,0.2)" border="#FFCC00">
        <InfoRow label={t('propertyCode')} value={p.code} />
        <InfoRow label={t('pdCity')} value={p.city} />
        <InfoRow label={t('propDistrict')} value={p.district} />
        {p.google_maps_link ? (
          <InfoRow label={t('pdLocation')} value={t('pdGoogleMapLink')} isLink onPress={() => Linking.openURL(p.google_maps_link)} />
        ) : (
          <InfoRow label={t('pdLocation')} value="—" />
        )}
        <View style={styles.divider} />
        <View style={styles.twoColRow}>
          <InfoRow label={t('propBedrooms')} value={p.bedrooms != null ? `${p.bedrooms}  pc` : '—'} />
          <InfoRow label={t('propBeach')} value={p.beach_distance != null ? `${p.beach_distance}  m` : '—'} />
        </View>
        <View style={styles.twoColRow}>
          <InfoRow label={t('pdBathrooms')} value={p.bathrooms != null ? `${p.bathrooms}  pc` : '—'} />
          <InfoRow label={t('propMarket')} value={p.market_distance != null ? `${p.market_distance}  m` : '—'} />
        </View>
        <InfoRow label={t('pdArea')} value={p.area != null ? `${p.area}  m2` : '—'} />
        <View style={styles.divider} />
        <InfoRow label={t('pdOwner')} value={ownerName || '—'} isLink={!!ownerName} onPress={onOwnerPress} />
        {p.ownerPhone1 ? <InfoRow label={t('pdPhone') + ' 1'} value={p.ownerPhone1} /> : null}
        {p.ownerPhone2 ? <InfoRow label={t('pdPhone') + ' 2'} value={p.ownerPhone2} /> : null}
        {p.ownerTelegram ? <InfoRow label={t('telegram')} value={p.ownerTelegram} /> : null}
      </SectionBlock>

      <MediaSection photos={photos} videos={videos} t={t} onPhotoPress={onPhotoPress} onVideoPress={onVideoPress} />

      {p.description ? (
        <View style={styles.descriptionBlock}>
          <Text style={styles.sectionTitle}>📝  {t('pdDescription')}</Text>
          <Text style={styles.descriptionText}>{p.description}</Text>
        </View>
      ) : null}

      <SectionBlock color="rgba(187,222,251,0.5)" border="#64B5F6">
        <Text style={styles.sectionTitle}>📅  {t('pdBookingList')}</Text>
        <Text style={styles.emptyMedia}>{t('pdNoBookings')}</Text>
      </SectionBlock>

      <SectionBlock color="rgba(248,187,208,0.4)" border="#F48FB1">
        <Text style={styles.sectionTitle}>{t('pdAmenities')}</Text>
        <View style={styles.amenitiesGrid}>
          {AMENITY_KEYS.map((key) => (
            <View key={key} style={styles.amenityItem}>
              <Text style={styles.amenityCheck}>{amenities[key] ? '✅' : '⬜'}</Text>
              <Text style={styles.amenityLabel}>{t(`amenity_${key}`)}</Text>
            </View>
          ))}
        </View>
      </SectionBlock>

      <SectionBlock color="rgba(224,224,224,0.4)" border="#BDBDBD">
        <InfoRow label={t('pdAirCon')} value={p.air_conditioners != null ? `${p.air_conditioners}  pc` : '—'} />
        <InfoRow label={t('pdInternetSpeed')} value={p.internet_speed || '—'} />
      </SectionBlock>

      <SectionBlock color="rgba(224,224,224,0.4)" border="#BDBDBD">
        <InfoRow label={t('pdPets')} value={p.pets_allowed ? t('pdToBeDiscussed') : 'NO'} />
        <InfoRow label={t('pdLongTerm')} value={p.long_term_booking ? t('yes') : 'NO'} />
      </SectionBlock>

      <SectionBlock color="rgba(168,230,163,0.35)" border="#A8E6A3">
        <PriceRow icon="💰" label={t('pdPriceMonthly')} value={formatPrice(p.price_monthly)} />
        <PriceRow icon="💳" label={t('pdBookingDeposit')} value={formatPrice(p.booking_deposit)} />
        <PriceRow icon="🛡️" label={t('pdSaveDeposit')} value={formatPrice(p.save_deposit)} />
        <PriceRow icon="💼" label={t('pdCommission')} value={formatPrice(p.commission)} />
        <PriceRow icon="⚡" label={t('pdElectricity')} value={p.electricity_price != null ? `${p.electricity_price} Thb` : '—'} />
        <PriceRow icon="💧" label={waterPriceLabel()} value={p.water_price != null ? `${p.water_price} Thb` : '—'} />
        <PriceRow icon="🔥" label={t('pdGas')} value={p.gas_price != null ? `${p.gas_price} Thb` : '—'} />
        <PriceRow icon="📶" label={t('pdInternetMonth')} value={formatPrice(p.internet_price)} />
        <PriceRow icon="🧹" label={t('pdCleaning')} value={formatPrice(p.cleaning_price)} />
        <PriceRow icon="🧹" label={t('pdExitCleaning')} value={formatPrice(p.exit_cleaning_price)} />
      </SectionBlock>

      {p.comments ? (
        <View style={styles.descriptionBlock}>
          <Text style={styles.sectionTitle}>💬  {t('pdComments')}</Text>
          <Text style={styles.descriptionText}>{p.comments}</Text>
        </View>
      ) : null}
    </>
  );
}

function ResortDetailContent({ p, t, typeColors, onOwnerPress, onPhotoPress, onVideoPress }) {
  const photos = Array.isArray(p.photos) ? p.photos : [];
  const videos = Array.isArray(p.videos) ? p.videos : [];
  const ownerName = p.ownerName || '';
  const [resortHouses, setResortHouses] = useState([]);
  const [expandedHouseIds, setExpandedHouseIds] = useState(new Set());
  const [allHousesExpanded, setAllHousesExpanded] = useState(false);

  const loadResortHouses = useCallback(async () => {
    try {
      const all = await getProperties();
      setResortHouses(all.filter(h => h.resort_id === p.id));
    } catch {}
  }, [p.id]);

  useEffect(() => { loadResortHouses(); }, [loadResortHouses]);

  const toggleHouseExpand = (id) => {
    setExpandedHouseIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllHouses = () => {
    if (!allHousesExpanded) {
      setExpandedHouseIds(new Set(resortHouses.map(h => h.id)));
      setAllHousesExpanded(true);
    } else {
      setExpandedHouseIds(new Set());
      setAllHousesExpanded(false);
    }
  };

  return (
    <>
      <SectionBlock color="rgba(255,204,0,0.2)" border="#FFCC00">
        <InfoRow label={t('propertyCode')} value={p.code} />
        <InfoRow label={t('pdCity')} value={p.city} />
        <InfoRow label={t('propDistrict')} value={p.district} />
        {p.google_maps_link ? (
          <InfoRow label={t('pdLocation')} value={t('pdGoogleMapLink')} isLink onPress={() => Linking.openURL(p.google_maps_link)} />
        ) : (
          <InfoRow label={t('pdLocation')} value="—" />
        )}
        <View style={styles.divider} />
        <InfoRow label={t('propHouses')} value={p.houses_count != null ? `${p.houses_count}  pc` : '—'} />
        <InfoRow label={t('propBeach')} value={p.beach_distance != null ? `${p.beach_distance}  m` : '—'} />
        <InfoRow label={t('propMarket')} value={p.market_distance != null ? `${p.market_distance}  m` : '—'} />
        <View style={styles.divider} />
        <InfoRow label={t('pdOwnerManager')} value={ownerName || '—'} isLink={!!ownerName} onPress={onOwnerPress} />
        {p.ownerPhone1 ? <InfoRow label={t('pdPhone') + ' 1'} value={p.ownerPhone1} /> : null}
        {p.ownerPhone2 ? <InfoRow label={t('pdPhone') + ' 2'} value={p.ownerPhone2} /> : null}
        {p.ownerTelegram ? <InfoRow label={t('telegram')} value={p.ownerTelegram} /> : null}
      </SectionBlock>

      <MediaSection photos={photos} videos={videos} t={t} onPhotoPress={onPhotoPress} onVideoPress={onVideoPress} />

      {p.description ? (
        <View style={styles.descriptionBlock}>
          <Text style={styles.sectionTitle}>📝  {t('pdDescription')}</Text>
          <Text style={styles.descriptionText}>{p.description}</Text>
        </View>
      ) : null}

      <SectionBlock color="rgba(187,222,251,0.5)" border="#64B5F6">
        <Text style={styles.sectionTitle}>📅  {t('pdBookingList')}</Text>
        <Text style={styles.emptyMedia}>{t('pdNoBookings')}</Text>
      </SectionBlock>

      {/* Houses toolbar */}
      <View style={styles.housesToolbar}>
        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
          <Text style={styles.actionCalendar}>📅</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
          <Image source={require('../../assets/icon-add-property.png')} style={styles.actionIcon} resizeMode="contain" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} onPress={toggleAllHouses}>
          <Image
            source={allHousesExpanded ? require('../../assets/icon-folder-open.png') : require('../../assets/icon-folder-closed.png')}
            style={styles.actionIcon}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>

      {/* Resort houses list */}
      {resortHouses.length > 0 ? (
        resortHouses.map(h => (
          <ResortHouseItem
            key={h.id}
            item={h}
            expanded={expandedHouseIds.has(h.id)}
            onToggle={() => toggleHouseExpand(h.id)}
          />
        ))
      ) : (
        <Text style={styles.emptyHouses}>{t('pdNoHouses')}</Text>
      )}

      <SectionBlock color="rgba(224,224,224,0.4)" border="#BDBDBD">
        <InfoRow label={t('pdPets')} value={p.pets_allowed ? t('pdToBeDiscussed') : 'NO'} />
        <InfoRow label={t('pdLongTerm')} value={p.long_term_booking ? t('yes') : 'NO'} />
      </SectionBlock>

      {p.comments ? (
        <View style={styles.descriptionBlock}>
          <Text style={styles.sectionTitle}>💬  {t('pdComments')}</Text>
          <Text style={styles.descriptionText}>{p.comments}</Text>
        </View>
      ) : null}
    </>
  );
}

function CondoApartmentItem({ item, expanded, onToggle }) {
  const arrowAnim = useState(() => new Animated.Value(0))[0];

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
    <View style={[styles.resortHouseCard, { backgroundColor: '#BBDEFB', borderColor: '#64B5F6' }]}>
      <View style={styles.resortHouseRow}>
        <Image source={require('../../assets/icon-property-condo.png')} style={styles.resortHouseIcon} resizeMode="contain" />
        <Text style={styles.resortHouseName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.resortHouseCode}>{item.code}</Text>
        <TouchableOpacity onPress={onToggle} activeOpacity={0.5} style={styles.resortHouseExpandBtn}>
          <Animated.View style={{ transform: [{ rotate: arrowRotate }] }}>
            <Image source={require('../../assets/icon-arrow-down.png')} style={styles.resortHouseArrow} resizeMode="contain" />
          </Animated.View>
        </TouchableOpacity>
      </View>
      {expanded && (
        <View style={styles.resortHouseExpanded}>
          <InfoRow label="Bedrooms" value={item.bedrooms != null ? `${item.bedrooms}` : '—'} />
          <InfoRow label="Area" value={item.area != null ? `${item.area} m2` : '—'} />
        </View>
      )}
    </View>
  );
}

function CondoDetailContent({ p, t, typeColors, onOwnerPress, onPhotoPress, onVideoPress }) {
  const photos = Array.isArray(p.photos) ? p.photos : [];
  const videos = Array.isArray(p.videos) ? p.videos : [];
  const [apartments, setApartments] = useState([]);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [allExpanded, setAllExpanded] = useState(false);

  const loadApartments = useCallback(async () => {
    try {
      const all = await getProperties();
      setApartments(all.filter(a => a.resort_id === p.id));
    } catch {}
  }, [p.id]);

  useEffect(() => { loadApartments(); }, [loadApartments]);

  const toggleExpand = (id) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!allExpanded) {
      setExpandedIds(new Set(apartments.map(a => a.id)));
      setAllExpanded(true);
    } else {
      setExpandedIds(new Set());
      setAllExpanded(false);
    }
  };

  return (
    <>
      <SectionBlock color="rgba(255,204,0,0.2)" border="#FFCC00">
        <InfoRow label={t('propertyCode')} value={p.code} />
        <InfoRow label={t('pdCity')} value={p.city} />
        <InfoRow label={t('propDistrict')} value={p.district} />
        {p.google_maps_link ? (
          <InfoRow label={t('pdLocation')} value={t('pdGoogleMapLink')} isLink onPress={() => Linking.openURL(p.google_maps_link)} />
        ) : (
          <InfoRow label={t('pdLocation')} value="—" />
        )}
        <View style={styles.divider} />
        <InfoRow label={t('propFloors')} value={p.floors != null ? `${p.floors}` : '—'} />
        <InfoRow label={t('propBeach')} value={p.beach_distance != null ? `${p.beach_distance}  m` : '—'} />
        <InfoRow label={t('propMarket')} value={p.market_distance != null ? `${p.market_distance}  m` : '—'} />
        <View style={styles.divider} />
        <InfoRow label={t('pdReception')} value={p.ownerName || '—'} />
        {p.ownerPhone1 ? <InfoRow label={t('pdPhone') + ' 1'} value={p.ownerPhone1} /> : null}
        {p.ownerPhone2 ? <InfoRow label={t('pdPhone') + ' 2'} value={p.ownerPhone2} /> : null}
      </SectionBlock>

      <MediaSection photos={photos} videos={videos} t={t} onPhotoPress={onPhotoPress} onVideoPress={onVideoPress} />

      {p.description ? (
        <View style={styles.descriptionBlock}>
          <Text style={styles.sectionTitle}>📝  {t('pdDescription')}</Text>
          <Text style={styles.descriptionText}>{p.description}</Text>
        </View>
      ) : null}

      <SectionBlock color="rgba(187,222,251,0.5)" border="#64B5F6">
        <Text style={styles.sectionTitle}>📅  {t('pdBookingList')}</Text>
        <Text style={styles.emptyMedia}>{t('pdNoBookings')}</Text>
      </SectionBlock>

      <View style={styles.housesToolbar}>
        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
          <Text style={styles.actionCalendar}>📅</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
          <Image source={require('../../assets/icon-add-property.png')} style={styles.actionIcon} resizeMode="contain" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} onPress={toggleAll}>
          <Image
            source={allExpanded ? require('../../assets/icon-folder-open.png') : require('../../assets/icon-folder-closed.png')}
            style={styles.actionIcon}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>

      {apartments.length > 0 ? (
        apartments.map(a => (
          <CondoApartmentItem
            key={a.id}
            item={a}
            expanded={expandedIds.has(a.id)}
            onToggle={() => toggleExpand(a.id)}
          />
        ))
      ) : (
        <Text style={styles.emptyHouses}>{t('pdNoApartments')}</Text>
      )}

      <SectionBlock color="rgba(224,224,224,0.4)" border="#BDBDBD">
        <InfoRow label={t('pdPets')} value={p.pets_allowed ? t('pdToBeDiscussed') : 'NO'} />
        <InfoRow label={t('pdLongTerm')} value={p.long_term_booking ? t('yes') : 'NO'} />
      </SectionBlock>

      {p.comments ? (
        <View style={styles.descriptionBlock}>
          <Text style={styles.sectionTitle}>💬  {t('pdComments')}</Text>
          <Text style={styles.descriptionText}>{p.comments}</Text>
        </View>
      ) : null}
    </>
  );
}

export default function PropertyDetailScreen({ property, onBack, onDelete, onPropertyUpdated }) {
  const { t } = useLanguage();
  const [p, setP] = useState(property);
  const [wizardVisible, setWizardVisible] = useState(false);
  const [ownerContact, setOwnerContact] = useState(null);
  const [showOwner, setShowOwner] = useState(false);

  const loadOwnerData = useCallback(async (prop) => {
    if (!prop.owner_id) {
      setP(prev => ({ ...prev, ownerName: '', ownerPhone1: '', ownerPhone2: '', ownerTelegram: '' }));
      setOwnerContact(null);
      return;
    }
    try {
      const owners = await getContacts('owners');
      const owner = owners.find(o => o.id === prop.owner_id);
      if (owner) {
        setOwnerContact(owner);
        setP(prev => ({
          ...prev,
          ownerName: `${owner.name} ${owner.lastName}`.trim(),
          ownerPhone1: owner.phone || '',
          ownerPhone2: owner.extraPhones?.[0] || '',
          ownerTelegram: owner.telegram || '',
        }));
      }
    } catch {}
  }, []);

  useEffect(() => {
    setP(property);
    loadOwnerData(property);
  }, [property, loadOwnerData]);

  const typeColors = BLOCK_COLORS[p.type] || BLOCK_COLORS.house;

  const formatPrice = (val) => {
    if (val == null) return '—';
    return Number(val).toLocaleString('en-US').replace(/,/g, ' ') + ' Thb';
  };

  const waterPriceLabel = () => {
    const base = t('pdWater');
    if (p.water_price_type === 'cubic') return base + ' / ' + t('pdPerCubic');
    if (p.water_price_type === 'person') return base + ' / ' + t('pdPerPerson');
    if (p.water_price_type === 'fixed') return base + ' / ' + t('pdFixed');
    return base;
  };

  const handleOwnerPress = () => {
    if (ownerContact) setShowOwner(true);
  };

  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const allPhotos = Array.isArray(p.photos) ? p.photos : [];

  const handlePhotoPress = (index) => {
    setGalleryIndex(index);
    setGalleryVisible(true);
  };

  const handlePhotoDelete = async (newPhotos, deletedUrl) => {
    if (newPhotos.length === 0) {
      setGalleryVisible(false);
    } else {
      setGalleryIndex(Math.min(galleryIndex, newPhotos.length - 1));
    }
    try {
      await deletePhotoFromStorage(deletedUrl);
      const updated = await updateProperty(p.id, { photos: newPhotos });
      setP(prev => ({ ...prev, ...updated }));
      onPropertyUpdated?.();
    } catch (e) {
      Alert.alert(t('error') || 'Error', e.message || 'Failed to delete');
    }
  };

  const handleVideoPress = (url) => {
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Cannot open link'));
  };

  const handleWizardSave = async (updates) => {
    try {
      const oldPhotos = Array.isArray(p.photos) ? p.photos : [];
      const newPhotos = Array.isArray(updates.photos) ? updates.photos : [];
      for (const url of oldPhotos) {
        if (!newPhotos.includes(url)) {
          await deletePhotoFromStorage(url);
        }
      }
      const updated = await updateProperty(p.id, updates);
      const merged = { ...p, ...updated };
      setP(merged);
      setWizardVisible(false);
      loadOwnerData(merged);
      onPropertyUpdated?.();
    } catch (e) {
      throw e;
    }
  };

  if (showOwner && ownerContact) {
    return (
      <ContactDetailScreen
        contact={ownerContact}
        onBack={() => setShowOwner(false)}
        onContactUpdated={() => loadOwnerData(p)}
        onContactDeleted={() => { setShowOwner(false); setOwnerContact(null); }}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{p.name}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={onDelete} activeOpacity={0.7}>
            <Image source={require('../../assets/trash-icon.png')} style={styles.actionIcon} resizeMode="contain" />
          </TouchableOpacity>
          <View style={styles.actionsRight}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => setWizardVisible(true)} activeOpacity={0.7}>
              <Image source={require('../../assets/pencil-icon.png')} style={styles.actionIcon} resizeMode="contain" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
              {(p.type === 'resort' || p.type === 'condo') ? (
                <Image source={require('../../assets/icon-add-property.png')} style={styles.actionIcon} resizeMode="contain" />
              ) : (
                <Text style={styles.actionCalendar}>📅+</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {p.type === 'resort' ? (
          <ResortDetailContent p={p} t={t} typeColors={typeColors} onOwnerPress={handleOwnerPress} onPhotoPress={handlePhotoPress} onVideoPress={handleVideoPress} />
        ) : p.type === 'condo' ? (
          <CondoDetailContent p={p} t={t} typeColors={typeColors} onOwnerPress={handleOwnerPress} onPhotoPress={handlePhotoPress} onVideoPress={handleVideoPress} />
        ) : (
          <HouseDetailContent p={p} t={t} typeColors={typeColors} formatPrice={formatPrice} waterPriceLabel={waterPriceLabel} onOwnerPress={handleOwnerPress} onPhotoPress={handlePhotoPress} onVideoPress={handleVideoPress} />
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <PhotoGalleryModal
        visible={galleryVisible}
        photos={allPhotos}
        initialIndex={galleryIndex}
        onClose={() => setGalleryVisible(false)}
        onDeletePhoto={handlePhotoDelete}
        t={t}
      />

      <PropertyEditWizard
        visible={wizardVisible}
        property={p}
        onClose={() => setWizardVisible(false)}
        onSave={handleWizardSave}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F2EB',
    paddingTop: TOP_INSET,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 32,
    color: '#2C2C2C',
    fontWeight: '300',
    marginTop: -4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2C2C2C',
    flex: 1,
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  actionsRight: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(245,242,235,0.9)',
    borderWidth: 1,
    borderColor: '#E0D8CC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    width: 20,
    height: 20,
  },
  actionCalendar: {
    fontSize: 18,
  },
  sectionBlock: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2C2C2C',
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 10,
    flex: 1,
  },
  infoLabel: {
    fontSize: 13,
    color: '#2C2C2C',
    width: 120,
  },
  infoColon: {
    fontSize: 13,
    color: '#6B6B6B',
    marginRight: 8,
  },
  infoValueWrap: {
    flex: 1,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2C2C2C',
    flex: 1,
    textAlign: 'right',
  },
  infoLink: {
    color: '#D81B60',
    textDecorationLine: 'underline',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginVertical: 10,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 8,
  },
  mediaList: {
    marginBottom: 4,
  },
  mediaThumb: {
    width: 100,
    height: 80,
    borderRadius: 10,
    marginRight: 8,
    backgroundColor: '#DDD',
  },
  videoThumb: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#333',
    overflow: 'hidden',
  },
  videoPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  videoPlayIcon: {
    fontSize: 28,
    color: '#FFF',
  },
  emptyMedia: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
  },
  descriptionBlock: {
    marginBottom: 12,
    padding: 14,
  },
  descriptionText: {
    fontSize: 14,
    color: '#2C2C2C',
    lineHeight: 20,
  },
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  amenityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '50%',
    marginBottom: 6,
  },
  amenityCheck: {
    fontSize: 14,
    marginRight: 6,
  },
  amenityLabel: {
    fontSize: 13,
    color: '#2C2C2C',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  priceIcon: {
    fontSize: 16,
    width: 26,
  },
  priceLabel: {
    fontSize: 13,
    color: '#6B6B6B',
    flex: 1,
  },
  priceValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2C2C2C',
    textAlign: 'right',
  },
  housesToolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginBottom: 10,
  },
  resortHouseCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 8,
    overflow: 'hidden',
  },
  resortHouseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  resortHouseIcon: {
    width: 28,
    height: 28,
    marginRight: 10,
  },
  resortHouseName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#2C2C2C',
  },
  resortHouseCode: {
    fontSize: 13,
    fontWeight: '700',
    color: '#D81B60',
    marginRight: 10,
  },
  resortHouseExpandBtn: {
    paddingVertical: 6,
    paddingLeft: 10,
    paddingRight: 4,
  },
  resortHouseArrow: {
    width: 12,
    height: 12,
    tintColor: '#888888',
  },
  resortHouseExpanded: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
    paddingTop: 8,
  },
  emptyHouses: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 12,
  },
});
