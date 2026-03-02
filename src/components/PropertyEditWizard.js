import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  Animated,
  Alert,
  Image,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { useLanguage } from '../context/LanguageContext';
import { getLocations } from '../services/locationsService';
import { getProperties } from '../services/propertiesService';
import { getContacts, createContact } from '../services/contactsService';
import { uploadPhoto, isLocalUri } from '../services/storageService';
import AddContactModal from './AddContactModal';

const COLORS = {
  bg: 'rgba(255,255,255,0.92)',
  title: '#2C2C2C',
  inputBg: '#F5F2EB',
  border: '#E0D8CC',
  green: '#2E7D32',
  greenBg: 'rgba(46,125,50,0.06)',
  greenBorder: 'rgba(46,125,50,0.5)',
  dot: '#D5D5D0',
  dotActive: '#2E7D32',
};

const AMENITY_KEYS = [
  'swimming_pool', 'gym', 'parking', 'internet', 'tv', 'washing_machine',
  'dishwasher', 'fridge', 'stove', 'oven', 'hood', 'microwave',
  'kettle', 'toaster', 'coffee_machine', 'multi_cooker', 'blender',
];

function Field({ label, value, onChangeText, placeholder, keyboardType, multiline }) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={[s.input, multiline && s.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || ''}
        placeholderTextColor="#999"
        keyboardType={keyboardType || 'default'}
        returnKeyType={multiline ? 'default' : 'done'}
        multiline={multiline}
      />
    </View>
  );
}

