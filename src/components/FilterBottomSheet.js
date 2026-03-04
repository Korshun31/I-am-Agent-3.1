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
  Platform,
  Keyboard,
  Dimensions,
} from 'react-native';

const { height: SCREEN_H } = Dimensions.get('window');
const MODAL_HEIGHT = Math.min(SCREEN_H * 0.85, 620);
import { BlurView } from 'expo-blur';
import { useLanguage } from '../context/LanguageContext';

const AMENITY_KEYS = [
  'swimming_pool', 'gym', 'parking', 'internet', 'tv', 'washing_machine',
  'dishwasher', 'fridge', 'stove', 'oven', 'hood', 'microwave',
  'kettle', 'toaster', 'coffee_machine', 'multi_cooker', 'blender',
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
  const [bedrooms, setBedrooms] = useState(filter?.bedrooms ?? null);
  const [priceMin, setPriceMin] = useState(filter?.priceMin != null ? String(filter.priceMin) : '');
  const [priceMax, setPriceMax] = useState(filter?.priceMax != null ? String(filter.priceMax) : '');
  const [pets, setPets] = useState(filter?.pets ?? 'any');
  const [longTerm, setLongTerm] = useState(filter?.longTerm ?? null);
  const [selectedAmenities, setSelectedAmenities] = useState(new Set(filter?.amenities ?? []));

  useEffect(() => {
    if (visible) {
      setCity(filter?.city ?? null);
      setSelectedDistricts(new Set(filter?.districts ?? []));
      setSelectedTypes(new Set(filter?.types ?? []));
      setBedrooms(filter?.bedrooms ?? null);
      setPriceMin(filter?.priceMin != null ? String(filter.priceMin) : '');
      setPriceMax(filter?.priceMax != null ? String(filter.priceMax) : '');
      setPets(filter?.pets ?? 'any');
      setLongTerm(filter?.longTerm ?? null);
      setSelectedAmenities(new Set(filter?.amenities ?? []));
    }
  }, [visible, filter]);

  const toggleDistrict = (d) => {
    setSelectedDistricts(prev => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
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

  const handleClear = () => {
    setCity(null);
    setSelectedDistricts(new Set());
    setSelectedTypes(new Set());
    setBedrooms(null);
    setPriceMin('');
    setPriceMax('');
    setPets('any');
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
      bedrooms: bedrooms,
      priceMin: isNaN(priceMinNum) ? null : priceMinNum,
      priceMax: isNaN(priceMaxNum) ? null : priceMaxNum,
      pets: pets,
      longTerm: longTerm,
      amenities: [...selectedAmenities],
    });
    onClose?.();
  };

  if (!visible) return null;

  const typeLabels = { resort: t('filterTypeResort'), house: t('filterTypeHouse'), condo: t('filterTypeCondo') };

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
                <View style={s.pillRow}>
                  <Pill label={t('filterAny')} selected={!city} onPress={() => setCity(null)} />
                  {cities.map(c => (
                    <Pill key={c} label={c} selected={city === c} onPress={() => setCity(c)} />
                  ))}
                </View>
              </View>
            )}

            {districts.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>{t('propDistrict')}</Text>
                {districts.map(d => (
                  <CheckRow key={d} label={d} checked={selectedDistricts.has(d)} onPress={() => toggleDistrict(d)} />
                ))}
              </View>
            )}

            <View style={s.section}>
              <Text style={s.sectionTitle}>{t('filterType')}</Text>
              {(['resort', 'house', 'condo']).map(type => (
                <CheckRow key={type} label={typeLabels[type]} checked={selectedTypes.has(type)} onPress={() => toggleType(type)} />
              ))}
            </View>

            <View style={s.section}>
              <Text style={s.sectionTitle}>{t('filterBedrooms')}</Text>
              <View style={s.pillRow}>
                <Pill label="—" selected={bedrooms === null} onPress={() => setBedrooms(null)} />
                {[1, 2, 3, 4, 5].map(n => (
                  <Pill key={n} label={String(n)} selected={bedrooms === n} onPress={() => setBedrooms(n)} />
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
              <Text style={s.sectionTitle}>{t('filterPets')}</Text>
              <View style={s.pillRow}>
                <Pill label={t('filterAny')} selected={pets === 'any'} onPress={() => setPets('any')} />
                <Pill label={t('yes')} selected={pets === true} onPress={() => setPets(true)} />
                <Pill label="NO" selected={pets === false} onPress={() => setPets(false)} />
              </View>
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
  checkboxChecked: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  checkMark: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  rowLabel: { fontSize: 15, color: COLORS.title, flex: 1 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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
