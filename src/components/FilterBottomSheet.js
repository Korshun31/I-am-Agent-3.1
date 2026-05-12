import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Image,
  Platform,
  Keyboard,
  Dimensions,
} from 'react-native';

const { height: SCREEN_H } = Dimensions.get('window');
const MODAL_HEIGHT = Math.min(SCREEN_H * 0.85, 620);
const CITY_LIST_MAX_HEIGHT = 280;
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Image as RNImage } from 'react-native';
import { TYPE_COLORS } from './PropertyItem';
import { IconHouseType, IconCondoType } from './PropertyIcons';
import Checkbox from './Checkbox';

function IconResortPng({ size = 28, color = '#888' }) {
  return (
    <RNImage
      source={require('../../assets/icon-property-resort-new.png')}
      style={{ width: size, height: size, tintColor: color }}
      resizeMode="contain"
    />
  );
}
import { useLanguage } from '../context/LanguageContext';

const AMENITY_KEYS = ['swimming_pool', 'gym', 'parking', 'washing_machine'];

const TYPE_BLOCKS = [
  { key: 'resort', Icon: IconResortPng },
  { key: 'house',  Icon: IconHouseType },
  { key: 'condo',  Icon: IconCondoType },
];

const COLORS = {
  boxBg: '#FFFFFF',
  inputBg: '#F7F7F9',
  title: '#2C2C2C',
  label: '#6B6B6B',
  border: '#D1D1D6',
  muted: '#888',
  accent: '#3D7D82',
  accentBg: 'rgba(61,125,130,0.06)',
  accentBorder: 'rgba(61,125,130,0.5)',
  saveGreen: '#3D7D82',
};

