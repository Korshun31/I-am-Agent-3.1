import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Switch, Animated, Modal, ActivityIndicator, Image, Platform,
} from 'react-native';
import { updateProperty, createPropertyFull, createProperty, updatePropertyResponsible } from '../../services/propertiesService';
import { getCompanyLocations, getLocationsForAgent, getLocationDistricts } from '../../services/locationsService';
import { getContacts } from '../../services/contactsService';
import { getActiveTeamMembers } from '../../services/companyService';
import { supabase } from '../../services/supabase';
import { deletePhotoFromStorage } from '../../services/storageService';
import { useLanguage } from '../../context/LanguageContext';
import { getCurrencySymbol } from '../../utils/currency';
import ContactPicker from './ContactPicker';
import WebContactEditPanel from './WebContactEditPanel';

const ICON_TAB_MAIN      = require('../../../assets/icon-tab-main.png');
const ICON_TAB_PRICES    = require('../../../assets/icon-tab-prices.png');
const ICON_TAB_UTILITIES = require('../../../assets/icon-tab-utilities.png');
const ICON_TAB_AMENITIES = require('../../../assets/icon-tab-amenities.png');
const ICON_TAB_PHOTOS    = require('../../../assets/icon-tab-photos.png');
const ICON_TOGGLE_PETS    = require('../../../assets/icon-toggle-pets.png');
const ICON_TOGGLE_BOOKING = require('../../../assets/icon-toggle-booking.png');
const PHOTOS_BUCKET      = 'property-photos';

async function resizeImageFile(file, maxSize = 1200, quality = 0.85) {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      let { width, height } = img;
      if (width <= maxSize && height <= maxSize) {
        resolve(file);
        return;
      }
      if (width > height) {
        height = Math.round(height * maxSize / width);
        width = maxSize;
      } else {
        width = Math.round(width * maxSize / height);
        height = maxSize;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        resolve(new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }));
      }, 'image/jpeg', quality);
    };
    img.src = URL.createObjectURL(file);
  });
}

const ACCENT = '#3D7D82';
const C = {
  bg: '#F4F6F9', surface: '#FFFFFF', border: '#E9ECEF',
  text: '#212529', muted: '#6C757D', light: '#ADB5BD',
  accent: ACCENT, accentBg: '#EAF4F5',
};

function getTabs(t) {
  return [
    { key: 'main',      label: t('tabMain'),      icon: ICON_TAB_MAIN      },
    { key: 'prices',    label: t('tabPrices'),     icon: ICON_TAB_PRICES    },
    { key: 'utilities', label: t('tabUtilities'),  icon: ICON_TAB_UTILITIES },
    { key: 'amenities', label: t('tabAmenities'),  icon: ICON_TAB_AMENITIES },
    { key: 'photos',    label: t('tabPhotos'),     icon: ICON_TAB_PHOTOS    },
  ];
}

function getAmenityKeys(t) {
  return [
    { key: 'swimming_pool',   label: t('amenity_swimming_pool'),   icon: require('../../../assets/icon-amenity-swimming_pool.png') },
    { key: 'gym',             label: t('amenity_gym'),             icon: require('../../../assets/icon-amenity-gym.png') },
    { key: 'parking',         label: t('amenity_parking'),         icon: require('../../../assets/icon-amenity-parking.png') },
    { key: 'internet',        label: t('amenity_internet'),        icon: require('../../../assets/icon-amenity-internet.png') },
    { key: 'tv',              label: t('amenity_tv'),              icon: require('../../../assets/icon-amenity-tv.png') },
    { key: 'washing_machine', label: t('amenity_washing_machine'), icon: require('../../../assets/icon-amenity-washing_machine.png') },
    { key: 'dishwasher',      label: t('amenity_dishwasher'),      icon: require('../../../assets/icon-amenity-dishwasher.png') },
    { key: 'fridge',          label: t('amenity_fridge'),          icon: require('../../../assets/icon-amenity-fridge.png') },
    { key: 'stove',           label: t('amenity_stove'),           icon: require('../../../assets/icon-amenity-stove.png') },
    { key: 'oven',            label: t('amenity_oven'),            icon: require('../../../assets/icon-amenity-oven.png') },
    { key: 'hood',            label: t('amenity_hood'),            icon: require('../../../assets/icon-amenity-hood.png') },
    { key: 'microwave',       label: t('amenity_microwave'),       icon: require('../../../assets/icon-amenity-microwave.png') },
    { key: 'kettle',          label: t('amenity_kettle'),          icon: require('../../../assets/icon-amenity-kettle.png') },
    { key: 'toaster',         label: t('amenity_toaster'),         icon: require('../../../assets/icon-amenity-toaster.png') },
    { key: 'coffee_machine',  label: t('amenity_coffee_machine'),  icon: require('../../../assets/icon-amenity-coffee_machine.png') },
    { key: 'multi_cooker',    label: t('amenity_multi_cooker'),    icon: require('../../../assets/icon-amenity-multi_cooker.png') },
    { key: 'blender',         label: t('amenity_blender'),         icon: require('../../../assets/icon-amenity-blender.png') },
  ];
}

function getUnitTypeForParent(parentType) {
  if (parentType === 'condo') return 'condo_apartment';
  return 'resort_house';
}

const UNIT_DETAIL_FIELDS = [
  'bedrooms', 'bathrooms', 'area', 'floor_number',
  'air_conditioners', 'internet_speed',
  'price_monthly', 'booking_deposit', 'save_deposit',
  'commission', 'owner_commission_one_time', 'owner_commission_monthly',
  'electricity_price', 'water_price', 'gas_price',
  'internet_price', 'cleaning_price', 'exit_cleaning_price',
];

const UNIT_DETAIL_FLAGS = [
  'price_monthly_is_from', 'booking_deposit_is_from', 'save_deposit_is_from',
  'commission_is_from',
  'owner_commission_one_time_is_percent',
  'owner_commission_monthly_is_percent',
  'pets_allowed', 'long_term_booking',
];

function resetTypeSpecificFields(nextType, prevForm) {
  const next = { ...prevForm, type: nextType };

  // Parent types must not keep house-like values from previous selection.
  if (nextType === 'resort' || nextType === 'condo') {
    for (const key of UNIT_DETAIL_FIELDS) next[key] = '';
    for (const key of UNIT_DETAIL_FLAGS) next[key] = null;
    next.amenities = {};
    next.water_price_type = 'fixed';
  }

  // House should not keep parent-only counters.
  if (nextType === 'house') {
    next.houses_count = '';
    next.floors = '';
  }

  // Resort and condo do not use additional unit suffix at create stage.
  if (nextType !== 'house') {
    next.code_suffix = '';
  }

  // Keep only the relevant parent counter for each parent type.
  if (nextType === 'resort') next.floors = '';
  if (nextType === 'condo') next.houses_count = '';

  return next;
}

