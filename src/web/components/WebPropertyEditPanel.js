import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Switch, Animated, Modal, ActivityIndicator, Image, Platform,
} from 'react-native';
import { updateProperty, createPropertyFull, createProperty } from '../../services/propertiesService';
import { supabase } from '../../services/supabase';

const ICON_TAB_MAIN      = require('../../../assets/icon-tab-main.png');
const ICON_TAB_PRICES    = require('../../../assets/icon-tab-prices.png');
const ICON_TAB_UTILITIES = require('../../../assets/icon-tab-utilities.png');
const ICON_TAB_AMENITIES = require('../../../assets/icon-tab-amenities.png');
const ICON_TAB_PHOTOS    = require('../../../assets/icon-tab-photos.png');
const ICON_TOGGLE_PETS    = require('../../../assets/icon-toggle-pets.png');
const ICON_TOGGLE_BOOKING = require('../../../assets/icon-toggle-booking.png');
const PHOTOS_BUCKET      = 'property-photos';

const ACCENT = '#D81B60';
const C = {
  bg: '#F4F6F9', surface: '#FFFFFF', border: '#E9ECEF',
  text: '#212529', muted: '#6C757D', light: '#ADB5BD',
  accent: ACCENT, accentBg: '#FCE4EC',
};

const TABS = [
  { key: 'main',      label: 'Основное',     icon: ICON_TAB_MAIN      },
  { key: 'prices',    label: 'Цены',          icon: ICON_TAB_PRICES    },
  { key: 'utilities', label: 'Коммунальные',  icon: ICON_TAB_UTILITIES },
  { key: 'amenities', label: 'Удобства',      icon: ICON_TAB_AMENITIES },
  { key: 'photos',    label: 'Фото',          icon: ICON_TAB_PHOTOS    },
];

const AMENITY_KEYS = [
  { key: 'swimming_pool',   label: 'Бассейн',      icon: require('../../../assets/icon-amenity-swimming_pool.png') },
  { key: 'gym',             label: 'Спортзал',     icon: require('../../../assets/icon-amenity-gym.png') },
  { key: 'parking',         label: 'Парковка',     icon: require('../../../assets/icon-amenity-parking.png') },
  { key: 'internet',        label: 'Интернет',     icon: require('../../../assets/icon-amenity-internet.png') },
  { key: 'tv',              label: 'ТВ',           icon: require('../../../assets/icon-amenity-tv.png') },
  { key: 'washing_machine', label: 'Стир. машина', icon: require('../../../assets/icon-amenity-washing_machine.png') },
  { key: 'dishwasher',      label: 'Посудомойка',  icon: require('../../../assets/icon-amenity-dishwasher.png') },
  { key: 'fridge',          label: 'Холодильник',  icon: require('../../../assets/icon-amenity-fridge.png') },
  { key: 'stove',           label: 'Плита',        icon: require('../../../assets/icon-amenity-stove.png') },
  { key: 'oven',            label: 'Духовка',      icon: require('../../../assets/icon-amenity-oven.png') },
  { key: 'hood',            label: 'Вытяжка',      icon: require('../../../assets/icon-amenity-hood.png') },
  { key: 'microwave',       label: 'Микроволновка',icon: require('../../../assets/icon-amenity-microwave.png') },
  { key: 'kettle',          label: 'Чайник',       icon: require('../../../assets/icon-amenity-kettle.png') },
  { key: 'toaster',         label: 'Тостер',       icon: require('../../../assets/icon-amenity-toaster.png') },
  { key: 'coffee_machine',  label: 'Кофемашина',   icon: require('../../../assets/icon-amenity-coffee_machine.png') },
  { key: 'multi_cooker',    label: 'Мультиварка',  icon: require('../../../assets/icon-amenity-multi_cooker.png') },
  { key: 'blender',         label: 'Блендер',      icon: require('../../../assets/icon-amenity-blender.png') },
];

