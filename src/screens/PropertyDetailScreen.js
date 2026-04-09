import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
  FlatList,
  Animated,
  Alert,
  Modal,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  Image as RNImage,
} from 'react-native';
import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import Constants from 'expo-constants';
import { useLanguage } from '../context/LanguageContext';
import { getCurrencySymbol } from '../utils/currency';
import { useAppData } from '../context/AppDataContext';
import { getProperties, updateProperty, createProperty, deleteProperty, updateResortChildrenDistrict, updatePropertyResponsible, submitPropertyDraft, getPropertyDraft, getPropertyRejectionHistory, approveProperty, rejectProperty, approvePropertyDraft, rejectPropertyDraft } from '../services/propertiesService';
import { supabase } from '../services/supabase';
import { sendNotification } from '../services/notificationsService';
import { getActiveTeamMembers } from '../services/companyService';
import { deletePhotoFromStorage } from '../services/storageService';
import { getContacts } from '../services/contactsService';
import { getBookings, deleteBooking, updateBooking } from '../services/bookingsService';
import { cancelBookingReminders } from '../services/bookingRemindersService';
import PropertyEditWizard from '../components/PropertyEditWizard';
import AddBookingModal from '../components/AddBookingModal';
import PropertyBookingCalendarModal from '../components/PropertyBookingCalendarModal';
import ContactDetailScreen from './ContactDetailScreen';
import BookingDetailScreen from './BookingDetailScreen';

const TOP_INSET = (Constants.statusBarHeight ?? 44) + 12;

/** Sort houses/apartments by internal code: numbers ascending (30,35,37), letters alphabetically */
function sortByInternalCode(items) {
  const key = (x) => String(x?.code_suffix ?? x?.code ?? '').trim();
  return [...items].sort((a, b) => {
    const sa = key(a);
    const sb = key(b);
    const aNum = parseFloat(sa);
    const bNum = parseFloat(sb);
    const aDigit = /^\d/.test(sa);
    const bDigit = /^\d/.test(sb);
    if (aDigit && bDigit) {
      if (aNum !== bNum) return aNum - bNum;
      return sa.localeCompare(sb);
    }
    if (aDigit && !bDigit) return -1;
    if (!aDigit && bDigit) return 1;
    return sa.localeCompare(sb);
  });
}

const BLOCK_COLORS = {
  resort: { bg: 'rgba(168,230,163,0.7)', border: '#A8E6A3' },
  house:  { bg: '#FFF9C4', border: '#FFD54F' },
  condo:  { bg: '#BBDEFB', border: '#64B5F6' },
};

const BOOKABLE_UNIT_TYPES = new Set(['house', 'resort_house', 'condo_apartment']);

const AMENITY_KEYS = [
  'swimming_pool', 'gym', 'parking', 'internet', 'tv', 'washing_machine',
  'dishwasher', 'fridge', 'stove', 'oven', 'hood', 'microwave',
  'kettle', 'toaster', 'coffee_machine', 'multi_cooker', 'blender',
];

const AMENITY_ICON_SOURCES = {
  swimming_pool: require('../../assets/icon-amenity-parking.png'),      // file had pool img
  gym: require('../../assets/icon-amenity-gym.png'),
  parking: require('../../assets/icon-amenity-internet.png'),           // file had P img
  internet: require('../../assets/icon-amenity-swimming_pool.png'),     // file had wifi img
  tv: require('../../assets/icon-amenity-fridge.png'),                  // file had TV img
  washing_machine: require('../../assets/icon-amenity-washing_machine.png'),
  dishwasher: require('../../assets/icon-amenity-dishwasher.png'),
  fridge: require('../../assets/icon-amenity-tv.png'),                  // file had fridge img
  stove: require('../../assets/icon-amenity-stove.png'),
  oven: require('../../assets/icon-amenity-hood.png'),                  // file had oven img
  hood: require('../../assets/icon-amenity-oven.png'),                  // file had hood img
  microwave: require('../../assets/icon-amenity-microwave.png'),
  kettle: require('../../assets/icon-amenity-blender.png'),             // file had kettle img
  toaster: require('../../assets/icon-amenity-toaster.png'),
  coffee_machine: require('../../assets/icon-amenity-coffee_machine.png'),
  multi_cooker: require('../../assets/icon-amenity-multi_cooker.png'),
  blender: require('../../assets/icon-amenity-kettle.png'),             // file had blender img
};

function SectionBlock({ color, border, children }) {
  return (
    <View style={[styles.sectionBlock, { backgroundColor: color, borderColor: border }]}>
      {children}
    </View>
  );
}

