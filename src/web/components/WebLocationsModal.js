import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Animated, Modal, ActivityIndicator, Image, Platform,
} from 'react-native';
import { getLocations, createLocation, updateLocation, deleteLocation, getLocationDistricts, setLocationDistricts, updateDistrictName, removeDistrict } from '../../services/locationsService';
import { getPropertiesCountByLocation } from '../../services/propertiesService';
import { useLanguage } from '../../context/LanguageContext';

const ACCENT = '#3D7D82';
const C = {
  bg: '#F4F6F9', surface: '#FFFFFF', border: '#E9ECEF',
  text: '#212529', muted: '#6C757D', light: '#ADB5BD',
  accent: ACCENT, accentBg: '#EAF4F5',
  danger: '#E53935',
};

// Helper for country-state-city
function getCountryStateCity() {
  try {
    return require('country-state-city');
  } catch (e) {
    return null;
  }
}

function DropdownField({ label, value, placeholder, options, onSelect, searchPlaceholder }) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredOptions = (options || []).filter((item) => {
    const name = (typeof item === 'object' ? item.name : item) || '';
    return name.toLowerCase().includes((searchQuery || '').trim().toLowerCase());
  });

  return (
    <View style={[s.field, open && { zIndex: 1000 }]}>
      <Text style={s.label}>{label}</Text>
      <TouchableOpacity
        style={[s.inputTouch, open && { borderColor: ACCENT }]}
        onPress={() => setOpen(!open)}
        activeOpacity={0.8}
      >
        <Text style={[s.inputText, !value && s.inputPlaceholder]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Text style={s.chevron}>{open ? '▴' : '▾'}</Text>
      </TouchableOpacity>
      
      {open && (
        <View style={s.dropdown}>
          <TextInput
            style={s.dropdownSearch}
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
            autoCapitalize="none"
          />
          <ScrollView style={s.dropdownScroll} keyboardShouldPersistTaps="handled">
            {filteredOptions.length === 0 ? (
              <Text style={s.dropdownEmpty}>Ничего не найдено</Text>
            ) : (
              filteredOptions.map((item, idx) => {
                const name = typeof item === 'object' ? item.name : item;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={s.dropdownItem}
                    onPress={() => {
                      onSelect(item);
                      setOpen(false);
                      setSearchQuery('');
                    }}
                  >
                    <Text style={s.dropdownItemText}>{name}</Text>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

export default function WebLocationsModal({ visible, onClose, onSaved }) {
  const { t } = useLanguage();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingLoc, setEditingLoc] = useState(null);
  
  // Form state
  const [country, setCountry] = useState(null);
  const [region, setRegion] = useState(null);
  const [city, setCity] = useState(null);
  const [districts, setDistricts] = useState([]);
  const [newDistrict, setNewDistrict] = useState('');
  const [showAddDistrict, setShowAddDistrict] = useState(false);
  const [districtError, setDistrictError] = useState('');
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const slideAnim = useRef(new Animated.Value(540)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  const csc = getCountryStateCity();
  const countries = useMemo(() => csc ? csc.Country.getAllCountries() : [], [csc]);
  const regions = useMemo(() => (csc && country) ? csc.State.getStatesOfCountry(country.isoCode) : [], [csc, country]);
  const cities = useMemo(() => (csc && country && region) ? csc.City.getCitiesOfState(country.isoCode, region.isoCode) : [], [csc, country, region]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      loadLocations();
      resetForm();
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 540, duration: 220, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible]);

  const loadLocations = async () => {
    setLoading(true);
    try {
      const data = await getLocations();
      setLocations(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCountry(null);
    setRegion(null);
    setCity(null);
    setDistricts([]);
    setEditingLoc(null);
    setError('');
    setShowAddDistrict(false);
    setDistrictError('');
    setNewDistrict('');
  };

  const handleEdit = async (loc) => {
    setEditingLoc(loc);
    setError('');
    
    if (csc) {
      const allCountries = csc.Country.getAllCountries();
      const foundCountry = allCountries.find(c => c.name === loc.country);
      setCountry(foundCountry || { name: loc.country });
      
      if (foundCountry) {
        const allStates = csc.State.getStatesOfCountry(foundCountry.isoCode);
        const foundState = allStates.find(s => s.name === loc.region);
        setRegion(foundState || { name: loc.region });
        
        if (foundState) {
          const allCities = csc.City.getCitiesOfState(foundCountry.isoCode, foundState.isoCode);
          const foundCity = allCities.find(c => c.name === loc.city);
          setCity(foundCity || { name: loc.city });
        }
      }
    }
    
    try {
      const d = await getLocationDistricts(loc.id);
      setDistricts(d || []);
    } catch (e) {
      setDistricts([]);
    }
  };

  const handleSave = async () => {
    if (!country) { setError('Выберите страну'); return; }

    // Если юзер ввёл район в input, но не нажал «+» — добавляем сами перед сохранением.
    let finalDistricts = districts;
    const pending = newDistrict.trim();
    if (pending) {
      if (districts.some(d => String(d).toLowerCase() === pending.toLowerCase())) {
        setDistrictError(t('duplicateDistrictError'));
        setShowAddDistrict(true);
        return;
      }
      finalDistricts = [...districts, pending].sort();
      setDistricts(finalDistricts);
      setNewDistrict('');
      setShowAddDistrict(false);
      setDistrictError('');
    }

    setSaving(true);
    try {
      const payload = {
        country: country.name,
        region: region?.name || '',
        city: city?.name || '',
      };

      let locId;
      if (editingLoc) {
        await updateLocation(editingLoc.id, payload);
        locId = editingLoc.id;
      } else {
        const created = await createLocation(payload);
        locId = created.id;
      }

      if (locId) {
        await setLocationDistricts(locId, finalDistricts);
      }

      await loadLocations();
      resetForm();
      onSaved?.();
    } catch (e) {
      setError(e?.code === 'DUPLICATE_LOCATION' ? t('duplicateLocationError') : e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    // TD-067: блокируем если у локации есть привязанные объекты.
    let propsCount = 0;
    try { propsCount = await getPropertiesCountByLocation(id); } catch {}
    if (propsCount > 0) {
      alert(`${t('deleteLocationBlockedTitle')}\n\n${t('deleteLocationBlockedText').replace('{count}', String(propsCount))}`);
      return;
    }
    if (!confirm(`${t('deleteLocationConfirm')}\n\n${t('deleteLocationConfirmMessage')}`)) return;
    try {
      await deleteLocation(id);
      await loadLocations();
      onSaved?.();
    } catch (e) {
      alert(e.message);
    }
  };

  const addDistrict = () => {
    const val = newDistrict.trim();
    if (!val) return;
    if (districts.some(d => String(d).toLowerCase() === val.toLowerCase())) {
      setDistrictError(t('duplicateDistrictError'));
      return;
    }
    setDistrictError('');
    setDistricts(prev => [...prev, val].sort());
    setNewDistrict('');
    setShowAddDistrict(false);
  };

  const removeDistrictItem = (name) => {
    setDistricts(prev => prev.filter(d => d !== name));
  };

  if (!mounted) return null;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Animated.View style={[s.backdrop, { opacity: backdropAnim }]}>
          <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
        </Animated.View>

        <Animated.View style={[s.panel, { transform: [{ translateX: slideAnim }] }]}>
          <View style={s.panelHeader}>
            <Text style={s.panelTitle}>Управление локациями</Text>
            <TouchableOpacity style={s.closeBtn} onPress={onClose}>
              <Text style={s.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={s.formCard}>
              <Text style={s.formTitle}>{editingLoc ? 'Редактировать локацию' : 'Добавить новую локацию'}</Text>
              
              <DropdownField
                label="Страна"
                value={country?.name}
                placeholder="Выберите страну"
                options={countries}
                onSelect={(c) => { setCountry(c); setRegion(null); setCity(null); }}
                searchPlaceholder="Поиск страны..."
              />

              <DropdownField
                label="Регион / Остров"
                value={region?.name}
                placeholder="Выберите регион"
                options={regions}
                onSelect={(r) => { setRegion(r); setCity(null); }}
                searchPlaceholder="Поиск региона..."
              />

              <DropdownField
                label="Город"
                value={city?.name}
                placeholder="Выберите город"
                options={cities}
                onSelect={setCity}
                searchPlaceholder="Поиск города..."
              />

              <View style={s.districtsSection}>
                <Text style={s.label}>Районы</Text>
                <View style={s.districtsList}>
                  {districts.map(d => (
                    <View key={d} style={s.districtTag}>
                      <Text style={s.districtTagText}>{d}</Text>
                      <TouchableOpacity onPress={() => removeDistrictItem(d)}>
                        <Text style={s.districtTagClose}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
                
                {showAddDistrict ? (
                  <>
                    <View style={s.addDistrictRow}>
                      <TextInput
                        style={s.districtInput}
                        value={newDistrict}
                        onChangeText={(v) => { setNewDistrict(v); if (districtError) setDistrictError(''); }}
                        placeholder="Название района"
                        autoFocus
                        onSubmitEditing={addDistrict}
                      />
                      <TouchableOpacity style={s.districtAddConfirm} onPress={addDistrict}>
                        <Text style={s.districtAddConfirmText}>+</Text>
                      </TouchableOpacity>
                    </View>
                    {districtError ? <Text style={s.districtErrorText}>{districtError}</Text> : null}
                  </>
                ) : (
                  <TouchableOpacity style={s.addDistrictBtn} onPress={() => { setShowAddDistrict(true); setDistrictError(''); }}>
                    <Text style={s.addDistrictBtnText}>+ Добавить район</Text>
                  </TouchableOpacity>
                )}
              </View>

              {error ? <Text style={s.errorText}>{error}</Text> : null}

              <View style={s.formActions}>
                {editingLoc && (
                  <TouchableOpacity style={s.cancelBtn} onPress={resetForm}>
                    <Text style={s.cancelBtnText}>Отмена</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
                  {saving ? <ActivityIndicator size="small" color="#FFF" /> : (
                    <Text style={s.saveBtnText}>{editingLoc ? 'Сохранить' : 'Добавить'}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View style={s.listSection}>
              <Text style={s.listTitle}>Ваши локации</Text>
              {loading ? (
                <ActivityIndicator style={{ marginTop: 20 }} color={ACCENT} />
              ) : locations.length === 0 ? (
                <Text style={s.emptyText}>Список пуст</Text>
              ) : (
                locations.map(loc => (
                  <View key={loc.id} style={s.locationItem}>
                    <View style={s.locationInfo}>
                      <Text style={s.locationMain}>{loc.city || loc.region || loc.country}</Text>
                      <Text style={s.locationSub}>{[loc.country, loc.region, loc.city].filter(Boolean).join(' / ')}</Text>
                    </View>
                    <View style={s.itemActions}>
                      <TouchableOpacity style={s.iconBtn} onPress={() => handleEdit(loc)}>
                        <Text style={s.iconText}>✎</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.iconBtn} onPress={() => handleDelete(loc.id)}>
                        <Text style={[s.iconText, { color: C.danger }]}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', flexDirection: 'row' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  panel: { width: 440, backgroundColor: C.surface, shadowColor: '#000', shadowOffset: { width: -8, height: 0 }, shadowOpacity: 0.15, shadowRadius: 24, flexDirection: 'column' },
  panelHeader: { flexDirection: 'row', alignItems: 'center', padding: 24, borderBottomWidth: 1, borderBottomColor: C.border, justifyContent: 'space-between' },
  panelTitle: { fontSize: 20, fontWeight: '800', color: C.text },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 16, color: C.muted },
  content: { flex: 1, padding: 24 },
  formCard: { backgroundColor: C.bg, padding: 20, borderRadius: 16, marginBottom: 32 },
  formTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 16 },
  
  field: { marginBottom: 16, position: 'relative' },
  label: { fontSize: 12, fontWeight: '600', color: C.muted, marginBottom: 6 },
  inputTouch: { height: 42, backgroundColor: '#FFF', borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inputText: { fontSize: 14, color: C.text, flex: 1 },
  inputPlaceholder: { color: C.light },
  chevron: { fontSize: 12, color: C.muted },
  
  dropdown: { 
    position: 'absolute', 
    top: '100%', 
    left: 0, 
    right: 0, 
    marginTop: 4,
    backgroundColor: '#FFF', 
    borderRadius: 10, 
    borderWidth: 1, 
    borderColor: C.border, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 8, 
    elevation: 5, 
    maxHeight: 250, 
    zIndex: 1000 
  },
  dropdownSearch: { padding: 12, borderBottomWidth: 1, borderBottomColor: C.border, fontSize: 14, outlineWidth: 0 },
  dropdownScroll: { maxHeight: 200 },
  dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#F8F9FA' },
  dropdownItemText: { fontSize: 14, color: C.text },
  dropdownEmpty: { padding: 20, textAlign: 'center', color: C.light, fontSize: 13 },

  districtsSection: { marginTop: 8, marginBottom: 16 },
  districtsList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  districtTag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: ACCENT + '15', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  districtTagText: { fontSize: 13, fontWeight: '600', color: ACCENT },
  districtTagClose: { fontSize: 12, color: ACCENT, fontWeight: '700' },
  addDistrictBtn: { alignSelf: 'flex-start' },
  addDistrictBtnText: { fontSize: 13, fontWeight: '700', color: ACCENT },
  addDistrictRow: { flexDirection: 'row', gap: 8 },
  districtInput: { flex: 1, height: 36, backgroundColor: '#FFF', borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 10, fontSize: 13, outlineWidth: 0 },
  districtAddConfirm: { width: 36, height: 36, backgroundColor: ACCENT, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  districtAddConfirmText: { color: '#FFF', fontSize: 20, fontWeight: '600' },

  formActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  saveBtn: { flex: 1, height: 42, backgroundColor: ACCENT, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  cancelBtn: { flex: 1, height: 42, borderWidth: 1, borderColor: C.border, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { color: C.muted, fontWeight: '600', fontSize: 14 },
  errorText: { color: C.danger, fontSize: 14, fontWeight: '700', marginBottom: 12 },
  districtErrorText: { color: '#E53935', fontSize: 14, fontWeight: '700', marginTop: 6 },
  
  listSection: { flex: 1 },
  listTitle: { fontSize: 14, fontWeight: '800', color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },
  locationItem: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#FFF', borderWidth: 1, borderColor: C.border, borderRadius: 14, marginBottom: 12 },
  locationInfo: { flex: 1 },
  locationMain: { fontSize: 15, fontWeight: '700', color: C.text },
  locationSub: { fontSize: 12, color: C.muted, marginTop: 2 },
  itemActions: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 14, color: C.muted },
  emptyText: { textAlign: 'center', color: C.light, marginTop: 40, fontStyle: 'italic' },
});
