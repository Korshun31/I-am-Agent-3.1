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
import { useLanguage } from '../context/LanguageContext';

const AMENITY_KEYS = [
  'swimming_pool', 'gym', 'parking', 'internet', 'tv', 'washing_machine',
  'dishwasher', 'fridge', 'stove', 'oven', 'hood', 'microwave',
  'kettle', 'toaster', 'coffee_machine', 'multi_cooker', 'blender',
];

const TYPE_BLOCKS = [
  { key: 'resort', color: '#C8E6C9', borderColor: '#81C784', icon: require('../../assets/icon-property-resort.png') },
  { key: 'house', color: '#FFF9C4', borderColor: '#FFD54F', icon: require('../../assets/icon-property-house.png') },
  { key: 'condo', color: '#BBDEFB', borderColor: '#64B5F6', icon: require('../../assets/icon-property-condo.png') },
];

const COLORS = {
  boxBg: 'rgba(255,255,255,0.72)',
  title: '#2C2C2C',
  border: '#E0D8CC',
  muted: '#888',
  accent: '#5DB87A',
  saveGreen: '#2E7D32',
};

function CheckRow({ label, checked, onPress }) {
  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[s.checkbox, checked && s.checkboxChecked]}>
        {checked && <Text style={s.checkMark}>✓</Text>}
      </View>
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
                <Text style={s.closeIcon}>✕</Text>
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
                  <Text style={s.cityFieldChevron}>▽</Text>
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
                  <Text style={s.cityFieldChevron}>▽</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={s.section}>
              <Text style={s.sectionTitle}>{t('filterType')}</Text>
              <View style={s.typeRow}>
                {TYPE_BLOCKS.map((pt) => {
                  const isActive = selectedTypes.has(pt.key);
                  return (
                    <TouchableOpacity
                      key={pt.key}
                      style={[
                        s.typeBtn,
                        isActive ? { backgroundColor: pt.color, borderColor: pt.borderColor } : s.typeBtnInactive,
                        isActive && s.typeBtnActive,
                      ]}
                      onPress={() => toggleType(pt.key)}
                      activeOpacity={0.7}
                    >
                      <Image source={pt.icon} style={[s.typeBtnIcon, !isActive && s.typeBtnIconInactive]} resizeMode="contain" />
                      <Text style={[s.typeBtnLabel, isActive && s.typeBtnLabelActive]}>
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
                  <Text style={s.closeIcon}>✕</Text>
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
                  <Text style={s.closeIcon}>✕</Text>
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
                    <View style={[s.pickerCheckbox, districtPickerSelected.has(d) && s.pickerCheckboxChecked]}>
                      {districtPickerSelected.has(d) && <Text style={s.pickerCheckMark}>✓</Text>}
                    </View>
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
    maxWidth: 360,
    height: MODAL_HEIGHT,
  },
  box: {
    flex: 1,
    minHeight: 0,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: COLORS.boxBg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
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
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: COLORS.title, textAlign: 'center' },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  closeIcon: { fontSize: 20, color: '#E85D4C', fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingTop: 16 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: COLORS.title, marginBottom: 10 },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  typeBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
  },
  typeBtnInactive: {
    backgroundColor: '#EDEDEB',
    borderColor: '#D5D5D0',
  },
  typeBtnActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  typeBtnIcon: { width: 32, height: 32, marginBottom: 4 },
  typeBtnIconInactive: { opacity: 0.35 },
  typeBtnLabel: { fontSize: 12, fontWeight: '600', color: '#AAAAAA' },
  typeBtnLabelActive: { color: '#2C2C2C', fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxChecked: { borderColor: COLORS.saveGreen },
  checkMark: { color: COLORS.saveGreen, fontSize: 14, fontWeight: '700' },
  rowLabel: { fontSize: 15, color: COLORS.title, flex: 1 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bedroomRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bedroomBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: '#F5F2EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bedroomBoxSelected: {
    backgroundColor: 'rgba(46, 125, 50, 0.06)',
    borderColor: 'rgba(46, 125, 50, 0.5)',
  },
  bedroomBoxText: { fontSize: 16, color: COLORS.title, fontWeight: '500' },
  bedroomBoxTextSelected: { color: COLORS.saveGreen, fontWeight: '600' },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F0EDE8',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pillSelected: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  pillText: { fontSize: 14, color: COLORS.title },
  pillTextSelected: { color: '#FFF', fontWeight: '600' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  priceInput: {
    flex: 1,
    backgroundColor: '#F5F2EB',
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
    backgroundColor: '#F5F2EB',
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
    maxWidth: 340,
    maxHeight: '80%',
    backgroundColor: COLORS.boxBg,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  cityPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  cityPickerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: COLORS.title, textAlign: 'center' },
  citySearchInput: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: COLORS.title,
    backgroundColor: '#F5F2EB',
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
  pickerCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  pickerCheckboxChecked: { borderColor: COLORS.saveGreen },
  pickerCheckMark: { color: COLORS.saveGreen, fontSize: 14, fontWeight: '700' },
  cityPickerCheck: { fontSize: 16, fontWeight: '700', color: COLORS.saveGreen },
  cityPickerSelectBtn: {
    paddingVertical: 14,
    marginHorizontal: 20,
    marginVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(46, 125, 50, 0.5)',
    backgroundColor: 'rgba(46, 125, 50, 0.06)',
  },
  cityPickerSelectBtnText: { fontSize: 16, fontWeight: '600', color: COLORS.saveGreen },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  clearBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.2)',
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  clearBtnText: { fontSize: 16, fontWeight: '600', color: COLORS.title },
  applyBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(46, 125, 50, 0.5)',
    backgroundColor: 'rgba(46, 125, 50, 0.06)',
  },
  applyBtnText: { fontSize: 16, fontWeight: '600', color: COLORS.saveGreen },
});
