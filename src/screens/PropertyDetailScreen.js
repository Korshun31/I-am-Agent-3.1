import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
  FlatList,
  Animated,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { FONT } from '../utils/scale';
import { IconPencil } from '../components/EditIcons';
import {
  IconPhoto,
  IconVideo,
  IconDescription,
  IconBookingList,
  IconAmenities,
  IconHashtag,
  IconSpecifications,
  IconContacts,
  IconPrices,
} from '../components/PropertyIcons';
import { IconBookings } from '../components/TabIcons';
import { IconFolderClosed, IconFolderOpen } from '../components/FolderIcons';
import OwnerInfoRow from '../components/OwnerInfoRow';
import PhotoGalleryModal from '../components/PhotoGalleryModal';
import { TYPE_COLORS } from '../components/PropertyItem';
import Constants from 'expo-constants';
import { useLanguage } from '../context/LanguageContext';
import { getCurrencySymbol } from '../utils/currency';
import { getVideoThumbnailUrl } from '../utils/videoThumbnail';
import { useAppData } from '../context/AppDataContext';
import { getProperties, updateProperty, createPropertyFull, deleteProperty, updateResortChildrenDistrict, updatePropertyResponsible } from '../services/propertiesService';
import { getActiveTeamMembers } from '../services/companyService';
import { deletePhotoFromStorage } from '../services/storageService';
import { getContacts } from '../services/contactsService';
import { getBookings, deleteBooking, getBookingsCountForProperty } from '../services/bookingsService';
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

// Палитра контуров секций — приглушённая радуга от красного к фиолетовому.
// Порядок: red → orange → amber → green → teal → blue → lilac.
// Все тона в одной матовой стилистике, согласованы с логотипом.
const SECTION_PALETTE = {
  red:    '#C8624A', // красный (логотип)
  orange: '#C97A52', // приглушённый оранжевый
  amber:  '#C4973A', // охра / жёлтый (логотип)
  green:  '#8BAF8E', // зелёный (логотип)
  teal:   '#6F9994', // пыльно-бирюзовый
  blue:   '#7BAEC8', // голубой (логотип)
  lilac:  '#9C8BB6', // фиолетовый (приглушённая лаванда)
};

// Прокидывается в Detail-контенты как заглушка совместимости — теперь
// каждый блок имеет свой цвет из SECTION_PALETTE (см. JSX ниже).
const BLOCK_COLORS = {
  resort: { bg: '#FFFFFF', border: SECTION_PALETTE.green },
  house:  { bg: '#FFFFFF', border: SECTION_PALETTE.amber },
  condo:  { bg: '#FFFFFF', border: SECTION_PALETTE.blue },
};

const BOOKABLE_UNIT_TYPES = new Set(['house', 'resort_house', 'condo_apartment']);

const AMENITY_KEYS = [
  'swimming_pool', 'gym', 'parking', 'internet', 'tv', 'washing_machine',
  'dishwasher', 'fridge', 'stove', 'oven', 'hood', 'microwave',
  'kettle', 'toaster', 'coffee_machine', 'multi_cooker', 'blender',
];

// Каждый ключ ссылается на одноимённый PNG. Старые перетасованные ссылки
// показывали неправильные картинки (бассейн ↔ паркинг, TV ↔ холодильник и т.д.)
const AMENITY_ICON_SOURCES = {
  swimming_pool:  require('../../assets/icon-amenity-swimming_pool.png'),
  gym:            require('../../assets/icon-amenity-gym.png'),
  parking:        require('../../assets/icon-amenity-parking.png'),
  internet:       require('../../assets/icon-amenity-internet.png'),
  tv:             require('../../assets/icon-amenity-tv.png'),
  washing_machine:require('../../assets/icon-amenity-washing_machine.png'),
  dishwasher:     require('../../assets/icon-amenity-dishwasher.png'),
  fridge:         require('../../assets/icon-amenity-fridge.png'),
  stove:          require('../../assets/icon-amenity-stove.png'),
  oven:           require('../../assets/icon-amenity-oven.png'),
  hood:           require('../../assets/icon-amenity-hood.png'),
  microwave:      require('../../assets/icon-amenity-microwave.png'),
  kettle:         require('../../assets/icon-amenity-kettle.png'),
  toaster:        require('../../assets/icon-amenity-toaster.png'),
  coffee_machine: require('../../assets/icon-amenity-coffee_machine.png'),
  multi_cooker:   require('../../assets/icon-amenity-multi_cooker.png'),
  blender:        require('../../assets/icon-amenity-blender.png'),
};