function InfoRow({ label, value, isLink, onPress, style, labelBold }) {
  return (
    <View style={[styles.infoRow, style]}>
      <Text style={[styles.infoLabel, labelBold && styles.infoLabelBold]} numberOfLines={1}>{label}</Text>
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

function PriceRow({ icon, iconSource, label, value, prefix }) {
  const displayValue = value ? (prefix ? `${prefix} ${value}` : value) : '—';
  return (
    <View style={styles.priceRow}>
      {iconSource ? (
        <Image source={iconSource} style={styles.priceIconImg} resizeMode="contain" />
      ) : (
        <Text style={styles.priceIcon}>{icon}</Text>
      )}
      <Text style={styles.priceLabel}>{label}</Text>
      <Text style={styles.priceValue}>{displayValue}</Text>
    </View>
  );
}

function ResortHouseItem({ item, expanded, onToggle, resortCode, onPress, t }) {
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

  const codeDisplay = (resortCode != null ? resortCode : item.code) + (item.code_suffix ? ` (${item.code_suffix})` : '');
  const isPending = item.property_status === 'pending';
  const isRejected = item.property_status === 'rejected';
  const isInReview = isPending || isRejected;

  return (
    <View
      style={
        isInReview
          ? [styles.resortHouseCard, styles.childCardInReview, { borderLeftColor: '#A8E6A3' }]
          : [styles.resortHouseCard, { backgroundColor: 'rgba(168,230,163,0.7)', borderColor: '#A8E6A3' }]
      }
    >
      <View style={styles.resortHouseRow}>
        <TouchableOpacity
          style={styles.resortHouseMainArea}
          onPress={onPress}
          activeOpacity={onPress ? 0.7 : 1}
          disabled={!onPress}
        >
          <RNImage source={require('../../assets/icon-property-resort.png')} style={styles.resortHouseIcon} resizeMode="contain" />
          <Text style={styles.resortHouseName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.resortHouseCode}>{codeDisplay}</Text>
        </TouchableOpacity>
        {isInReview && (
          <View style={[styles.childStatusBadge, isRejected ? styles.childStatusBadgeRejected : styles.childStatusBadgePending]}>
            <Text style={[styles.childStatusBadgeText, isRejected ? styles.childStatusBadgeTextRejected : styles.childStatusBadgeTextPending]}>
              {isPending ? t('statusPending') : t('statusRejected')}
            </Text>
          </View>
        )}
        <TouchableOpacity onPress={onToggle} activeOpacity={0.5} style={styles.resortHouseExpandBtn}>
          <Animated.View style={{ transform: [{ rotate: arrowRotate }] }}>
            <RNImage source={require('../../assets/icon-arrow-down.png')} style={styles.resortHouseArrow} resizeMode="contain" />
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
          <RNImage source={require('../../assets/trash-icon.png')} style={galleryStyles.deleteBtnIcon} resizeMode="contain" />
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
              <Image source={{ uri: item }} style={galleryStyles.fullImage} contentFit="contain" cachePolicy="disk" />
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
      <View style={styles.sectionTitleRow}>
        <RNImage source={require('../../assets/icon-photo.png')} style={styles.sectionTitleIcon} resizeMode="contain" />
        <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{t('pdPhoto')}</Text>
      </View>
      {photos.length > 0 ? (
        <FlatList
          data={photos}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(_, i) => `photo-${i}`}
          renderItem={({ item, index }) => (
            <TouchableOpacity onPress={() => onPhotoPress(index)} activeOpacity={0.85}>
              <Image source={{ uri: item }} style={styles.mediaThumb} contentFit="cover" cachePolicy="disk" />
            </TouchableOpacity>
          )}
          style={styles.mediaList}
        />
      ) : (<Text style={styles.emptyMedia}>{t('pdNoPhotos')}</Text>)}
      <View style={[styles.sectionTitleRow, { marginTop: 12 }]}>
        <RNImage source={require('../../assets/icon-video.png')} style={styles.sectionTitleIcon} resizeMode="contain" />
        <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{t('pdVideo')}</Text>
      </View>
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
                    <Image source={{ uri: thumbUri }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" />
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

function formatBookingDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const y = d.getFullYear();
  return `${day}.${m}.${y}`;
}

/** Booking number: sequence within year, e.g. 1/26, 2/26. Year from check_in. */
function getBookingNumber(booking, allBookings) {
  const year = new Date(booking.checkIn).getFullYear();
  const yearShort = year % 100;
  const sameYear = allBookings
    .filter(x => new Date(x.checkIn).getFullYear() === year)
    .sort((a, b) => new Date(a.createdAt || a.checkIn) - new Date(b.createdAt || b.checkIn));
  const idx = sameYear.findIndex(x => x.id === booking.id);
  const seq = idx >= 0 ? idx + 1 : 0;
  return `${seq}/${String(yearShort).padStart(2, '0')}`;
}

function HouseDetailContent({ p, t, typeColors, formatPrice, waterPriceLabel, onOwnerPress, onOwner2Press, onPhotoPress, onVideoPress, resort, refreshBookingsTrigger, onBookingPress, onOpenBookingCalendar, hideLocation, responsibleName }) {
  const amenities = p.amenities || {};
  const [bookings, setBookings] = useState([]);

  const loadBookings = useCallback(async () => {
    try {
      const data = await getBookings(p.id);
      setBookings(data);
    } catch {}
  }, [p.id]);

  useEffect(() => { loadBookings(); }, [loadBookings]);
  useEffect(() => { if (refreshBookingsTrigger > 0) loadBookings(); }, [refreshBookingsTrigger, loadBookings]);
  const photos = Array.isArray(p.photos) ? p.photos : [];
  const videos = Array.isArray(p.videos) ? p.videos : [];
  const ownerName = p.ownerName || '';
  const owner2Name = p.owner2Name || '';
  const isApartment = resort?.type === 'condo';
  const beachDistance = p.beach_distance ?? resort?.beach_distance;
  const marketDistance = p.market_distance ?? resort?.market_distance;
  const city = p.city ?? resort?.city;
  const district = p.district ?? resort?.district;
  const googleMapsLink = p.google_maps_link || resort?.google_maps_link;
  const codeDisplay = resort
    ? (resort.code || '') + (p.code_suffix ? ` (${p.code_suffix})` : '')
    : p.code;

  return (
    <>
      <SectionBlock color="rgba(255,204,0,0.2)" border="#FFCC00">
        <InfoRow label={t('propertyCode')} value={codeDisplay} labelBold />
        <InfoRow label={t('pdCity')} value={city} labelBold />
        <InfoRow label={t('propDistrict')} value={district} labelBold />
        {!hideLocation && (googleMapsLink ? (
          <InfoRow label={t('pdLocation')} value={t('pdGoogleMapLink')} isLink onPress={() => Linking.openURL(googleMapsLink)} labelBold />
        ) : (
          <InfoRow label={t('pdLocation')} value="—" labelBold />
        ))}
        {p.website_url ? (
          <InfoRow
            label={t('propertyWebPage')}
            value={t('goToWebsite')}
            isLink
            onPress={() => Linking.openURL((p.website_url || '').replace(/^(?!https?:\/\/)/, 'https://'))}
            labelBold
          />
        ) : null}
        <View style={styles.divider} />
        <InfoRow label={t('propBedrooms')} value={p.bedrooms != null ? `${p.bedrooms}  pc` : '—'} labelBold />
        <InfoRow label={t('pdBathrooms')} value={p.bathrooms != null ? `${p.bathrooms}  pc` : '—'} labelBold />
        <InfoRow label={t('pdArea')} value={p.area != null ? `${p.area}  m2` : '—'} labelBold />
        {isApartment && p.floor_number != null && (
          <InfoRow label={t('propFloorNumber')} value={String(p.floor_number)} labelBold />
        )}
        <InfoRow label={t('propBeach')} value={beachDistance != null ? `${beachDistance}  m` : '—'} labelBold />
        <InfoRow label={t('propMarket')} value={marketDistance != null ? `${marketDistance}  m` : '—'} labelBold />
        <View style={styles.divider} />
        <InfoRow label={isApartment ? t('pdReception') : t('pdOwner')} value={ownerName || '—'} isLink={!!ownerName} onPress={onOwnerPress} labelBold />
        {p.ownerPhone1 ? <InfoRow label={t('pdPhone') + ' 1'} value={p.ownerPhone1} labelBold /> : null}
        {p.ownerPhone2 ? <InfoRow label={t('pdPhone') + ' 2'} value={p.ownerPhone2} labelBold /> : null}
        {p.ownerTelegram ? <InfoRow label={t('telegram')} value={p.ownerTelegram} labelBold /> : null}
        {isApartment && (p.owner2Name || p.owner2Phone1 || p.owner2Phone2 || p.owner2Telegram) ? (
          <>
            <View style={styles.divider} />
            <InfoRow label={t('pdOwnerContact')} value={owner2Name || '—'} isLink={!!owner2Name} onPress={onOwner2Press} labelBold />
            {p.owner2Phone1 ? <InfoRow label={t('pdPhone') + ' 1'} value={p.owner2Phone1} labelBold /> : null}
            {p.owner2Phone2 ? <InfoRow label={t('pdPhone') + ' 2'} value={p.owner2Phone2} labelBold /> : null}
            {p.owner2Telegram ? <InfoRow label={t('telegram')} value={p.owner2Telegram} labelBold /> : null}
          </>
        ) : null}
        {responsibleName !== undefined && (
          <>
            <View style={styles.divider} />
            <InfoRow label={t('propResponsibleLabel').replace(':', '')} value={responsibleName} labelBold />
          </>
        )}
      </SectionBlock>

      <MediaSection photos={photos} videos={videos} t={t} onPhotoPress={onPhotoPress} onVideoPress={onVideoPress} />

      {p.description ? (
        <View style={styles.descriptionBlock}>
          <View style={styles.sectionTitleRow}>
            <RNImage source={require('../../assets/icon-description.png')} style={styles.sectionTitleIcon} resizeMode="contain" />
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{t('pdDescription')}</Text>
          </View>
          <Text style={styles.descriptionText}>{p.description}</Text>
        </View>
      ) : null}

      <SectionBlock color="rgba(187,222,251,0.5)" border="#64B5F6">
        <View style={[styles.sectionTitleRow, styles.bookingListHeaderRow]}>
            <View style={styles.sectionTitleLeft}>
              <RNImage source={require('../../assets/icon-booking.png')} style={styles.sectionTitleIcon} resizeMode="contain" />
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{t('pdBookingList')}</Text>
            </View>
            {onOpenBookingCalendar && (
              <TouchableOpacity onPress={() => onOpenBookingCalendar([p.id], resort ? codeDisplay : (p.name || p.code || ''))} style={styles.calendarLinkRow} activeOpacity={0.7}>
                <RNImage source={require('../../assets/icon-calendar-booking.png')} style={styles.calendarIcon} resizeMode="contain" />
              </TouchableOpacity>
            )}
          </View>
        {bookings.length > 0 ? (
          bookings.map((b) => {
            const bookingNum = getBookingNumber(b, bookings);
            const codePart = `${codeDisplay} ${bookingNum}`;
            return (
              <TouchableOpacity
                key={b.id}
                style={styles.bookingItem}
                onPress={onBookingPress ? () => onBookingPress(b, codePart, p) : undefined}
                activeOpacity={onBookingPress ? 0.7 : 1}
              >
                <RNImage source={require('../../assets/icon-booking-hashtag.png')} style={styles.bookingItemIcon} resizeMode="contain" />
                <Text style={styles.bookingItemCode} numberOfLines={1}>{codePart}</Text>
                <Text style={styles.bookingItemDates}>
                  {formatBookingDate(b.checkIn)} — {formatBookingDate(b.checkOut)}
                </Text>
              </TouchableOpacity>
            );
          })
        ) : (
          <Text style={styles.emptyMedia}>{t('pdNoBookings')}</Text>
        )}
      </SectionBlock>

      <SectionBlock color="rgba(248,187,208,0.4)" border="#F48FB1">
        <View style={styles.sectionTitleRow}>
          <RNImage source={require('../../assets/icon-amenities.png')} style={styles.sectionTitleIcon} resizeMode="contain" />
          <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{t('pdAmenities')}</Text>
        </View>
        <View style={styles.amenitiesGrid}>
          {AMENITY_KEYS.filter((key) => amenities[key]).map((key) => (
            <View key={key} style={styles.amenityItem}>
              <Image source={AMENITY_ICON_SOURCES[key]} style={styles.amenityIconImg} resizeMode="contain" />
              <Text style={styles.amenityLabel}>{t(`amenity_${key}`)}</Text>
            </View>
          ))}
        </View>
        {!AMENITY_KEYS.some((key) => amenities[key]) && (
          <Text style={styles.amenityEmpty}>—</Text>
        )}
      </SectionBlock>

      <SectionBlock color="rgba(224,224,224,0.4)" border="#BDBDBD">
        <InfoRow label={t('pdAirCon')} value={p.air_conditioners != null ? `${p.air_conditioners}  pc` : '—'} labelBold />
        <InfoRow label={t('pdInternetSpeed')} value={p.internet_speed ? `${p.internet_speed} ${t('pdInternetSpeedUnit')}` : '—'} labelBold />
      </SectionBlock>

      <SectionBlock color="rgba(224,224,224,0.4)" border="#BDBDBD">
        <View style={styles.sectionBlockGap}>
          <InfoRow label={t('pdPets')} value={p.pets_allowed ? t('pdToBeDiscussed') : 'NO'} style={styles.infoRowNoMargin} labelBold />
          <InfoRow label={t('pdLongTerm')} value={p.long_term_booking ? t('yes') : 'NO'} style={styles.infoRowNoMargin} labelBold />
        </View>
      </SectionBlock>

      {[p.price_monthly, p.booking_deposit, p.save_deposit, p.commission, p.owner_commission_one_time, p.owner_commission_monthly, p.electricity_price, p.water_price, p.gas_price, p.internet_price, p.cleaning_price, p.exit_cleaning_price].some(v => v != null) && (
      <SectionBlock color="rgba(168,230,163,0.35)" border="#A8E6A3">
        {p.price_monthly != null && <PriceRow iconSource={require('../../assets/icon-price-booking-deposit.png')} label={t('pdPriceMonthly')} value={formatPrice(p.price_monthly)} prefix={p.price_monthly_is_from ? t('priceFrom') : null} />}
        {p.booking_deposit != null && <PriceRow iconSource={require('../../assets/icon-price-monthly.png')} label={t('pdBookingDeposit')} value={formatPrice(p.booking_deposit)} prefix={p.booking_deposit_is_from ? t('priceFrom') : null} />}
        {p.save_deposit != null && <PriceRow iconSource={require('../../assets/icon-price-commission.png')} label={t('pdSaveDeposit')} value={formatPrice(p.save_deposit)} prefix={p.save_deposit_is_from ? t('priceFrom') : null} />}
        {p.commission != null && <PriceRow iconSource={require('../../assets/icon-price-save-deposit.png')} label={t('pdCommission')} value={formatPrice(p.commission)} prefix={p.commission_is_from ? t('priceFrom') : null} />}
        {p.owner_commission_one_time != null && (
          <PriceRow
            iconSource={require('../../assets/icon-price-commission.png')}
            label={t('pdOwnerCommOnce')}
            value={p.owner_commission_one_time_is_percent ? `${p.owner_commission_one_time}%` : formatPrice(p.owner_commission_one_time)}
          />
        )}
        {p.owner_commission_monthly != null && (
          <PriceRow
            iconSource={require('../../assets/icon-price-commission.png')}
            label={t('pdOwnerCommMonthly')}
            value={p.owner_commission_monthly_is_percent ? `${p.owner_commission_monthly}%` : formatPrice(p.owner_commission_monthly)}
          />
        )}
        {p.electricity_price != null && <PriceRow iconSource={require('../../assets/icon-price-electricity.png')} label={t('pdElectricity')} value={formatPrice(p.electricity_price)} />}
        {p.water_price != null && <PriceRow iconSource={require('../../assets/icon-price-water.png')} label={waterPriceLabel()} value={formatPrice(p.water_price)} />}
        {p.gas_price != null && <PriceRow iconSource={require('../../assets/icon-price-gas.png')} label={t('pdGas')} value={formatPrice(p.gas_price)} />}
        {p.internet_price != null && <PriceRow iconSource={require('../../assets/icon-price-exit-cleaning.png')} label={t('pdInternetMonth')} value={formatPrice(p.internet_price)} />}
        {p.cleaning_price != null && <PriceRow iconSource={require('../../assets/icon-price-internet.png')} label={t('pdCleaning')} value={formatPrice(p.cleaning_price)} />}
        {p.exit_cleaning_price != null && <PriceRow iconSource={require('../../assets/icon-price-cleaning.png')} label={t('pdExitCleaning')} value={formatPrice(p.exit_cleaning_price)} />}
      </SectionBlock>
      )}

      {p.comments ? (
        <View style={styles.descriptionBlock}>
          <Text style={styles.sectionTitle}>💬  {t('pdComments')}</Text>
          <Text style={styles.descriptionText}>{p.comments}</Text>
        </View>
      ) : null}
    </>
  );
}

function ResortDetailContent({ p, t, typeColors, onOwnerPress, onPhotoPress, onVideoPress, refreshResortHousesTrigger, refreshBookingsTrigger, newHouseIdToExpand, onExpandedNewHouse, onHousePress, onBookingPress, onOpenBookingCalendar, hideLocation, responsibleName }) {
  const photos = Array.isArray(p.photos) ? p.photos : [];
  const videos = Array.isArray(p.videos) ? p.videos : [];
  const ownerName = p.ownerName || '';
  const [resortHouses, setResortHouses] = useState([]);
  const [aggregatedBookings, setAggregatedBookings] = useState([]);
  const [expandedHouseIds, setExpandedHouseIds] = useState(new Set());
  const [allHousesExpanded, setAllHousesExpanded] = useState(false);

  const loadResortHouses = useCallback(async () => {
    try {
      const all = await getProperties();
      setResortHouses(sortByInternalCode(all.filter(h => h.resort_id === p.id)));
    } catch {}
  }, [p.id]);

  const loadAggregatedBookings = useCallback(async () => {
    if (resortHouses.length === 0) { setAggregatedBookings([]); return; }
    try {
      const childIds = resortHouses.map(h => h.id);
      const all = await getBookings();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const byProp = {};
      all.filter(b => childIds.includes(b.propertyId)).forEach((b) => {
        if (!byProp[b.propertyId]) byProp[b.propertyId] = [];
        byProp[b.propertyId].push(b);
      });
      const active = all
        .filter(b => childIds.includes(b.propertyId) && new Date(b.checkOut) >= today)
        .sort((a, b) => new Date(a.checkIn) - new Date(b.checkIn));
      setAggregatedBookings(active.map((b) => {
        const house = resortHouses.find(h => h.id === b.propertyId);
        const codeDisplay = (p.code || '') + (house?.code_suffix ? ` (${house.code_suffix})` : '');
        const bookingNum = getBookingNumber(b, byProp[b.propertyId] || []);
        return { ...b, _codePart: `${codeDisplay} ${bookingNum}` };
      }));
    } catch { setAggregatedBookings([]); }
  }, [p.id, p.code, resortHouses]);

  useEffect(() => { loadResortHouses(); }, [loadResortHouses]);
  useEffect(() => { if (refreshResortHousesTrigger > 0) loadResortHouses(); }, [refreshResortHousesTrigger, loadResortHouses]);
  useEffect(() => { loadAggregatedBookings(); }, [loadAggregatedBookings]);
  useEffect(() => { if (refreshBookingsTrigger > 0) loadAggregatedBookings(); }, [refreshBookingsTrigger, loadAggregatedBookings]);
  useEffect(() => {
    if (newHouseIdToExpand && resortHouses.some(h => h.id === newHouseIdToExpand)) {
      setExpandedHouseIds(prev => new Set([...prev, newHouseIdToExpand]));
      onExpandedNewHouse?.();
    }
  }, [newHouseIdToExpand, resortHouses, onExpandedNewHouse]);

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
        <InfoRow label={t('propertyCode')} value={p.code} labelBold />
        <InfoRow label={t('pdCity')} value={p.city} labelBold />
        <InfoRow label={t('propDistrict')} value={p.district} labelBold />
        {!hideLocation && (p.google_maps_link ? (
          <InfoRow label={t('pdLocation')} value={t('pdGoogleMapLink')} isLink onPress={() => Linking.openURL(p.google_maps_link)} labelBold />
        ) : (
          <InfoRow label={t('pdLocation')} value="—" labelBold />
        ))}
        <View style={styles.divider} />
        <InfoRow label={t('propHouses')} value={p.houses_count != null ? `${p.houses_count}  pc` : '—'} labelBold />
        <InfoRow label={t('propBeach')} value={p.beach_distance != null ? `${p.beach_distance}  m` : '—'} labelBold />
        <InfoRow label={t('propMarket')} value={p.market_distance != null ? `${p.market_distance}  m` : '—'} labelBold />
        <View style={styles.divider} />
        <InfoRow label={t('pdOwnerManager')} value={ownerName || '—'} isLink={!!ownerName} onPress={onOwnerPress} labelBold />
        {p.ownerPhone1 ? <InfoRow label={t('pdPhone') + ' 1'} value={p.ownerPhone1} labelBold /> : null}
        {p.ownerPhone2 ? <InfoRow label={t('pdPhone') + ' 2'} value={p.ownerPhone2} labelBold /> : null}
        {p.ownerTelegram ? <InfoRow label={t('telegram')} value={p.ownerTelegram} labelBold /> : null}
        {responsibleName !== undefined && (
          <>
            <View style={styles.divider} />
            <InfoRow label={t('propResponsibleLabel').replace(':', '')} value={responsibleName} labelBold />
          </>
        )}
      </SectionBlock>

      <MediaSection photos={photos} videos={videos} t={t} onPhotoPress={onPhotoPress} onVideoPress={onVideoPress} />

      <SectionBlock color="rgba(187,222,251,0.5)" border="#64B5F6">
        <View style={[styles.sectionTitleRow, styles.bookingListHeaderRow]}>
            <View style={styles.sectionTitleLeft}>
              <RNImage source={require('../../assets/icon-booking.png')} style={styles.sectionTitleIcon} resizeMode="contain" />
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{t('pdBookingList')}</Text>
            </View>
            {onOpenBookingCalendar && (
              <TouchableOpacity onPress={() => onOpenBookingCalendar(resortHouses.map((h) => h.id), p.name || p.code || '')} style={styles.calendarLinkRow} activeOpacity={0.7}>
                <RNImage source={require('../../assets/icon-calendar-booking.png')} style={styles.calendarIcon} resizeMode="contain" />
              </TouchableOpacity>
            )}
          </View>
        {aggregatedBookings.length > 0 ? (
          aggregatedBookings.map((b) => {
            const house = resortHouses.find(h => h.id === b.propertyId);
            return (
              <TouchableOpacity
                key={b.id}
                style={styles.bookingItem}
                onPress={onBookingPress ? () => onBookingPress(b, b._codePart, house) : undefined}
                activeOpacity={onBookingPress ? 0.7 : 1}
              >
                <RNImage source={require('../../assets/icon-booking-hashtag.png')} style={styles.bookingItemIcon} resizeMode="contain" />
                <Text style={styles.bookingItemCode} numberOfLines={1}>{b._codePart}</Text>
                <Text style={styles.bookingItemDates}>
                  {formatBookingDate(b.checkIn)} — {formatBookingDate(b.checkOut)}
                </Text>
              </TouchableOpacity>
            );
          })
        ) : (
          <Text style={styles.emptyMedia}>{t('pdNoBookings')}</Text>
        )}
      </SectionBlock>

      {p.description ? (
        <View style={styles.descriptionBlock}>
          <View style={styles.sectionTitleRow}>
            <RNImage source={require('../../assets/icon-description.png')} style={styles.sectionTitleIcon} resizeMode="contain" />
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{t('pdDescription')}</Text>
          </View>
          <Text style={styles.descriptionText}>{p.description}</Text>
        </View>
      ) : null}

      {/* Houses toolbar */}
      <View style={[styles.housesToolbar, { justifyContent: 'flex-end' }]}>
        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} onPress={toggleAllHouses}>
          <RNImage
            source={allHousesExpanded ? require('../../assets/icon-folder-open.png') : require('../../assets/icon-folder-closed.png')}
            style={styles.housesToolbarIcon}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>

      {/* Resort houses list */}
      {resortHouses.length > 0 ? (
        resortHouses.map(h => (
          <ResortHouseItem
            key={h.id}
            item={{ ...h, district: p.district ?? h.district }}
            resortCode={p.code}
            expanded={expandedHouseIds.has(h.id)}
            onToggle={() => toggleHouseExpand(h.id)}
            onPress={onHousePress ? () => onHousePress(h) : undefined}
            t={t}
          />
        ))
      ) : (
        <Text style={styles.emptyHouses}>{t('pdNoHouses')}</Text>
      )}

      {p.comments ? (
        <View style={styles.descriptionBlock}>
          <Text style={styles.sectionTitle}>💬  {t('pdComments')}</Text>
          <Text style={styles.descriptionText}>{p.comments}</Text>
        </View>
      ) : null}
    </>
  );
}

function CondoApartmentItem({ item, expanded, onToggle, onPress, t }) {
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

  const codeDisplay = (item.code_suffix ? `${item.code || ''} (${item.code_suffix})` : item.code) || '';
  const isPending = item.property_status === 'pending';
  const isRejected = item.property_status === 'rejected';
  const isInReview = isPending || isRejected;

  return (
    <View
      style={
        isInReview
          ? [styles.resortHouseCard, styles.childCardInReview, { borderLeftColor: '#64B5F6' }]
          : [styles.resortHouseCard, { backgroundColor: '#BBDEFB', borderColor: '#64B5F6' }]
      }
    >
      <View style={styles.resortHouseRow}>
        <TouchableOpacity
          style={styles.resortHouseMainArea}
          onPress={onPress}
          activeOpacity={onPress ? 0.7 : 1}
          disabled={!onPress}
        >
          <RNImage source={require('../../assets/icon-property-condo.png')} style={styles.resortHouseIcon} resizeMode="contain" />
          <Text style={styles.resortHouseName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.resortHouseCode}>{codeDisplay}</Text>
        </TouchableOpacity>
        {isInReview && (
          <View style={[styles.childStatusBadge, isRejected ? styles.childStatusBadgeRejected : styles.childStatusBadgePending]}>
            <Text style={[styles.childStatusBadgeText, isRejected ? styles.childStatusBadgeTextRejected : styles.childStatusBadgeTextPending]}>
              {isPending ? t('statusPending') : t('statusRejected')}
            </Text>
          </View>
        )}
        <TouchableOpacity onPress={onToggle} activeOpacity={0.5} style={styles.resortHouseExpandBtn}>
          <Animated.View style={{ transform: [{ rotate: arrowRotate }] }}>
            <RNImage source={require('../../assets/icon-arrow-down.png')} style={styles.resortHouseArrow} resizeMode="contain" />
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

function CondoDetailContent({ p, t, typeColors, onOwnerPress, onPhotoPress, onVideoPress, refreshApartmentsTrigger, refreshBookingsTrigger, onApartmentPress, onBookingPress, onOpenBookingCalendar, hideLocation, responsibleName }) {
  const photos = Array.isArray(p.photos) ? p.photos : [];
  const videos = Array.isArray(p.videos) ? p.videos : [];
  const [apartments, setApartments] = useState([]);
  const [aggregatedBookings, setAggregatedBookings] = useState([]);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [allExpanded, setAllExpanded] = useState(false);

  const loadApartments = useCallback(async () => {
    try {
      const all = await getProperties();
      setApartments(sortByInternalCode(all.filter(a => a.resort_id === p.id)));
    } catch {}
  }, [p.id]);

  const loadAggregatedBookings = useCallback(async () => {
    if (apartments.length === 0) { setAggregatedBookings([]); return; }
    try {
      const childIds = apartments.map(a => a.id);
      const all = await getBookings();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const byProp = {};
      all.filter(b => childIds.includes(b.propertyId)).forEach((b) => {
        if (!byProp[b.propertyId]) byProp[b.propertyId] = [];
        byProp[b.propertyId].push(b);
      });
      const active = all
        .filter(b => childIds.includes(b.propertyId) && new Date(b.checkOut) >= today)
        .sort((a, b) => new Date(a.checkIn) - new Date(b.checkIn));
      setAggregatedBookings(active.map((b) => {
        const apt = apartments.find(a => a.id === b.propertyId);
        const codeDisplay = (p.code || '') + (apt?.code_suffix ? ` (${apt.code_suffix})` : '');
        const bookingNum = getBookingNumber(b, byProp[b.propertyId] || []);
        return { ...b, _codePart: `${codeDisplay} ${bookingNum}` };
      }));
    } catch { setAggregatedBookings([]); }
  }, [p.id, p.code, apartments]);

  useEffect(() => { loadApartments(); }, [loadApartments]);
  useEffect(() => { if (refreshApartmentsTrigger > 0) loadApartments(); }, [refreshApartmentsTrigger, loadApartments]);
  useEffect(() => { loadAggregatedBookings(); }, [loadAggregatedBookings]);
  useEffect(() => { if (refreshBookingsTrigger > 0) loadAggregatedBookings(); }, [refreshBookingsTrigger, loadAggregatedBookings]);

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
        <InfoRow label={t('propertyCode')} value={p.code} labelBold />
        <InfoRow label={t('pdCity')} value={p.city} labelBold />
        <InfoRow label={t('propDistrict')} value={p.district} labelBold />
        {!hideLocation && (p.google_maps_link ? (
          <InfoRow label={t('pdLocation')} value={t('pdGoogleMapLink')} isLink onPress={() => Linking.openURL(p.google_maps_link)} labelBold />
        ) : (
          <InfoRow label={t('pdLocation')} value="—" labelBold />
        ))}
        {p.website_url ? (
          <InfoRow
            label={t('propertyWebPage')}
            value={t('goToWebsite')}
            isLink
            onPress={() => Linking.openURL((p.website_url || '').replace(/^(?!https?:\/\/)/, 'https://'))}
            labelBold
          />
        ) : null}
        <View style={styles.divider} />
        <InfoRow label={t('propFloors')} value={p.floors != null ? `${p.floors}` : '—'} labelBold />
        <InfoRow label={t('propBeach')} value={p.beach_distance != null ? `${p.beach_distance}  m` : '—'} labelBold />
        <InfoRow label={t('propMarket')} value={p.market_distance != null ? `${p.market_distance}  m` : '—'} labelBold />
        <View style={styles.divider} />
        <InfoRow label={t('pdReception')} value={p.ownerName || '—'} labelBold />
        {p.ownerPhone1 ? <InfoRow label={t('pdPhone') + ' 1'} value={p.ownerPhone1} labelBold /> : null}
        {p.ownerPhone2 ? <InfoRow label={t('pdPhone') + ' 2'} value={p.ownerPhone2} labelBold /> : null}
        {responsibleName !== undefined && (
          <>
            <View style={styles.divider} />
            <InfoRow label={t('propResponsibleLabel').replace(':', '')} value={responsibleName} labelBold />
          </>
        )}
      </SectionBlock>

      <MediaSection photos={photos} videos={videos} t={t} onPhotoPress={onPhotoPress} onVideoPress={onVideoPress} />

      <SectionBlock color="rgba(187,222,251,0.5)" border="#64B5F6">
        <View style={[styles.sectionTitleRow, styles.bookingListHeaderRow]}>
            <View style={styles.sectionTitleLeft}>
              <RNImage source={require('../../assets/icon-booking.png')} style={styles.sectionTitleIcon} resizeMode="contain" />
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{t('pdBookingList')}</Text>
            </View>
            {onOpenBookingCalendar && (
              <TouchableOpacity onPress={() => onOpenBookingCalendar(apartments.map((a) => a.id), p.name || p.code || '')} style={styles.calendarLinkRow} activeOpacity={0.7}>
                <RNImage source={require('../../assets/icon-calendar-booking.png')} style={styles.calendarIcon} resizeMode="contain" />
              </TouchableOpacity>
            )}
          </View>
        {aggregatedBookings.length > 0 ? (
          aggregatedBookings.map((b) => {
            const apt = apartments.find(a => a.id === b.propertyId);
            return (
              <TouchableOpacity
                key={b.id}
                style={styles.bookingItem}
                onPress={onBookingPress ? () => onBookingPress(b, b._codePart, apt) : undefined}
                activeOpacity={onBookingPress ? 0.7 : 1}
              >
                <RNImage source={require('../../assets/icon-booking-hashtag.png')} style={styles.bookingItemIcon} resizeMode="contain" />
                <Text style={styles.bookingItemCode} numberOfLines={1}>{b._codePart}</Text>
                <Text style={styles.bookingItemDates}>
                  {formatBookingDate(b.checkIn)} — {formatBookingDate(b.checkOut)}
                </Text>
              </TouchableOpacity>
            );
          })
        ) : (
          <Text style={styles.emptyMedia}>{t('pdNoBookings')}</Text>
        )}
      </SectionBlock>

      {p.description ? (
        <View style={styles.descriptionBlock}>
          <View style={styles.sectionTitleRow}>
            <RNImage source={require('../../assets/icon-description.png')} style={styles.sectionTitleIcon} resizeMode="contain" />
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{t('pdDescription')}</Text>
          </View>
          <Text style={styles.descriptionText}>{p.description}</Text>
        </View>
      ) : null}

      <View style={[styles.housesToolbar, { justifyContent: 'flex-end' }]}>
        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} onPress={toggleAll}>
          <RNImage
            source={allExpanded ? require('../../assets/icon-folder-open.png') : require('../../assets/icon-folder-closed.png')}
            style={styles.housesToolbarIcon}
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
            onPress={onApartmentPress ? () => onApartmentPress(a) : undefined}
            t={t}
          />
        ))
      ) : (
        <Text style={styles.emptyHouses}>{t('pdNoApartments')}</Text>
      )}

      {p.comments ? (
        <View style={styles.descriptionBlock}>
          <Text style={styles.sectionTitle}>💬  {t('pdComments')}</Text>
          <Text style={styles.descriptionText}>{p.comments}</Text>
        </View>
      ) : null}
    </>
  );
}

