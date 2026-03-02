import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Pressable,
  Image,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useLanguage } from '../context/LanguageContext';

function getCountryStateCity() {
  try {
    return require('country-state-city');
  } catch (e) {
    return null;
  }
}

const COLORS = {
  boxBg: 'rgba(255,255,255,0.92)',
  title: '#2C2C2C',
  border: '#E0D8CC',
  fieldBg: 'rgba(245,242,235,0.8)',
  link: '#D81B60',
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
        <Text style={styles.fieldChevron}>▽</Text>
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
          <ScrollView style={styles.dropdownScroll} keyboardShouldPersistTaps="handled">
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
  const [country, setCountry] = useState(null);
  const [region, setRegion] = useState(null);
  const [city, setCity] = useState(null);

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
      if (editLocationData && csc) {
        const parsed = parseLocationString(editLocationData.displayName || '', csc);
        setCountry(parsed.country);
        setRegion(parsed.region);
        setCity(parsed.city);
      } else if (initialLocation && csc) {
        const parsed = parseLocationString(initialLocation, csc);
        setCountry(parsed.country);
        setRegion(parsed.region);
        setCity(parsed.city);
      } else {
        setCountry(null);
        setRegion(null);
        setCity(null);
      }
    }
  }, [visible, initialLocation, editLocationData, csc]);

  const handleSave = () => {
    if (!country?.name) return;
    onSave?.({
      country: country.name,
      region: region?.name || '',
      city: city?.name || '',
    });
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

  const handleDelete = () => {
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

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
      <Pressable style={styles.backdrop}>
        {Platform.OS === 'web' ? (
          <View style={[StyleSheet.absoluteFill, styles.backdropWeb]} />
        ) : (
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        )}
        <Pressable style={styles.boxWrap} onPress={(e) => e.stopPropagation()}>
          <View style={styles.box}>
            <View style={styles.headerRow}>
              {editIndex !== undefined && editIndex !== null ? (
                <TouchableOpacity onPress={handleDelete} style={styles.headerLeftBtn} activeOpacity={0.8}>
                  <Image source={require('../../assets/trash-icon.png')} style={styles.trashIconImage} resizeMode="contain" />
                </TouchableOpacity>
              ) : (
                <View style={styles.headerLeftBtn} />
              )}
              <Text style={styles.title}>{editIndex !== undefined && editIndex !== null ? t('editLocation') : t('addLocationsTitle')}</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.8}>
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
              <TouchableOpacity style={styles.saveLocationBtn} onPress={handleSave} activeOpacity={0.7}>
                <Text style={styles.saveLocationBtnText}>{t('saveLocation')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Pressable>
      </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardWrap: {
    flex: 1,
  },
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
    maxHeight: '90%',
  },
  box: {
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
    justifyContent: 'space-between',
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 20,
    color: '#E85D4C',
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.title,
  },
  headerLeftBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trashIconImage: {
    width: 22,
    height: 22,
  },
  content: {
    padding: 20,
  },
  saveLocationBtn: {
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(46, 125, 50, 0.5)',
    backgroundColor: 'rgba(46, 125, 50, 0.06)',
  },
  saveLocationBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
  },
  fieldWrap: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.title,
    marginBottom: 8,
  },
  fieldTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.fieldBg,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  fieldText: {
    fontSize: 16,
    color: COLORS.title,
    flex: 1,
  },
  fieldPlaceholder: {
    color: '#999',
  },
  fieldChevron: {
    fontSize: 12,
    color: '#6B6B6B',
    marginLeft: 8,
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
});