function CheckRow({ label, checked, onPress }) {
  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.7}>
      <Checkbox checked={checked} style={{ marginRight: 12 }} />
      <Text style={s.rowLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function Pill({ label, selected, onPress }) {
  return (
    <TouchableOpacity
      style={[s.pill, selected && s.pillSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[s.pillText, selected && s.pillTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function FilterBottomSheet({
  visible,
  onClose,
  filter,
  onApply,
  cities = [],
  districts = [],
  user,
  showBookingsFilter = true,
}) {
  const { t } = useLanguage();
  const [city, setCity] = useState(filter?.city ?? null);
  const [selectedDistricts, setSelectedDistricts] = useState(new Set(filter?.districts ?? []));
  const [selectedTypes, setSelectedTypes] = useState(new Set(filter?.types ?? []));
  const [selectedBedrooms, setSelectedBedrooms] = useState(() => {
    const b = filter?.bedrooms;
    if (b == null) return new Set();
    return new Set(Array.isArray(b) ? b : [b]);
  });
  const [priceMin, setPriceMin] = useState(filter?.priceMin != null ? String(filter.priceMin) : '');
  const [priceMax, setPriceMax] = useState(filter?.priceMax != null ? String(filter.priceMax) : '');
  const [pets, setPets] = useState(filter?.pets ?? null);
  const [longTerm, setLongTerm] = useState(filter?.longTerm ?? null);
  const [selectedAmenities, setSelectedAmenities] = useState(new Set(filter?.amenities ?? []));
  // myBookings: для агента «Мои бронирования», для админа «Бронирования компании».
  // По умолчанию ВКЛ — это текущий префильтр, который показывает дома с актуальной бронью.
  const [myBookings, setMyBookings] = useState(filter?.myBookings !== false);
  const [cityPickerVisible, setCityPickerVisible] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [cityPickerSelected, setCityPickerSelected] = useState(null);
  const [districtPickerVisible, setDistrictPickerVisible] = useState(false);
  const [districtSearch, setDistrictSearch] = useState('');
  const [districtPickerSelected, setDistrictPickerSelected] = useState(new Set());

  useEffect(() => {
    if (visible) {
      setCity(filter?.city ?? null);
      setSelectedDistricts(new Set(filter?.districts ?? []));
      setSelectedTypes(new Set(filter?.types ?? []));
      const b = filter?.bedrooms;
      setSelectedBedrooms(b == null ? new Set() : new Set(Array.isArray(b) ? b : [b]));
      setPriceMin(filter?.priceMin != null ? String(filter.priceMin) : '');
      setPriceMax(filter?.priceMax != null ? String(filter.priceMax) : '');
      setPets(filter?.pets ?? null);
      setLongTerm(filter?.longTerm ?? null);
      setSelectedAmenities(new Set(filter?.amenities ?? []));
      setMyBookings(filter?.myBookings !== false);
    }
  }, [visible, filter]);

  const toggleBedroom = (n) => {
    setSelectedBedrooms(prev => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  };

  const toggleType = (type) => {
    setSelectedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const toggleAmenity = (key) => {
    setSelectedAmenities(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const filteredCities = citySearch.trim()
    ? cities.filter(c => (c || '').toLowerCase().includes(citySearch.trim().toLowerCase()))
    : cities;

  const filteredDistricts = districtSearch.trim()
    ? districts.filter(d => (d || '').toLowerCase().includes(districtSearch.trim().toLowerCase()))
    : districts;

  const toggleDistrictPicker = (d) => {
    setDistrictPickerSelected(prev => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  };

  const handleClear = () => {
    setCity(null);
    setSelectedDistricts(new Set());
    setSelectedTypes(new Set());
    setSelectedBedrooms(new Set());
    setPriceMin('');
    setPriceMax('');
    setPets(null);
    setLongTerm(null);
    setSelectedAmenities(new Set());
    setMyBookings(false);
    onApply?.({
      city: null,
      districts: [],
      types: [],
      bedrooms: null,
      priceMin: null,
      priceMax: null,
      pets: null,
      longTerm: null,
      amenities: [],
      myBookings: false,
    });
    onClose?.();
  };

  const handleApply = () => {
    const priceMinNum = priceMin.trim() ? parseFloat(priceMin) : null;
    const priceMaxNum = priceMax.trim() ? parseFloat(priceMax) : null;
    onApply?.({
      city: city || null,
      districts: [...selectedDistricts],
      types: [...selectedTypes],
      bedrooms: selectedBedrooms.size === 0 ? null : [...selectedBedrooms],
      priceMin: isNaN(priceMinNum) ? null : priceMinNum,
      priceMax: isNaN(priceMaxNum) ? null : priceMaxNum,
      pets: pets,
      longTerm: longTerm,
      amenities: [...selectedAmenities],
      myBookings: showBookingsFilter ? myBookings : false,
    });
    onClose?.();
  };

  if (!visible) return null;

  const typeLabels = { resort: t('propertyType_resort'), house: t('propertyType_house'), condo: t('propertyType_condo') };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={() => { Keyboard.dismiss(); onClose?.(); }}>
        {Platform.OS === 'web' ? (
          <View style={[StyleSheet.absoluteFill, s.backdropWeb]} />
        ) : (
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        )}
        <Pressable style={s.boxWrap} onPress={(e) => { e.stopPropagation(); Keyboard.dismiss(); }}>
          <View style={s.box}>
            <View style={s.headerRow}>
              <View style={s.headerSpacer} />
              <Text style={s.title}>{t('filterTitle')}</Text>
              <TouchableOpacity onPress={onClose} style={s.closeBtn} activeOpacity={0.8}>
                <Ionicons name="close" size={22} color="#888" />
              </TouchableOpacity>
            </View>

          <ScrollView
            style={s.scroll}
            contentContainerStyle={s.scrollContent}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={Keyboard.dismiss}
            indicatorStyle="black"
          >
            {showBookingsFilter && (
              <View style={s.section}>
                <CheckRow
                  label={user?.isAgentRole ? t('filterMyBookings') : t('filterCompanyBookings')}
                  checked={myBookings}
                  onPress={() => setMyBookings(v => !v)}
                />
              </View>
            )}

            {cities.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>{t('pdCity')}</Text>
                <TouchableOpacity
                  style={s.cityField}
                  onPress={() => { setCitySearch(''); setCityPickerSelected(city); setCityPickerVisible(true); }}
                  activeOpacity={0.8}
                >
                  <Text style={[s.cityFieldText, !city && s.cityFieldPlaceholder]} numberOfLines={1}>
                    {city || t('filterAny')}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color="#6B6B6B" />
                </TouchableOpacity>
              </View>
            )}

            {districts.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>{t('propDistrict')}</Text>
                <TouchableOpacity
                  style={s.cityField}
                  onPress={() => { setDistrictSearch(''); setDistrictPickerSelected(new Set(selectedDistricts)); setDistrictPickerVisible(true); }}
                  activeOpacity={0.8}
                >
                  <Text style={[s.cityFieldText, selectedDistricts.size === 0 && s.cityFieldPlaceholder]} numberOfLines={1}>
                    {selectedDistricts.size === 0
                      ? t('filterAny')
                      : selectedDistricts.size === 1
                        ? [...selectedDistricts][0]
                        : `${selectedDistricts.size} ${t('filterDistrictsCount')}`}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color="#6B6B6B" />
                </TouchableOpacity>
              </View>
            )}

            <View style={s.section}>
              <Text style={s.sectionTitle}>{t('filterType')}</Text>
              <View style={s.typeRow}>
                {TYPE_BLOCKS.map((pt) => {
                  const isActive = selectedTypes.has(pt.key);
                  const typeColor = TYPE_COLORS[pt.key] || TYPE_COLORS.house;
                  const iconColor = isActive ? typeColor : '#C7C7CC';
                  const labelColor = isActive ? typeColor : '#C7C7CC';
                  return (
                    <TouchableOpacity
                      key={pt.key}
                      style={[
                        s.typeBtn,
                        isActive && { borderColor: typeColor, borderWidth: 1.5 },
                      ]}
                      onPress={() => toggleType(pt.key)}
                      activeOpacity={0.7}
                    >
                      <pt.Icon size={28} color={iconColor} />
                      <Text style={[s.typeBtnLabel, { color: labelColor }]} numberOfLines={1}>
                        {typeLabels[pt.key]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={s.section}>
              <Text style={s.sectionTitle}>{t('filterBedrooms')}</Text>
              <View style={s.bedroomRow}>
                <TouchableOpacity
                  style={[s.bedroomBox, selectedBedrooms.size === 0 && s.bedroomBoxSelected]}
                  onPress={() => setSelectedBedrooms(new Set())}
                  activeOpacity={0.7}
                >
                  <Text style={[s.bedroomBoxText, selectedBedrooms.size === 0 && s.bedroomBoxTextSelected]}>—</Text>
                </TouchableOpacity>
                {[1, 2, 3, 4, 5].map(n => (
                  <TouchableOpacity
                    key={n}
                    style={[s.bedroomBox, selectedBedrooms.has(n) && s.bedroomBoxSelected]}
                    onPress={() => toggleBedroom(n)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.bedroomBoxText, selectedBedrooms.has(n) && s.bedroomBoxTextSelected]}>{n === 5 ? '5+' : n}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={s.section}>
              <Text style={s.sectionTitle}>{t('filterPriceRange')}</Text>
              <View style={s.priceRow}>
                <TextInput
                  style={s.priceInput}
                  value={priceMin}
                  onChangeText={setPriceMin}
                  placeholder="0"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                />
                <Text style={s.priceDash}>—</Text>
                <TextInput
                  style={s.priceInput}
                  value={priceMax}
                  onChangeText={setPriceMax}
                  placeholder="∞"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={s.section}>
              <CheckRow label={t('pdLongTerm')} checked={longTerm === true} onPress={() => setLongTerm(longTerm === true ? null : true)} />
            </View>

            <View style={s.section}>
              <CheckRow label={t('filterPets')} checked={pets === true} onPress={() => setPets(pets === true ? null : true)} />
            </View>

            <View style={s.section}>
              <Text style={s.sectionTitle}>{t('pdAmenities')}</Text>
              {AMENITY_KEYS.map(key => (
                <CheckRow key={key} label={t(`amenity_${key}`)} checked={selectedAmenities.has(key)} onPress={() => toggleAmenity(key)} />
              ))}
            </View>
            <View style={{ height: 24 }} />
          </ScrollView>

          <View style={s.buttons}>
            <TouchableOpacity style={s.clearBtn} onPress={handleClear} activeOpacity={0.7}>
              <Text style={s.clearBtnText}>{t('filterClear')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.applyBtn} onPress={handleApply} activeOpacity={0.7}>
              <Text style={s.applyBtnText}>{t('filterApply')}</Text>
            </TouchableOpacity>
          </View>
          </View>
        </Pressable>
      </Pressable>

      {cityPickerVisible && (
        <Modal transparent animationType="fade" onRequestClose={() => setCityPickerVisible(false)} statusBarTranslucent>
          <Pressable style={s.cityPickerBackdrop} onPress={() => setCityPickerVisible(false)}>
            {Platform.OS === 'web' ? (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
            ) : (
              <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
            )}
            <Pressable style={s.cityPickerBox} onPress={(e) => e.stopPropagation()}>
              <View style={s.cityPickerHeader}>
                <Text style={s.cityPickerTitle}>{t('pdCity')}</Text>
                <TouchableOpacity onPress={() => setCityPickerVisible(false)} style={s.closeBtn} activeOpacity={0.8}>
                  <Ionicons name="close" size={22} color="#888" />
                </TouchableOpacity>
              </View>
              {cities.length > 10 && (
                <TextInput
                  style={s.citySearchInput}
                  placeholder={t('search')}
                  placeholderTextColor="#999"
                  value={citySearch}
                  onChangeText={setCitySearch}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              )}
              <ScrollView style={s.cityPickerScroll} contentContainerStyle={s.cityPickerScrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={true}>
                <TouchableOpacity style={s.cityPickerItem} onPress={() => setCityPickerSelected(null)} activeOpacity={0.7}>
                  <Text style={[s.cityPickerItemText, cityPickerSelected === null && s.cityPickerItemSelected]}>{t('filterAny')}</Text>
                  {cityPickerSelected === null && <Text style={s.cityPickerCheck}>✓</Text>}
                </TouchableOpacity>
                {filteredCities.map(c => (
                  <TouchableOpacity key={c} style={s.cityPickerItem} onPress={() => setCityPickerSelected(c)} activeOpacity={0.7}>
                    <Text style={[s.cityPickerItemText, cityPickerSelected === c && s.cityPickerItemSelected]} numberOfLines={1}>{c}</Text>
                    {cityPickerSelected === c && <Text style={s.cityPickerCheck}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity style={s.cityPickerSelectBtn} onPress={() => { setCity(cityPickerSelected); setCityPickerVisible(false); }} activeOpacity={0.7}>
                <Text style={s.cityPickerSelectBtnText}>{t('filterSelect')}</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {districtPickerVisible && (
        <Modal transparent animationType="fade" onRequestClose={() => setDistrictPickerVisible(false)} statusBarTranslucent>
          <Pressable style={s.cityPickerBackdrop} onPress={() => setDistrictPickerVisible(false)}>
            {Platform.OS === 'web' ? (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
            ) : (
              <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
            )}
            <Pressable style={s.cityPickerBox} onPress={(e) => e.stopPropagation()}>
              <View style={s.cityPickerHeader}>
                <Text style={s.cityPickerTitle}>{t('propDistrict')}</Text>
                <TouchableOpacity onPress={() => setDistrictPickerVisible(false)} style={s.closeBtn} activeOpacity={0.8}>
                  <Ionicons name="close" size={22} color="#888" />
                </TouchableOpacity>
              </View>
              {districts.length > 10 && (
                <TextInput
                  style={s.citySearchInput}
                  placeholder={t('search')}
                  placeholderTextColor="#999"
                  value={districtSearch}
                  onChangeText={setDistrictSearch}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              )}
              <ScrollView style={s.cityPickerScroll} contentContainerStyle={s.cityPickerScrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={true}>
                <TouchableOpacity style={s.cityPickerItem} onPress={() => setDistrictPickerSelected(new Set())} activeOpacity={0.7}>
                  <Text style={[s.cityPickerItemText, districtPickerSelected.size === 0 && s.cityPickerItemSelected]}>{t('filterAny')}</Text>
                  {districtPickerSelected.size === 0 && <Text style={s.cityPickerCheck}>✓</Text>}
                </TouchableOpacity>
                {filteredDistricts.map(d => (
                  <TouchableOpacity key={d} style={s.cityPickerItem} onPress={() => toggleDistrictPicker(d)} activeOpacity={0.7}>
                    <Text style={[s.cityPickerItemText, districtPickerSelected.has(d) && s.cityPickerItemSelected]} numberOfLines={1}>{d}</Text>
                    <Checkbox checked={districtPickerSelected.has(d)} style={{ marginLeft: 12 }} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity style={s.cityPickerSelectBtn} onPress={() => { setSelectedDistricts(new Set(districtPickerSelected)); setDistrictPickerVisible(false); }} activeOpacity={0.7}>
                <Text style={s.cityPickerSelectBtnText}>{t('filterSelect')}</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  backdropWeb: {
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  boxWrap: {
    width: '100%',
    maxWidth: 380,
    height: MODAL_HEIGHT,
  },
  box: {
    flex: 1,
    minHeight: 0,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: COLORS.boxBg,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  headerSpacer: { width: 36 },
  title: { flex: 1, fontSize: 20, fontWeight: '600', letterSpacing: -0.3, color: COLORS.title, textAlign: 'center' },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingTop: 16 },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 12, fontWeight: '600', color: COLORS.label,
    letterSpacing: 0.7, textTransform: 'uppercase',
    marginBottom: 8,
  },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  typeBtn: {
    flex: 1,
    height: 88,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  typeBtnLabel: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  rowLabel: { fontSize: 16, color: COLORS.title, flex: 1 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bedroomRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bedroomBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bedroomBoxSelected: {
    backgroundColor: COLORS.accentBg,
    borderColor: COLORS.accentBorder,
  },
  bedroomBoxText: { fontSize: 16, color: COLORS.title, fontWeight: '500' },
  bedroomBoxTextSelected: { color: COLORS.saveGreen, fontWeight: '600' },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pillSelected: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  pillText: { fontSize: 14, color: COLORS.title },
  pillTextSelected: { color: '#FFF', fontWeight: '600' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  priceInput: {
    flex: 1,
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.title,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  priceDash: { fontSize: 16, color: COLORS.muted },
  cityField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cityFieldText: { fontSize: 16, color: COLORS.title, flex: 1 },
  cityFieldPlaceholder: { color: '#999' },
  cityFieldChevron: { fontSize: 12, color: '#6B6B6B', marginLeft: 8 },
  cityPickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  cityPickerBox: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '80%',
    backgroundColor: COLORS.boxBg,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  cityPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  cityPickerTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: COLORS.title, textAlign: 'center' },
  citySearchInput: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: COLORS.title,
    backgroundColor: COLORS.inputBg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  cityPickerScroll: { maxHeight: CITY_LIST_MAX_HEIGHT },
  cityPickerScrollContent: { flexGrow: 0 },
  cityPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  cityPickerItemText: { fontSize: 16, color: COLORS.title, flex: 1 },
  cityPickerItemSelected: { fontWeight: '600', color: COLORS.saveGreen },
  cityPickerCheck: { fontSize: 16, fontWeight: '700', color: COLORS.saveGreen },
  cityPickerSelectBtn: {
    paddingVertical: 10,
    marginHorizontal: 20,
    marginVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.accent,
    backgroundColor: 'transparent',
  },
  cityPickerSelectBtnText: { fontSize: 16, fontWeight: '600', color: COLORS.saveGreen },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.07)',
  },
  clearBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  clearBtnText: { fontSize: 16, fontWeight: '600', color: '#6B6B6B' },
  applyBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.accent,
    backgroundColor: 'transparent',
  },
  applyBtnText: { fontSize: 16, fontWeight: '600', color: COLORS.accent },
});