function SectionBlock({ color, border, children }) {
  return (
    <View style={[styles.sectionBlock, { backgroundColor: color, borderColor: border }]}>
      {children}
    </View>
  );
}

function InfoRow({ label, value, isLink, onPress, style }) {
  return (
    <View style={[styles.infoRow, style]}>
      <Text style={styles.infoLabel} numberOfLines={1}>{label}</Text>
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
    outputRange: ['0deg', '180deg'],
  });

  const codeDisplay = (resortCode != null ? resortCode : item.code) + (item.code_suffix ? ` (${item.code_suffix})` : '');

  return (
    <View style={styles.resortHouseCard}>
      <View style={[styles.resortHouseStripe, { backgroundColor: TYPE_COLORS.resort }]} />
      <View style={styles.resortHouseRow}>
        <TouchableOpacity
          style={styles.resortHouseMainArea}
          onPress={onPress}
          activeOpacity={onPress ? 0.7 : 1}
          disabled={!onPress}
        >
          <Text style={styles.resortHouseName} numberOfLines={1}>{item.name}</Text>
        </TouchableOpacity>
        <Text style={styles.resortHouseCode}>{codeDisplay}</Text>
        <TouchableOpacity onPress={onToggle} activeOpacity={0.5} style={styles.resortHouseExpandBtn}>
          <Animated.View style={{ transform: [{ rotate: arrowRotate }] }}>
            <Ionicons name="chevron-down" size={14} color="#C7C7CC" />
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


function MediaSection({ photos, videos, t, typeColors, onPhotoPress, onVideoPress }) {
  return (
    <SectionBlock color="#FFFFFF" border={SECTION_PALETTE.red}>
      <View style={styles.sectionTitleRow}>
        <IconPhoto size={22} color="#888" />
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
        <IconVideo size={22} color="#888" />
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
  const y = String(d.getFullYear()).slice(-2);
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
  const address = p.address || resort?.address || '';
  const googleMapsLink = p.google_maps_link || resort?.google_maps_link;
  const codeDisplay = resort
    ? (resort.code || '') + (p.code_suffix ? ` (${p.code_suffix})` : '')
    : p.code;

  const hasPrices = [p.price_monthly, p.booking_deposit, p.save_deposit, p.commission, p.owner_commission_one_time, p.owner_commission_monthly, p.electricity_price, p.water_price, p.gas_price, p.internet_price, p.cleaning_price, p.exit_cleaning_price].some(v => v != null);

  return (
    <>
      {/* 1. Фото/видео — red */}
      <MediaSection photos={photos} videos={videos} t={t} typeColors={typeColors} onPhotoPress={onPhotoPress} onVideoPress={onVideoPress} />

      {/* 2. Характеристики дома — orange */}
      <SectionBlock color="#FFFFFF" border={SECTION_PALETTE.orange}>
        <View style={styles.sectionTitleRow}>
          <IconSpecifications size={22} color="#888" />
          <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{t('pdSpecifications')}</Text>
        </View>
        <InfoRow label={t('propertyCode')} value={codeDisplay} />
        <InfoRow label={t('pdCity')} value={city} />
        <InfoRow label={t('propDistrict')} value={district} />
        {address ? <InfoRow label={t('pdAddress')} value={address} /> : null}
        {!hideLocation && (googleMapsLink ? (
          <InfoRow label={t('pdLocation')} value={t('pdGoogleMapLink')} isLink onPress={() => Linking.openURL(googleMapsLink)} />
        ) : (
          <InfoRow label={t('pdLocation')} value="—" />
        ))}
        {p.website_url ? (
          <InfoRow
            label={t('propertyWebPage')}
            value={t('goToWebsite')}
            isLink
            onPress={() => Linking.openURL((p.website_url || '').replace(/^(?!https?:\/\/)/, 'https://'))}
          />
        ) : null}
        <View style={styles.divider} />
        <InfoRow label={t('propBedrooms')} value={p.bedrooms != null ? `${p.bedrooms}  pc` : '—'} />
        <InfoRow label={t('pdBathrooms')} value={p.bathrooms != null ? `${p.bathrooms}  pc` : '—'} />
        <InfoRow label={t('pdArea')} value={p.area != null ? `${p.area}  m2` : '—'} />
        {isApartment && p.floor_number != null && (
          <InfoRow label={t('propFloorNumber')} value={String(p.floor_number)} />
        )}
        <InfoRow label={t('propBeach')} value={beachDistance != null ? `${beachDistance}  m` : '—'} />
        <InfoRow label={t('propMarket')} value={marketDistance != null ? `${marketDistance}  m` : '—'} />
      </SectionBlock>

      {/* 3. Контакты — amber. Телефоны кликабельные → системный набор номера. */}
      <SectionBlock color="#FFFFFF" border={SECTION_PALETTE.amber}>
        <View style={styles.sectionTitleRow}>
          <IconContacts size={22} color="#888" />
          <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{t('pdContacts')}</Text>
        </View>
        <OwnerInfoRow
          label={isApartment ? t('pdReception') : t('pdOwner')}
          name={ownerName}
          phone={p.ownerPhone1}
          whatsapp={p.ownerWhatsapp}
          telegram={p.ownerTelegram}
          isLink={!!ownerName}
          onPressName={onOwnerPress}
          alignRight
          t={t}
        />
        {isApartment && (p.owner2Name || p.owner2Phone1 || p.owner2Phone2 || p.owner2Whatsapp || p.owner2Telegram) ? (
          <>
            <View style={styles.divider} />
            <OwnerInfoRow
              label={t('pdOwnerContact')}
              name={owner2Name}
              phone={p.owner2Phone1}
              whatsapp={p.owner2Whatsapp}
              telegram={p.owner2Telegram}
              isLink={!!owner2Name}
              onPressName={onOwner2Press}
              alignRight
              t={t}
            />
          </>
        ) : null}
        {responsibleName !== undefined && (
          <>
            <View style={styles.divider} />
            <InfoRow label={t('propResponsibleLabel').replace(':', '')} value={responsibleName} />
          </>
        )}
      </SectionBlock>

      {/* 4. Цены — green */}
      {hasPrices && (
        <SectionBlock color="#FFFFFF" border={SECTION_PALETTE.green}>
          <View style={styles.sectionTitleRow}>
            <IconPrices size={22} color="#888" />
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{t('pdPrices')}</Text>
          </View>
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

      {/* 5. Брони — teal. Иконки тоже teal — в цвет блока. */}
      <SectionBlock color="#FFFFFF" border={SECTION_PALETTE.teal}>
        <View style={[styles.sectionTitleRow, styles.bookingListHeaderRow]}>
          <View style={styles.sectionTitleLeft}>
            <IconBookingList size={22} color="#888" />
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{t('pdBookingList')}</Text>
          </View>
          {onOpenBookingCalendar && (
            <TouchableOpacity onPress={() => onOpenBookingCalendar([p.id], resort ? codeDisplay : (p.name || p.code || ''))} style={styles.actionBtn} activeOpacity={0.7}>
              <IconBookings size={22} color="#3D7D82" />
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
                <View style={styles.bookingItemIcon}><IconHashtag size={19} color="#888" /></View>
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

      {/* 6. Удобства — blue */}
      <SectionBlock color="#FFFFFF" border={SECTION_PALETTE.blue}>
        <View style={styles.sectionTitleRow}>
          <IconAmenities size={22} color="#888" />
          <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{t('pdAmenities')}</Text>
        </View>
        <View style={styles.amenitiesGrid}>
          {AMENITY_KEYS.filter((key) => amenities[key]).map((key) => (
            <View key={key} style={styles.amenityItem}>
              <Image source={AMENITY_ICON_SOURCES[key]} style={styles.amenityIconImg} resizeMode="contain" />
              <Text style={styles.amenityLabel} numberOfLines={1}>{t(`amenity_${key}`)}</Text>
            </View>
          ))}
        </View>
        {!AMENITY_KEYS.some((key) => amenities[key]) && (
          <Text style={styles.amenityEmpty}>—</Text>
        )}
      </SectionBlock>

      {/* 7. Детали (кондиционеры, интернет, питомцы, долгосрок) — lilac */}
      <SectionBlock color="#FFFFFF" border={SECTION_PALETTE.lilac}>
        <InfoRow label={t('pdAirCon')} value={p.air_conditioners != null ? `${p.air_conditioners}  pc` : '—'} />
        <InfoRow label={t('pdInternetSpeed')} value={p.internet_speed ? `${p.internet_speed} ${t('pdInternetSpeedUnit')}` : '—'} />
        <InfoRow label={t('pdPets')} value={p.pets_allowed ? t('pdToBeDiscussed') : t('pdForbidden')} />
        <InfoRow label={t('pdLongTerm')} value={p.long_term_booking ? t('pdAllowed') : t('pdForbidden')} style={styles.infoRowNoMargin} />
      </SectionBlock>

      {/* Описание и комментарии — без цветной карточки, простой текст */}
      {p.description ? (
        <View style={styles.descriptionBlock}>
          <View style={styles.sectionTitleRow}>
            <IconDescription size={22} color="#888" />
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{t('pdDescription')}</Text>
          </View>
          <Text style={styles.descriptionText}>{p.description}</Text>
        </View>
      ) : null}

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
      setResortHouses(sortByInternalCode(all.filter(h => h.parent_id === p.id)));
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
      {/* 1. Фото/видео — red */}
      <MediaSection photos={photos} videos={videos} t={t} typeColors={typeColors} onPhotoPress={onPhotoPress} onVideoPress={onVideoPress} />

      {/* 2. Характеристики курорта — orange */}
      <SectionBlock color="#FFFFFF" border={SECTION_PALETTE.orange}>
        <View style={styles.sectionTitleRow}>
          <IconSpecifications size={22} color="#888" />
          <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{t('pdSpecifications')}</Text>
        </View>
        <InfoRow label={t('propertyCode')} value={p.code} />
        <InfoRow label={t('pdCity')} value={p.city} />
        <InfoRow label={t('propDistrict')} value={p.district} />
        {p.address ? <InfoRow label={t('pdAddress')} value={p.address} /> : null}
        {!hideLocation && (p.google_maps_link ? (
          <InfoRow label={t('pdLocation')} value={t('pdGoogleMapLink')} isLink onPress={() => Linking.openURL(p.google_maps_link)} />
        ) : (
          <InfoRow label={t('pdLocation')} value="—" />
        ))}
        <View style={styles.divider} />
        <InfoRow label={t('propHouses')} value={p.houses_count != null ? `${p.houses_count}  pc` : '—'} />
        <InfoRow label={t('propBeach')} value={p.beach_distance != null ? `${p.beach_distance}  m` : '—'} />
        <InfoRow label={t('propMarket')} value={p.market_distance != null ? `${p.market_distance}  m` : '—'} />
      </SectionBlock>

      {/* 3. Контакты — amber. Телефоны кликабельные → системный набор номера. */}
      <SectionBlock color="#FFFFFF" border={SECTION_PALETTE.amber}>
        <View style={styles.sectionTitleRow}>
          <IconContacts size={22} color="#888" />
          <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{t('pdContacts')}</Text>
        </View>
        <OwnerInfoRow
          label={t('pdOwnerManager')}
          name={ownerName}
          phone={p.ownerPhone1}
          whatsapp={p.ownerWhatsapp}
          telegram={p.ownerTelegram}
          isLink={!!ownerName}
          onPressName={onOwnerPress}
          alignRight
          t={t}
        />
        {responsibleName !== undefined && (
          <>
            <View style={styles.divider} />
            <InfoRow label={t('propResponsibleLabel').replace(':', '')} value={responsibleName} />
          </>
        )}
      </SectionBlock>

      {/* 4. Брони — green */}
      <SectionBlock color="#FFFFFF" border={SECTION_PALETTE.green}>
        <View style={[styles.sectionTitleRow, styles.bookingListHeaderRow]}>
            <View style={styles.sectionTitleLeft}>
              <IconBookingList size={22} color="#888" />
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{t('pdBookingList')}</Text>
            </View>
            {onOpenBookingCalendar && (
              <TouchableOpacity onPress={() => onOpenBookingCalendar(resortHouses.map((h) => h.id), p.name || p.code || '')} style={styles.actionBtn} activeOpacity={0.7}>
                <IconBookings size={22} color="#3D7D82" />
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
                <View style={styles.bookingItemIcon}><IconHashtag size={19} color="#888" /></View>
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
            <IconDescription size={22} color="#888" />
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{t('pdDescription')}</Text>
          </View>
          <Text style={styles.descriptionText}>{p.description}</Text>
        </View>
      ) : null}

      {/* Houses toolbar */}
      <View style={[styles.housesToolbar, { justifyContent: 'flex-end' }]}>
        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} onPress={toggleAllHouses}>
          {allHousesExpanded
            ? <IconFolderOpen size={22} color="#888" />
            : <IconFolderClosed size={22} color="#888" />}
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
    outputRange: ['0deg', '180deg'],
  });

  const codeDisplay = (item.code_suffix ? `${item.code || ''} (${item.code_suffix})` : item.code) || '';

  return (
    <View style={styles.resortHouseCard}>
      <View style={[styles.resortHouseStripe, { backgroundColor: TYPE_COLORS.condo }]} />
      <View style={styles.resortHouseRow}>
        <TouchableOpacity
          style={styles.resortHouseMainArea}
          onPress={onPress}
          activeOpacity={onPress ? 0.7 : 1}
          disabled={!onPress}
        >
          <Text style={styles.resortHouseName} numberOfLines={1}>{item.name}</Text>
        </TouchableOpacity>
        <Text style={styles.resortHouseCode}>{codeDisplay}</Text>
        <TouchableOpacity onPress={onToggle} activeOpacity={0.5} style={styles.resortHouseExpandBtn}>
          <Animated.View style={{ transform: [{ rotate: arrowRotate }] }}>
            <Ionicons name="chevron-down" size={14} color="#C7C7CC" />
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
      setApartments(sortByInternalCode(all.filter(a => a.parent_id === p.id)));
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
      {/* 1. Фото/видео — red */}
      <MediaSection photos={photos} videos={videos} t={t} typeColors={typeColors} onPhotoPress={onPhotoPress} onVideoPress={onVideoPress} />

      {/* 2. Характеристики кондо — orange */}
      <SectionBlock color="#FFFFFF" border={SECTION_PALETTE.orange}>
        <View style={styles.sectionTitleRow}>
          <IconSpecifications size={22} color="#888" />
          <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{t('pdSpecifications')}</Text>
        </View>
        <InfoRow label={t('propertyCode')} value={p.code} />
        <InfoRow label={t('pdCity')} value={p.city} />
        <InfoRow label={t('propDistrict')} value={p.district} />
        {p.address ? <InfoRow label={t('pdAddress')} value={p.address} /> : null}
        {!hideLocation && (p.google_maps_link ? (
          <InfoRow label={t('pdLocation')} value={t('pdGoogleMapLink')} isLink onPress={() => Linking.openURL(p.google_maps_link)} />
        ) : (
          <InfoRow label={t('pdLocation')} value="—" />
        ))}
        {p.website_url ? (
          <InfoRow
            label={t('propertyWebPage')}
            value={t('goToWebsite')}
            isLink
            onPress={() => Linking.openURL((p.website_url || '').replace(/^(?!https?:\/\/)/, 'https://'))}
          />
        ) : null}
        <View style={styles.divider} />
        <InfoRow label={t('propFloors')} value={p.floors != null ? `${p.floors}` : '—'} />
        <InfoRow label={t('propBeach')} value={p.beach_distance != null ? `${p.beach_distance}  m` : '—'} />
        <InfoRow label={t('propMarket')} value={p.market_distance != null ? `${p.market_distance}  m` : '—'} />
      </SectionBlock>

      {/* 3. Контакты — amber. Телефоны кликабельные → системный набор номера. */}
      <SectionBlock color="#FFFFFF" border={SECTION_PALETTE.amber}>
        <View style={styles.sectionTitleRow}>
          <IconContacts size={22} color="#888" />
          <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{t('pdContacts')}</Text>
        </View>
        <OwnerInfoRow
          label={t('pdReception')}
          name={p.ownerName}
          phone={p.ownerPhone1}
          whatsapp={p.ownerWhatsapp}
          telegram={p.ownerTelegram}
          isLink={!!p.ownerName}
          onPressName={onOwnerPress}
          alignRight
          t={t}
        />
        {responsibleName !== undefined && (
          <>
            <View style={styles.divider} />
            <InfoRow label={t('propResponsibleLabel').replace(':', '')} value={responsibleName} />
          </>
        )}
      </SectionBlock>

      {/* 4. Брони — green */}
      <SectionBlock color="#FFFFFF" border={SECTION_PALETTE.green}>
        <View style={[styles.sectionTitleRow, styles.bookingListHeaderRow]}>
            <View style={styles.sectionTitleLeft}>
              <IconBookingList size={22} color="#888" />
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{t('pdBookingList')}</Text>
            </View>
            {onOpenBookingCalendar && (
              <TouchableOpacity onPress={() => onOpenBookingCalendar(apartments.map((a) => a.id), p.name || p.code || '')} style={styles.actionBtn} activeOpacity={0.7}>
                <IconBookings size={22} color="#3D7D82" />
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
                <View style={styles.bookingItemIcon}><IconHashtag size={19} color="#888" /></View>
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
            <IconDescription size={22} color="#888" />
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{t('pdDescription')}</Text>
          </View>
          <Text style={styles.descriptionText}>{p.description}</Text>
        </View>
      ) : null}

      <View style={[styles.housesToolbar, { justifyContent: 'flex-end' }]}>
        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} onPress={toggleAll}>
          {allExpanded
            ? <IconFolderOpen size={22} color="#888" />
            : <IconFolderClosed size={22} color="#888" />}
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
  const canBook = user?.teamPermissions?.can_manage_bookings;
  const isParentContainer = (p?.type === 'resort' || p?.type === 'condo') && !p?.parent_id;
  const propertiesList = Array.isArray(properties) ? properties : [];
  const hasChildren = propertiesList.some((child) => child.parent_id === p?.id);
  const needsSecondDeleteConfirm = isAdminRole && isParentContainer && hasChildren;
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

  // Синхронизируем p с актуальными данными из AppDataContext.
  useEffect(() => {
    if (!p?.id || !properties?.length) return;
    const fresh = properties.find(x => x.id === p.id);
    if (fresh && fresh !== p) setP(fresh);
  }, [p?.id, properties]);

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
            ownerWhatsapp: owner.whatsapp || '',
            ownerTelegram: owner.telegram || '',
          });
        } else {
          setOwnerContact(null);
          Object.assign(updates, { ownerName: '', ownerPhone1: '', ownerPhone2: '', ownerWhatsapp: '', ownerTelegram: '' });
        }
      } else {
        setOwnerContact(null);
        Object.assign(updates, { ownerName: '', ownerPhone1: '', ownerPhone2: '', ownerWhatsapp: '', ownerTelegram: '' });
      }
      if (prop.owner_id_2) {
        const owner2 = owners.find(o => o.id === prop.owner_id_2);
        if (owner2) {
          setOwner2Contact(owner2);
          Object.assign(updates, {
            owner2Name: `${owner2.name} ${owner2.lastName}`.trim(),
            owner2Phone1: owner2.phone || '',
            owner2Phone2: owner2.extraPhones?.[0] || '',
            owner2Whatsapp: owner2.whatsapp || '',
            owner2Telegram: owner2.telegram || '',
          });
        } else {
          setOwner2Contact(null);
          Object.assign(updates, { owner2Name: '', owner2Phone1: '', owner2Phone2: '', owner2Whatsapp: '', owner2Telegram: '' });
        }
      } else {
        setOwner2Contact(null);
        Object.assign(updates, { owner2Name: '', owner2Phone1: '', owner2Phone2: '', owner2Whatsapp: '', owner2Telegram: '' });
      }
      setP(prev => ({ ...prev, ...updates }));
    } catch {}
  }, []);

  useEffect(() => {
    setP(property);
    loadOwnerData(property);
  }, [property, loadOwnerData]);

  useEffect(() => {
    loadResortData(property?.parent_id);
  }, [property?.parent_id, loadResortData]);

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
      const oldThumbs = Array.isArray(p.photos_thumb) ? p.photos_thumb : [];
      const oldPhotos = Array.isArray(p.photos) ? p.photos : [];
      const deletedIdx = oldPhotos.indexOf(deletedUrl);
      const deletedThumb = deletedIdx >= 0 ? oldThumbs[deletedIdx] : null;
      const newThumbs = oldThumbs.filter((_, i) => i !== deletedIdx);
      await deletePhotoFromStorage(deletedUrl);
      if (deletedThumb) await deletePhotoFromStorage(deletedThumb);
      const updated = await updateProperty(p.id, { photos: newPhotos, photos_thumb: newThumbs });
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

  const handleDeletePress = useCallback(async () => {
    // TD-061: для не-контейнера подтверждение делает родитель через onDelete (Alert с pdDeleteConfirm).
    // Здесь добавляем предварительный alert с count броней, если они есть.
    let bookingsCount = 0;
    try { bookingsCount = await getBookingsCountForProperty(p.id); } catch {}

    const showBookingsAlertIfAny = (afterConfirm) => {
      if (bookingsCount > 0) {
        Alert.alert(
          t('deletePropertyTitle'),
          t('deletePropertyWithBookingsText').replace('{count}', String(bookingsCount)),
          [
            { text: t('cancel'), style: 'cancel' },
            { text: t('deleteAction'), style: 'destructive', onPress: afterConfirm },
          ]
        );
      } else {
        afterConfirm();
      }
    };

    if (!needsSecondDeleteConfirm) {
      showBookingsAlertIfAny(() => onDelete?.());
      return;
    }

    // Контейнер с детьми: сохраняем двойное подтверждение (pdDeleteConfirm → deleteContainerWithUnitsText).
    showBookingsAlertIfAny(() => {
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
                  { text: t('deleteAction'), style: 'destructive', onPress: async () => { await handleDirectDelete(); } },
                ]
              );
            },
          },
        ]
      );
    });
  }, [p?.id, needsSecondDeleteConfirm, onDelete, t, handleDirectDelete]);

  const handleWizardSave = async (updates) => {
    try {
      const oldPhotos = Array.isArray(p.photos) ? p.photos : [];
      const newPhotos = Array.isArray(updates.photos) ? updates.photos : [];
      for (const url of oldPhotos) {
        if (!newPhotos.includes(url)) {
          await deletePhotoFromStorage(url);
        }
      }
      const oldThumbs = Array.isArray(p.photos_thumb) ? p.photos_thumb : [];
      const newThumbs = Array.isArray(updates.photos_thumb) ? updates.photos_thumb : [];
      for (const url of oldThumbs) {
        if (url && !newThumbs.includes(url)) {
          await deletePhotoFromStorage(url);
        }
      }

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
    parent_id: p.id,
    name: '',
    code: p.code || '',
    city: p.city || '',
    location_id: p.location_id || null,
    owner_id: p.owner_id || null,
    responsible_agent_id: p.responsible_agent_id ?? null,
    district: p.district || '',
    google_maps_link: p.google_maps_link || '',
    address: p.address || '',
    currency: p.currency || null,
  };

  const draftApartmentInCondo = {
    type: 'condo_apartment',
    parent_id: p.id,
    name: '',
    code: p.code || '',
    city: p.city || '',
    location_id: p.location_id || null,
    owner_id: p.owner_id || null,
    responsible_agent_id: p.responsible_agent_id ?? null,
    district: p.district || '',
    google_maps_link: p.google_maps_link || '',
    address: p.address || '',
    currency: p.currency || null,
  };

  const handleAddHouseSave = async (updates) => {
    try {
      const fullData = {
        ...updates,
        parent_id: p.id,
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
        ...detailsToUpdate
      } = fullData;

      const created = await createPropertyFull({
        ...fullData,
        type: 'resort_house',
        responsible_agent_id: p.responsible_agent_id ?? null,
      });

      setAddHouseWizardVisible(false);
      setNewHouseIdToExpand(created?.id);
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
        parent_id: p.id,
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
        ...detailsToUpdate
      } = fullData;

      await createPropertyFull({
        ...fullData,
        type: 'condo_apartment',
        responsible_agent_id: p.responsible_agent_id ?? null,
      });

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

  const companyDisplayName = user?.companyInfo?.name || t('workAsCompany');
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
          <Ionicons name="chevron-back" size={20} color="#2C2C2C" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{p.name}</Text>
        <View style={styles.backBtn} />
      </View>

      {/* Строка действий */}
      <View style={styles.actionsRow}>
        {/* Удалить — все могут удалять свои объекты; admin-режим всегда */}
        {(!isAgentRole || isCreator) && (
          <TouchableOpacity style={styles.actionBtn} onPress={handleDeletePress} activeOpacity={0.7}>
            <Ionicons name="trash-outline" size={22} color="#888" />
          </TouchableOpacity>
        )}
        <View style={[styles.actionsRight, isTeamMember && { flex: 1, justifyContent: 'flex-end' }]}>
          {/* Редактировать */}
          <TouchableOpacity style={styles.actionBtn} onPress={() => setWizardVisible(true)} activeOpacity={0.7}>
            <IconPencil size={22} color="#888" />
          </TouchableOpacity>
          {/* Добавить бронирование / добавить дом — для агента только если есть can_manage_bookings */}
          {(!isTeamMember || canBook) && (
            <TouchableOpacity
              style={styles.actionBtn}
              activeOpacity={0.7}
              onPress={() => {
                if (p.type === 'resort') setAddHouseWizardVisible(true);
                else if (p.type === 'condo') setAddApartmentWizardVisible(true);
                else if (BOOKABLE_UNIT_TYPES.has(p.type)) setAddBookingVisible(true);
              }}
            >
              <Ionicons name="add-outline" size={22} color="#888" />
            </TouchableOpacity>
          )}
        </View>
      </View>

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
            onOpenBookingCalendar={(ids, subtitle) => { setCalendarPropertyIds(ids || []); setCalendarSubtitle(subtitle || ''); setCalendarModalVisible(true); }}
            hideLocation={false}
            responsibleName={(isAdmin && user?.companyInfo?.name?.trim()) ? responsibleName : undefined}
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
            onOpenBookingCalendar={(ids, subtitle) => { setCalendarPropertyIds(ids || []); setCalendarSubtitle(subtitle || ''); setCalendarModalVisible(true); }}
            hideLocation={false}
            responsibleName={(isAdmin && user?.companyInfo?.name?.trim()) ? responsibleName : undefined}
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
            resort={p.parent_id ? resort : null}
            refreshBookingsTrigger={refreshBookingsTrigger}
            onBookingPress={(b, codePart) => {
              setSelectedBooking(b);
              setSelectedBookingTitle(codePart || '');
            }}
            onOpenBookingCalendar={(ids, subtitle) => { setCalendarPropertyIds(ids || []); setCalendarSubtitle(subtitle || ''); setCalendarModalVisible(true); }}
            hideLocation={false}
            responsibleName={(isAdmin && user?.companyInfo?.name?.trim()) ? responsibleName : undefined}
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
        parentResort={p.parent_id ? resort : null}
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
    backgroundColor: '#F5F5F7',
    paddingTop: TOP_INSET,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 14,
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
    fontWeight: '600',
    letterSpacing: -0.3,
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
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: '#E5E5EA',
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
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
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
    fontSize: 16,
    fontWeight: '600',
    color: '#2C2C2C',
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B6B6B',
  },
  infoValueWrap: {
    flex: 1,
  },
  infoValue: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    textAlign: 'right',
  },
  infoLink: {
    color: '#3D7D82',
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
    width: 110,
    height: 88,
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
    fontSize: 14,
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
    fontSize: 14,
    color: '#3D7D82',
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
    fontSize: 16,
    color: '#2C2C2C',
    lineHeight: 22,
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
    width: 20,
    height: 20,
    marginRight: 10,
    opacity: 0.8,
  },
  amenityLabel: {
    flex: 1,
    fontSize: 14,
    color: '#2C2C2C',
  },
  amenityEmpty: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  priceIcon: {
    fontSize: 16,
    width: 26,
  },
  priceIconImg: {
    width: 24,
    height: 24,
    marginRight: 4,
    opacity: 0.8,
  },
  priceLabel: {
    fontSize: 14,
    fontWeight: '400',
    color: '#2C2C2C',
    flex: 1,
  },
  priceValue: {
    fontSize: 16,
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
  // Карточка дома/квартиры внутри Resort/Condo — повторяет propertyCard с главной:
  // белый фон, скруглённые углы, мягкая тень, цветная полоска слева по типу.
  resortHouseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
    overflow: 'hidden',
  },
  resortHouseStripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
  },
  resortHouseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingLeft: 20,
    paddingRight: 14,
  },
  resortHouseMainArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  resortHouseName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#2C2C2C',
    letterSpacing: -0.3,
  },
  resortHouseCode: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3D7D82',
    marginRight: 10,
  },
  resortHouseExpandBtn: {
    paddingVertical: 8,
    paddingLeft: 12,
    paddingRight: 4,
  },
  resortHouseExpanded: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
    paddingTop: 8,
  },
  emptyHouses: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 12,
  },
});