export default function PropertyDetailScreen({ property, onBack, onDelete, onPropertyUpdated, onSelectProperty, user }) {
  const { t } = useLanguage();
  const { refreshBookings, properties } = useAppData();
  const [p, setP] = useState(property);

  // Агент видит только свои объекты — isOwnProperty всегда true для агентов
  const isTeamMember = !!(user?.teamMembership);
  // Phase 1: explicit role predicate (LOCK-001). Falls back to isTeamMember.
  const isAgentRole = user?.isAgentRole ?? isTeamMember;
  const isAdmin = user?.workAs === 'company' && !!(user?.companyId); // web-паттерн: явная проверка company mode
  const isAdminRole = user?.isAdminRole ?? (!user?.teamMembership && !!user?.companyId);
  const canBook = user?.teamPermissions?.can_book;
  const canEditInfo = !isTeamMember || user?.teamPermissions?.can_edit_info;
  const canEditPrices = !isTeamMember || user?.teamPermissions?.can_edit_prices;
  const needsApproval = isTeamMember && (!canEditInfo || !canEditPrices || p?.property_status === 'rejected');
  const isApproved = !p?.property_status || p?.property_status === 'approved';
  const isParentContainer = (p?.type === 'resort' || p?.type === 'condo') && !p?.resort_id;
  const propertiesList = Array.isArray(properties) ? properties : [];
  const hasApprovedChildren = propertiesList.some((child) => child.resort_id === p?.id && child.property_status === 'approved');
  const needsSecondDeleteConfirm = isAdminRole && isParentContainer && hasApprovedChildren;
  // Agent may delete only their own non-approved property (LOCK-001)
  const isCreator = p?.user_id === user?.id;
  const [wizardVisible, setWizardVisible] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [currentResponsible, setCurrentResponsible] = useState(p?.responsible_agent_id ?? null);
  const [addHouseWizardVisible, setAddHouseWizardVisible] = useState(false);
  const [addApartmentWizardVisible, setAddApartmentWizardVisible] = useState(false);
  const [addBookingVisible, setAddBookingVisible] = useState(false);
  const [calendarModalVisible, setCalendarModalVisible] = useState(false);
  const [calendarPropertyIds, setCalendarPropertyIds] = useState([]);
  const [calendarSubtitle, setCalendarSubtitle] = useState('');
  const [refreshResortHousesTrigger, setRefreshResortHousesTrigger] = useState(0);
  const [refreshApartmentsTrigger, setRefreshApartmentsTrigger] = useState(0);
  const [newHouseIdToExpand, setNewHouseIdToExpand] = useState(null);
  const [ownerContact, setOwnerContact] = useState(null);
  const [owner2Contact, setOwner2Contact] = useState(null);
  const [showOwner, setShowOwner] = useState(false);
  const [showOwner2, setShowOwner2] = useState(false);
  const [resort, setResort] = useState(null);
  const [refreshBookingsTrigger, setRefreshBookingsTrigger] = useState(0);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [selectedBookingTitle, setSelectedBookingTitle] = useState('');
  const [selectedBookingProperty, setSelectedBookingProperty] = useState(null);
  const [selectedClientContact, setSelectedClientContact] = useState(null);
  const [editBookingModalVisible, setEditBookingModalVisible] = useState(false);
  const [editBookingToEdit, setEditBookingToEdit] = useState(null);
  const [pendingDraft, setPendingDraft] = useState(null);
  const [rejectionHistory, setRejectionHistory] = useState([]);
  // Admin moderation: pending draft from any agent (different from own pendingDraft)
  const [adminAgentDraft, setAdminAgentDraft] = useState(null);
  const [rejectFormVisible, setRejectFormVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectReasonError, setRejectReasonError] = useState(false);
  const [moderating, setModerating] = useState(false);

  // Priority-based display status — computed AFTER all useState declarations so that
  // pendingDraft and adminAgentDraft hold their actual state values (not Babel-hoisted undefined).
  const hasPendingDraft = Boolean(pendingDraft);
  const hasAdminAgentDraft = isAdmin && Boolean(adminAgentDraft);
  let displayStatus = null;
  if (hasPendingDraft || hasAdminAgentDraft) {
    displayStatus = 'in_review';
  } else if (p?.property_status === 'rejected') {
    displayStatus = 'rejected';
  } else if (p?.property_status === 'pending') {
    displayStatus = 'in_review';
  }

  // Загружаем pending-черновик и историю отклонений при смене объекта или обновлении списка.
  // cancel-флаг предотвращает setState после размонтирования.
  // Синхронизируем p с актуальными данными из AppDataContext (как web делает с selected).
  useEffect(() => {
    let cancelled = false;
    if (!p?.id) {
      setPendingDraft(null);
      setRejectionHistory([]);
      return;
    }
    // Sync local property state with fresh data from AppDataContext (mirrors web's setSelected sync)
    if (properties?.length) {
      const fresh = properties.find(x => x.id === p.id);
      if (fresh && fresh.property_status !== p.property_status) {
        setP(fresh);
      }
    }
    getPropertyDraft(p.id)
      .then(draft => { if (!cancelled) setPendingDraft(draft); })
      .catch(() => {});
    getPropertyRejectionHistory(p.id)
      .then(history => { if (!cancelled) setRejectionHistory(history); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [p?.id, p?.property_status, properties]);

  // Admin: load any agent's pending draft for this property.
  // Extracted into useCallback so it can be called both on screen focus (useFocusEffect)
  // and whenever isAdmin or p?.id changes (useEffect below).
  const loadAdminDraft = useCallback(() => {
    if (!isAdmin || !p?.id) {
      setAdminAgentDraft(null);
      return undefined;
    }
    let cancelled = false;
    supabase
      .from('property_drafts')
      .select('id, user_id')
      .eq('property_id', p.id)
      .eq('status', 'pending')
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn('[adminAgentDraft] query error:', error.message, error.code);
          return;
        }
        setAdminAgentDraft(data || null);
        if (data) {
          setRejectFormVisible(false);
          setRejectReason('');
          setRejectReasonError(false);
        }
      })
      .catch(e => console.warn('[adminAgentDraft] unexpected error:', e?.message));
    return () => { cancelled = true; };
  }, [isAdmin, p?.id]);

  // Fire every time the screen gains focus (mirrors web's draftRefreshKey mechanism).
  // Guarantees fresh data when admin navigates to the screen after agent resubmits.
  useFocusEffect(useCallback(() => { return loadAdminDraft(); }, [loadAdminDraft]));

  // Also fire when isAdmin or p?.id changes while screen is already mounted.
  useEffect(() => { return loadAdminDraft(); }, [loadAdminDraft]);

  // Re-run when AppDataContext properties refresh (triggered by broadcastChange after agent resubmit).
  // This covers the case where admin is already on the screen when agent sends for review.
  useEffect(() => {
    if (isAdmin && p?.id) return loadAdminDraft();
  }, [isAdmin, p?.id, properties, loadAdminDraft]);

  // Admin realtime ping: lightweight subscription on property_drafts for this property.
  // When the agent submits a new draft, the admin sees the status switch to in_review immediately.
  // One targeted channel per open detail screen — minimal server load.
  useEffect(() => {
    if (!isAdmin || !p?.id) return;

    // Realtime ping: accelerates update when property_drafts is in supabase_realtime publication.
    // Falls back gracefully to the properties-dep useEffect above if publication is not enabled.
    const reloadAdminDraft = () => {
      supabase
        .from('property_drafts')
        .select('id, user_id')
        .eq('property_id', p.id)
        .eq('status', 'pending')
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          setAdminAgentDraft(data || null);
          if (data) {
            setRejectFormVisible(false);
            setRejectReason('');
            setRejectReasonError(false);
          }
        })
        .catch(() => {});
    };

    const channel = supabase
      .channel(`admin-draft-watch-${p.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'property_drafts',
          filter: `property_id=eq.${p.id}`,
        },
        reloadAdminDraft,
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isAdmin, p?.id]);

  const loadResortData = useCallback(async (resortId) => {
    if (!resortId) { setResort(null); return; }
    try {
      const all = await getProperties();
      const r = all.find(pr => pr.id === resortId);
      setResort(r || null);
    } catch { setResort(null); }
  }, []);

  // Загружаем участников команды для пикера ответственного (только Admin)
  useEffect(() => {
    if (!isAdmin || !user?.companyId) return;
    getActiveTeamMembers(user.companyId)
      .then(setTeamMembers)
      .catch(() => {});
  }, [isAdmin, user?.companyId]);

  const loadOwnerData = useCallback(async (prop) => {
    try {
      const owners = await getContacts('owners');
      const updates = {};
      if (prop.owner_id) {
        const owner = owners.find(o => o.id === prop.owner_id);
        if (owner) {
          setOwnerContact(owner);
          Object.assign(updates, {
            ownerName: `${owner.name} ${owner.lastName}`.trim(),
            ownerPhone1: owner.phone || '',
            ownerPhone2: owner.extraPhones?.[0] || '',
            ownerTelegram: owner.telegram || '',
          });
        } else {
          setOwnerContact(null);
          Object.assign(updates, { ownerName: '', ownerPhone1: '', ownerPhone2: '', ownerTelegram: '' });
        }
      } else {
        setOwnerContact(null);
        Object.assign(updates, { ownerName: '', ownerPhone1: '', ownerPhone2: '', ownerTelegram: '' });
      }
      if (prop.owner_id_2) {
        const owner2 = owners.find(o => o.id === prop.owner_id_2);
        if (owner2) {
          setOwner2Contact(owner2);
          Object.assign(updates, {
            owner2Name: `${owner2.name} ${owner2.lastName}`.trim(),
            owner2Phone1: owner2.phone || '',
            owner2Phone2: owner2.extraPhones?.[0] || '',
            owner2Telegram: owner2.telegram || '',
          });
        } else {
          setOwner2Contact(null);
          Object.assign(updates, { owner2Name: '', owner2Phone1: '', owner2Phone2: '', owner2Telegram: '' });
        }
      } else {
        setOwner2Contact(null);
        Object.assign(updates, { owner2Name: '', owner2Phone1: '', owner2Phone2: '', owner2Telegram: '' });
      }
      setP(prev => ({ ...prev, ...updates }));
    } catch {}
  }, []);

  useEffect(() => {
    setP(property);
    loadOwnerData(property);
  }, [property, loadOwnerData]);

  useEffect(() => {
    loadResortData(property?.resort_id);
  }, [property?.resort_id, loadResortData]);

  const scrollViewRef = useRef(null);
  useEffect(() => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
  }, [property?.id]);

  const typeColors = BLOCK_COLORS[p.type] || BLOCK_COLORS.house;

  const propertySym = getCurrencySymbol(p.currency);

  const formatPrice = (val) => {
    if (val == null) return '—';
    return Number(val).toLocaleString('en-US').replace(/,/g, ' ') + ' ' + propertySym;
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

  const handleOwner2Press = () => {
    if (owner2Contact) setShowOwner2(true);
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

  const handleDirectDelete = useCallback(async () => {
    try {
      await deleteProperty(p.id);
      onPropertyUpdated?.();
      onBack?.();
    } catch (e) {
      Alert.alert(t('error') || 'Error', e.message || 'Failed to delete');
    }
  }, [p?.id, onPropertyUpdated, onBack, t]);

  const handleDeletePress = useCallback(() => {
    if (!needsSecondDeleteConfirm) {
      onDelete?.();
      return;
    }
    Alert.alert(
      t('deletePropertyTitle'),
      t('pdDeleteConfirm'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('deleteAction'),
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              t('deleteContainerWithUnitsTitle'),
              t('deleteContainerWithUnitsText'),
              [
                { text: t('cancel'), style: 'cancel' },
                {
                  text: t('deleteAction'),
                  style: 'destructive',
                  onPress: async () => {
                    await handleDirectDelete();
                  },
                },
              ]
            );
          },
        },
      ]
    );
  }, [needsSecondDeleteConfirm, onDelete, t, handleDirectDelete]);

  // ── Admin moderation: Approve ──────────────────────────────────────────────
  const handleAdminApprove = useCallback(() => {
    Alert.alert(
      t('approveConfirmTitle'),
      t('approveConfirmMsg'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('propApprove'),
          onPress: async () => {
            setModerating(true);
            try {
              if (adminAgentDraft) {
                // edit_submitted flow: approve the agent's draft
                const updated = await approvePropertyDraft(adminAgentDraft.id);
                setP(prev => ({ ...prev, ...(updated || {}), property_status: 'approved' }));
                setAdminAgentDraft(null);
                setPendingDraft(null);
                await sendNotification({
                  recipientId: adminAgentDraft.user_id,
                  senderId: user.id,
                  type: 'edit_approved',
                  title: t('changesApproved'),
                  body: p.name,
                  propertyId: p.id,
                });
              } else {
                // property_submitted flow: approve the property directly
                await approveProperty(p.id);
                setP(prev => ({ ...prev, property_status: 'approved' }));
                if (p.user_id) {
                  await sendNotification({
                    recipientId: p.user_id,
                    senderId: user.id,
                    type: 'property_approved',
                    title: t('changesApproved'),
                    body: p.name,
                    propertyId: p.id,
                  });
                }
              }
              onPropertyUpdated?.();
            } catch (e) {
              Alert.alert(t('error') || 'Error', e.message || 'Failed to approve');
            } finally {
              setModerating(false);
            }
          },
        },
      ],
    );
  }, [adminAgentDraft, p, user, t, onPropertyUpdated]);

  // ── Admin moderation: Reject ───────────────────────────────────────────────
  const handleAdminReject = useCallback(async () => {
    const trimmed = rejectReason.trim();
    if (!trimmed) {
      setRejectReasonError(true);
      return;
    }
    setModerating(true);
    try {
      if (adminAgentDraft) {
        await rejectPropertyDraft(adminAgentDraft.id, trimmed);
        setAdminAgentDraft(null);
        setP(prev => ({ ...prev, property_status: 'rejected', rejection_reason: trimmed }));
      } else {
        await rejectProperty(p.id, trimmed);
        setP(prev => ({ ...prev, property_status: 'rejected', rejection_reason: trimmed }));
      }
      // Refresh rejection history to include the new entry
      getPropertyRejectionHistory(p.id).then(setRejectionHistory).catch(() => {});
      // Notify the agent
      const agentId = adminAgentDraft?.user_id ?? p.user_id;
      if (agentId) {
        await sendNotification({
          recipientId: agentId,
          senderId: user.id,
          type: adminAgentDraft ? 'edit_rejected' : 'property_rejected',
          title: t('changesRejected'),
          body: `${t('diffReason')} ${trimmed}`,
          propertyId: p.id,
        });
      }
      setRejectFormVisible(false);
      setRejectReason('');
      setRejectReasonError(false);
      onPropertyUpdated?.();
    } catch (e) {
      Alert.alert(t('error') || 'Error', e.message || 'Failed to reject');
    } finally {
      setModerating(false);
    }
  }, [adminAgentDraft, rejectReason, p, user, t, onPropertyUpdated]);

  const handleWizardSave = async (updates) => {
    try {
      const oldPhotos = Array.isArray(p.photos) ? p.photos : [];
      const newPhotos = Array.isArray(updates.photos) ? updates.photos : [];
      for (const url of oldPhotos) {
        if (!newPhotos.includes(url)) {
          await deletePhotoFromStorage(url);
        }
      }
      if (needsApproval) {
        // Отправляем черновик — оригинал не трогаем
        await submitPropertyDraft(p.id, updates);
        const adminId = user?.teamMembership?.adminId;
        if (adminId) {
          const agentName = [user?.name, user?.lastName].filter(Boolean).join(' ') || user?.email || '';
          await sendNotification({
            recipientId: adminId,
            senderId: user.id,
            type: 'edit_submitted',
            title: `${agentName} ${t('notifPropChangesMiddle')} «${p.name}»`,
            body: t('notifApprovalRequired'),
            propertyId: p.id,
          });
        }
        // Обновляем local state черновика
        getPropertyDraft(p.id).then(setPendingDraft).catch(() => {});
        setWizardVisible(false);
        Alert.alert(t('draftSentAlertTitle'), t('draftSentAlertBody'));
        return; // НЕ вызываем onPropertyUpdated — данные не изменились
      }

      // Агент с разрешениями или Админ — сохраняем напрямую
      const updated = await updateProperty(p.id, updates);
      const merged = { ...p, ...updated };
      setP(merged);
      if ('responsible_agent_id' in updates) {
        setCurrentResponsible(updates.responsible_agent_id ?? null);
        // Автоматически каскадируем на все дома/апартаменты внутри резорта/кондо
        if (p.type === 'resort' || p.type === 'condo') {
          try {
            await updatePropertyResponsible(p.id, updates.responsible_agent_id ?? null, true);
          } catch {}
        }
      }
      setWizardVisible(false);
      loadOwnerData(merged);
      if ((p.type === 'resort' || p.type === 'condo') && updates.district !== undefined && String(updates.district || '') !== String(p.district || '')) {
        try {
          await updateResortChildrenDistrict(p.id, updates.district);
        } catch {}
      }
      onPropertyUpdated?.();
    } catch (e) {
      throw e;
    }
  };

  const draftHouseInResort = {
    type: 'resort_house',
    resort_id: p.id,
    name: '',
    code: p.code || '',
    city: p.city || '',
    location_id: p.location_id || null,
    owner_id: p.owner_id || null,
    responsible_agent_id: p.responsible_agent_id ?? null,
    district: p.district || '',
    google_maps_link: p.google_maps_link || '',
    address: p.address || '',
  };

  const draftApartmentInCondo = {
    type: 'condo_apartment',
    resort_id: p.id,
    name: '',
    code: p.code || '',
    city: p.city || '',
    location_id: p.location_id || null,
    owner_id: p.owner_id || null,
    responsible_agent_id: p.responsible_agent_id ?? null,
    district: p.district || '',
    google_maps_link: p.google_maps_link || '',
    address: p.address || '',
  };

  const handleAddHouseSave = async (updates) => {
    try {
      const fullData = {
        ...updates,
        resort_id: p.id,
        city: p.city || '',
        district: p.district || '',
        owner_id: p.owner_id || null,
        responsible_agent_id: p.responsible_agent_id ?? null,
        location_id: p.location_id || null,
      };
      const {
        name,
        code,
        location_id,
        owner_id,
        responsible_agent_id,
        property_status,
        ...detailsToUpdate
      } = fullData;

      const created = await createProperty({
        name: name || '',
        code: code || '',
        type: 'resort_house',
        location_id: location_id || null,
        owner_id: owner_id || null,
        responsible_agent_id: responsible_agent_id ?? null,
        property_status: property_status || (isTeamMember ? 'pending' : 'approved'),
      });

      if (created?.id) {
        await updateProperty(created.id, {
          responsible_agent_id: p.responsible_agent_id ?? null,
        });
      }

      const { user_id, company_id, ...safeDetailsToUpdate } = detailsToUpdate;

      if (created?.id && Object.keys(safeDetailsToUpdate).length > 0) {
        await updateProperty(created.id, safeDetailsToUpdate);
      }

      if (isTeamMember && created?.id) {
        const adminId = user?.teamMembership?.adminId;
        if (adminId) {
          const agentName = [user?.name, user?.lastName].filter(Boolean).join(' ') || user?.email;
          await sendNotification({
            recipientId: adminId,
            senderId: user?.id,
            type: 'property_submitted',
            title: `🏠 ${agentName} ${t('notifAddedPropertyTo')} ${p.name}`,
            body: `${t('notifLabelProperty')} ${name || ''} · ${t('notifLabelCode')} ${code || ''}`,
            propertyId: created.id,
          });
        }
      }

      setAddHouseWizardVisible(false);
      setNewHouseIdToExpand(created.id);
      setRefreshResortHousesTrigger(prev => prev + 1);
      onPropertyUpdated?.();
    } catch (e) {
      throw e;
    }
  };

  const handleAddApartmentSave = async (updates) => {
    try {
      const fullData = {
        ...updates,
        resort_id: p.id,
        city: p.city || '',
        district: p.district || '',
        owner_id: p.owner_id || null,
        responsible_agent_id: p.responsible_agent_id ?? null,
        location_id: p.location_id || null,
      };
      const {
        name,
        code,
        location_id,
        owner_id,
        responsible_agent_id,
        property_status,
        ...detailsToUpdate
      } = fullData;

      const created = await createProperty({
        name: name || '',
        code: code || '',
        type: 'condo_apartment',
        location_id: location_id || null,
        owner_id: owner_id || null,
        responsible_agent_id: responsible_agent_id ?? null,
        property_status: property_status || (isTeamMember ? 'pending' : 'approved'),
      });

      if (created?.id) {
        await updateProperty(created.id, {
          responsible_agent_id: p.responsible_agent_id ?? null,
        });
      }

      const { user_id, company_id, ...safeDetailsToUpdate } = detailsToUpdate;

      if (created?.id && Object.keys(safeDetailsToUpdate).length > 0) {
        await updateProperty(created.id, safeDetailsToUpdate);
      }

      if (isTeamMember && created?.id) {
        const adminId = user?.teamMembership?.adminId;
        if (adminId) {
          const agentName = [user?.name, user?.lastName].filter(Boolean).join(' ') || user?.email;
          await sendNotification({
            recipientId: adminId,
            senderId: user?.id,
            type: 'property_submitted',
            title: `🏠 ${agentName} ${t('notifAddedPropertyTo')} ${p.name}`,
            body: `${t('notifLabelProperty')} ${name || ''} · ${t('notifLabelCode')} ${code || ''}`,
            propertyId: created.id,
          });
        }
      }

      setAddApartmentWizardVisible(false);
      setRefreshApartmentsTrigger(prev => prev + 1);
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
        user={user}
      />
    );
  }
  if (showOwner2 && owner2Contact) {
    return (
      <ContactDetailScreen
        contact={owner2Contact}
        onBack={() => setShowOwner2(false)}
        onContactUpdated={() => loadOwnerData(p)}
        onContactDeleted={() => { setShowOwner2(false); setOwner2Contact(null); }}
        user={user}
      />
    );
  }
  if (selectedClientContact) {
    return (
      <ContactDetailScreen
        contact={selectedClientContact}
        onBack={() => setSelectedClientContact(null)}
        onContactUpdated={() => setSelectedClientContact(null)}
        onContactDeleted={() => setSelectedClientContact(null)}
        user={user}
      />
    );
  }
  if (selectedBooking) {
    return (
      <View style={{ flex: 1 }}>
        <BookingDetailScreen
          booking={selectedBooking}
          propertyCode={selectedBookingTitle || t('pdBookingList')}
          onBack={() => { setSelectedBooking(null); setSelectedBookingTitle(''); setSelectedBookingProperty(null); }}
          onContactPress={(contact) => setSelectedClientContact(contact)}
          user={user}
          onDelete={async (id) => {
            try {
              await cancelBookingReminders(id);
              await deleteBooking(id);
              setSelectedBooking(null);
              setSelectedBookingTitle('');
              setRefreshBookingsTrigger((prev) => prev + 1);
            } catch (e) {
              Alert.alert(t('error'), e.message);
            }
          }}
          onEdit={(b) => {
            setEditBookingToEdit(b);
            setEditBookingModalVisible(true);
          }}
        />
        <AddBookingModal
          visible={editBookingModalVisible}
          property={selectedBookingProperty || p}
          editBooking={editBookingToEdit}
          onClose={() => { setEditBookingModalVisible(false); setEditBookingToEdit(null); }}
          onSaved={(updated) => {
            setEditBookingModalVisible(false);
            setEditBookingToEdit(null);
            if (updated) setSelectedBooking(updated);
            setRefreshBookingsTrigger((prev) => prev + 1);
            refreshBookings();
          }}
        />
      </View>
    );
  }

  const companyDisplayName = user?.companyInfo?.name || 'Компания';
  const responsibleName = (!currentResponsible || currentResponsible === user?.id)
    ? companyDisplayName
    : (() => {
        const m = teamMembers.find(tm => tm.user_id === currentResponsible);
        return m ? ([m.name, m.last_name].filter(Boolean).join(' ') || m.email) : companyDisplayName;
      })();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{p.name}</Text>
        <View style={styles.backBtn} />
      </View>

      {/* Строка действий */}
      <View style={styles.actionsRow}>
        {/* Удалить — для не-агентов всегда; для agent-role только если создатель + не approved (LOCK-001) */}
        {(!isAgentRole || (isCreator && !isApproved)) && (
          <TouchableOpacity style={styles.actionBtn} onPress={handleDeletePress} activeOpacity={0.7}>
            <RNImage source={require('../../assets/trash-icon.png')} style={styles.actionIconLg} resizeMode="contain" />
          </TouchableOpacity>
        )}
        <View style={[styles.actionsRight, isTeamMember && { flex: 1, justifyContent: 'flex-end' }]}>
          {/* Редактировать */}
          <TouchableOpacity style={styles.actionBtn} onPress={() => setWizardVisible(true)} activeOpacity={0.7}>
            <RNImage source={require('../../assets/pencil-icon.png')} style={styles.actionIcon} resizeMode="contain" />
          </TouchableOpacity>
          {/* Добавить бронирование / добавить дом — только для approved, для агента только если есть can_book */}
          {isApproved && (!isTeamMember || canBook) && (
            <TouchableOpacity
              style={styles.actionBtn}
              activeOpacity={0.7}
              onPress={() => {
                if (p.type === 'resort') setAddHouseWizardVisible(true);
                else if (p.type === 'condo') setAddApartmentWizardVisible(true);
                else if (BOOKABLE_UNIT_TYPES.has(p.type)) setAddBookingVisible(true);
              }}
            >
              {(p.type === 'resort' || p.type === 'condo') ? (
                <RNImage source={require('../../assets/icon-add-property.png')} style={styles.actionIconLg} resizeMode="contain" />
              ) : (
                <RNImage source={require('../../assets/icon-add-booking.png')} style={styles.actionIconLg} resizeMode="contain" />
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Status block (uses pre-computed displayStatus) ── */}
      {displayStatus && (
        <View style={styles.statusBlockWrap}>
          <View style={[styles.statusBadge, displayStatus === 'rejected' ? styles.statusBadgeRejected : styles.statusBadgePending]}>
            <Text style={[styles.statusBadgeText, displayStatus === 'rejected' ? styles.statusBadgeTextRejected : styles.statusBadgeTextPending]}>
              {displayStatus === 'rejected' ? t('propRejected') : t('filterInReview')}
            </Text>
            {displayStatus === 'rejected' && (
              <Text style={styles.statusBadgeSubtitle}>{t('propRejectedSubtitle')}</Text>
            )}
          </View>

          {rejectionHistory.length > 0 && (
            <View style={styles.rejHistoryBlock}>
              <Text style={styles.rejHistoryTitle}>{t('propRejectionHistory')}</Text>
              {rejectionHistory.map((item, index) => {
                const isLatest = index === 0;
                const num = rejectionHistory.length - index;
                return (
                  <View key={item.id} style={styles.rejHistoryItem}>
                    <Text style={[styles.rejHistoryNum, isLatest && styles.rejHistoryNumLatest]}>
                      {`#${num}`}
                    </Text>
                    <Text style={[styles.rejHistoryReason, isLatest && styles.rejHistoryReasonLatest]}>
                      {item.reason}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* ── Admin moderation actions (only when admin + displayStatus = in_review) ── */}
      {isAdmin && displayStatus === 'in_review' && (
        <View style={styles.adminActionsWrap}>
          {!rejectFormVisible ? (
            <View style={styles.adminActionRow}>
              <TouchableOpacity
                style={[styles.adminActionBtn, styles.adminActionApprove, moderating && styles.adminActionDisabled]}
                onPress={handleAdminApprove}
                disabled={moderating}
                activeOpacity={0.75}
              >
                <Text style={styles.adminActionApproveText}>{t('propApprove')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.adminActionBtn, styles.adminActionReject, moderating && styles.adminActionDisabled]}
                onPress={() => { setRejectFormVisible(true); setRejectReason(''); setRejectReasonError(false); }}
                disabled={moderating}
                activeOpacity={0.75}
              >
                <Text style={styles.adminActionRejectText}>{t('propReject')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.rejectForm}>
              <Text style={styles.rejectFormLabel}>{t('propRejectionReason')}</Text>
              <TextInput
                style={[styles.rejectFormInput, rejectReasonError && styles.rejectFormInputError]}
                value={rejectReason}
                onChangeText={v => { setRejectReason(v); if (rejectReasonError) setRejectReasonError(false); }}
                placeholder={t('propRejectReasonPlaceholder')}
                placeholderTextColor="#AAAAAA"
                multiline
                editable={!moderating}
              />
              {rejectReasonError && (
                <Text style={styles.rejectFormErrorText}>{t('propRejectReasonRequired')}</Text>
              )}
              <View style={styles.adminActionRow}>
                <TouchableOpacity
                  style={[styles.adminActionBtn, styles.adminActionCancel]}
                  onPress={() => { setRejectFormVisible(false); setRejectReason(''); setRejectReasonError(false); }}
                  disabled={moderating}
                  activeOpacity={0.75}
                >
                  <Text style={styles.adminActionCancelText}>{t('cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.adminActionBtn, styles.adminActionSubmitReject, moderating && styles.adminActionDisabled]}
                  onPress={handleAdminReject}
                  disabled={moderating}
                  activeOpacity={0.75}
                >
                  <Text style={styles.adminActionSubmitRejectText}>{t('propRejectSubmit')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      <ScrollView ref={scrollViewRef} style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {p.type === 'resort' ? (
          <ResortDetailContent
            p={p}
            t={t}
            typeColors={typeColors}
            onOwnerPress={handleOwnerPress}
            onPhotoPress={handlePhotoPress}
            onVideoPress={handleVideoPress}
            refreshResortHousesTrigger={refreshResortHousesTrigger}
            refreshBookingsTrigger={refreshBookingsTrigger}
            newHouseIdToExpand={newHouseIdToExpand}
            onExpandedNewHouse={() => setNewHouseIdToExpand(null)}
            onHousePress={onSelectProperty ? (h) => onSelectProperty(h) : undefined}
            onBookingPress={(b, codePart, property) => {
              setSelectedBooking(b);
              setSelectedBookingTitle(codePart || '');
              setSelectedBookingProperty(property || null);
            }}
            onOpenBookingCalendar={isApproved ? (ids, subtitle) => { setCalendarPropertyIds(ids || []); setCalendarSubtitle(subtitle || ''); setCalendarModalVisible(true); } : undefined}
            hideLocation={false}
            responsibleName={isAdmin ? responsibleName : undefined}
          />
        ) : p.type === 'condo' ? (
          <CondoDetailContent
            p={p}
            t={t}
            typeColors={typeColors}
            onOwnerPress={handleOwnerPress}
            onPhotoPress={handlePhotoPress}
            onVideoPress={handleVideoPress}
            refreshApartmentsTrigger={refreshApartmentsTrigger}
            refreshBookingsTrigger={refreshBookingsTrigger}
            onApartmentPress={onSelectProperty ? (a) => onSelectProperty(a) : undefined}
            onBookingPress={(b, codePart, property) => {
              setSelectedBooking(b);
              setSelectedBookingTitle(codePart || '');
              setSelectedBookingProperty(property || null);
            }}
            onOpenBookingCalendar={isApproved ? (ids, subtitle) => { setCalendarPropertyIds(ids || []); setCalendarSubtitle(subtitle || ''); setCalendarModalVisible(true); } : undefined}
            hideLocation={false}
            responsibleName={isAdmin ? responsibleName : undefined}
          />
        ) : (
          <HouseDetailContent
            p={p}
            t={t}
            typeColors={typeColors}
            formatPrice={formatPrice}
            waterPriceLabel={waterPriceLabel}
            onOwnerPress={handleOwnerPress}
            onOwner2Press={handleOwner2Press}
            onPhotoPress={handlePhotoPress}
            onVideoPress={handleVideoPress}
            resort={p.resort_id ? resort : null}
            refreshBookingsTrigger={refreshBookingsTrigger}
            onBookingPress={(b, codePart) => {
              setSelectedBooking(b);
              setSelectedBookingTitle(codePart || '');
            }}
            onOpenBookingCalendar={isApproved ? (ids, subtitle) => { setCalendarPropertyIds(ids || []); setCalendarSubtitle(subtitle || ''); setCalendarModalVisible(true); } : undefined}
            hideLocation={false}
            responsibleName={isAdmin ? responsibleName : undefined}
          />
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
        parentResort={p.resort_id ? resort : null}
        onClose={() => setWizardVisible(false)}
        onSave={handleWizardSave}
      />
      {p.type === 'resort' && (
        <PropertyEditWizard
          visible={addHouseWizardVisible}
          property={draftHouseInResort}
          parentResort={p}
          onClose={() => setAddHouseWizardVisible(false)}
          onSave={handleAddHouseSave}
        />
      )}
      {p.type === 'condo' && (
        <PropertyEditWizard
          visible={addApartmentWizardVisible}
          property={draftApartmentInCondo}
          parentResort={p}
          onClose={() => setAddApartmentWizardVisible(false)}
          onSave={handleAddApartmentSave}
        />
      )}
      {BOOKABLE_UNIT_TYPES.has(p.type) && (
        <AddBookingModal
          visible={addBookingVisible}
          property={p}
          onClose={() => setAddBookingVisible(false)}
          onSaved={() => {
            setAddBookingVisible(false);
            setRefreshBookingsTrigger(prev => prev + 1);
            refreshBookings();
          }}
        />
      )}

      <PropertyBookingCalendarModal
        visible={calendarModalVisible}
        onClose={() => setCalendarModalVisible(false)}
        propertyIds={calendarPropertyIds}
        subtitle={calendarSubtitle}
        readOnly={false}
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
    paddingHorizontal: 20,
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
  actionIconLg: {
    width: 24,
    height: 24,
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
  sectionBlockGap: {
    gap: 10,
  },
  infoRowNoMargin: {
    marginBottom: 0,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  bookingListHeaderRow: {
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  calendarLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 4,
  },
  calendarLinkText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#D81B60',
  },
  calendarIcon: {
    width: 26,
    height: 26,
  },
  sectionTitleIcon: {
    width: 22,
    height: 22,
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
    width: 165,
  },
  infoLabelBold: {
    fontWeight: '700',
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
  bookingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  bookingItemIcon: {
    width: 19,
    height: 19,
    marginRight: 10,
  },
  bookingItemCode: {
    flex: 1,
    fontSize: 15,
    color: '#C45C6E',
    fontWeight: '600',
  },
  bookingItemDates: {
    fontSize: 14,
    color: '#2C2C2C',
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
  amenityIconImg: {
    width: 24,
    height: 24,
    marginRight: 10,
  },
  amenityLabel: {
    fontSize: 13,
    color: '#2C2C2C',
  },
  amenityEmpty: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
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
  priceIconImg: {
    width: 24,
    height: 24,
    marginRight: 4,
  },
  priceLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2C2C2C',
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  housesToolbarIcon: {
    width: 24,
    height: 24,
  },
  resortHouseCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 8,
    overflow: 'hidden',
  },
  childCardInReview: {
    backgroundColor: '#ECECE7',
    borderColor: '#9FA6AD',
    borderWidth: 1.5,
    borderStyle: 'solid',
    borderLeftWidth: 5,
  },
  resortHouseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  resortHouseMainArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
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
  childStatusBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    marginRight: 8,
  },
  childStatusBadgePending: {
    backgroundColor: '#FFF8E1',
    borderColor: '#FFE082',
  },
  childStatusBadgeRejected: {
    backgroundColor: '#FFF5F5',
    borderColor: '#FFCDD2',
  },
  childStatusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  childStatusBadgeTextPending: {
    color: '#F57F17',
  },
  childStatusBadgeTextRejected: {
    color: '#C62828',
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
  draftBanner: {
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#FFE082',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  draftBannerText: {
    fontSize: 13,
    color: '#F57F17',
    fontWeight: '600',
  },
  statusBlockWrap: {
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
  },
  statusBadgePending: {
    backgroundColor: '#FFF8E1',
    borderColor: '#FFE082',
  },
  statusBadgeRejected: {
    backgroundColor: '#FFF5F5',
    borderColor: '#FFCDD2',
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  statusBadgeTextPending: {
    color: '#F57F17',
  },
  statusBadgeTextRejected: {
    color: '#C62828',
  },
  statusBadgeSubtitle: {
    fontSize: 12,
    color: '#C62828',
    marginTop: 2,
    fontWeight: '400',
  },
  rejHistoryBlock: {
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F0E0E0',
    padding: 12,
    gap: 6,
  },
  rejHistoryTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  rejHistoryItem: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-start',
  },
  rejHistoryNum: {
    fontSize: 12,
    fontWeight: '600',
    color: '#BBBBBB',
    minWidth: 28,
  },
  rejHistoryNumLatest: {
    color: '#C62828',
    fontWeight: '700',
  },
  rejHistoryReason: {
    flex: 1,
    fontSize: 13,
    color: '#AAAAAA',
    lineHeight: 18,
  },
  rejHistoryReasonLatest: {
    color: '#C62828',
    fontWeight: '600',
  },
  adminActionsWrap: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  adminActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  adminActionBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminActionApprove: {
    backgroundColor: '#3D7D82',
  },
  adminActionApproveText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  adminActionReject: {
    backgroundColor: '#FFF0F0',
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  adminActionRejectText: {
    color: '#C62828',
    fontSize: 14,
    fontWeight: '600',
  },
  adminActionCancel: {
    backgroundColor: '#F2F2F7',
  },
  adminActionCancelText: {
    color: '#555555',
    fontSize: 14,
    fontWeight: '500',
  },
  adminActionSubmitReject: {
    backgroundColor: '#C62828',
  },
  adminActionSubmitRejectText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  adminActionDisabled: {
    opacity: 0.5,
  },
  rejectForm: {
    gap: 8,
  },
  rejectFormLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555555',
    marginBottom: 2,
  },
  rejectFormInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1C1C1E',
    minHeight: 72,
    textAlignVertical: 'top',
    backgroundColor: '#FAFAFA',
  },
  rejectFormInputError: {
    borderColor: '#C62828',
  },
  rejectFormErrorText: {
    fontSize: 12,
    color: '#C62828',
    marginTop: -4,
  },
});