function sanitizeUpdatesByType(type, updates) {
  const next = { ...updates };
  if (type === 'resort' || type === 'condo') {
    // Поля юнита (internet_speed, air_conditioners, цены, площади и т.д.) у контейнера не существуют по бизнесу,
    // и схема БД требует валидных значений (например internet_speed — text NOT NULL DEFAULT '').
    // Поэтому не зануляем — удаляем ключи целиком, чтобы БД использовала default'ы при INSERT и не трогала при UPDATE.
    for (const key of UNIT_DETAIL_FIELDS) delete next[key];
    next.price_monthly_is_from = false;
    next.booking_deposit_is_from = false;
    next.save_deposit_is_from = false;
    next.commission_is_from = false;
    next.owner_commission_one_time_is_percent = false;
    next.owner_commission_monthly_is_percent = false;
    next.pets_allowed = null;
    next.long_term_booking = null;
    next.amenities = {};
    next.water_price_type = 'fixed';
  }
  if (type === 'house') {
    next.houses_count = null;
    next.floors = null;
  }
  if (type === 'resort') next.floors = null;
  if (type === 'condo') next.houses_count = null;
  return next;
}

// ─── Small form components ────────────────────────────────────────────────────

function FieldLabel({ text, required }) {
  return (
    <Text style={s.fieldLabel}>
      {text}{required && <Text style={{ color: ACCENT }}> *</Text>}
    </Text>
  );
}

function FieldInput({ value, onChangeText, placeholder, numeric, multiline, readOnly }) {
  return (
    <TextInput
      style={[s.fieldInput, multiline && s.fieldInputMulti, readOnly && s.fieldInputReadonlyStyle]}
      value={value != null ? String(value) : ''}
      onChangeText={readOnly ? undefined : (text => {
        if (numeric) {
          const cleaned = text.replace(/[^0-9.]/g, '');
          onChangeText(cleaned === '' ? null : cleaned);
        } else {
          onChangeText(text);
        }
      })}
      placeholder={readOnly ? '' : (placeholder || '')}
      placeholderTextColor={C.light}
      keyboardType={numeric ? 'numeric' : 'default'}
      multiline={multiline}
      numberOfLines={multiline ? 3 : 1}
      editable={!readOnly}
      selectTextOnFocus={!readOnly}
      caretHidden={!!readOnly}
    />
  );
}