function StepInfo({ data, setData, t, propertyType, locations, knownDistricts, owners, onNewOwnerCreated }) {
  const [cityOpen, setCityOpen] = useState(false);
  const [districtOpen, setDistrictOpen] = useState(false);
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [addOwnerModal, setAddOwnerModal] = useState(false);
  const [newDistrict, setNewDistrict] = useState('');

  const closeAllPickers = (except) => {
    if (except !== 'city') setCityOpen(false);
    if (except !== 'district') setDistrictOpen(false);
    if (except !== 'owner') setOwnerOpen(false);
  };

  const handleSelectLocation = (loc) => {
    setData(d => ({ ...d, city: loc.city, location_id: loc.id, district: '' }));
    setCityOpen(false);
  };

  const districtsForCity = (knownDistricts || []).filter(d => d.city === data.city).map(d => d.district);
  const uniqueDistricts = [...new Set(districtsForCity)].filter(Boolean).sort();

  const handleSelectDistrict = (district) => {
    setData(d => ({ ...d, district }));
    setDistrictOpen(false);
    setNewDistrict('');
  };

  const handleAddNewDistrict = () => {
    const trimmed = newDistrict.trim();
    if (!trimmed) return;
    setData(d => ({ ...d, district: trimmed }));
    setDistrictOpen(false);
    setNewDistrict('');
  };

  const handleSelectOwner = (owner) => {
    setData(d => ({ ...d, owner_id: owner.id, _ownerName: `${owner.name} ${owner.lastName}`.trim() }));
    setOwnerOpen(false);
  };

  const handleClearOwner = () => {
    setData(d => ({ ...d, owner_id: null, _ownerName: '' }));
    setOwnerOpen(false);
  };

  const handleNewOwnerSave = async (contactData) => {
    try {
      const newOwner = await createContact({ ...contactData, type: 'owners' });
      setData(d => ({ ...d, owner_id: newOwner.id, _ownerName: `${newOwner.name} ${newOwner.lastName}`.trim() }));
      setAddOwnerModal(false);
      onNewOwnerCreated?.();
    } catch (e) {
      Alert.alert('Error', e.message || 'Error');
    }
  };

  const ownerDisplay = data._ownerName || (owners || []).find(o => o.id === data.owner_id)?.name || '';

  return (
    <>
      <Field label={t('propertyName')} value={data.name} onChangeText={v => setData(d => ({ ...d, name: v }))} />
      <Field label={t('propertyCode')} value={data.code} onChangeText={v => setData(d => ({ ...d, code: v }))} />

      {/* City picker */}
      <View style={s.fieldWrap}>
        <Text style={s.fieldLabel}>{t('pdCity')}</Text>
        <TouchableOpacity
          style={s.pickerBtn}
          onPress={() => { closeAllPickers('city'); setCityOpen(!cityOpen); }}
          activeOpacity={0.7}
        >
          <Text style={[s.pickerBtnText, !data.city && s.pickerBtnPlaceholder]}>
            {data.city || t('wizSelectCity')}
          </Text>
          <Text style={s.pickerArrow}>{cityOpen ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        {cityOpen && (
          <View style={s.pickerDropdown}>
            {locations.length === 0 ? (
              <Text style={s.pickerEmpty}>{t('wizNoLocations')}</Text>
            ) : (
              locations.map(loc => (
                <TouchableOpacity
                  key={loc.id}
                  style={[s.pickerItem, data.location_id === loc.id && s.pickerItemActive]}
                  onPress={() => handleSelectLocation(loc)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.pickerItemCity, data.location_id === loc.id && s.pickerItemCityActive]}>{loc.city}</Text>
                  <Text style={s.pickerItemSub}>{[loc.country, loc.region].filter(Boolean).join(' / ')}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </View>

      {/* District picker */}
      <View style={s.fieldWrap}>
        <Text style={s.fieldLabel}>{t('propDistrict')}</Text>
        <TouchableOpacity
          style={s.pickerBtn}
          onPress={() => { closeAllPickers('district'); setDistrictOpen(!districtOpen); }}
          activeOpacity={0.7}
        >
          <Text style={[s.pickerBtnText, !data.district && s.pickerBtnPlaceholder]}>
            {data.district || t('wizSelectDistrict')}
          </Text>
          <Text style={s.pickerArrow}>{districtOpen ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        {districtOpen && (
          <View style={s.pickerDropdown}>
            {uniqueDistricts.length > 0 && uniqueDistricts.map(d => (
              <TouchableOpacity
                key={d}
                style={[s.pickerItem, data.district === d && s.pickerItemActive]}
                onPress={() => handleSelectDistrict(d)}
                activeOpacity={0.7}
              >
                <Text style={[s.pickerItemCity, data.district === d && s.pickerItemCityActive]}>{d}</Text>
              </TouchableOpacity>
            ))}
            <View style={s.newDistrictRow}>
              <TextInput
                style={s.newDistrictInput}
                value={newDistrict}
                onChangeText={setNewDistrict}
                placeholder={t('wizNewDistrict')}
                placeholderTextColor="#999"
                returnKeyType="done"
                onSubmitEditing={handleAddNewDistrict}
              />
              <TouchableOpacity style={s.newDistrictBtn} onPress={handleAddNewDistrict} activeOpacity={0.7}>
                <Text style={s.newDistrictBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <Field label={t('pdLocation') + ' (Google Maps)'} value={data.google_maps_link} onChangeText={v => setData(d => ({ ...d, google_maps_link: v }))} placeholder="https://maps.google.com/..." />

      {/* Owner picker */}
      <View style={s.fieldWrap}>
        <Text style={s.fieldLabel}>{t('wizOwner')}</Text>
        <TouchableOpacity
          style={s.pickerBtn}
          onPress={() => { closeAllPickers('owner'); setOwnerOpen(!ownerOpen); }}
          activeOpacity={0.7}
        >
          <Text style={[s.pickerBtnText, !ownerDisplay && s.pickerBtnPlaceholder]}>
            {ownerDisplay || t('wizSelectOwner')}
          </Text>
          <Text style={s.pickerArrow}>{ownerOpen ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        {ownerOpen && (
          <View style={s.pickerDropdown}>
            {data.owner_id && (
              <TouchableOpacity style={s.pickerItemClear} onPress={handleClearOwner} activeOpacity={0.7}>
                <Text style={s.pickerItemClearText}>✕  {t('wizClearOwner')}</Text>
              </TouchableOpacity>
            )}
            {(owners || []).map(owner => (
              <TouchableOpacity
                key={owner.id}
                style={[s.pickerItem, data.owner_id === owner.id && s.pickerItemActive]}
                onPress={() => handleSelectOwner(owner)}
                activeOpacity={0.7}
              >
                <Text style={[s.pickerItemCity, data.owner_id === owner.id && s.pickerItemCityActive]}>
                  {`${owner.name} ${owner.lastName}`.trim()}
                </Text>
                {owner.phone ? <Text style={s.pickerItemSub}>{owner.phone}</Text> : null}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={s.pickerItemNew}
              onPress={() => { setOwnerOpen(false); setAddOwnerModal(true); }}
              activeOpacity={0.7}
            >
              <Text style={s.pickerItemNewText}>+  {t('wizNewOwner')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <AddContactModal
        visible={addOwnerModal}
        onClose={() => setAddOwnerModal(false)}
        onSave={handleNewOwnerSave}
        contactType="owners"
      />
    </>
  );
}

function StepCharacteristics({ data, setData, t, propertyType }) {
  return (
    <>
      {propertyType === 'house' && (
        <>
          <Field label={t('propBedrooms')} value={data.bedrooms} onChangeText={v => setData(d => ({ ...d, bedrooms: v }))} keyboardType="numeric" />
          <Field label={t('pdBathrooms')} value={data.bathrooms} onChangeText={v => setData(d => ({ ...d, bathrooms: v }))} keyboardType="numeric" />
          <Field label={t('pdArea') + ' (m\u00B2)'} value={data.area} onChangeText={v => setData(d => ({ ...d, area: v }))} keyboardType="numeric" />
        </>
      )}
      {propertyType === 'resort' && (
        <Field label={t('propHouses')} value={data.houses_count} onChangeText={v => setData(d => ({ ...d, houses_count: v }))} keyboardType="numeric" />
      )}
      {propertyType === 'condo' && (
        <Field label={t('propFloors')} value={data.floors} onChangeText={v => setData(d => ({ ...d, floors: v }))} keyboardType="numeric" />
      )}
      <Field label={t('propBeach') + ' (m)'} value={data.beach_distance} onChangeText={v => setData(d => ({ ...d, beach_distance: v }))} keyboardType="numeric" />
      <Field label={t('propMarket') + ' (m)'} value={data.market_distance} onChangeText={v => setData(d => ({ ...d, market_distance: v }))} keyboardType="numeric" />
    </>
  );
}

function StepDescription({ data, setData, t }) {
  return (
    <Field label={t('pdDescription')} value={data.description} onChangeText={v => setData(d => ({ ...d, description: v }))} multiline placeholder={t('wizDescPlaceholder')} />
  );
}

function StepComments({ data, setData, t }) {
  return (
    <Field label={t('pdComments')} value={data.comments} onChangeText={v => setData(d => ({ ...d, comments: v }))} multiline placeholder={t('wizCommPlaceholder')} />
  );
}

function StepMedia({ data, setData, t }) {
  const photos = Array.isArray(data.photos) ? data.photos : [];
  const videos = Array.isArray(data.videos) ? data.videos : [];
  const [videoUrl, setVideoUrl] = useState('');

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: 10,
    });
    if (!result.canceled && result.assets?.length > 0) {
      const newUris = result.assets.map(a => a.uri);
      setData(d => ({ ...d, photos: [...(d.photos || []), ...newUris] }));
    }
  };

  const removePhoto = (index) => {
    setData(d => {
      const next = [...(d.photos || [])];
      next.splice(index, 1);
      return { ...d, photos: next };
    });
  };

  const addVideo = () => {
    const trimmed = videoUrl.trim();
    if (!trimmed) return;
    setData(d => ({ ...d, videos: [...(d.videos || []), trimmed] }));
    setVideoUrl('');
  };

  const removeVideo = (index) => {
    setData(d => {
      const next = [...(d.videos || [])];
      next.splice(index, 1);
      return { ...d, videos: next };
    });
  };

  return (
    <>
      <Text style={s.mediaSectionTitle}>📷  {t('pdPhoto')}</Text>
      <View style={s.mediaGrid}>
        {photos.map((uri, i) => (
          <View key={i} style={s.mediaThumbWrap}>
            <Image source={{ uri }} style={s.mediaThumb} resizeMode="cover" />
            <TouchableOpacity style={s.mediaRemoveBtn} onPress={() => removePhoto(i)} activeOpacity={0.7}>
              <Text style={s.mediaRemoveText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={s.mediaAddBtn} onPress={pickPhoto} activeOpacity={0.7}>
          <Text style={s.mediaAddIcon}>+</Text>
          <Text style={s.mediaAddLabel}>{t('wizAddPhoto')}</Text>
        </TouchableOpacity>
      </View>

      <Text style={[s.mediaSectionTitle, { marginTop: 20 }]}>🎬  {t('pdVideo')}</Text>
      {videos.map((url, i) => (
        <View key={i} style={s.videoRow}>
          <Text style={s.videoUrl} numberOfLines={1}>{url}</Text>
          <TouchableOpacity onPress={() => removeVideo(i)} activeOpacity={0.7}>
            <Text style={s.videoRemoveText}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}
      <View style={s.newDistrictRow}>
        <TextInput
          style={s.newDistrictInput}
          value={videoUrl}
          onChangeText={setVideoUrl}
          placeholder={t('wizVideoPlaceholder')}
          placeholderTextColor="#999"
          returnKeyType="done"
          onSubmitEditing={addVideo}
          autoCapitalize="none"
        />
        <TouchableOpacity style={s.newDistrictBtn} onPress={addVideo} activeOpacity={0.7}>
          <Text style={s.newDistrictBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

function StepAmenities({ data, setData, t }) {
  const amenities = data.amenities || {};
  const toggle = (key) => {
    setData(d => ({ ...d, amenities: { ...d.amenities, [key]: !d.amenities?.[key] } }));
  };
  return (
    <>
      {AMENITY_KEYS.map(key => (
        <TouchableOpacity
          key={key}
          style={s.switchRow}
          onPress={() => toggle(key)}
          activeOpacity={0.7}
        >
          <Text style={s.switchLabel}>{t(`amenity_${key}`)}</Text>
          <View style={[s.toggleTrack, amenities[key] && s.toggleTrackOn]}>
            <View style={[s.toggleThumb, amenities[key] && s.toggleThumbOn]} />
          </View>
        </TouchableOpacity>
      ))}
    </>
  );
}

function StepAdditional({ data, setData, t, propertyType }) {
  return (
    <>
      {propertyType === 'house' && (
        <>
          <Field label={t('pdAirCon')} value={data.air_conditioners} onChangeText={v => setData(d => ({ ...d, air_conditioners: v }))} keyboardType="numeric" />
          <Field label={t('pdInternetSpeed')} value={data.internet_speed} onChangeText={v => setData(d => ({ ...d, internet_speed: v }))} placeholder="300 mbt/s" />
        </>
      )}
      <TouchableOpacity style={s.switchRow} onPress={() => setData(d => ({ ...d, pets_allowed: !d.pets_allowed }))} activeOpacity={0.7}>
        <Text style={s.switchLabel}>{t('pdPets')}</Text>
        <View style={[s.toggleTrack, data.pets_allowed && s.toggleTrackOn]}>
          <View style={[s.toggleThumb, data.pets_allowed && s.toggleThumbOn]} />
        </View>
      </TouchableOpacity>
      <TouchableOpacity style={s.switchRow} onPress={() => setData(d => ({ ...d, long_term_booking: !d.long_term_booking }))} activeOpacity={0.7}>
        <Text style={s.switchLabel}>{t('pdLongTerm')}</Text>
        <View style={[s.toggleTrack, data.long_term_booking && s.toggleTrackOn]}>
          <View style={[s.toggleThumb, data.long_term_booking && s.toggleThumbOn]} />
        </View>
      </TouchableOpacity>
    </>
  );
}

function StepPricing({ data, setData, t }) {
  const WATER_TYPES = [
    { key: 'cubic', label: t('pdPerCubic') },
    { key: 'person', label: t('pdPerPerson') },
    { key: 'fixed', label: t('pdFixed') },
  ];
  return (
    <>
      <Field label={t('pdPriceMonthly')} value={data.price_monthly} onChangeText={v => setData(d => ({ ...d, price_monthly: v }))} keyboardType="numeric" />
      <Field label={t('pdBookingDeposit')} value={data.booking_deposit} onChangeText={v => setData(d => ({ ...d, booking_deposit: v }))} keyboardType="numeric" />
      <Field label={t('pdSaveDeposit')} value={data.save_deposit} onChangeText={v => setData(d => ({ ...d, save_deposit: v }))} keyboardType="numeric" />
      <Field label={t('pdCommission')} value={data.commission} onChangeText={v => setData(d => ({ ...d, commission: v }))} keyboardType="numeric" />
      <Field label={t('pdElectricity')} value={data.electricity_price} onChangeText={v => setData(d => ({ ...d, electricity_price: v }))} keyboardType="numeric" />
      <View style={s.fieldWrap}>
        <Text style={s.fieldLabel}>{t('pdWater')}</Text>
        <TextInput style={s.input} value={data.water_price} onChangeText={v => setData(d => ({ ...d, water_price: v }))} keyboardType="numeric" placeholderTextColor="#999" returnKeyType="done" />
        <View style={s.waterTypeRow}>
          {WATER_TYPES.map(wt => (
            <TouchableOpacity
              key={wt.key}
              style={[s.waterTypeBtn, data.water_price_type === wt.key && s.waterTypeBtnActive]}
              onPress={() => setData(d => ({ ...d, water_price_type: wt.key }))}
              activeOpacity={0.7}
            >
              <Text style={[s.waterTypeBtnText, data.water_price_type === wt.key && s.waterTypeBtnTextActive]}>{wt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <Field label={t('pdGas')} value={data.gas_price} onChangeText={v => setData(d => ({ ...d, gas_price: v }))} keyboardType="numeric" />
      <Field label={t('pdInternetMonth')} value={data.internet_price} onChangeText={v => setData(d => ({ ...d, internet_price: v }))} keyboardType="numeric" />
      <Field label={t('pdCleaning')} value={data.cleaning_price} onChangeText={v => setData(d => ({ ...d, cleaning_price: v }))} keyboardType="numeric" />
      <Field label={t('pdExitCleaning')} value={data.exit_cleaning_price} onChangeText={v => setData(d => ({ ...d, exit_cleaning_price: v }))} keyboardType="numeric" />
    </>
  );
}

function getStepsForType(type) {
  const base = [
    { key: 'info', titleKey: 'wizStepInfo' },
    { key: 'chars', titleKey: 'wizStepChars' },
    { key: 'desc', titleKey: 'wizStepDesc' },
    { key: 'media', titleKey: 'wizStepMedia' },
  ];
  if (type === 'house') {
    base.push({ key: 'amenities', titleKey: 'wizStepAmenities' });
  }
  base.push({ key: 'additional', titleKey: 'wizStepAdditional' });
  if (type === 'house') {
    base.push({ key: 'pricing', titleKey: 'wizStepPricing' });
  }
  base.push({ key: 'comments', titleKey: 'wizStepComments' });
  return base;
}

function toStr(val) {
  return val != null ? String(val) : '';
}

function buildInitialData(p) {
  return {
    name: p.name || '',
    code: p.code || '',
    city: p.city || '',
    location_id: p.location_id || null,
    owner_id: p.owner_id || null,
    _ownerName: '',
    district: p.district || '',
    google_maps_link: p.google_maps_link || '',
    bedrooms: toStr(p.bedrooms),
    bathrooms: toStr(p.bathrooms),
    area: toStr(p.area),
    houses_count: toStr(p.houses_count),
    floors: toStr(p.floors),
    beach_distance: toStr(p.beach_distance),
    market_distance: toStr(p.market_distance),
    description: p.description || '',
    comments: p.comments || '',
    photos: Array.isArray(p.photos) ? p.photos : [],
    videos: Array.isArray(p.videos) ? p.videos : [],
    amenities: p.amenities || {},
    air_conditioners: toStr(p.air_conditioners),
    internet_speed: p.internet_speed || '',
    pets_allowed: !!p.pets_allowed,
    long_term_booking: !!p.long_term_booking,
    price_monthly: toStr(p.price_monthly),
    booking_deposit: toStr(p.booking_deposit),
    save_deposit: toStr(p.save_deposit),
    commission: toStr(p.commission),
    electricity_price: toStr(p.electricity_price),
    water_price: toStr(p.water_price),
    water_price_type: p.water_price_type || '',
    gas_price: toStr(p.gas_price),
    internet_price: toStr(p.internet_price),
    cleaning_price: toStr(p.cleaning_price),
    exit_cleaning_price: toStr(p.exit_cleaning_price),
  };
}

function toNum(val) {
  if (!val || val.trim() === '') return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

function buildUpdates(data) {
  return {
    name: data.name.trim(),
    code: data.code.trim(),
    city: data.city.trim(),
    location_id: data.location_id || null,
    owner_id: data.owner_id || null,
    district: data.district.trim(),
    google_maps_link: data.google_maps_link.trim(),
    bedrooms: toNum(data.bedrooms),
    bathrooms: toNum(data.bathrooms),
    area: toNum(data.area),
    houses_count: toNum(data.houses_count),
    floors: toNum(data.floors),
    beach_distance: toNum(data.beach_distance),
    market_distance: toNum(data.market_distance),
    description: data.description.trim(),
    comments: data.comments.trim(),
    photos: data.photos || [],
    videos: data.videos || [],
    amenities: data.amenities,
    air_conditioners: toNum(data.air_conditioners),
    internet_speed: data.internet_speed.trim(),
    pets_allowed: data.pets_allowed,
    long_term_booking: data.long_term_booking,
    price_monthly: toNum(data.price_monthly),
    booking_deposit: toNum(data.booking_deposit),
    save_deposit: toNum(data.save_deposit),
    commission: toNum(data.commission),
    electricity_price: toNum(data.electricity_price),
    water_price: toNum(data.water_price),
    water_price_type: data.water_price_type,
    gas_price: toNum(data.gas_price),
    internet_price: toNum(data.internet_price),
    cleaning_price: toNum(data.cleaning_price),
    exit_cleaning_price: toNum(data.exit_cleaning_price),
  };
}

export default function PropertyEditWizard({ visible, property, onClose, onSave }) {
  const { t } = useLanguage();
  const [step, setStep] = useState(0);
  const [data, setData] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [locations, setLocations] = useState([]);
  const [knownDistricts, setKnownDistricts] = useState([]);
  const [owners, setOwners] = useState([]);
  const scrollRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const loadOwners = () => getContacts('owners').then(setOwners).catch(() => {});

  useEffect(() => {
    if (visible && property) {
      setData(buildInitialData(property));
      setStep(0);
      getLocations().then(setLocations).catch(() => {});
      loadOwners();
      getProperties().then(props => {
        const districts = props
          .filter(p => p.city && p.district)
          .map(p => ({ city: p.city, district: p.district }));
        setKnownDistricts(districts);
      }).catch(() => {});
    }
  }, [visible, property]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [step]);

  if (!visible || !property) return null;

  const steps = getStepsForType(property.type);
  const totalSteps = steps.length;
  const isLast = step === totalSteps - 1;
  const isFirst = step === 0;
  const currentStep = steps[step];

  const animateTransition = (direction, callback) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      callback();
      Animated.timing(fadeAnim, { toValue: 1, duration: 120, useNativeDriver: true }).start();
    });
  };

  const goNext = () => {
    Keyboard.dismiss();
    if (isLast) {
      handleSave();
    } else {
      animateTransition('next', () => setStep(s => s + 1));
    }
  };

  const goBack = () => {
    Keyboard.dismiss();
    if (isFirst) return;
    animateTransition('back', () => setStep(s => s - 1));
  };

  const handleSave = async () => {
    if (!data.name.trim()) {
      Alert.alert(t('error'), t('enterPropertyName'));
      return;
    }
    setSaving(true);
    try {
      const photos = data.photos || [];
      const localPhotos = photos.filter(isLocalUri);
      const remotePhotos = photos.filter(u => !isLocalUri(u));

      if (localPhotos.length > 0) {
        setUploadProgress(`0/${localPhotos.length}`);
        const uploaded = [];
        for (let i = 0; i < localPhotos.length; i++) {
          const url = await uploadPhoto(localPhotos[i]);
          uploaded.push(url);
          setUploadProgress(`${i + 1}/${localPhotos.length}`);
        }
        data.photos = [...remotePhotos, ...uploaded];
      }
      setUploadProgress('');

      const updates = buildUpdates(data);
      await onSave(updates);
    } catch (e) {
      Alert.alert(t('error'), e.message || 'Error');
    } finally {
      setSaving(false);
      setUploadProgress('');
    }
  };

  const renderStep = () => {
    switch (currentStep.key) {
      case 'info': return <StepInfo data={data} setData={setData} t={t} propertyType={property.type} locations={locations} knownDistricts={knownDistricts} owners={owners} onNewOwnerCreated={loadOwners} />;
      case 'chars': return <StepCharacteristics data={data} setData={setData} t={t} propertyType={property.type} />;
      case 'desc': return <StepDescription data={data} setData={setData} t={t} />;
      case 'media': return <StepMedia data={data} setData={setData} t={t} />;
      case 'amenities': return <StepAmenities data={data} setData={setData} t={t} />;
      case 'additional': return <StepAdditional data={data} setData={setData} t={t} propertyType={property.type} />;
      case 'pricing': return <StepPricing data={data} setData={setData} t={t} />;
      case 'comments': return <StepComments data={data} setData={setData} t={t} />;
      default: return null;
    }
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.backdrop}>
        {Platform.OS === 'web' ? (
          <View style={[StyleSheet.absoluteFill, s.backdropWeb]} />
        ) : (
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        )}
        <KeyboardAvoidingView
          style={s.keyboardWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={40}
        >
          <View style={s.boxWrap}>
            <View style={s.box}>
              {/* Header */}
              <View style={s.headerRow}>
                <View style={s.headerSpacer} />
                <View style={s.headerCenter}>
                  <Text style={s.title}>{t(currentStep.titleKey)}</Text>
                  <Text style={s.stepCounter}>{step + 1} / {totalSteps}</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={s.closeBtn} activeOpacity={0.8}>
                  <Text style={s.closeIcon}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Progress dots */}
              <View style={s.dotsRow}>
                {steps.map((_, i) => (
                  <View key={i} style={[s.dot, i <= step && s.dotActive]} />
                ))}
              </View>

              {/* Content */}
              <ScrollView
                ref={scrollRef}
                style={s.scroll}
                contentContainerStyle={s.scrollContent}
                showsVerticalScrollIndicator={true}
                keyboardShouldPersistTaps="handled"
                onScrollBeginDrag={Keyboard.dismiss}
                indicatorStyle="black"
                nestedScrollEnabled
                scrollEventThrottle={16}
                bounces
              >
                <Animated.View style={{ opacity: fadeAnim }}>
                  {renderStep()}
                </Animated.View>
              </ScrollView>

              {/* Navigation */}
              <View style={s.navRow}>
                <TouchableOpacity
                  style={[s.navBtn, isFirst && s.navBtnDisabled]}
                  onPress={goBack}
                  disabled={isFirst}
                  activeOpacity={0.7}
                >
                  <Text style={[s.navBtnText, isFirst && s.navBtnTextDisabled]}>‹  {t('wizBack')}</Text>
                </TouchableOpacity>

                {!isLast && (
                  <TouchableOpacity
                    style={s.navSaveIconBtn}
                    onPress={handleSave}
                    activeOpacity={0.7}
                    disabled={saving}
                  >
                    <Image
                      source={require('../../assets/save-icon.png')}
                      style={[s.navSaveIconImg, saving && { opacity: 0.4 }]}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[s.navBtn, s.navBtnNext, isLast && s.navBtnSave]}
                  onPress={goNext}
                  activeOpacity={0.7}
                  disabled={saving}
                >
                  <Text style={[s.navBtnText, s.navBtnNextText, isLast && s.navBtnSaveText]}>
                    {saving ? (uploadProgress ? `📤 ${uploadProgress}` : '...') : isLast ? t('save') : t('wizNext') + '  ›'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  backdropWeb: { backgroundColor: 'rgba(0,0,0,0.5)' },
  keyboardWrap: { width: '100%', alignItems: 'center' },
  boxWrap: { width: '100%', maxWidth: 380, maxHeight: '90%' },
  box: {
    borderRadius: 20, overflow: 'hidden', backgroundColor: COLORS.bg,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 8,
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 18, paddingHorizontal: 18, paddingBottom: 10,
  },
  headerSpacer: { width: 36 },
  headerCenter: { flex: 1, alignItems: 'center' },
  title: { fontSize: 17, fontWeight: '700', color: COLORS.title },
  stepCounter: { fontSize: 12, color: '#999', marginTop: 2 },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  closeIcon: { fontSize: 20, color: '#E85D4C', fontWeight: '600' },

  dotsRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 8,
    paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.dot },
  dotActive: { backgroundColor: COLORS.dotActive },

  scroll: { maxHeight: Dimensions.get('window').height * 0.9 - 180 },
  scrollContent: { padding: 20 },

  fieldWrap: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#6B6B6B', marginBottom: 6 },
  input: {
    backgroundColor: COLORS.inputBg, borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 14,
    fontSize: 15, color: COLORS.title,
    borderWidth: 1, borderColor: COLORS.border,
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },

  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  switchLabel: { fontSize: 15, color: COLORS.title, flex: 1 },
  toggleTrack: {
    width: 48, height: 28, borderRadius: 14,
    backgroundColor: '#D5D5D0', justifyContent: 'center', paddingHorizontal: 3,
  },
  toggleTrackOn: { backgroundColor: '#81C784' },
  toggleThumb: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2,
  },
  toggleThumbOn: { alignSelf: 'flex-end', backgroundColor: '#4CAF50' },

  waterTypeRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  waterTypeBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 8,
    backgroundColor: '#EDEDEB', alignItems: 'center',
    borderWidth: 1, borderColor: '#D5D5D0',
  },
  waterTypeBtnActive: { backgroundColor: '#E3F2FD', borderColor: '#64B5F6' },
  waterTypeBtnText: { fontSize: 11, color: '#999', fontWeight: '600' },
  waterTypeBtnTextActive: { color: '#1976D2' },

  navRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)',
  },
  navSaveIconBtn: {
    width: 46, height: 46, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  navSaveIconImg: { width: 25, height: 25 },
  navBtn: {
    paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12,
  },
  navBtnDisabled: { opacity: 0.3 },
  navBtnText: { fontSize: 15, fontWeight: '600', color: '#6B6B6B' },
  navBtnTextDisabled: { color: '#BBB' },
  navBtnNext: {
    backgroundColor: 'rgba(46,125,50,0.08)', borderWidth: 1.5, borderColor: COLORS.greenBorder,
  },
  navBtnNextText: { color: COLORS.green },
  navBtnSave: {
    backgroundColor: COLORS.green, borderColor: COLORS.green,
  },
  navBtnSaveText: { color: '#FFF' },

  pickerBtn: {
    backgroundColor: COLORS.inputBg, borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 14,
    borderWidth: 1, borderColor: COLORS.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  pickerBtnText: { fontSize: 15, color: COLORS.title, flex: 1 },
  pickerBtnPlaceholder: { color: '#999' },
  pickerArrow: { fontSize: 12, color: '#999', marginLeft: 8 },
  pickerDropdown: {
    marginTop: 6, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: '#FFF', overflow: 'hidden',
  },
  pickerItem: {
    paddingVertical: 10, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  pickerItemActive: { backgroundColor: 'rgba(46,125,50,0.08)' },
  pickerItemCity: { fontSize: 15, fontWeight: '600', color: COLORS.title },
  pickerItemCityActive: { color: COLORS.green },
  pickerItemSub: { fontSize: 11, color: '#999', marginTop: 2 },
  pickerEmpty: { fontSize: 13, color: '#999', fontStyle: 'italic', padding: 14 },
  pickerItemClear: {
    paddingVertical: 10, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.04)',
    backgroundColor: 'rgba(232,93,76,0.06)',
  },
  pickerItemClearText: { fontSize: 13, color: '#E85D4C', fontWeight: '600' },
  pickerItemNew: {
    paddingVertical: 12, paddingHorizontal: 14,
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)',
    backgroundColor: 'rgba(46,125,50,0.06)',
  },
  pickerItemNewText: { fontSize: 14, color: COLORS.green, fontWeight: '700' },

  newDistrictRow: {
    flexDirection: 'row', alignItems: 'center', padding: 8,
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)',
  },
  newDistrictInput: {
    flex: 1, backgroundColor: COLORS.inputBg, borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 12, fontSize: 14,
    color: COLORS.title, borderWidth: 1, borderColor: COLORS.border,
  },
  newDistrictBtn: {
    width: 36, height: 36, borderRadius: 10, marginLeft: 8,
    backgroundColor: COLORS.green, alignItems: 'center', justifyContent: 'center',
  },
  newDistrictBtnText: { fontSize: 20, color: '#FFF', fontWeight: '600', marginTop: -1 },

  mediaSectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.title, marginBottom: 10 },
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  mediaThumbWrap: { width: 90, height: 90, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  mediaThumb: { width: '100%', height: '100%' },
  mediaRemoveBtn: {
    position: 'absolute', top: 4, right: 4,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  mediaRemoveText: { fontSize: 12, color: '#FFF', fontWeight: '700' },
  mediaAddBtn: {
    width: 90, height: 90, borderRadius: 12,
    borderWidth: 1.5, borderColor: COLORS.border, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.inputBg,
  },
  mediaAddIcon: { fontSize: 28, color: COLORS.green, fontWeight: '300', marginTop: -2 },
  mediaAddLabel: { fontSize: 10, color: '#999', marginTop: 2 },

  videoRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 8,
    backgroundColor: COLORS.inputBg, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },
  videoUrl: { flex: 1, fontSize: 13, color: COLORS.title },
  videoRemoveText: { fontSize: 16, color: '#E85D4C', fontWeight: '700', marginLeft: 10 },
});
