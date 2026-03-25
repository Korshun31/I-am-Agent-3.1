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
  ActivityIndicator,
  InteractionManager,
  Pressable,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useLanguage } from '../context/LanguageContext';
import { getCurrentUser } from '../services/authService';
import { getPhotoLimitForProperty } from '../constants/roleFeatures';
import { getLocations, getLocationDistricts, setLocationDistricts } from '../services/locationsService';
import { getContacts, createContact } from '../services/contactsService';
import { getActiveTeamMembers } from '../services/companyService';
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
        blurOnSubmit={!multiline}
        multiline={multiline}
        onSubmitEditing={!multiline ? Keyboard.dismiss : undefined}
      />
    </View>
  );
}

function StepInfo({ data, setData, t, propertyType, locations, locationDistricts, onDistrictAdded, owners, onNewOwnerCreated, onOpenOwnerPicker, resortId, resortCode, parentResort, teamMembers, currentUser }) {
  const [cityOpen, setCityOpen] = useState(false);
  const [districtOpen, setDistrictOpen] = useState(false);
  const [ownerPickerVisible, setOwnerPickerVisible] = useState(false);
  const [owner2PickerVisible, setOwner2PickerVisible] = useState(false);
  const [ownerSearch, setOwnerSearch] = useState('');
  const [owner2Search, setOwner2Search] = useState('');
  const [addOwnerModal, setAddOwnerModal] = useState(false);
  const [addOwnerFor, setAddOwnerFor] = useState('owner');
  const [newDistrict, setNewDistrict] = useState('');
  const [responsiblePickerVisible, setResponsiblePickerVisible] = useState(false);
  const [tempResponsible, setTempResponsible] = useState(null);

  const closeAllPickers = (except) => {
    if (except !== 'city') setCityOpen(false);
    if (except !== 'district') setDistrictOpen(false);
  };

  const filteredOwners = (list, search) => {
    if (!search.trim()) return list || [];
    const q = search.trim().toLowerCase();
    return (list || []).filter(o => {
      const name = `${o.name || ''} ${o.lastName || ''}`.trim().toLowerCase();
      const phone = (o.phone || '').toLowerCase();
      return name.includes(q) || phone.includes(q);
    });
  };

  const handleSelectLocation = (loc) => {
    setData(d => ({ ...d, city: loc.city, location_id: loc.id, district: '' }));
    setCityOpen(false);
  };

  const uniqueDistricts = (locationDistricts || []).filter(Boolean).sort();

  const handleSelectDistrict = (district) => {
    setData(d => ({ ...d, district }));
    setDistrictOpen(false);
    setNewDistrict('');
  };

  const handleAddNewDistrict = async () => {
    const trimmed = newDistrict.trim();
    if (!trimmed) return;
    if (data.location_id && onDistrictAdded) {
      try {
        await onDistrictAdded(data.location_id, trimmed);
      } catch (e) {
        Alert.alert('Error', e.message || 'Error');
        return;
      }
    }
    setData(d => ({ ...d, district: trimmed }));
    setDistrictOpen(false);
    setNewDistrict('');
  };

  const handleSelectOwner = (owner) => {
    setData(d => ({ ...d, owner_id: owner.id, _ownerName: `${owner.name} ${owner.lastName}`.trim() }));
    setOwnerPickerVisible(false);
  };

  const handleClearOwner = () => {
    setData(d => ({ ...d, owner_id: null, _ownerName: '' }));
    setOwnerPickerVisible(false);
  };

  const handleSelectOwner2 = (owner) => {
    setData(d => ({ ...d, owner_id_2: owner.id, _owner2Name: `${owner.name} ${owner.lastName}`.trim() }));
    setOwner2PickerVisible(false);
  };

  const handleClearOwner2 = () => {
    setData(d => ({ ...d, owner_id_2: null, _owner2Name: '' }));
    setOwner2PickerVisible(false);
  };

  const handleNewOwnerSave = async (contactData) => {
    try {
      const newOwner = await createContact({ ...contactData, type: 'owners' });
      const name = `${newOwner.name} ${newOwner.lastName}`.trim();
      if (addOwnerFor === 'owner2') {
        setData(d => ({ ...d, owner_id_2: newOwner.id, _owner2Name: name }));
      } else {
        setData(d => ({ ...d, owner_id: newOwner.id, _ownerName: name }));
      }
      setAddOwnerModal(false);
      onNewOwnerCreated?.();
    } catch (e) {
      Alert.alert('Error', e.message || 'Error');
    }
  };

  const openOwnerPicker = () => {
    setOwnerSearch('');
    onOpenOwnerPicker?.();
    setOwnerPickerVisible(true);
  };

  const openOwner2Picker = () => {
    setOwner2Search('');
    onOpenOwnerPicker?.();
    setOwner2PickerVisible(true);
  };

  const ownerDisplay = data._ownerName || (owners || []).find(o => o.id === data.owner_id)?.name || '';
  const owner2Display = data._owner2Name || (owners || []).find(o => o.id === data.owner_id_2)?.name || '';
  const isHouseInResort = Boolean(resortId);
  const isAdmin = !!(currentUser?.companyId) && !currentUser?.teamMembership;
  const companyDisplayName = currentUser?.companyInfo?.name || t('workAsCompany');
  const getResponsibleDisplay = (agentId) => {
    if (!agentId || agentId === currentUser?.id) return companyDisplayName;
    const m = (teamMembers || []).find(tm => tm.agent_id === agentId);
    return m ? ([m.name, m.last_name].filter(Boolean).join(' ') || m.email) : companyDisplayName;
  };
  const responsibleDisplay = getResponsibleDisplay(data.responsible_agent_id);

  return (
    <>
      <Field label={t('propertyName')} value={data.name} onChangeText={v => setData(d => ({ ...d, name: v }))} />

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

      {/* District: read-only from resort for houses in resort, else picker */}
      <View style={s.fieldWrap}>
        <Text style={s.fieldLabel}>{t('propDistrict')}</Text>
        {isHouseInResort && parentResort ? (
          <View style={[s.pickerBtn, { opacity: 0.9 }]}>
            <Text style={s.pickerBtnText}>{parentResort.district || '—'}</Text>
          </View>
        ) : (
          <>
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
                {!data.location_id && (
                  <Text style={s.pickerEmpty}>{t('wizSelectCityFirst')}</Text>
                )}
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
                {data.location_id && (
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
                )}
              </View>
            )}
          </>
        )}
      </View>

      {isHouseInResort ? (
        <>
          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>{t('wizResortCode')}</Text>
            <Text style={[s.pickerBtnText, { paddingVertical: 10 }]}>{resortCode || data.code || '—'}</Text>
          </View>
          <Field
            label={t('wizInternalCodeSuffix')}
            value={data.code_suffix}
            onChangeText={v => setData(d => ({ ...d, code_suffix: v }))}
            placeholder="72-А"
          />
        </>
      ) : (
        <Field label={t('propertyCode')} value={data.code} onChangeText={v => setData(d => ({ ...d, code: v }))} />
      )}

      <Field label={t('pdLocation') + ' (Google Maps)'} value={data.google_maps_link} onChangeText={v => setData(d => ({ ...d, google_maps_link: v }))} placeholder="https://maps.google.com/..." />

      <Field label={t('pdAddress')} value={data.address} onChangeText={v => setData(d => ({ ...d, address: v }))} placeholder={t('pdAddressPlaceholder')} />

      {/* Owner picker */}
      <View style={s.fieldWrap}>
        <Text style={s.fieldLabel}>{t('wizOwner')}</Text>
        <TouchableOpacity
          style={s.pickerBtn}
          onPress={openOwnerPicker}
          activeOpacity={0.7}
        >
          <Text style={[s.pickerBtnText, !ownerDisplay && s.pickerBtnPlaceholder]}>
            {ownerDisplay || t('wizSelectOwner')}
          </Text>
          <Text style={s.pickerArrow}>▽</Text>
        </TouchableOpacity>
      </View>

      {isHouseInResort && (
        <View style={s.fieldWrap}>
          <Text style={s.fieldLabel}>{t('wizAdditionalOwner')}</Text>
          <TouchableOpacity
            style={s.pickerBtn}
            onPress={openOwner2Picker}
            activeOpacity={0.7}
          >
            <Text style={[s.pickerBtnText, !data.owner_id_2 && s.pickerBtnPlaceholder]}>
              {owner2Display || t('wizSelectOwner')}
            </Text>
            <Text style={s.pickerArrow}>▽</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Ответственный — только для Admin */}
      {isAdmin && (
        <View style={s.fieldWrap}>
          <Text style={s.fieldLabel}>{t('propResponsiblePicker')}</Text>
          <TouchableOpacity
            style={s.pickerBtn}
            onPress={() => { setTempResponsible(data.responsible_agent_id ?? null); setResponsiblePickerVisible(true); }}
            activeOpacity={0.7}
          >
            <Text style={s.pickerBtnText}>{responsibleDisplay}</Text>
            <Text style={s.pickerArrow}>▽</Text>
          </TouchableOpacity>
        </View>
      )}

      <AddContactModal
        visible={addOwnerModal}
        onClose={() => setAddOwnerModal(false)}
        onSave={handleNewOwnerSave}
        contactType="owners"
      />

      {ownerPickerVisible && (
        <Modal transparent animationType="fade" onRequestClose={() => setOwnerPickerVisible(false)} statusBarTranslucent>
          <Pressable style={s.ownerPickerBackdrop} onPress={() => setOwnerPickerVisible(false)}>
            {Platform.OS === 'web' ? (
              <View style={[StyleSheet.absoluteFill, s.backdropWeb]} />
            ) : (
              <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
            )}
            <Pressable style={s.ownerPickerBox} onPress={(e) => e.stopPropagation()}>
              <View style={s.ownerPickerHeader}>
                <Text style={s.ownerPickerTitle}>{t('wizOwner')}</Text>
                <TouchableOpacity onPress={() => setOwnerPickerVisible(false)} style={s.ownerPickerClose} activeOpacity={0.8}>
                  <Text style={s.ownerPickerCloseIcon}>✕</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={s.ownerPickerAddRow} onPress={() => { setOwnerPickerVisible(false); setAddOwnerFor('owner'); setAddOwnerModal(true); }} activeOpacity={0.7}>
                <Text style={s.ownerPickerAddText}>+ {t('wizNewOwner')}</Text>
              </TouchableOpacity>
              <TextInput
                style={s.ownerPickerSearch}
                placeholder={t('search')}
                placeholderTextColor="#999"
                value={ownerSearch}
                onChangeText={setOwnerSearch}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <ScrollView style={s.ownerPickerScroll} contentContainerStyle={s.ownerPickerScrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
                {data.owner_id && (
                  <TouchableOpacity style={s.pickerItemClear} onPress={handleClearOwner} activeOpacity={0.7}>
                    <Text style={s.pickerItemClearText}>✕  {t('wizClearOwner')}</Text>
                  </TouchableOpacity>
                )}
                {filteredOwners(owners, ownerSearch).map((owner) => {
                  const isSelected = data.owner_id === owner.id;
                  return (
                    <TouchableOpacity key={owner.id} style={s.ownerPickerItem} onPress={() => handleSelectOwner(owner)} activeOpacity={0.7}>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.ownerPickerItemText, isSelected && s.ownerPickerItemSelected]} numberOfLines={1}>
                          {`${owner.name} ${owner.lastName}`.trim() || owner.phone || '—'}
                        </Text>
                        {owner.phone ? <Text style={s.ownerPickerItemSub} numberOfLines={1}>{owner.phone}</Text> : null}
                      </View>
                      {isSelected && <Text style={s.ownerPickerCheck}>✓</Text>}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {owner2PickerVisible && (
        <Modal transparent animationType="fade" onRequestClose={() => setOwner2PickerVisible(false)} statusBarTranslucent>
          <Pressable style={s.ownerPickerBackdrop} onPress={() => setOwner2PickerVisible(false)}>
            {Platform.OS === 'web' ? (
              <View style={[StyleSheet.absoluteFill, s.backdropWeb]} />
            ) : (
              <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
            )}
            <Pressable style={s.ownerPickerBox} onPress={(e) => e.stopPropagation()}>
              <View style={s.ownerPickerHeader}>
                <Text style={s.ownerPickerTitle}>{t('wizAdditionalOwner')}</Text>
                <TouchableOpacity onPress={() => setOwner2PickerVisible(false)} style={s.ownerPickerClose} activeOpacity={0.8}>
                  <Text style={s.ownerPickerCloseIcon}>✕</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={s.ownerPickerAddRow} onPress={() => { setOwner2PickerVisible(false); setAddOwnerFor('owner2'); setAddOwnerModal(true); }} activeOpacity={0.7}>
                <Text style={s.ownerPickerAddText}>+ {t('wizNewOwner')}</Text>
              </TouchableOpacity>
              <TextInput
                style={s.ownerPickerSearch}
                placeholder={t('search')}
                placeholderTextColor="#999"
                value={owner2Search}
                onChangeText={setOwner2Search}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <ScrollView style={s.ownerPickerScroll} contentContainerStyle={s.ownerPickerScrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
                {data.owner_id_2 && (
                  <TouchableOpacity style={s.pickerItemClear} onPress={handleClearOwner2} activeOpacity={0.7}>
                    <Text style={s.pickerItemClearText}>✕  {t('wizClearOwner')}</Text>
                  </TouchableOpacity>
                )}
                {filteredOwners(owners, owner2Search).map((owner) => {
                  const isSelected = data.owner_id_2 === owner.id;
                  return (
                    <TouchableOpacity key={owner.id} style={s.ownerPickerItem} onPress={() => handleSelectOwner2(owner)} activeOpacity={0.7}>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.ownerPickerItemText, isSelected && s.ownerPickerItemSelected]} numberOfLines={1}>
                          {`${owner.name} ${owner.lastName}`.trim() || owner.phone || '—'}
                        </Text>
                        {owner.phone ? <Text style={s.ownerPickerItemSub} numberOfLines={1}>{owner.phone}</Text> : null}
                      </View>
                      {isSelected && <Text style={s.ownerPickerCheck}>✓</Text>}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* Пикер Ответственного */}
      {responsiblePickerVisible && (
        <Modal transparent animationType="fade" onRequestClose={() => setResponsiblePickerVisible(false)} statusBarTranslucent>
          <Pressable style={s.ownerPickerBackdrop} onPress={() => setResponsiblePickerVisible(false)}>
            {Platform.OS === 'web' ? (
              <View style={[StyleSheet.absoluteFill, s.backdropWeb]} />
            ) : (
              <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
            )}
            <Pressable style={s.ownerPickerBox} onPress={(e) => e.stopPropagation()}>
              <View style={s.ownerPickerHeader}>
                <Text style={s.ownerPickerTitle}>{t('propResponsiblePicker')}</Text>
                <TouchableOpacity onPress={() => setResponsiblePickerVisible(false)} style={s.ownerPickerClose} activeOpacity={0.8}>
                  <Text style={s.ownerPickerCloseIcon}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={s.ownerPickerScroll} contentContainerStyle={s.ownerPickerScrollContent} showsVerticalScrollIndicator>
                {/* Компания (без агента) */}
                {[{ agent_id: null, name: companyDisplayName, is_company: true },
                  ...(teamMembers || []).filter(m => m.role !== 'owner')
                ].map((item) => {
                  const isSelected = item.is_company
                    ? (!tempResponsible || tempResponsible === currentUser?.id)
                    : tempResponsible === item.agent_id;
                  const displayName = item.is_company
                    ? companyDisplayName
                    : ([item.name, item.last_name].filter(Boolean).join(' ') || item.email || '—');
                  return (
                    <TouchableOpacity
                      key={item.agent_id ?? 'company'}
                      style={[s.ownerPickerItem, isSelected && s.responsibleItemActive]}
                      onPress={() => setTempResponsible(item.is_company ? null : item.agent_id)}
                      activeOpacity={0.7}
                    >
                      <View style={s.responsibleCheckbox}>
                        {isSelected && <View style={s.responsibleCheckboxInner} />}
                      </View>
                      <Text style={[s.ownerPickerItemText, isSelected && s.ownerPickerItemSelected]} numberOfLines={1}>
                        {displayName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <TouchableOpacity
                style={s.responsibleSaveBtn}
                onPress={() => {
                  setData(d => ({ ...d, responsible_agent_id: tempResponsible }));
                  setResponsiblePickerVisible(false);
                }}
                activeOpacity={0.8}
              >
                <Text style={s.responsibleSaveBtnText}>{t('save')}</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </>
  );
}

function StepCharacteristics({ data, setData, t, propertyType, resortId, parentResort }) {
  const isHouseInResort = Boolean(resortId);
  const isApartment = isHouseInResort && parentResort?.type === 'condo';

  return (
    <>
      {propertyType === 'house' && (
        <>
          <Field label={t('propBedrooms')} value={data.bedrooms} onChangeText={v => setData(d => ({ ...d, bedrooms: v }))} keyboardType="numeric" />
          <Field label={t('pdBathrooms')} value={data.bathrooms} onChangeText={v => setData(d => ({ ...d, bathrooms: v }))} keyboardType="numeric" />
          <Field label={t('pdArea') + ' (m\u00B2)'} value={data.area} onChangeText={v => setData(d => ({ ...d, area: v }))} keyboardType="numeric" />
          {isApartment && (
            <Field label={t('propFloorNumber') || 'Этаж'} value={data.floor_number} onChangeText={v => setData(d => ({ ...d, floor_number: v }))} keyboardType="numeric" />
          )}
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

function StepComments({ data, setData, t, property }) {
  const showWebsite = property && (
    property.type === 'house' ||
    (property.type === 'condo' && property.resort_id)
  );
  return (
    <>
      {showWebsite && (
        <Field
          label={t('propertyWebsiteUrl')}
          value={data.website_url || ''}
          onChangeText={v => setData(d => ({ ...d, website_url: v }))}
          placeholder="https://..."
          keyboardType="url"
        />
      )}
      <Field label={t('pdComments')} value={data.comments} onChangeText={v => setData(d => ({ ...d, comments: v }))} multiline placeholder={t('wizCommPlaceholder')} />
    </>
  );
}

const MAX_PHOTO_SIDE = 1600;
const PHOTO_QUALITY = 0.85;

async function resizePhotoIfNeeded(uri, width, height) {
  const maxSide = Math.max(width || 0, height || 0);
  if (maxSide <= MAX_PHOTO_SIDE) return uri;
  const actions = width >= (height || 1)
    ? [{ resize: { width: MAX_PHOTO_SIDE } }]
    : [{ resize: { height: MAX_PHOTO_SIDE } }];
  const { uri: resized } = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: PHOTO_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return resized;
}

function StepMedia({ data, setData, t, maxPhotos }) {
  const limit = maxPhotos ?? 10;
  const photos = Array.isArray(data.photos) ? data.photos : [];
  const videos = Array.isArray(data.videos) ? data.videos : [];
  const [videoUrl, setVideoUrl] = useState('');
  const [processing, setProcessing] = useState(false);

  const pickPhoto = async () => {
    const remain = limit - photos.length;
    if (remain <= 0) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsMultipleSelection: true,
      selectionLimit: remain,
    });
    if (!result.canceled && result.assets?.length > 0) {
      setProcessing(true);
      try {
        const uris = [];
        const toProcess = result.assets.slice(0, remain);
        for (const a of toProcess) {
          const uri = await resizePhotoIfNeeded(a.uri, a.width, a.height);
          uris.push(uri);
        }
        setData(d => ({ ...d, photos: [...(d.photos || []), ...uris].slice(0, limit) }));
      } finally {
        setProcessing(false);
      }
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
      <View style={s.mediaSectionTitleRow}>
        <Image source={require('../../assets/icon-photo.png')} style={s.mediaSectionTitleIcon} resizeMode="contain" />
        <Text style={s.mediaSectionTitle}>{t('pdPhoto')}</Text>
      </View>
      <View style={s.mediaGrid}>
        {photos.map((uri, i) => (
          <View key={i} style={s.mediaThumbWrap}>
            <Image source={{ uri }} style={s.mediaThumb} resizeMode="cover" />
            <TouchableOpacity style={s.mediaRemoveBtn} onPress={() => removePhoto(i)} activeOpacity={0.7}>
              <Text style={s.mediaRemoveText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
        {photos.length < limit && (
        <TouchableOpacity style={s.mediaAddBtn} onPress={pickPhoto} activeOpacity={0.7} disabled={processing}>
          {processing ? (
            <ActivityIndicator size="small" color={COLORS.green} />
          ) : (
            <>
              <Text style={s.mediaAddIcon}>+</Text>
              <Text style={s.mediaAddLabel}>{t('wizAddPhoto')}</Text>
            </>
          )}
        </TouchableOpacity>
        )}
      </View>
      {photos.length >= limit && (
        <Text style={s.mediaLimitNote}>{t('wizPhotoLimit').replace('{count}', limit)}</Text>
      )}

      <View style={[s.mediaSectionTitleRow, { marginTop: 20 }]}>
        <Image source={require('../../assets/icon-video.png')} style={s.mediaSectionTitleIcon} resizeMode="contain" />
        <Text style={s.mediaSectionTitle}>{t('pdVideo')}</Text>
      </View>
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
          <Field label={`${t('pdInternetSpeed')} (${t('pdInternetSpeedUnit')})`} value={data.internet_speed} onChangeText={v => setData(d => ({ ...d, internet_speed: v }))} placeholder="300" keyboardType="numeric" />
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

function PriceFieldWithFrom({ label, value, onChangeText, isFrom, dataKey, setData, t }) {
  return (
    <View style={s.fieldWrap}>
      <View style={s.priceFromLabelRow}>
        <Text style={s.fieldLabel}>{label}</Text>
        <View style={s.priceFromToggleWrap}>
          <Text style={s.priceFromLabel}>{t('priceFrom')}</Text>
          <TouchableOpacity
            style={[s.toggleTrackSmall, isFrom && s.toggleTrackOn]}
            onPress={() => setData(d => ({ ...d, [dataKey]: !d[dataKey] }))}
            activeOpacity={0.7}
          >
            <View style={[s.toggleThumbSmall, isFrom && s.toggleThumbOn]} />
          </TouchableOpacity>
        </View>
      </View>
      <TextInput
        style={s.input}
        value={value}
        onChangeText={onChangeText}
        placeholder=""
        placeholderTextColor="#999"
        keyboardType="numeric"
        returnKeyType="done"
        blurOnSubmit
        onSubmitEditing={Keyboard.dismiss}
      />
    </View>
  );
}

function StepPricing({ data, setData, t, sym }) {
  const WATER_TYPES = [
    { key: 'cubic', label: t('pdPerCubic') },
    { key: 'person', label: t('pdPerPerson') },
    { key: 'fixed', label: t('pdFixed') },
  ];
  const lbl = (key) => `${t(key)} ${sym}`;
  return (
    <>
      <PriceFieldWithFrom label={lbl('pdPriceMonthly')} value={data.price_monthly} onChangeText={v => setData(d => ({ ...d, price_monthly: v }))} isFrom={!!data.price_monthly_is_from} dataKey="price_monthly_is_from" setData={setData} t={t} />
      <PriceFieldWithFrom label={lbl('pdBookingDeposit')} value={data.booking_deposit} onChangeText={v => setData(d => ({ ...d, booking_deposit: v }))} isFrom={!!data.booking_deposit_is_from} dataKey="booking_deposit_is_from" setData={setData} t={t} />
      <PriceFieldWithFrom label={lbl('pdSaveDeposit')} value={data.save_deposit} onChangeText={v => setData(d => ({ ...d, save_deposit: v }))} isFrom={!!data.save_deposit_is_from} dataKey="save_deposit_is_from" setData={setData} t={t} />
      <PriceFieldWithFrom label={lbl('pdCommission')} value={data.commission} onChangeText={v => setData(d => ({ ...d, commission: v }))} isFrom={!!data.commission_is_from} dataKey="commission_is_from" setData={setData} t={t} />
      <Field label={lbl('pdElectricity')} value={data.electricity_price} onChangeText={v => setData(d => ({ ...d, electricity_price: v }))} keyboardType="numeric" />
      <View style={s.fieldWrap}>
        <Text style={s.fieldLabel}>{lbl('pdWater')}</Text>
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
      <Field label={lbl('pdGas')} value={data.gas_price} onChangeText={v => setData(d => ({ ...d, gas_price: v }))} keyboardType="numeric" />
      <Field label={lbl('pdInternetMonth')} value={data.internet_price} onChangeText={v => setData(d => ({ ...d, internet_price: v }))} keyboardType="numeric" />
      <Field label={lbl('pdCleaning')} value={data.cleaning_price} onChangeText={v => setData(d => ({ ...d, cleaning_price: v }))} keyboardType="numeric" />
      <Field label={lbl('pdExitCleaning')} value={data.exit_cleaning_price} onChangeText={v => setData(d => ({ ...d, exit_cleaning_price: v }))} keyboardType="numeric" />
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
    base.push({ key: 'additional', titleKey: 'wizStepAdditional' });
  }
  if (type === 'house') {
    base.push({ key: 'pricing', titleKey: 'wizStepPricing' });
  }
  base.push({ key: 'comments', titleKey: 'wizStepComments' });
  return base;
}

function toStr(val) {
  return val != null ? String(val) : '';
}

function buildInitialData(p, parentResort) {
  const isHouseInResort = Boolean(p.resort_id);
  const district = isHouseInResort && parentResort ? (parentResort.district || '') : (p.district || '');
  const googleMapsLink = p.google_maps_link || (parentResort?.google_maps_link || '');
  const address = p.address || (parentResort?.address || '');
  return {
    name: p.name || '',
    code: p.code || '',
    code_suffix: p.code_suffix || '',
    city: p.city || '',
    location_id: p.location_id || null,
    owner_id: p.owner_id || null,
    owner_id_2: p.owner_id_2 || null,
    _ownerName: '',
    _owner2Name: '',
    responsible_agent_id: p.responsible_agent_id ?? null,
    district,
    google_maps_link: googleMapsLink,
    address,
    bedrooms: toStr(p.bedrooms),
    bathrooms: toStr(p.bathrooms),
    area: toStr(p.area),
    houses_count: toStr(p.houses_count),
    floors: toStr(p.floors),
    floor_number: toStr(p.floor_number),
    beach_distance: toStr(p.beach_distance ?? (isHouseInResort ? parentResort?.beach_distance : null)),
    market_distance: toStr(p.market_distance ?? (isHouseInResort ? parentResort?.market_distance : null)),
    description: p.description || '',
    comments: p.comments || '',
    website_url: p.website_url || '',
    photos: Array.isArray(p.photos) ? p.photos : [],
    videos: Array.isArray(p.videos) ? p.videos : [],
    amenities: p.amenities || {},
    air_conditioners: toStr(p.air_conditioners),
    internet_speed: p.internet_speed || '',
    pets_allowed: !!p.pets_allowed,
    long_term_booking: !!p.long_term_booking,
    price_monthly: toStr(p.price_monthly),
    price_monthly_is_from: !!p.price_monthly_is_from,
    booking_deposit: toStr(p.booking_deposit),
    booking_deposit_is_from: !!p.booking_deposit_is_from,
    save_deposit: toStr(p.save_deposit),
    save_deposit_is_from: !!p.save_deposit_is_from,
    commission: toStr(p.commission),
    commission_is_from: !!p.commission_is_from,
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

function buildUpdates(data, property, parentResort, maxPhotos = 10, currency = 'THB') {
  const isHouseInResort = Boolean(property?.resort_id);
  const district = isHouseInResort && parentResort ? (parentResort.district || '').trim() : (data.district || '').trim();
  return {
    name: data.name.trim(),
    code: data.code.trim(),
    code_suffix: (data.code_suffix || '').trim(),
    city: data.city.trim(),
    location_id: data.location_id || null,
    owner_id: data.owner_id || null,
    owner_id_2: data.owner_id_2 || null,
    responsible_agent_id: data.responsible_agent_id ?? null,
    district,
    google_maps_link: data.google_maps_link.trim(),
    address: data.address.trim(),
    bedrooms: toNum(data.bedrooms),
    bathrooms: toNum(data.bathrooms),
    area: toNum(data.area),
    houses_count: toNum(data.houses_count),
    floors: toNum(data.floors),
    floor_number: toNum(data.floor_number),
    beach_distance: toNum(data.beach_distance),
    market_distance: toNum(data.market_distance),
    description: data.description.trim(),
    comments: data.comments.trim(),
    website_url: (data.website_url || '').trim(),
    photos: (data.photos || []).slice(0, maxPhotos),
    videos: data.videos || [],
    amenities: data.amenities,
    air_conditioners: toNum(data.air_conditioners),
    internet_speed: data.internet_speed.trim(),
    pets_allowed: data.pets_allowed,
    long_term_booking: data.long_term_booking,
    price_monthly: toNum(data.price_monthly),
    price_monthly_is_from: !!data.price_monthly_is_from,
    booking_deposit: toNum(data.booking_deposit),
    booking_deposit_is_from: !!data.booking_deposit_is_from,
    save_deposit: toNum(data.save_deposit),
    save_deposit_is_from: !!data.save_deposit_is_from,
    commission: toNum(data.commission),
    commission_is_from: !!data.commission_is_from,
    electricity_price: toNum(data.electricity_price),
    water_price: toNum(data.water_price),
    water_price_type: data.water_price_type,
    gas_price: toNum(data.gas_price),
    internet_price: toNum(data.internet_price),
    cleaning_price: toNum(data.cleaning_price),
    exit_cleaning_price: toNum(data.exit_cleaning_price),
    currency,
  };
}

export default function PropertyEditWizard({ visible, property, onClose, onSave, parentResort, mode = 'edit', initialType = 'house' }) {
  const { t, currency, currencySymbol: sym } = useLanguage();
  const [step, setStep] = useState(0);
  const [data, setData] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [locations, setLocations] = useState([]);
  const [locationDistricts, setLocationDistrictsState] = useState([]);
  const [owners, setOwners] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [maxPhotos, setMaxPhotos] = useState(10);
  const scrollRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const loadOwners = () => getContacts('owners').then(setOwners).catch(() => {});

  useEffect(() => {
    if (!visible) return;
    setStep(0);
    const shouldInit = mode === 'create' || property;
    if (shouldInit) {
      const src = mode === 'create' ? { type: initialType } : property;
      const resort = mode === 'create' ? null : parentResort;
      setData(buildInitialData(src, resort));
      getLocations().then(setLocations).catch(() => {});
      loadOwners();
      getCurrentUser().then(u => {
        setCurrentUser(u);
        setMaxPhotos(getPhotoLimitForProperty(u?.role || 'standard'));
        if (u?.companyId) {
          getActiveTeamMembers(u.companyId).then(setTeamMembers).catch(() => setTeamMembers([]));
        }
      }).catch(() => setMaxPhotos(10));
    }
  }, [visible, property, parentResort, mode, initialType]);

  useEffect(() => {
    if (visible && data.location_id) {
      getLocationDistricts(data.location_id).then(setLocationDistrictsState).catch(() => setLocationDistrictsState([]));
    } else {
      setLocationDistrictsState([]);
    }
  }, [visible, data.location_id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [step]);

  if (!visible) return null;
  if (mode === 'edit' && !property) return null;

  const propertyType = mode === 'create' ? initialType : property.type;
  const steps = getStepsForType(propertyType);
  const safeStep = Math.min(step, steps.length - 1);
  const currentStep = steps[safeStep];
  const isLast = safeStep === steps.length - 1;
  const isFirst = safeStep === 0;

  const animateTransition = (direction, callback) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      callback();
      Animated.timing(fadeAnim, { toValue: 1, duration: 120, useNativeDriver: true }).start();
    });
  };

  const runAfterKeyboardDismiss = (fn) => {
    Keyboard.dismiss();
    InteractionManager.runAfterInteractions(() => {
      fn();
    });
  };

  const goNext = () => {
    runAfterKeyboardDismiss(() => {
      if (isLast) {
        handleSave();
      } else {
        animateTransition('next', () => setStep(s => s + 1));
      }
    });
  };

  const goBack = () => {
    runAfterKeyboardDismiss(() => {
      if (isFirst) return;
      animateTransition('back', () => setStep(s => s - 1));
    });
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

      const propRef = mode === 'create' ? { type: propertyType } : property;
      const resortRef = mode === 'create' ? null : parentResort;
      const updates = buildUpdates(data, propRef, resortRef, maxPhotos, currency);
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
      case 'info': return (
        <StepInfo
          data={data}
          setData={setData}
          t={t}
          propertyType={propertyType}
          locations={locations}
          locationDistricts={locationDistricts}
          onDistrictAdded={async (locationId, district) => {
            const current = await getLocationDistricts(locationId);
            await setLocationDistricts(locationId, [...current, district]);
            setLocationDistrictsState((prev) => [...new Set([...prev, district])].sort());
          }}
          owners={owners}
          onNewOwnerCreated={loadOwners}
          onOpenOwnerPicker={loadOwners}
          resortId={property?.resort_id}
          resortCode={property?.code}
          parentResort={parentResort}
          teamMembers={teamMembers}
          currentUser={currentUser}
        />
      );
      case 'chars': return <StepCharacteristics data={data} setData={setData} t={t} propertyType={propertyType} resortId={property?.resort_id} parentResort={parentResort} />;
      case 'desc': return <StepDescription data={data} setData={setData} t={t} />;
      case 'media': return <StepMedia data={data} setData={setData} t={t} maxPhotos={maxPhotos} />;
      case 'amenities': return <StepAmenities data={data} setData={setData} t={t} />;
      case 'additional': return <StepAdditional data={data} setData={setData} t={t} propertyType={propertyType} />;
      case 'pricing': return <StepPricing data={data} setData={setData} t={t} sym={sym} />;
      case 'comments': return <StepComments data={data} setData={setData} t={t} property={property} />;
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
                  <Text style={s.stepCounter}>{safeStep + 1} / {steps.length}</Text>
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
                    onPress={() => runAfterKeyboardDismiss(handleSave)}
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

  priceFromLabelRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6,
  },
  priceFromToggleWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  priceFromLabel: { fontSize: 12, color: '#6B6B6B' },
  toggleTrackSmall: {
    width: 36, height: 20, borderRadius: 10,
    backgroundColor: '#D5D5D0', justifyContent: 'center', paddingHorizontal: 2,
  },
  toggleThumbSmall: {
    width: 16, height: 16, borderRadius: 8, backgroundColor: '#FFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2,
  },

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

  ownerPickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  ownerPickerBox: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    backgroundColor: COLORS.bg,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  ownerPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  ownerPickerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: COLORS.title },
  ownerPickerClose: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  ownerPickerCloseIcon: { fontSize: 20, color: '#E85D4C', fontWeight: '600' },
  ownerPickerAddRow: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  ownerPickerAddText: { fontSize: 16, color: COLORS.green, fontWeight: '600' },
  ownerPickerSearch: {
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    color: COLORS.title,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  ownerPickerScroll: { maxHeight: 280 },
  ownerPickerScrollContent: { paddingBottom: 8 },
  ownerPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  ownerPickerItemText: { fontSize: 16, color: COLORS.title, flex: 1 },
  ownerPickerItemSelected: { fontWeight: '600', color: COLORS.green },
  ownerPickerItemSub: { fontSize: 11, color: '#999', marginTop: 2, maxWidth: 120 },
  ownerPickerCheck: { fontSize: 16, fontWeight: '700', color: COLORS.green, marginLeft: 8 },

  responsibleItemActive: { backgroundColor: 'rgba(46,125,50,0.05)' },
  responsibleCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.green,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  responsibleCheckboxInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.green,
  },
  responsibleSaveBtn: {
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: COLORS.green,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  responsibleSaveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  mediaSectionTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  mediaSectionTitleIcon: { width: 22, height: 22 },
  mediaSectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.title },
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
  mediaLimitNote: { fontSize: 12, color: '#999', fontStyle: 'italic', marginTop: 6 },

  videoRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 8,
    backgroundColor: COLORS.inputBg, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },
  videoUrl: { flex: 1, fontSize: 13, color: COLORS.title },
  videoRemoveText: { fontSize: 16, color: '#E85D4C', fontWeight: '700', marginLeft: 10 },
});
