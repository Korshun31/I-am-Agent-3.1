import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IconPencil } from './EditIcons';
import { getLocationDistricts, setLocationDistricts, updateDistrictName, removeDistrict } from '../services/locationsService';
import { getPropertiesCountByLocation } from '../services/propertiesService';
import { useLanguage } from '../context/LanguageContext';
import { useAppData } from '../context/AppDataContext';
import ModalScrollFrame from './ModalScrollFrame';

function getCountryStateCity() {
  try {
    return require('country-state-city');
  } catch (e) {
    return null;
  }
}

const COLORS = {
  title: '#2C2C2C',
  border: '#D1D1D6',
  fieldBg: '#F7F7F9',
  accent: '#3D7D82',
  label: '#6B6B6B',
  danger: '#C62828',
};

function LocationField({ label, value, placeholder, options, onSelect, searchPlaceholder }) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSelect = (item) => {
    onSelect(item);
    setOpen(false);
    setSearchQuery('');
  };

  const handleOpen = () => {
    setOpen(!open);
    if (open) setSearchQuery('');
  };

  const filteredOptions = (options || []).filter((item) => {
    const name = (typeof item === 'object' ? item.name : item) || '';
    return name.toLowerCase().includes((searchQuery || '').trim().toLowerCase());
  });

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity
        style={styles.fieldTouch}
        onPress={handleOpen}
        activeOpacity={0.8}
      >
        <Text style={[styles.fieldText, !value && styles.fieldPlaceholder]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color="#888" />
      </TouchableOpacity>
      {open && options && options.length > 0 && (
        <View style={styles.dropdown}>
          <TextInput
            style={styles.dropdownSearch}
            placeholder={searchPlaceholder}
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <ScrollView style={styles.dropdownScroll} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {filteredOptions.map((item, idx) => {
              const name = typeof item === 'object' ? item.name : item;
              const code = (typeof item === 'object' && item.isoCode) ? item.isoCode : `${item?.name || idx}-${idx}`;
              return (
                <TouchableOpacity
                  key={code}
                  style={styles.dropdownItem}
                  onPress={() => handleSelect(item)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.dropdownItemText} numberOfLines={1}>{name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function parseLocationString(str, csc) {
  if (!str || !csc) return { country: null, region: null, city: null };
  const parts = str.split(/\s*\/\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return { country: null, region: null, city: null };
  let country = null, region = null, city = null;
  try {
    const countries = csc.Country.getAllCountries();
    country = countries.find((c) => c.name === parts[0]) || null;
    if (country && parts.length >= 2) {
      const regions = csc.State.getStatesOfCountry(country.isoCode);
      region = regions.find((r) => r.name === parts[1]) || null;
      if (region && parts.length >= 3) {
        const cities = csc.City.getCitiesOfState(country.isoCode, region.isoCode);
        city = cities.find((c) => c.name === parts[2]) || null;
      }
    }
  } catch (e) {}
  return { country, region, city };
}

/**
 * Модальное окно добавления/редактирования локации. Страна → Регион → Город.
 */
export default function AddLocationsModal({ visible, onClose, onSave, onDelete, initialLocation, editIndex, editLocationData }) {
  const { t } = useLanguage();
  const { refreshProperties: refreshGlobalProperties } = useAppData();
  const [country, setCountry] = useState(null);
  const [region, setRegion] = useState(null);
  const [city, setCity] = useState(null);
  const [districts, setDistricts] = useState([]);
  const [showAddDistrictInput, setShowAddDistrictInput] = useState(false);
  const [newDistrictValue, setNewDistrictValue] = useState('');
  const [editingDistrict, setEditingDistrict] = useState(null);
  const [editDistrictValue, setEditDistrictValue] = useState('');

  const csc = getCountryStateCity();
  const countries = useMemo(() => {
    if (!csc) return [];
    try {
      return csc.Country.getAllCountries();
    } catch (e) {
      return [];
    }
  }, [csc]);

  const regions = useMemo(() => {
    if (!csc || !country?.isoCode) return [];
    try {
      return csc.State.getStatesOfCountry(country.isoCode);
    } catch (e) {
      return [];
    }
  }, [csc, country?.isoCode]);

  const cities = useMemo(() => {
    if (!csc || !country?.isoCode || !region?.isoCode) return [];
    try {
      return csc.City.getCitiesOfState(country.isoCode, region.isoCode);
    } catch (e) {
      return [];
    }
  }, [csc, country?.isoCode, region?.isoCode]);

  useEffect(() => {
    if (visible) {
      setShowAddDistrictInput(false);
      setNewDistrictValue('');
      setEditingDistrict(null);
      setEditDistrictValue('');
      if (editLocationData && csc) {
        const parsed = parseLocationString(editLocationData.displayName || '', csc);
        setCountry(parsed.country);
        setRegion(parsed.region);
        setCity(parsed.city);
        if (editLocationData.id) {
          getLocationDistricts(editLocationData.id).then((d) => setDistricts(d || []));
        } else {
          setDistricts([]);
        }
      } else if (initialLocation && csc) {
        const parsed = parseLocationString(initialLocation, csc);
        setCountry(parsed.country);
        setRegion(parsed.region);
        setCity(parsed.city);
        setDistricts([]);
      } else {
        setCountry(null);
        setRegion(null);
        setCity(null);
        setDistricts([]);
      }
    }
  }, [visible, initialLocation, editLocationData, csc]);

  const handleSave = () => {
    if (!country?.name) return;

    // Если юзер ввёл район в input, но не подтвердил — добавляем сами перед сохранением.
    let finalDistricts = districts;
    const pending = newDistrictValue.trim();
    if (pending) {
      if (districts.some(d => String(d).toLowerCase() === pending.toLowerCase())) {
        Alert.alert(t('error') || 'Error', t('duplicateDistrictError'));
        return;
      }
      finalDistricts = [...districts, pending].sort();
      setDistricts(finalDistricts);
    }

    setShowAddDistrictInput(false);
    setNewDistrictValue('');
    onSave?.({
      country: country.name,
      region: region?.name || '',
      city: city?.name || '',
      districts: [...finalDistricts],
    });
  };

  const handleAddDistrict = () => {
    const trimmed = newDistrictValue.trim();
    if (!trimmed) {
      setShowAddDistrictInput(false);
      setNewDistrictValue('');
      return;
    }
    if (districts.some(d => String(d).toLowerCase() === trimmed.toLowerCase())) {
      Alert.alert(t('error') || 'Error', t('duplicateDistrictError'));
      setNewDistrictValue('');
      return;
    }
    setDistricts((prev) => [...prev, trimmed].sort());
    setNewDistrictValue('');
    setShowAddDistrictInput(false);
  };

  const handleStartEditDistrict = (d) => {
    setEditingDistrict(d);
    setEditDistrictValue(d);
  };

  const handleConfirmEditDistrict = async () => {
    const trimmed = editDistrictValue.trim();
    if (!trimmed || !editingDistrict) {
      setEditingDistrict(null);
      setEditDistrictValue('');
      return;
    }
    if (trimmed === editingDistrict) {
      setEditingDistrict(null);
      setEditDistrictValue('');
      return;
    }
    if (districts.includes(trimmed) && trimmed !== editingDistrict) {
      setEditDistrictValue('');
      return;
    }
    const locationId = editLocationData?.id;
    if (locationId) {
      try {
        await updateDistrictName(locationId, editingDistrict, trimmed);
      } catch (e) {
        Alert.alert(t('error') || 'Error', e?.message || 'Failed to update district');
        return;
      }
      refreshGlobalProperties();
    }
    setDistricts((prev) => prev.map((x) => (x === editingDistrict ? trimmed : x)).sort());
    setEditingDistrict(null);
    setEditDistrictValue('');
  };

  const handleCancelEditDistrict = () => {
    setEditingDistrict(null);
    setEditDistrictValue('');
  };

  const handleDeleteDistrict = async (d) => {
    const msg = (t('deleteDistrictConfirm') || 'Delete district?') + '\n\n' + (t('deleteDistrictConfirmMessage') || 'Properties using this district will have their district cleared.');
    const doDelete = () => {
      const locationId = editLocationData?.id;
      if (locationId) {
        removeDistrict(locationId, d)
          .then(() => refreshGlobalProperties())
          .catch((e) => Alert.alert(t('error') || 'Error', e?.message));
      }
      setDistricts((prev) => prev.filter((x) => x !== d));
    };
    if (Platform.OS === 'web' || typeof Alert?.alert !== 'function') {
      if (typeof window !== 'undefined' && window.confirm?.(msg)) doDelete();
    } else {
      Alert.alert(
        t('deleteDistrictConfirm') || 'Delete district?',
        t('deleteDistrictConfirmMessage') || 'Properties using this district will have their district cleared.',
        [{ text: t('no'), style: 'cancel' }, { text: t('yes'), style: 'destructive', onPress: doDelete }]
      );
    }
  };


  const handleCountrySelect = (c) => {
    setCountry(c);
    setRegion(null);
    setCity(null);
  };

  const handleRegionSelect = (r) => {
    setRegion(r);
    setCity(null);
  };

  const handleDelete = async () => {
    // TD-067: блокируем удаление, если у локации есть привязанные объекты.
    const locationId = editLocationData?.id;
    let propsCount = 0;
    if (locationId) {
      try { propsCount = await getPropertiesCountByLocation(locationId); } catch {}
    }
    if (propsCount > 0) {
      const blockedMsg = t('deleteLocationBlockedText').replace('{count}', String(propsCount));
      if (Platform.OS === 'web' || typeof Alert?.alert !== 'function') {
        if (typeof window !== 'undefined') window.alert(`${t('deleteLocationBlockedTitle')}\n\n${blockedMsg}`);
      } else {
        Alert.alert(t('deleteLocationBlockedTitle'), blockedMsg, [{ text: 'OK', style: 'default' }]);
      }
      return;
    }
    const msg = t('deleteLocationConfirm') + '\n\n' + t('deleteLocationConfirmMessage');
    if (Platform.OS === 'web' || typeof Alert?.alert !== 'function') {
      if (typeof window !== 'undefined' && window.confirm?.(msg)) {
        onDelete?.();
      }
    } else {
      Alert.alert(
        t('deleteLocationConfirm'),
        t('deleteLocationConfirmMessage'),
        [
          { text: t('no'), style: 'cancel' },
          { text: t('yes'), style: 'destructive', onPress: () => { onDelete?.(); } },
        ]
      );
    }
  };

  if (!visible) return null;

  const header = (
    <View style={styles.headerRow}>
      {editIndex !== undefined && editIndex !== null ? (
        <TouchableOpacity onPress={handleDelete} style={styles.headerLeftBtn} activeOpacity={0.8}>
          <Ionicons name="trash-outline" size={22} color="#888" />
        </TouchableOpacity>
      ) : (
        <View style={styles.headerLeftBtn} />
      )}
      <Text style={styles.title}>{editIndex !== undefined && editIndex !== null ? t('editLocation') : t('addLocationsTitle')}</Text>
      <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.8}>
        <Ionicons name="close" size={22} color="#888" />
      </TouchableOpacity>
    </View>
  );

  const footer = (
    <TouchableOpacity style={styles.saveLocationBtn} onPress={handleSave} activeOpacity={0.7}>
      <Text style={styles.saveLocationBtnText}>{t('saveLocation')}</Text>
    </TouchableOpacity>
  );

  return (
    <ModalScrollFrame
      visible={visible}
      onRequestClose={onClose}
      header={header}
      footer={footer}
      boxWrapStyle={{ maxWidth: 380 }}
      boxStyle={{ backgroundColor: '#FFFFFF' }}
      scrollContentContainerStyle={styles.content}
      scrollProps={{
        showsVerticalScrollIndicator: false,
        keyboardShouldPersistTaps: 'handled',
        keyboardDismissMode: 'interactive',
        nestedScrollEnabled: true,
      }}
    >
              <LocationField
                label={t('addLocationsCountry')}
                value={country?.name}
                placeholder={t('addLocationsChooseCountry')}
                options={countries}
                onSelect={handleCountrySelect}
                searchPlaceholder={t('addLocationsSearch')}
              />
              <LocationField
                label={t('addLocationsRegion')}
                value={region?.name}
                placeholder={t('addLocationsChooseRegion')}
                options={regions}
                onSelect={handleRegionSelect}
                searchPlaceholder={t('addLocationsSearch')}
              />
              <LocationField
                label={t('addLocationsCity')}
                value={city?.name}
                placeholder={t('addLocationsChooseCity')}
                options={cities}
                onSelect={setCity}
                searchPlaceholder={t('addLocationsSearch')}
              />
              <View style={styles.districtsSection}>
                <Text style={styles.districtsLabel}>{t('locationsDistricts')}</Text>
                {districts.length > 0 && (
                  <View style={styles.districtsList}>
                    {districts.map((d) => (
                      <View key={d} style={styles.districtRow}>
                        {editingDistrict === d ? (
                          <>
                            <TextInput
                              style={styles.editDistrictInput}
                              value={editDistrictValue}
                              onChangeText={setEditDistrictValue}
                              placeholder={t('locationsNewDistrictPlaceholder')}
                              placeholderTextColor="#999"
                              autoFocus
                              onSubmitEditing={handleConfirmEditDistrict}
                            />
                            <TouchableOpacity style={styles.districtActionBtn} onPress={handleConfirmEditDistrict} activeOpacity={0.7}>
                              <Ionicons name="checkmark" size={22} color={COLORS.accent} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.districtActionBtn} onPress={handleCancelEditDistrict} activeOpacity={0.7}>
                              <Ionicons name="close" size={22} color="#888" />
                            </TouchableOpacity>
                          </>
                        ) : (
                          <>
                            <Text style={styles.districtItem} numberOfLines={1}>{d}</Text>
                            <TouchableOpacity style={styles.districtActionBtn} onPress={() => handleStartEditDistrict(d)} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                              <IconPencil size={20} color="#888" />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.districtActionBtn} onPress={() => handleDeleteDistrict(d)} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                              <Ionicons name="trash-outline" size={22} color="#888" />
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    ))}
                  </View>
                )}
                {showAddDistrictInput ? (
                  <View style={styles.addDistrictRow}>
                    <TextInput
                      style={styles.addDistrictInput}
                      value={newDistrictValue}
                      onChangeText={setNewDistrictValue}
                      placeholder={t('locationsNewDistrictPlaceholder')}
                      placeholderTextColor="#999"
                      autoFocus
                      onSubmitEditing={handleAddDistrict}
                    />
                    <TouchableOpacity style={styles.addDistrictBtn} onPress={handleAddDistrict} activeOpacity={0.7}>
                      <Ionicons name="add" size={22} color={COLORS.accent} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.addDistrictCancelBtn}
                      onPress={() => { setShowAddDistrictInput(false); setNewDistrictValue(''); }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="close" size={22} color="#888" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.addDistrictLinkWrap} onPress={() => setShowAddDistrictInput(true)} activeOpacity={0.7}>
                    <Text style={styles.addDistrictLink}>{t('locationsAddDistrict')}</Text>
                  </TouchableOpacity>
                )}
              </View>
    </ModalScrollFrame>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.07)',
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.title,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  headerLeftBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 20,
  },
  saveLocationBtn: {
    marginHorizontal: 20,
    marginBottom: 20,
    marginTop: 4,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(61,125,130,0.08)',
  },
  saveLocationBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.accent,
  },
  fieldWrap: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.label,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  fieldTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.fieldBg,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 46,
  },
  fieldText: {
    fontSize: 16,
    color: COLORS.title,
    flex: 1,
  },
  fieldPlaceholder: {
    color: '#888',
  },
  dropdownSearch: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: COLORS.title,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dropdown: {
    marginTop: 4,
    maxHeight: 200,
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  dropdownItemText: {
    fontSize: 16,
    color: COLORS.title,
  },
  districtsSection: {
    marginBottom: 16,
  },
  districtsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.label,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  districtsList: {
    marginBottom: 10,
  },
  districtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 8,
  },
  districtItem: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.title,
  },
  editDistrictInput: {
    flex: 1,
    backgroundColor: COLORS.fieldBg,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: COLORS.title,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  districtActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addDistrictLinkWrap: {
    marginTop: 4,
  },
  addDistrictLink: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.accent,
  },
  addDistrictRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  addDistrictInput: {
    flex: 1,
    backgroundColor: COLORS.fieldBg,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: COLORS.title,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 46,
    marginRight: 8,
  },
  addDistrictBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(61,125,130,0.08)',
    borderWidth: 1.5,
    borderColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addDistrictCancelBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});