// ─── Small form components ────────────────────────────────────────────────────

function FieldLabel({ text, required }) {
  return (
    <Text style={s.fieldLabel}>
      {text}{required && <Text style={{ color: ACCENT }}> *</Text>}
    </Text>
  );
}

function FieldInput({ value, onChangeText, placeholder, numeric, multiline }) {
  return (
    <TextInput
      style={[s.fieldInput, multiline && s.fieldInputMulti]}
      value={value != null ? String(value) : ''}
      onChangeText={text => {
        if (numeric) {
          const cleaned = text.replace(/[^0-9.]/g, '');
          onChangeText(cleaned === '' ? null : cleaned);
        } else {
          onChangeText(text);
        }
      }}
      placeholder={placeholder || ''}
      placeholderTextColor={C.light}
      keyboardType={numeric ? 'numeric' : 'default'}
      multiline={multiline}
      numberOfLines={multiline ? 3 : 1}
    />
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

function FieldToggle({ label, icon, value, onChange, compact }) {
  return (
    <View style={[s.toggleRow, compact && s.toggleRowCompact]}>
      {icon && <Image source={icon} style={s.toggleIcon} resizeMode="contain" />}
      <Text style={[s.toggleLabel, compact && s.toggleLabelCompact]}>{label}</Text>
      <Switch
        value={!!value}
        onValueChange={onChange}
        trackColor={{ false: C.border, true: ACCENT }}
        thumbColor="#FFF"
      />
    </View>
  );
}

function FieldSelect({ value, options, onChange }) {
  return (
    <View style={s.selectRow}>
      {options.map(opt => (
        <TouchableOpacity
          key={opt.value}
          style={[s.selectOption, value === opt.value && s.selectOptionActive]}
          onPress={() => onChange(opt.value)}
        >
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
      city: property.city || '',
      district: property.district || '',
      houses_count: property.houses_count ?? '',
      floors: property.floors ?? '',
      bedrooms: property.bedrooms ?? '',
      bathrooms: property.bathrooms ?? '',
      area: property.area ?? '',
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
    };
  }
  // create mode
  return {
    name: '', code: parentProperty?.code || '', code_suffix: '',
    type: 'house',
    city: parentProperty?.city || '',
    district: parentProperty?.district || '',
    houses_count: '', floors: '',
    bedrooms: '', bathrooms: '', area: '',
    beach_distance: parentProperty?.beach_distance ?? '',
    market_distance: parentProperty?.market_distance ?? '',
    google_maps_link: '', website_url: '',
    description: '', comments: '',
    price_monthly: '', price_monthly_is_from: false,
    booking_deposit: '', booking_deposit_is_from: false,
    save_deposit: '', save_deposit_is_from: false,
    commission: '', commission_is_from: false,
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
  };
}

// ─── Main Panel Component ─────────────────────────────────────────────────────

/**
 * mode: 'edit' | 'create' | 'create-unit'
 * property: existing property (edit mode)
 * parentProperty: resort/condo (create-unit mode)
 */
export default function WebPropertyEditPanel({ visible, mode, property, parentProperty, onClose, onSaved }) {
  const [tab, setTab] = useState('main');
  const [form, setForm] = useState(() => buildForm(property, parentProperty));

  // Determine if this is a parent resort/condo (not a child unit)
  const effectiveType = mode === 'create-unit' ? (parentProperty?.type || 'house') : (property?.type || form.type);
  const isChildUnit = mode === 'create-unit' || Boolean(property?.resort_id);
  const isParent = !isChildUnit && (effectiveType === 'resort' || effectiveType === 'condo');
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

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const setAmenity = (key, val) => setForm(f => ({ ...f, amenities: { ...f.amenities, [key]: val } }));

  const numOrNull = val => {
    if (val === '' || val == null) return null;
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Введите название'); setTab('main'); return; }
    if (!form.code.trim()) { setError('Введите код'); setTab('main'); return; }
    setSaving(true);
    setError('');

    const updates = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      code_suffix: form.code_suffix.trim() || null,
      type: form.type,
      city: form.city.trim() || null,
      district: form.district.trim() || null,
      houses_count: numOrNull(form.houses_count),
      floors: numOrNull(form.floors),
      bedrooms: numOrNull(form.bedrooms),
      bathrooms: numOrNull(form.bathrooms),
      area: numOrNull(form.area),
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
      electricity_price: numOrNull(form.electricity_price),
      water_price: numOrNull(form.water_price),
      water_price_type: form.water_price_type,
      gas_price: numOrNull(form.gas_price),
      internet_price: numOrNull(form.internet_price),
      cleaning_price: numOrNull(form.cleaning_price),
      exit_cleaning_price: numOrNull(form.exit_cleaning_price),
      air_conditioners: numOrNull(form.air_conditioners),
      internet_speed: numOrNull(form.internet_speed),
      pets_allowed: form.pets_allowed,
      long_term_booking: form.long_term_booking,
      amenities: form.amenities,
      photos: form.photos || [],
      video_url: form.video_url.trim() || null,
    };

    try {
      let saved;
      if (mode === 'edit') {
        saved = await updateProperty(property.id, updates);
      } else if (mode === 'create-unit') {
        saved = await createPropertyFull({
          ...updates,
          resort_id: parentProperty.id,
          type: parentProperty.type,
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
      setError(e.message || 'Ошибка сохранения');
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
          const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
          const fileName = `${session.user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from(PHOTOS_BUCKET)
            .upload(fileName, file, { upsert: true, contentType: file.type });
          if (upErr) { setError(`Ошибка: ${upErr.message}`); continue; }
          const { data: pub } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(fileName);
          newUrls.push(pub.publicUrl);
        }
        if (newUrls.length) {
          setForm(f => ({ ...f, photos: [...(f.photos || []), ...newUrls] }));
        }
      } catch (e) {
        setError(`Ошибка загрузки: ${e.message}`);
      } finally {
        setUploadingPhoto(false);
      }
    };
    input.click();
  };

  const handleRemovePhoto = (idx) => {
    setForm(f => ({ ...f, photos: f.photos.filter((_, i) => i !== idx) }));
  };

  const title = mode === 'edit'
    ? `Редактировать: ${property?.name || ''}`
    : mode === 'create-unit'
    ? `Добавить юнит в ${parentProperty?.name || ''}`
    : 'Добавить объект';

  // ── Tab content ──────────────────────────────────────────────────────────────

  const renderMain = () => (
    <>
      <FieldRow label="Название" required>
        <FieldInput value={form.name} onChangeText={v => set('name', v)} placeholder="Вилла Sunset" />
      </FieldRow>

      <View style={s.row2}>
        <View style={{ flex: 1 }}>
          <FieldRow label="Код" required={!(mode === 'edit' && property?.resort_id)}>
            {mode === 'edit' && property?.resort_id ? (
              <View style={s.fieldInputReadonly}>
                <Text style={s.fieldInputReadonlyText}>{form.code}</Text>
                <Text style={s.fieldInputReadonlyHint}>🔒</Text>
              </View>
            ) : (
              <FieldInput value={form.code} onChangeText={v => set('code', v)} placeholder="CW01" />
            )}
          </FieldRow>
        </View>
        <View style={{ flex: 1 }}>
          <FieldRow label="Суффикс кода">
            <FieldInput value={form.code_suffix} onChangeText={v => set('code_suffix', v)} placeholder="A, B, 32…" />
          </FieldRow>
        </View>
      </View>

      {mode !== 'create-unit' && !(mode === 'edit' && property?.resort_id) && (
        <FieldRow label="Тип объекта">
          <FieldSelect
            value={form.type}
            onChange={v => set('type', v)}
            options={[
              { value: 'house',  label: '🏠 Дом' },
              { value: 'resort', label: '🏨 Резорт' },
              { value: 'condo',  label: '🏢 Кондо' },
            ]}
          />
        </FieldRow>
      )}

      <View style={s.row2}>
        <View style={{ flex: 1 }}>
          <FieldRow label="Город">
            {mode === 'edit' && property?.resort_id ? (
              <View style={s.fieldInputReadonly}>
                <Text style={s.fieldInputReadonlyText}>{form.city || '—'}</Text>
                <Text style={s.fieldInputReadonlyHint}>🔒</Text>
              </View>
            ) : (
              <FieldInput value={form.city} onChangeText={v => set('city', v)} placeholder="Ko Samui" />
            )}
          </FieldRow>
        </View>
        <View style={{ flex: 1 }}>
          <FieldRow label="Район">
            {mode === 'edit' && property?.resort_id ? (
              <View style={s.fieldInputReadonly}>
                <Text style={s.fieldInputReadonlyText}>{form.district || '—'}</Text>
                <Text style={s.fieldInputReadonlyHint}>🔒</Text>
              </View>
            ) : (
              <FieldInput value={form.district} onChangeText={v => set('district', v)} placeholder="BanTai" />
            )}
          </FieldRow>
        </View>
      </View>

      <SectionDivider title="Параметры" />

      {/* Resort: houses count */}
      {isParent && effectiveType === 'resort' && (
        <FieldRow label="Кол-во домов">
          <FieldInput value={form.houses_count} onChangeText={v => set('houses_count', v)} placeholder="10" numeric />
        </FieldRow>
      )}

      {/* Condo: floors */}
      {isParent && effectiveType === 'condo' && (
        <FieldRow label="Этажей">
          <FieldInput value={form.floors} onChangeText={v => set('floors', v)} placeholder="7" numeric />
        </FieldRow>
      )}

      {/* House / child unit: bedrooms, bathrooms, area + air conditioners + internet speed */}
      {!isParent && (
        <>
          <View style={s.row3}>
            <View style={{ flex: 1 }}>
              <FieldRow label="Спальни">
                <FieldInput value={form.bedrooms} onChangeText={v => set('bedrooms', v)} placeholder="2" numeric />
              </FieldRow>
            </View>
            <View style={{ flex: 1 }}>
              <FieldRow label="Ванные">
                <FieldInput value={form.bathrooms} onChangeText={v => set('bathrooms', v)} placeholder="1" numeric />
              </FieldRow>
            </View>
            <View style={{ flex: 1 }}>
              <FieldRow label="Площадь м²">
                <FieldInput value={form.area} onChangeText={v => set('area', v)} placeholder="55" numeric />
              </FieldRow>
            </View>
          </View>
          <View style={s.row2}>
            <View style={{ flex: 1 }}>
              <FieldRow label="Кондиционеры">
                <FieldInput value={form.air_conditioners} onChangeText={v => set('air_conditioners', v)} placeholder="2" numeric />
              </FieldRow>
            </View>
            <View style={{ flex: 1 }}>
              <FieldRow label="Интернет (Мбит/с)">
                <FieldInput value={form.internet_speed} onChangeText={v => set('internet_speed', v)} placeholder="300" numeric />
              </FieldRow>
            </View>
          </View>
        </>
      )}

      <SectionDivider title="Расположение" />

      <View style={s.row2}>
        <View style={{ flex: 1 }}>
          <FieldRow label="До пляжа (м)">
            <FieldInput value={form.beach_distance} onChangeText={v => set('beach_distance', v)} placeholder="500" numeric />
          </FieldRow>
        </View>
        <View style={{ flex: 1 }}>
          <FieldRow label="До магазина (м)">
            <FieldInput value={form.market_distance} onChangeText={v => set('market_distance', v)} placeholder="200" numeric />
          </FieldRow>
        </View>
      </View>

      <FieldRow label="Google Maps ссылка">
        <FieldInput value={form.google_maps_link} onChangeText={v => set('google_maps_link', v)} placeholder="https://maps.google.com/..." />
      </FieldRow>

      {!isParent && (
        <FieldRow label="Сайт объекта">
          <FieldInput value={form.website_url} onChangeText={v => set('website_url', v)} placeholder="https://..." />
        </FieldRow>
      )}

      <SectionDivider title="Описание" />

      <FieldRow label="Описание">
        <FieldInput value={form.description} onChangeText={v => set('description', v)} placeholder="Описание объекта для клиентов…" multiline />
      </FieldRow>

      <FieldRow label="Комментарии агента">
        <FieldInput value={form.comments} onChangeText={v => set('comments', v)} placeholder="Внутренние заметки…" multiline />
      </FieldRow>
    </>
  );

  const renderPrices = () => (
    <>
      <SectionDivider title="Аренда" />

      <FieldRow label="Цена в месяц (฿)">
        <FieldInput value={form.price_monthly} onChangeText={v => set('price_monthly', v)} placeholder="15 000" numeric />
      </FieldRow>
      <FieldToggle label="от" compact value={form.price_monthly_is_from} onChange={v => set('price_monthly_is_from', v)} />

      <SectionDivider title="Депозиты" />

      <FieldRow label="Депозит бронирования (฿)">
        <FieldInput value={form.booking_deposit} onChangeText={v => set('booking_deposit', v)} placeholder="5 000" numeric />
      </FieldRow>
      <FieldToggle label="от" compact value={form.booking_deposit_is_from} onChange={v => set('booking_deposit_is_from', v)} />

      <FieldRow label="Сохранный депозит (฿)">
        <FieldInput value={form.save_deposit} onChangeText={v => set('save_deposit', v)} placeholder="10 000" numeric />
      </FieldRow>
      <FieldToggle label="от" compact value={form.save_deposit_is_from} onChange={v => set('save_deposit_is_from', v)} />

      <SectionDivider title="Комиссия" />

      <FieldRow label="Комиссия (฿)">
        <FieldInput value={form.commission} onChangeText={v => set('commission', v)} placeholder="15 000" numeric />
      </FieldRow>
      <FieldToggle label="от" compact value={form.commission_is_from} onChange={v => set('commission_is_from', v)} />
    </>
  );

  const renderUtilities = () => (
    <>
      <SectionDivider title="Электричество и вода" />

      <FieldRow label="Электричество (฿/ед.)">
        <FieldInput value={form.electricity_price} onChangeText={v => set('electricity_price', v)} placeholder="7" numeric />
      </FieldRow>

      <FieldRow label="Вода (฿)">
        <FieldInput value={form.water_price} onChangeText={v => set('water_price', v)} placeholder="100" numeric />
      </FieldRow>

      <FieldRow label="Тип оплаты воды">
        <FieldSelect
          value={form.water_price_type}
          onChange={v => set('water_price_type', v)}
          options={[
            { value: 'cubic',  label: '📦 куб.м' },
            { value: 'person', label: '👤 с чел.' },
            { value: 'fixed',  label: '📌 фикс.' },
          ]}
        />
      </FieldRow>

      <SectionDivider title="Прочие услуги" />

      <FieldRow label="Газ (฿)">
        <FieldInput value={form.gas_price} onChangeText={v => set('gas_price', v)} placeholder="500" numeric />
      </FieldRow>

      <FieldRow label="Интернет в месяц (฿)">
        <FieldInput value={form.internet_price} onChangeText={v => set('internet_price', v)} placeholder="600" numeric />
      </FieldRow>

      <FieldRow label="Уборка (฿)">
        <FieldInput value={form.cleaning_price} onChangeText={v => set('cleaning_price', v)} placeholder="500" numeric />
      </FieldRow>

      <FieldRow label="Уборка перед выездом (฿)">
        <FieldInput value={form.exit_cleaning_price} onChangeText={v => set('exit_cleaning_price', v)} placeholder="1 000" numeric />
      </FieldRow>

    </>
  );

  const renderPhotosTab = () => (
    <>
      <SectionDivider title="Фотографии" />
      <View style={s.photosGrid}>
        {(form.photos || []).map((uri, idx) => (
          <View key={idx} style={s.photoThumb}>
            <Image source={{ uri }} style={s.photoThumbImg} resizeMode="cover" />
            <TouchableOpacity style={s.photoRemoveBtn} onPress={() => handleRemovePhoto(idx)}>
              <Text style={s.photoRemoveText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={s.photoAddBtn} onPress={handlePickPhotos} disabled={uploadingPhoto}>
          {uploadingPhoto
            ? <ActivityIndicator size="small" color={ACCENT} />
            : <Text style={s.photoAddText}>＋ Добавить фото</Text>
          }
        </TouchableOpacity>
      </View>

      <SectionDivider title="Видео" />
      <View style={s.fieldRow}>
        <TextInput
          style={s.input}
          value={form.video_url}
          onChangeText={v => set('video_url', v)}
          placeholder="Ссылка на видео (YouTube, Vimeo...)"
          placeholderTextColor={C.light}
          autoCapitalize="none"
          keyboardType="url"
        />
      </View>
    </>
  );

  const renderAmenities = () => (
    <>
      <SectionDivider title="Особенности" />

      <FieldToggle
        icon={ICON_TOGGLE_PETS}
        label="Домашние животные разрешены"
        value={form.pets_allowed}
        onChange={v => set('pets_allowed', v)}
      />
      <FieldToggle
        icon={ICON_TOGGLE_BOOKING}
        label="Бронирование на дальние даты"
        value={form.long_term_booking}
        onChange={v => set('long_term_booking', v)}
      />

      <SectionDivider title="Удобства" />

      <View style={s.amenitiesGrid}>
        {AMENITY_KEYS.map(({ key, label, icon }) => (
          <TouchableOpacity
            key={key}
            style={[s.amenityChip, form.amenities[key] && s.amenityChipActive]}
            onPress={() => setAmenity(key, !form.amenities[key])}
            activeOpacity={0.75}
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
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <View style={s.overlay}>
        {/* Dim backdrop — animated opacity */}
        <Animated.View
          style={[s.backdrop, { opacity: backdropAnim }]}
          pointerEvents={visible ? 'auto' : 'none'}
        >
          <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
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
            <TouchableOpacity style={s.closeBtn} onPress={onClose}>
              <Text style={s.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={s.tabs}>
            {visibleTabs.map(t => (
              <TouchableOpacity
                key={t.key}
                style={[s.tabBtn, tab === t.key && s.tabBtnActive]}
                onPress={() => setTab(t.key)}
              >
                <Image source={t.icon} style={[s.tabBtnIcon, tab === t.key && s.tabBtnIconActive]} resizeMode="contain" />
                <Text style={[s.tabBtnText, tab === t.key && s.tabBtnTextActive]} numberOfLines={1}>{t.label}</Text>
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
              <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
                <Text style={s.cancelBtnText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
                {saving
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <Text style={s.saveBtnText}>
                      {mode === 'edit' ? '💾 Сохранить' : '＋ Добавить'}
                    </Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
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
  toggleLabelCompact: { fontSize: 12, color: C.muted, fontWeight: '600' },

  selectRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  selectOption: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 8, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.bg,
  },
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
  amenityChipIcon: { width: 20, height: 20, marginBottom: 3, opacity: 0.5 },
  amenityChipIconActive: { opacity: 1 },
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
    flex: 1, height: 44, borderRadius: 10,
    borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: C.muted },
  saveBtn: {
    flex: 2, height: 44, borderRadius: 10,
    backgroundColor: ACCENT,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