function FieldDropdown({ value, options, onChange, placeholder, disabled, readOnly }) {
  const isDisabled = !!disabled || !!readOnly;
  return (
    <select
      value={value || ''}
      onChange={e => { if (isDisabled) return; onChange(e.target.value); }}
      disabled={isDisabled}
      style={{
        height: 42, width: '100%',
        border: `1px solid ${isDisabled ? '#E9ECEF' : C.border}`,
        borderRadius: 10, paddingLeft: 12, paddingRight: 8,
        fontSize: 14, color: value ? (isDisabled ? '#6C757D' : C.text) : C.light,
        backgroundColor: isDisabled ? '#F8F9FA' : C.bg,
        outline: 'none', cursor: isDisabled ? 'not-allowed' : 'pointer',
        appearance: 'auto',
        opacity: isDisabled ? 0.92 : 1,
      }}
    >
      <option value="" disabled>{placeholder || '—'}</option>
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

function FieldRow({ label, children, required }) {
  return (
    <View style={s.fieldRow}>
      <FieldLabel text={label} required={required} />
      {children}
    </View>
  );
}

function FieldToggle({ label, icon, value, onChange, compact, readOnly }) {
  return (
    <View style={[s.toggleRow, compact && s.toggleRowCompact]}>
      {icon && <Image source={icon} style={s.toggleIcon} resizeMode="contain" />}
      <Text style={[s.toggleLabel, compact && s.toggleLabelCompact]}>{label}</Text>
      <Switch
        value={!!value}
        onValueChange={readOnly ? undefined : onChange}
        trackColor={{ false: C.border, true: ACCENT }}
        thumbColor="#FFF"
        disabled={!!readOnly}
      />
    </View>
  );
}

function OwnerCommField({ label, value, isPercent, onChangeValue, onTogglePercent, sym, priceMonthly, readOnly }) {
  const calcAmount = isPercent && value && priceMonthly
    ? Math.round((parseFloat(value) / 100) * parseFloat(priceMonthly))
    : null;

  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {isPercent ? (
          <>
            <TextInput
              style={[s.fieldInput, { flex: 1 }, readOnly && s.fieldInputReadonlyStyle]}
              value={value != null ? String(value) : ''}
              onChangeText={readOnly ? undefined : (text => onChangeValue(text.replace(/[^0-9.]/g, '') || null))}
              placeholder={readOnly ? '' : '10'}
              placeholderTextColor={C.light}
              keyboardType="numeric"
              editable={!readOnly}
              selectTextOnFocus={!readOnly}
              caretHidden={!!readOnly}
            />
            <View style={[s.fieldInput, { flex: 2, justifyContent: 'center', backgroundColor: '#F8F9FA' }]}>
              <Text style={{ fontSize: 14, color: calcAmount != null ? C.text : C.light }}>
                {calcAmount != null ? `= ${calcAmount.toLocaleString()} ${sym}` : `— ${sym}`}
              </Text>
            </View>
          </>
        ) : (
          <TextInput
            style={[s.fieldInput, { flex: 1 }, readOnly && s.fieldInputReadonlyStyle]}
            value={value != null ? String(value) : ''}
            onChangeText={readOnly ? undefined : (text => onChangeValue(text.replace(/[^0-9.]/g, '') || null))}
            placeholder={readOnly ? '' : '15 000'}
            placeholderTextColor={C.light}
            keyboardType="numeric"
            editable={!readOnly}
            selectTextOnFocus={!readOnly}
            caretHidden={!!readOnly}
          />
        )}
        {!readOnly ? (
          <View style={{ flexDirection: 'row', borderRadius: 7, borderWidth: 1, borderColor: C.border, overflow: 'hidden' }}>
            <TouchableOpacity
              onPress={() => onTogglePercent(false)}
              style={{ paddingHorizontal: 11, paddingVertical: 8, backgroundColor: !isPercent ? ACCENT : C.bg }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: !isPercent ? '#FFF' : C.muted }}>{sym}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onTogglePercent(true)}
              style={{ paddingHorizontal: 11, paddingVertical: 8, backgroundColor: isPercent ? ACCENT : C.bg }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: isPercent ? '#FFF' : C.muted }}>%</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 10, paddingVertical: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: C.muted }}>{isPercent ? '%' : sym}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function FieldSelect({ value, options, onChange, readOnly }) {
  return (
    <View style={[s.selectRow, readOnly && { opacity: 0.75, cursor: 'not-allowed' }]}>
      {options.map(opt => (
        <TouchableOpacity
          key={opt.value}
          style={[
            s.selectOption,
            readOnly && s.selectOptionReadonly,
            value === opt.value && s.selectOptionActive,
          ]}
          onPress={readOnly ? undefined : () => onChange(opt.value)}
          activeOpacity={readOnly ? 1 : 0.75}
        >
          {opt.icon && <Image source={opt.icon} style={s.selectOptionIcon} resizeMode="contain" />}
          <Text style={[s.selectOptionText, value === opt.value && s.selectOptionTextActive]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function SectionDivider({ title }) {
  return <Text style={s.sectionDivider}>{title}</Text>;
}

// ─── Build initial form state ─────────────────────────────────────────────────

function buildForm(property, parentProperty) {
  if (property) {
    return {
      name: property.name || '',
      code: property.code || '',
      code_suffix: property.code_suffix || '',
      type: property.type || 'house',
      location_id: property.location_id || null,
      owner_id: property.owner_id || null,
      owner_id_2: property.owner_id_2 || null,
      responsible_agent_id: property.responsible_agent_id || null,
      city: property.city || '',
      district: property.district || '',
      houses_count: property.houses_count ?? '',
      floors: property.floors ?? '',
      bedrooms: property.bedrooms ?? '',
      bathrooms: property.bathrooms ?? '',
      area: property.area ?? '',
      floor_number: property.floor_number ?? '',
      beach_distance: property.beach_distance ?? '',
      market_distance: property.market_distance ?? '',
      google_maps_link: property.google_maps_link || '',
      website_url: property.website_url || '',
      description: property.description || '',
      comments: property.comments || '',
      price_monthly: property.price_monthly ?? '',
      price_monthly_is_from: property.price_monthly_is_from ?? false,
      booking_deposit: property.booking_deposit ?? '',
      booking_deposit_is_from: property.booking_deposit_is_from ?? false,
      save_deposit: property.save_deposit ?? '',
      save_deposit_is_from: property.save_deposit_is_from ?? false,
      commission: property.commission ?? '',
      commission_is_from: property.commission_is_from ?? false,
      owner_commission_one_time: property.owner_commission_one_time ?? '',
      owner_commission_one_time_is_percent: property.owner_commission_one_time_is_percent ?? false,
      owner_commission_monthly: property.owner_commission_monthly ?? '',
      owner_commission_monthly_is_percent: property.owner_commission_monthly_is_percent ?? false,
      electricity_price: property.electricity_price ?? '',
      water_price: property.water_price ?? '',
      water_price_type: property.water_price_type || 'fixed',
      gas_price: property.gas_price ?? '',
      internet_price: property.internet_price ?? '',
      cleaning_price: property.cleaning_price ?? '',
      exit_cleaning_price: property.exit_cleaning_price ?? '',
      air_conditioners: property.air_conditioners ?? '',
      internet_speed: property.internet_speed ?? '',
      pets_allowed: property.pets_allowed ?? null,
      long_term_booking: property.long_term_booking ?? null,
      amenities: property.amenities || {},
      photos: property.photos || [],
      video_url: property.video_url || '',
      currency: property.currency || 'THB',
    };
  }
  // create mode
  return {
    name: '', code: parentProperty?.code || '', code_suffix: '',
    type: 'house',
    location_id: parentProperty?.location_id || null,
    owner_id: parentProperty?.owner_id || null,
    owner_id_2: null,
    responsible_agent_id: null,
    city: parentProperty?.city || '',
    district: parentProperty?.district || '',
    houses_count: '', floors: '',
    bedrooms: '', bathrooms: '', area: '', floor_number: '',
    beach_distance: parentProperty?.beach_distance ?? '',
    market_distance: parentProperty?.market_distance ?? '',
    google_maps_link: '', website_url: '',
    description: '', comments: '',
    price_monthly: '', price_monthly_is_from: false,
    booking_deposit: '', booking_deposit_is_from: false,
    save_deposit: '', save_deposit_is_from: false,
    commission: '', commission_is_from: false,
    owner_commission_one_time: '', owner_commission_one_time_is_percent: false,
    owner_commission_monthly: '', owner_commission_monthly_is_percent: false,
    electricity_price: parentProperty?.electricity_price ?? '',
    water_price: parentProperty?.water_price ?? '',
    water_price_type: parentProperty?.water_price_type || 'fixed',
    gas_price: parentProperty?.gas_price ?? '',
    internet_price: parentProperty?.internet_price ?? '',
    cleaning_price: parentProperty?.cleaning_price ?? '',
    exit_cleaning_price: parentProperty?.exit_cleaning_price ?? '',
    air_conditioners: '', internet_speed: '',
    pets_allowed: parentProperty?.pets_allowed ?? null,
    long_term_booking: parentProperty?.long_term_booking ?? null,
    amenities: parentProperty?.amenities ? { ...parentProperty.amenities } : {},
    photos: [],
    video_url: '',
    currency: 'THB',
  };
}

// ─── Main Panel Component ─────────────────────────────────────────────────────

/**
 * mode: 'edit' | 'create' | 'create-unit'
 * property: existing property (edit mode)
 * parentProperty: resort/condo (create-unit mode)
 */
export default function WebPropertyEditPanel({
  visible, mode, property, parentProperty, onClose, onSaved, userCurrency, user,
  readOnly = false,
}) {
  const { t } = useLanguage();

  // Разрешения агента / роли
  const isAgent = !!user?.teamMembership;
  const isCompanyAdmin = !isAgent && !!(user?.workAs === 'company' && user?.companyId);

  // In edit mode use the currency stored on the property; in create mode use the user's selected currency
  const activeCurrency = (mode === 'edit' && property?.currency) ? property.currency : (userCurrency || 'THB');
  const sym = getCurrencySymbol(activeCurrency);
  // Replace ฿ placeholder in translated strings with the active currency symbol
  const L = (key) => t(key).replace('฿', sym);
  const TABS = getTabs(t);
  const AMENITY_KEYS = getAmenityKeys(t);
  const [tab, setTab] = useState('main');
  const [form, setForm] = useState(() => buildForm(property, parentProperty));
  const [locations, setLocations] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [owners, setOwners] = useState([]);
  const [panelTeamMembers, setPanelTeamMembers] = useState([]);

  // Load available locations based on user role
  useEffect(() => {
    if (!visible) return;
    const load = async () => {
      let locs = [];
      if (user?.teamMembership?.companyId) {
        locs = await getLocationsForAgent(user.id, user.teamMembership.companyId).catch(() => []);
      } else if (user?.companyId) {
        locs = await getCompanyLocations(user.companyId).catch(() => []);
      }
      setLocations(locs);
    };
    load();
  }, [visible, user?.id, user?.companyId, user?.teamMembership?.companyId]);

  // Load districts when location changes
  useEffect(() => {
    if (!form.location_id) { setDistricts([]); return; }
    getLocationDistricts(form.location_id).then(setDistricts).catch(() => setDistricts([]));
  }, [form.location_id]);

  // Load owner contacts for all roles, team members for admin only
  useEffect(() => {
    if (!visible) return;
    // Owners — загружаем для всех ролей (агент тоже видит собственников)
    getContacts('owners').then(setOwners).catch(() => setOwners([]));
    // Team members — только для админа (пикер ответственного)
    if (isCompanyAdmin) {
      getActiveTeamMembers(user.companyId).then(setPanelTeamMembers).catch(() => setPanelTeamMembers([]));
    }
  }, [visible, isCompanyAdmin, user?.companyId]);

  // Determine if this is a parent resort/condo (not a child unit)
  const effectiveType = mode === 'create-unit' ? (parentProperty?.type || 'house') : (property?.type || form.type);
  const isChildUnit = mode === 'create-unit' || Boolean(property?.resort_id);
  const isParent = !isChildUnit && (effectiveType === 'resort' || effectiveType === 'condo');
  const isCondoApartment = (mode === 'create-unit' && parentProperty?.type === 'condo')
    || (mode === 'edit' && property?.type === 'condo_apartment');
  const visibleTabs = isParent
    ? TABS.filter(t => t.key === 'main' || t.key === 'photos')
    : TABS;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const slideAnim    = useRef(new Animated.Value(540)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  // Reset form and animate when visibility changes
  useEffect(() => {
    if (visible) {
      setMounted(true);
      setForm(buildForm(property, parentProperty));
      setTab('main');
      setError('');
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 540,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, property?.id]);

  const set = readOnly ? () => {} : (key, val) => setForm(f => ({ ...f, [key]: val }));
  const setAmenity = readOnly ? () => {} : (key, val) => setForm(f => ({ ...f, amenities: { ...f.amenities, [key]: val } }));

  // Inline создание контакта-собственника прямо из формы объекта.
  const [newOwnerVisible, setNewOwnerVisible] = useState(false);
  const [newOwnerInitialName, setNewOwnerInitialName] = useState('');
  const [newOwnerTarget, setNewOwnerTarget] = useState('owner_id'); // 'owner_id' | 'owner_id_2'

  const handleRequestNewOwner = useCallback((target, prefillName) => {
    setNewOwnerTarget(target);
    setNewOwnerInitialName(prefillName || '');
    setNewOwnerVisible(true);
  }, []);

  const handleNewOwnerSaved = useCallback((saved) => {
    const contact = Array.isArray(saved) ? saved[0] : saved;
    if (contact?.id) {
      setOwners(prev => [contact, ...prev]);
      setForm(f => ({ ...f, [newOwnerTarget]: contact.id }));
    }
    setNewOwnerVisible(false);
  }, [newOwnerTarget]);

  // Не закрываем форму объекта пока открыто окно создания собственника —
  // иначе несохранённые данные нового контакта потеряются вместе с анимацией.
  const handleClose = useCallback(() => {
    if (newOwnerVisible) return;
    onClose?.();
  }, [newOwnerVisible, onClose]);
  const handleTypeChange = useCallback((nextType) => {
    setForm((prev) => {
      if (mode !== 'create') return prev;
      if (!nextType || prev.type === nextType) return prev;
      return resetTypeSpecificFields(nextType, prev);
    });
  }, [mode]);

  const numOrNull = val => {
    if (val === '' || val == null) return null;
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
  };

  const handleSave = async () => {
    const selectedLoc = locations.find(l => l.id === form.location_id);
    const cityValue = (selectedLoc?.city || form.city || '').trim();
    const districtValue = (form.district || '').trim();

    if (!form.name.trim()) { setError(t('fieldRequired') + ': ' + t('propName')); setTab('main'); return; }
    if (!cityValue) { setError(t('fieldRequired') + ': ' + t('city')); setTab('main'); return; }
    if (!districtValue) { setError(t('fieldRequired') + ': ' + t('filterDistrict')); setTab('main'); return; }
    setSaving(true);
    setError('');

    const targetType = mode === 'edit' ? (property?.type || form.type) : form.type;
    let updates = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      code_suffix: form.code_suffix.trim() || null,
      type: targetType,
      location_id: form.location_id || null,
      city: cityValue || null,
      district: districtValue || null,
      houses_count: numOrNull(form.houses_count),
      floors: numOrNull(form.floors),
      bedrooms: numOrNull(form.bedrooms),
      bathrooms: numOrNull(form.bathrooms),
      area: numOrNull(form.area),
      ...(isCondoApartment && { floor_number: numOrNull(form.floor_number) }),
      beach_distance: numOrNull(form.beach_distance),
      market_distance: numOrNull(form.market_distance),
      google_maps_link: form.google_maps_link.trim() || '',
      website_url: form.website_url.trim() || '',
      description: form.description.trim() || '',
      comments: form.comments.trim() || '',
      price_monthly: numOrNull(form.price_monthly),
      price_monthly_is_from: form.price_monthly_is_from,
      booking_deposit: numOrNull(form.booking_deposit),
      booking_deposit_is_from: form.booking_deposit_is_from,
      save_deposit: numOrNull(form.save_deposit),
      save_deposit_is_from: form.save_deposit_is_from,
      commission: numOrNull(form.commission),
      commission_is_from: form.commission_is_from,
      owner_commission_one_time: numOrNull(form.owner_commission_one_time),
      owner_commission_one_time_is_percent: form.owner_commission_one_time_is_percent,
      owner_commission_monthly: numOrNull(form.owner_commission_monthly),
      owner_commission_monthly_is_percent: form.owner_commission_monthly_is_percent,
      electricity_price: numOrNull(form.electricity_price),
      water_price: numOrNull(form.water_price),
      water_price_type: form.water_price_type,
      gas_price: numOrNull(form.gas_price),
      internet_price: numOrNull(form.internet_price),
      cleaning_price: numOrNull(form.cleaning_price),
      exit_cleaning_price: numOrNull(form.exit_cleaning_price),
      air_conditioners: numOrNull(form.air_conditioners) ?? 0,
      internet_speed: numOrNull(form.internet_speed) ?? 0,
      pets_allowed: form.pets_allowed,
      long_term_booking: form.long_term_booking,
      amenities: form.amenities,
      photos: form.photos || [],
      video_url: form.video_url.trim() || null,
      currency: activeCurrency,
      // TD-048: agent тоже задаёт owner при создании объекта (PR-CR-12 / CT-VIS-2).
      ...(!isChildUnit && { owner_id: form.owner_id || null }),
      ...(isChildUnit  && { owner_id_2: form.owner_id_2 || null }),
      // responsible_agent_id: parent resort/condo → cascade separately after save;
      //                       child unit         → inherited, never touch here;
      //                       standalone house   → plain field update.
      ...(isCompanyAdmin && !isParent && !isChildUnit && { responsible_agent_id: form.responsible_agent_id || null }),
    };
    updates = sanitizeUpdatesByType(targetType, updates);

    try {
      let saved;

      if (mode === 'edit') {
        saved = await updateProperty(property.id, updates);
        if (isCompanyAdmin && isParent) {
          await updatePropertyResponsible(property.id, form.responsible_agent_id || null, true);
          if (saved) saved = { ...saved, responsible_agent_id: form.responsible_agent_id || null };
        }
      } else if (mode === 'create-unit') {
        const unitType = getUnitTypeForParent(parentProperty?.type);
        saved = await createPropertyFull({
          ...updates,
          resort_id: parentProperty.id,
          type: unitType,
          responsible_agent_id: parentProperty.responsible_agent_id ?? null,
        });
      } else {
        saved = await createProperty({
          name: updates.name,
          code: updates.code,
          type: updates.type,
        });
        if (saved?.id) {
          saved = await updateProperty(saved.id, updates);
        }
      }
      onSaved(saved);
    } catch (e) {
      setError(e.message || t('errorSave'));
    } finally {
      setSaving(false);
    }
  };

  const handlePickPhotos = () => {
    if (Platform.OS !== 'web') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      setUploadingPhoto(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const newUrls = [];
        for (const file of files) {
          const resized = await resizeImageFile(file, 1200, 0.85);
          const ext = 'jpg';
          const fileName = `${session.user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from(PHOTOS_BUCKET)
            .upload(fileName, resized, { upsert: true, contentType: 'image/jpeg' });
          if (upErr) { setError(`${t('errorPrefix')} ${upErr.message}`); continue; }
          const { data: pub } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(fileName);
          newUrls.push(pub.publicUrl);
        }
        if (newUrls.length) {
          setForm(f => ({ ...f, photos: [...(f.photos || []), ...newUrls] }));
        }
      } catch (e) {
        setError(`${t('errorUpload')}: ${e.message}`);
      } finally {
        setUploadingPhoto(false);
      }
    };
    input.click();
  };

  const handleRemovePhoto = async (idx) => {
    const url = form.photos[idx];
    setForm(f => ({ ...f, photos: f.photos.filter((_, i) => i !== idx) }));
    if (url && url.startsWith('http')) {
      try {
        await deletePhotoFromStorage(url);
      } catch (e) {
        console.warn('Failed to delete photo from storage:', e.message);
      }
    }
  };

  const title = mode === 'edit'
    ? `${t('editProperty')}: ${property?.name || ''}`
    : mode === 'create-unit'
    ? `${t('addPropertyUnit')} ${parentProperty?.name || ''}`
    : t('addProperty');

  // ── Tab content ──────────────────────────────────────────────────────────────

  const renderMain = () => (
    <>
      <FieldRow label={t('propName')} required={!readOnly}>
        <FieldInput value={form.name} onChangeText={v => set('name', v)} placeholder="Villa Sunset" readOnly={readOnly} />
      </FieldRow>

      <View style={s.row2}>
        <View style={{ flex: 1 }}>
          <FieldRow label={t('propCode')}>
            {!readOnly && isChildUnit ? (
              <View style={s.fieldInputReadonly}>
                <Text style={s.fieldInputReadonlyText}>{form.code}</Text>
                <Text style={s.fieldInputReadonlyHint}>🔒</Text>
              </View>
            ) : (
              <FieldInput value={form.code} onChangeText={v => set('code', v)} placeholder="CW01" readOnly={readOnly} />
            )}
          </FieldRow>
        </View>
        {isChildUnit && (
          <View style={{ flex: 1 }}>
            <FieldRow label={t('additionalCode') || t('codeSuffix')}>
              <FieldInput value={form.code_suffix} onChangeText={v => set('code_suffix', v)} placeholder="A, B, 32…" readOnly={readOnly} />
            </FieldRow>
          </View>
        )}
      </View>

      {mode !== 'create-unit' && !(mode === 'edit' && property?.resort_id) && (
        <FieldRow label={t('propType')}>
          <FieldSelect
            value={form.type}
            onChange={handleTypeChange}
            readOnly={readOnly || mode === 'edit'}
            options={[
              { value: 'house',  label: `🏠 ${t('house')}` },
              { value: 'resort', label: `🏨 ${t('resort')}` },
              { value: 'condo',  label: `🏢 ${t('condo')}` },
            ]}
          />
        </FieldRow>
      )}

      <View style={s.row2}>
        <View style={{ flex: 1 }}>
          <FieldRow label={t('city')} required={!readOnly}>
            {isChildUnit ? (
              <View style={s.fieldInputReadonly}>
                <Text style={s.fieldInputReadonlyText}>{form.city || '—'}</Text>
                <Text style={s.fieldInputReadonlyHint}>🔒</Text>
              </View>
            ) : (
              <FieldDropdown
                value={form.location_id}
                options={locations.map(l => ({ value: l.id, label: l.displayName }))}
                onChange={id => {
                  const loc = locations.find(l => l.id === id);
                  setForm(f => ({ ...f, location_id: id || null, city: loc?.city || '', district: '' }));
                }}
                placeholder={t('city') + '...'}
                readOnly={readOnly}
              />
            )}
          </FieldRow>
        </View>
        <View style={{ flex: 1 }}>
          <FieldRow label={t('filterDistrict')} required={!readOnly}>
            {isChildUnit ? (
              <View style={s.fieldInputReadonly}>
                <Text style={s.fieldInputReadonlyText}>{form.district || '—'}</Text>
                <Text style={s.fieldInputReadonlyHint}>🔒</Text>
              </View>
            ) : (
              <FieldDropdown
                value={form.district}
                options={districts.map(d => ({ value: d, label: d }))}
                onChange={v => set('district', v)}
                placeholder={districts.length ? (t('filterDistrict') + '...') : '—'}
                disabled={!form.location_id || districts.length === 0}
                readOnly={readOnly}
              />
            )}
          </FieldRow>
        </View>
      </View>

      {/* ── Owners — visible to admin and agent (TD-048 / PR-CR-12).
          В readOnly (просмотр через уведомление / approval) — статичные плашки с именами. */}
      <>
        <SectionDivider title={t('propOwners')} />

        {isChildUnit ? (
          <>
            <FieldRow label={`${t('propOwner1')} 🔒`}>
              <View style={s.fieldInputReadonly}>
                <Text style={s.fieldInputReadonlyText}>
                  {(() => {
                    const parentOwnerId = parentProperty?.owner_id ?? property?.owner_id;
                    const o = owners.find(c => c.id === parentOwnerId);
                    return o ? [o.name, o.lastName].filter(Boolean).join(' ') : '—';
                  })()}
                </Text>
                <Text style={s.fieldInputReadonlyHint}>🔒</Text>
              </View>
            </FieldRow>
            <FieldRow label={t('propOwner2')}>
              {readOnly ? (
                <View style={s.fieldInputReadonly}>
                  <Text style={s.fieldInputReadonlyText}>
                    {(() => {
                      const o = owners.find(c => c.id === form.owner_id_2);
                      return o ? [o.name, o.lastName].filter(Boolean).join(' ') : '—';
                    })()}
                  </Text>
                </View>
              ) : (
                <ContactPicker
                  value={form.owner_id_2 || ''}
                  contacts={owners}
                  onChange={v => set('owner_id_2', v || null)}
                  canCreateContact={true}
                  onRequestNewContact={(prefill) => handleRequestNewOwner('owner_id_2', prefill)}
                  texts={{
                    placeholder:       t('propPickOwner'),
                    searchPlaceholder: t('propSearchOwner'),
                    addNewLabel:       t('propAddNewOwner'),
                    removeLabel:       t('propRemoveOwner'),
                    noResults:         t('noResults'),
                  }}
                />
              )}
            </FieldRow>
          </>
        ) : (
          <FieldRow label={t('propOwner1')}>
            {readOnly ? (
              <View style={s.fieldInputReadonly}>
                <Text style={s.fieldInputReadonlyText}>
                  {(() => {
                    const o = owners.find(c => c.id === form.owner_id);
                    return o ? [o.name, o.lastName].filter(Boolean).join(' ') : '—';
                  })()}
                </Text>
              </View>
            ) : (
              <ContactPicker
                value={form.owner_id || ''}
                contacts={owners}
                onChange={v => set('owner_id', v || null)}
                canCreateContact={true}
                onRequestNewContact={(prefill) => handleRequestNewOwner('owner_id', prefill)}
                texts={{
                  placeholder:       t('propPickOwner'),
                  searchPlaceholder: t('propSearchOwner'),
                  addNewLabel:       t('propAddNewOwner'),
                  removeLabel:       t('propRemoveOwner'),
                  noResults:         t('noResults'),
                }}
              />
            )}
          </FieldRow>
        )}
      </>

      {/* ── Responsible agent — admin only.
          В readOnly показываем имя ответственного как плашку (для approval-режима). */}
      {isCompanyAdmin && user?.companyInfo?.name?.trim() ? (
        <>
          <SectionDivider title={t('propResponsiblePicker')} />
          {isChildUnit ? (
            <FieldRow label={t('propResponsibleLabel')}>
              <View style={s.fieldInputReadonly}>
                <Text style={s.fieldInputReadonlyText}>{t('propResponsibleInherited')}</Text>
                <Text style={s.fieldInputReadonlyHint}>🔒</Text>
              </View>
            </FieldRow>
          ) : readOnly ? (
            <FieldRow label={t('propResponsibleLabel')}>
              <View style={s.fieldInputReadonly}>
                <Text style={s.fieldInputReadonlyText}>
                  {(() => {
                    const id = form.responsible_agent_id;
                    if (!id) return user?.companyInfo?.name || t('workAsCompany');
                    const m = panelTeamMembers.find(x => x.user_id === id);
                    return m ? ([m.name, m.last_name].filter(Boolean).join(' ') || m.email) : '—';
                  })()}
                </Text>
              </View>
            </FieldRow>
          ) : (
            <FieldRow label={t('propResponsibleLabel')}>
              {(() => {
                const COMPANY_SENTINEL = '__company__';
                const companyLabel = user?.companyInfo?.name || t('workAsCompany');
                return (
                  <FieldDropdown
                    value={form.responsible_agent_id ?? COMPANY_SENTINEL}
                    options={[
                      { value: COMPANY_SENTINEL, label: companyLabel },
                      ...panelTeamMembers
                        .filter(m => m.role === 'agent')
                        .map(m => ({
                          value: m.user_id,
                          label: [m.name, m.last_name].filter(Boolean).join(' ') || m.email,
                        })),
                    ]}
                    onChange={v => set('responsible_agent_id', v === COMPANY_SENTINEL ? null : (v || null))}
                  />
                );
              })()}
            </FieldRow>
          )}
        </>
      ) : null}

      <SectionDivider title={t('propParams')} />

      {isParent && effectiveType === 'resort' && (
        <FieldRow label={t('propHousesCount')}>
          <FieldInput value={form.houses_count} onChangeText={v => set('houses_count', v)} placeholder="10" numeric readOnly={readOnly} />
        </FieldRow>
      )}

      {isParent && effectiveType === 'condo' && (
        <FieldRow label={t('propFloors')}>
          <FieldInput value={form.floors} onChangeText={v => set('floors', v)} placeholder="7" numeric readOnly={readOnly} />
        </FieldRow>
      )}

      {!isParent && (
        <>
          <View style={s.row3}>
            {isCondoApartment && (
              <View style={{ flex: 1 }}>
                <FieldRow label={t('propFloorNumber')}>
                  <FieldInput value={form.floor_number} onChangeText={v => set('floor_number', v)} placeholder="3" numeric readOnly={readOnly} />
                </FieldRow>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <FieldRow label={t('propBedrooms3')}>
                <FieldInput value={form.bedrooms} onChangeText={v => set('bedrooms', v)} placeholder="2" numeric readOnly={readOnly} />
              </FieldRow>
            </View>
            <View style={{ flex: 1 }}>
              <FieldRow label={t('propBathrooms3')}>
                <FieldInput value={form.bathrooms} onChangeText={v => set('bathrooms', v)} placeholder="1" numeric readOnly={readOnly} />
              </FieldRow>
            </View>
            <View style={{ flex: 1 }}>
              <FieldRow label={t('propAreaSqm')}>
                <FieldInput value={form.area} onChangeText={v => set('area', v)} placeholder="55" numeric readOnly={readOnly} />
              </FieldRow>
            </View>
          </View>
          <View style={s.row2}>
            <View style={{ flex: 1 }}>
              <FieldRow label={t('propAirConditioners')}>
                <FieldInput value={form.air_conditioners} onChangeText={v => set('air_conditioners', v)} placeholder="2" numeric readOnly={readOnly} />
              </FieldRow>
            </View>
            <View style={{ flex: 1 }}>
              <FieldRow label={t('propInternetSpeed')}>
                <FieldInput value={form.internet_speed} onChangeText={v => set('internet_speed', v)} placeholder="300" numeric readOnly={readOnly} />
              </FieldRow>
            </View>
          </View>
        </>
      )}

      <SectionDivider title={t('propLocationSection')} />

      <View style={s.row2}>
        <View style={{ flex: 1 }}>
          <FieldRow label={t('propBeachDist')}>
            <FieldInput value={form.beach_distance} onChangeText={v => set('beach_distance', v)} placeholder="500" numeric readOnly={readOnly} />
          </FieldRow>
        </View>
        <View style={{ flex: 1 }}>
          <FieldRow label={t('propMarketDist')}>
            <FieldInput value={form.market_distance} onChangeText={v => set('market_distance', v)} placeholder="200" numeric readOnly={readOnly} />
          </FieldRow>
        </View>
      </View>

      <FieldRow label={t('propGoogleMapsLink')}>
        <FieldInput value={form.google_maps_link} onChangeText={v => set('google_maps_link', v)} placeholder="https://maps.google.com/..." readOnly={readOnly} />
      </FieldRow>

      {!isParent && (
        <FieldRow label={t('propWebsite')}>
          <FieldInput value={form.website_url} onChangeText={v => set('website_url', v)} placeholder="https://..." readOnly={readOnly} />
        </FieldRow>
      )}

      <SectionDivider title={t('propDescriptionSection')} />

      <FieldRow label={t('pdDescription')}>
        <FieldInput value={form.description} onChangeText={v => set('description', v)} placeholder={t('propDescriptionPlaceholder')} multiline readOnly={readOnly} />
      </FieldRow>

      <FieldRow label={t('propCommentsAgent')}>
        <FieldInput value={form.comments} onChangeText={v => set('comments', v)} placeholder={t('propCommentsPlaceholder')} multiline readOnly={readOnly} />
      </FieldRow>
    </>
  );

  const renderPrices = () => (
    <>
      <SectionDivider title={t('propRentalSection')} />

      <FieldRow label={L('propPriceMonthly')}>
        <FieldInput value={form.price_monthly} onChangeText={v => set('price_monthly', v)} placeholder="15 000" numeric readOnly={readOnly} />
      </FieldRow>
      <FieldToggle label={t('propFromToggle')} compact value={form.price_monthly_is_from} onChange={v => set('price_monthly_is_from', v)} readOnly={readOnly} />

      <SectionDivider title={t('propDeposits')} />

      <FieldRow label={L('propBookingDeposit2')}>
        <FieldInput value={form.booking_deposit} onChangeText={v => set('booking_deposit', v)} placeholder="5 000" numeric readOnly={readOnly} />
      </FieldRow>
      <FieldToggle label={t('propFromToggle')} compact value={form.booking_deposit_is_from} onChange={v => set('booking_deposit_is_from', v)} readOnly={readOnly} />

      <FieldRow label={L('propSaveDeposit2')}>
        <FieldInput value={form.save_deposit} onChangeText={v => set('save_deposit', v)} placeholder="10 000" numeric readOnly={readOnly} />
      </FieldRow>
      <FieldToggle label={t('propFromToggle')} compact value={form.save_deposit_is_from} onChange={v => set('save_deposit_is_from', v)} readOnly={readOnly} />

      <SectionDivider title={t('propCommissionSection')} />

      <FieldRow label={L('propCommissionField')}>
        <FieldInput value={form.commission} onChangeText={v => set('commission', v)} placeholder="15 000" numeric readOnly={readOnly} />
      </FieldRow>
      <FieldToggle label={t('propFromToggle')} compact value={form.commission_is_from} onChange={v => set('commission_is_from', v)} readOnly={readOnly} />

      <OwnerCommField
        label={t('propOwnerCommOnce').replace(' (฿)', '')}
        value={form.owner_commission_one_time}
        isPercent={form.owner_commission_one_time_is_percent}
        onChangeValue={v => set('owner_commission_one_time', v)}
        onTogglePercent={v => set('owner_commission_one_time_is_percent', v)}
        sym={sym}
        priceMonthly={form.price_monthly}
        readOnly={readOnly}
      />

      <OwnerCommField
        label={t('propOwnerCommMonthly').replace(' (฿)', '')}
        value={form.owner_commission_monthly}
        isPercent={form.owner_commission_monthly_is_percent}
        onChangeValue={v => set('owner_commission_monthly', v)}
        onTogglePercent={v => set('owner_commission_monthly_is_percent', v)}
        sym={sym}
        priceMonthly={form.price_monthly}
        readOnly={readOnly}
      />
    </>
  );

  const renderUtilities = () => (
    <>
      <SectionDivider title={t('propElectricityWater')} />

      <FieldRow label={L('propElectricityField')}>
        <FieldInput value={form.electricity_price} onChangeText={v => set('electricity_price', v)} placeholder="7" numeric readOnly={readOnly} />
      </FieldRow>

      <FieldRow label={L('propWaterField')}>
        <FieldInput value={form.water_price} onChangeText={v => set('water_price', v)} placeholder="100" numeric readOnly={readOnly} />
      </FieldRow>

      <FieldRow label={t('propWaterType')}>
        <FieldSelect
          value={form.water_price_type}
          onChange={v => set('water_price_type', v)}
          readOnly={readOnly}
          options={[
            { value: 'cubic',  label: t('propWaterCubic'),  icon: require('../../../assets/icon-price-water.png') },
            { value: 'person', label: t('propWaterPerson'), icon: require('../../../assets/icon-contact-phone.png') },
            { value: 'fixed',  label: t('propWaterFixed'),  icon: require('../../../assets/icon-price-monthly.png') },
          ]}
        />
      </FieldRow>

      <SectionDivider title={t('propOtherServices')} />

      <FieldRow label={L('propGasField')}>
        <FieldInput value={form.gas_price} onChangeText={v => set('gas_price', v)} placeholder="500" numeric readOnly={readOnly} />
      </FieldRow>

      <FieldRow label={L('propInternetMonth')}>
        <FieldInput value={form.internet_price} onChangeText={v => set('internet_price', v)} placeholder="600" numeric readOnly={readOnly} />
      </FieldRow>

      <FieldRow label={L('propCleaningField')}>
        <FieldInput value={form.cleaning_price} onChangeText={v => set('cleaning_price', v)} placeholder="500" numeric readOnly={readOnly} />
      </FieldRow>

      <FieldRow label={L('propExitCleaningField')}>
        <FieldInput value={form.exit_cleaning_price} onChangeText={v => set('exit_cleaning_price', v)} placeholder="1 000" numeric readOnly={readOnly} />
      </FieldRow>

    </>
  );

  const renderPhotosTab = () => (
    <>
      <SectionDivider title={t('pdPhotos')} />
      <View style={s.photosGrid}>
        {(form.photos || []).map((uri, idx) => (
          <View key={idx} style={s.photoThumb}>
            <Image source={{ uri }} style={s.photoThumbImg} resizeMode="cover" />
            {!readOnly && (
              <TouchableOpacity style={s.photoRemoveBtn} onPress={() => handleRemovePhoto(idx)}>
                <Text style={s.photoRemoveText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
        {!readOnly && (
          <TouchableOpacity style={s.photoAddBtn} onPress={handlePickPhotos} disabled={uploadingPhoto}>
            {uploadingPhoto
              ? <ActivityIndicator size="small" color={ACCENT} />
              : <Text style={s.photoAddText}>{t('propAddPhoto')}</Text>
            }
          </TouchableOpacity>
        )}
      </View>

      <SectionDivider title={t('pdVideo')} />
      <View style={s.fieldRow}>
        <TextInput
          style={[s.input, readOnly && s.fieldInputReadonlyStyle]}
          value={form.video_url}
          onChangeText={readOnly ? undefined : (v => set('video_url', v))}
          placeholder={readOnly ? '' : t('propVideoLink')}
          placeholderTextColor={C.light}
          autoCapitalize="none"
          keyboardType="url"
          editable={!readOnly}
          selectTextOnFocus={!readOnly}
          caretHidden={!!readOnly}
        />
      </View>
    </>
  );

  const renderAmenities = () => (
    <>
      <SectionDivider title={t('propFeatures')} />

      <FieldToggle
        icon={ICON_TOGGLE_PETS}
        label={t('propPetsLabel')}
        value={form.pets_allowed}
        onChange={v => set('pets_allowed', v)}
        readOnly={readOnly}
      />
      <FieldToggle
        icon={ICON_TOGGLE_BOOKING}
        label={t('propLongTermLabel')}
        value={form.long_term_booking}
        onChange={v => set('long_term_booking', v)}
        readOnly={readOnly}
      />

      <SectionDivider title={t('tabAmenities')} />

      <View style={s.amenitiesGrid}>
        {AMENITY_KEYS.map(({ key, label, icon }) => (
          <TouchableOpacity
            key={key}
            style={[s.amenityChip, form.amenities[key] && s.amenityChipActive]}
            onPress={readOnly ? undefined : () => setAmenity(key, !form.amenities[key])}
            activeOpacity={readOnly ? 1 : 0.75}
          >
            <Image
              source={icon}
              style={[s.amenityChipIcon, form.amenities[key] && s.amenityChipIconActive]}
              resizeMode="contain"
            />
            <Text style={[s.amenityChipText, form.amenities[key] && s.amenityChipTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );

  // ── Render ───────────────────────────────────────────────────────────────────

  if (!mounted) return null;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={handleClose}>
      <View style={s.overlay}>
        {/* Dim backdrop — animated opacity */}
        <Animated.View
          style={[s.backdrop, { opacity: backdropAnim }]}
          pointerEvents={visible ? 'auto' : 'none'}
        >
          <TouchableOpacity style={{ flex: 1 }} onPress={handleClose} activeOpacity={1} />
        </Animated.View>

        {/* Sliding panel */}
        <Animated.View style={[s.panel, { transform: [{ translateX: slideAnim }] }]}>

          {/* Header */}
          <View style={s.panelHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.panelTitle} numberOfLines={1}>{title}</Text>
              {mode === 'create-unit' && parentProperty && (
                <Text style={s.panelSubtitle}>
                  {parentProperty.type === 'condo' ? '🏢' : '🏨'} {parentProperty.name}
                </Text>
              )}
            </View>
            <TouchableOpacity style={s.closeBtn} onPress={handleClose}>
              <Text style={s.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={s.tabs}>
            {visibleTabs.map(tab_ => (
              <TouchableOpacity
                key={tab_.key}
                style={[s.tabBtn, tab === tab_.key && s.tabBtnActive]}
                onPress={() => setTab(tab_.key)}
              >
                <Image source={tab_.icon} style={[s.tabBtnIcon, tab === tab_.key && s.tabBtnIconActive]} resizeMode="contain" />
                <Text style={[s.tabBtnText, tab === tab_.key && s.tabBtnTextActive]} numberOfLines={1}>{tab_.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Form content */}
          <ScrollView style={s.formScroll} showsVerticalScrollIndicator={false} contentContainerStyle={s.formContent}>
            {tab === 'main'      && renderMain()}
            {tab === 'prices'    && renderPrices()}
            {tab === 'utilities' && renderUtilities()}
            {tab === 'amenities' && renderAmenities()}
            {tab === 'photos' && renderPhotosTab()}
            <View style={{ height: 24 }} />
          </ScrollView>

          {/* Footer */}
          <View style={s.footer}>
            {error ? <Text style={s.footerError}>{error}</Text> : null}

            <View style={s.footerBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={handleClose}>
                <Text style={s.cancelBtnText}>{t('cancel')}</Text>
              </TouchableOpacity>
              {!readOnly && (
                <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
                  {saving
                    ? <ActivityIndicator size="small" color="#FFF" />
                    : <Text style={s.saveBtnText}>
                        {mode === 'edit' ? t('save') : `＋ ${t('add')}`}
                      </Text>
                  }
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Animated.View>
      </View>

      {/* Панель создания нового собственника — открывается поверх формы объекта */}
      <WebContactEditPanel
        visible={newOwnerVisible}
        mode="add"
        lockType="owners"
        contact={(() => {
          const parts = (newOwnerInitialName || '').trim().split(/\s+/).filter(Boolean);
          if (parts.length === 0) return null;
          return { name: parts[0], lastName: parts.slice(1).join(' ') };
        })()}
        onClose={() => setNewOwnerVisible(false)}
        onSaved={handleNewOwnerSaved}
      />
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    flexDirection: 'row',
  },
  backdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  panel: {
    width: 540,
    backgroundColor: C.surface,
    shadowColor: '#000',
    shadowOffset: { width: -8, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    flexDirection: 'column',
  },

  // Header
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 12,
  },
  panelTitle: { fontSize: 18, fontWeight: '800', color: C.text },
  panelSubtitle: { fontSize: 12, color: C.muted, marginTop: 2 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { fontSize: 16, color: C.muted },

  // Tabs
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  tabBtnActive: { borderBottomColor: ACCENT },
  tabBtnIcon: { width: 22, height: 22, opacity: 0.3 },
  tabBtnIconActive: { opacity: 1 },
  tabBtnText: { fontSize: 11, fontWeight: '500', color: C.muted },
  tabBtnTextActive: { color: ACCENT, fontWeight: '700' },

  // Photos tab
  photosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  photoThumb: { width: 100, height: 80, borderRadius: 8, overflow: 'hidden', position: 'relative' },
  photoThumbImg: { width: '100%', height: '100%' },
  photoRemoveBtn: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10,
    width: 20, height: 20, alignItems: 'center', justifyContent: 'center',
  },
  photoRemoveText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  photoAddBtn: {
    width: 100, height: 80, borderRadius: 8,
    borderWidth: 1.5, borderColor: C.border, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface,
  },
  photoAddText: { fontSize: 12, color: C.muted, textAlign: 'center' },

  // Form
  formScroll: { flex: 1 },
  formContent: { paddingHorizontal: 24, paddingTop: 20 },

  fieldRow: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: C.muted, marginBottom: 6 },
  fieldInput: {
    height: 42, borderWidth: 1, borderColor: C.border,
    borderRadius: 10, paddingHorizontal: 12,
    fontSize: 14, color: C.text, backgroundColor: C.bg,
    outlineWidth: 0,
  },
  fieldInputMulti: {
    height: 80, paddingTop: 10, textAlignVertical: 'top',
  },
  fieldInputReadonly: {
    height: 42, borderWidth: 1, borderColor: C.border,
    borderRadius: 10, paddingHorizontal: 12,
    backgroundColor: '#F8F9FA',
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldInputReadonlyText: { fontSize: 14, fontWeight: '700', color: C.muted },
  fieldInputReadonlyHint: { fontSize: 11, color: C.light },
  // Applied to FieldInput/TextInput when readOnly=true
  fieldInputReadonlyStyle: {
    backgroundColor: '#F8F9FA',
    borderColor: '#E9ECEF',
    color: '#6C757D',
    opacity: 0.92,
  },
  // General "disabled look" — applies to all read-only interactive fields
  fieldDisabledLook: {
    backgroundColor: '#F8F9FA',
    borderColor: '#E9ECEF',
    color: '#6C757D',
    opacity: 0.92,
  },
  selectOptionReadonly: {
    backgroundColor: '#F8F9FA',
    borderColor: '#E9ECEF',
  },
  row2: { flexDirection: 'row', gap: 12 },
  row3: { flexDirection: 'row', gap: 12 },

  sectionDivider: {
    fontSize: 11, fontWeight: '700', color: C.muted,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginTop: 8, marginBottom: 14,
    paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: C.border,
  },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  toggleRowCompact: {
    justifyContent: 'flex-end',
    paddingVertical: 6,
    gap: 8,
    borderBottomWidth: 0,
    marginBottom: 2,
  },
  toggleIcon: { width: 22, height: 22, marginRight: 8 },
  toggleLabel: { flex: 1, fontSize: 14, color: C.text },
  toggleLabelCompact: { fontSize: 12, color: C.muted, fontWeight: '600', flex: 0 },

  selectRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  selectOption: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 8, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.bg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectOptionIcon: { width: 16, height: 16 },
  selectOptionActive: { borderColor: ACCENT, backgroundColor: C.accentBg },
  selectOptionText: { fontSize: 13, color: C.muted, fontWeight: '500' },
  selectOptionTextActive: { color: ACCENT, fontWeight: '700' },

  amenitiesGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    marginTop: 8, gap: 8,
    paddingHorizontal: 4,
  },
  amenityChip: {
    width: '31%',
    paddingHorizontal: 10, paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    backgroundColor: C.bg,
    alignItems: 'center',
  },
  amenityChipActive: { backgroundColor: C.accentBg, borderColor: ACCENT },
  amenityChipIcon: { width: 22, height: 22, marginBottom: 4, opacity: 0.6 },
  amenityChipIconActive: { opacity: 1, tintColor: ACCENT },
  amenityChipText: { fontSize: 11, color: C.muted, textAlign: 'center' },
  amenityChipTextActive: { color: ACCENT, fontWeight: '700' },

  // Footer
  footer: {
    paddingHorizontal: 24, paddingVertical: 16,
    borderTopWidth: 1, borderTopColor: C.border,
    gap: 8,
  },
  footerError: { fontSize: 13, color: ACCENT },
  footerBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1, height: 44, borderRadius: 14,
    borderWidth: 1.5, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: C.muted },
  saveBtn: {
    flex: 2, height: 44, borderRadius: 14,
    backgroundColor: '#EAF4F5',
    borderWidth: 1.5, borderColor: '#B2D8DB',
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: ACCENT },
});
