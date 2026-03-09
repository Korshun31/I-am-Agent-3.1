import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  Linking,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import Constants from 'expo-constants';
import { useLanguage } from '../context/LanguageContext';
import { deleteContact, updateContact } from '../services/contactsService';
import { getBookings, deleteBooking } from '../services/bookingsService';
import { cancelBookingReminders } from '../services/bookingRemindersService';
import { getProperties, deleteProperty } from '../services/propertiesService';
import AddContactModal from '../components/AddContactModal';
import BookingDetailScreen from './BookingDetailScreen';
import AddBookingModal from '../components/AddBookingModal';
import PropertyItem from '../components/PropertyItem';
import PropertyDetailScreen from './PropertyDetailScreen';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const TOP_INSET = (Constants.statusBarHeight ?? 44) + 12;

const COLORS = {
  background: '#F5F2EB',
  title: '#2C2C2C',
  subtitle: '#5A5A5A',
  backArrow: '#5DB8D4',
  cardBg: '#FFFFFF',
  border: '#E0DAD2',
  contactLink: '#D81B60',
  labelColor: '#8A8A8A',
  deleteRed: '#E85D4C',
  editGreen: '#2E7D32',
  clientBadge: '#449CDA',
  ownerBadge: '#C2920E',
};

function formatBookingDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const y = d.getFullYear();
  return `${day}.${m}.${y}`;
}

function getBookingNumber(booking, samePropertyBookings) {
  const year = new Date(booking.checkIn).getFullYear();
  const yearShort = year % 100;
  const sameYear = samePropertyBookings
    .filter(x => new Date(x.checkIn).getFullYear() === year)
    .sort((a, b) => new Date(a.createdAt || a.checkIn) - new Date(b.createdAt || b.checkIn));
  const idx = sameYear.findIndex(x => x.id === booking.id);
  const seq = idx >= 0 ? idx + 1 : 0;
  return `${seq}/${String(yearShort).padStart(2, '0')}`;
}

function buildPropertyCode(property, properties) {
  if (!property) return '—';
  if (property.resort_id) {
    const parent = properties.find(p => p.id === property.resort_id);
    return parent ? (parent.code || '') + (property.code_suffix ? ` (${property.code_suffix})` : '') : (property.code || '—');
  }
  return property.code || '—';
}

function parseSortKey(s) {
  const str = String(s ?? '').trim();
  const m = str.match(/^(.*?)(\d+)$/);
  if (m) return { prefix: m[1], num: parseInt(m[2], 10) };
  return { prefix: str, num: null };
}

function compareByCodeOrName(a, b) {
  const codeA = (a.code || a.name || '').trim();
  const codeB = (b.code || b.name || '').trim();
  const ka = parseSortKey(codeA);
  const kb = parseSortKey(codeB);
  const cmp = ka.prefix.localeCompare(kb.prefix);
  if (cmp !== 0) return cmp;
  if (ka.num != null && kb.num != null) return ka.num - kb.num;
  if (ka.num != null) return 1;
  if (kb.num != null) return -1;
  return 0;
}

export default function ContactDetailScreen({ contact, onBack, onContactUpdated, onContactDeleted }) {
  const { t } = useLanguage();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [currentContact, setCurrentContact] = useState(contact);
  const [bookings, setBookings] = useState([]);
  const [properties, setProperties] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [selectedBookingTitle, setSelectedBookingTitle] = useState('');
  const [selectedBookingProperty, setSelectedBookingProperty] = useState(null);
  const [editBookingModalVisible, setEditBookingModalVisible] = useState(false);
  const [editBookingToEdit, setEditBookingToEdit] = useState(null);
  const [refreshBookingsTrigger, setRefreshBookingsTrigger] = useState(0);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [expandedPropertyIds, setExpandedPropertyIds] = useState(new Set());
  const [refreshPropertiesTrigger, setRefreshPropertiesTrigger] = useState(0);

  const loadBookings = useCallback(async () => {
    try {
      const data = await getBookings(null, currentContact.id);
      setBookings(data);
    } catch {}
  }, [currentContact.id]);

  const loadProperties = useCallback(async () => {
    try {
      const data = await getProperties();
      setProperties(data);
    } catch {}
  }, []);

  useEffect(() => { loadBookings(); }, [loadBookings]);
  useEffect(() => { if (refreshBookingsTrigger > 0) loadBookings(); }, [refreshBookingsTrigger, loadBookings]);
  useEffect(() => { loadProperties(); }, [loadProperties]);
  useEffect(() => { if (refreshPropertiesTrigger > 0) loadProperties(); }, [refreshPropertiesTrigger, loadProperties]);

  const c = currentContact;
  const displayName = [c.name, c.lastName].filter(Boolean).join(' ') || c.name || '';
  const isOwner = c.type === 'owners';
  const badgeColor = isOwner ? COLORS.ownerBadge : COLORS.clientBadge;
  const badgeLabel = isOwner ? t('contactOwner') : t('contactClient');

  const openPhone = (number) => {
    const clean = (number || '').replace(/\s/g, '');
    if (!clean) return;
    Alert.alert(number, t('callOrMessage'), [
      { text: t('back'), style: 'cancel' },
      { text: t('call'), onPress: () => Linking.openURL('tel:' + clean) },
      { text: t('sendMessage'), onPress: () => Linking.openURL('sms:' + clean) },
    ]);
  };

  const openEmail = (address) => {
    if (!address?.trim()) return;
    Linking.openURL('mailto:' + encodeURIComponent(address.trim()));
  };

  const openTelegram = (value) => {
    const v = (value || '').trim();
    if (!v) return;
    const isPhone = /^\+?[\d\s-]+$/.test(v);
    const url = isPhone
      ? 'https://t.me/+' + v.replace(/\D/g, '')
      : 'https://t.me/' + (v.startsWith('@') ? v.slice(1) : v);
    Linking.openURL(url);
  };

  const openWhatsApp = (number) => {
    const digits = (number || '').replace(/\D/g, '');
    if (!digits) return;
    Linking.openURL('https://wa.me/' + digits);
  };

  const handleDelete = () => {
    Alert.alert(t('deleteContactTitle'), t('deleteContactConfirm'), [
      { text: t('back'), style: 'cancel' },
      {
        text: t('remove'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteContact(c.id);
            onContactDeleted?.(c.id);
            onBack();
          } catch (e) {
            Alert.alert(t('error'), e.message);
          }
        },
      },
    ]);
  };

  const handleEditSave = async (data) => {
    try {
      const updated = await updateContact(c.id, data);
      setCurrentContact(updated);
      onContactUpdated?.(updated);
    } catch (e) {
      Alert.alert(t('error'), e.message);
    }
  };

  const InfoRow = ({ icon, value, onPress }) => {
    if (!value?.trim()) return null;
    return (
      <TouchableOpacity style={styles.infoRow} onPress={onPress} activeOpacity={0.7}>
        <Image source={icon} style={styles.infoIcon} resizeMode="contain" />
        <Text style={[styles.infoText, onPress && styles.infoTextLink]}>{value}</Text>
      </TouchableOpacity>
    );
  };

  const DetailRow = ({ label, value }) => {
    if (!value?.trim()) return null;
    return (
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    );
  };

  const byProperty = {};
  bookings.forEach(b => {
    const pid = b.propertyId;
    if (!byProperty[pid]) byProperty[pid] = [];
    byProperty[pid].push(b);
  });

  const isPastBooking = (b) => new Date(b.checkOut) < new Date();

  const ownerId = c.id;
  const getParent = (id) => properties.find(pr => pr.id === id);
  const ownsProperty = (p) => p.owner_id === ownerId || p.owner_id_2 === ownerId;

  const ownerTopLevel = properties.filter(p => !p.resort_id && ownsProperty(p));

  const ownerChildren = properties.filter((p) => {
    if (!p.resort_id || !ownsProperty(p)) return false;
    const parent = getParent(p.resort_id);
    if (!parent) return true;
    if (ownsProperty(parent)) return false;
    return true;
  });

  const ownerPropertiesList = [
    ...ownerTopLevel.map(p => ({ ...p, _parentName: null, _parentType: null })),
    ...ownerChildren.map(p => {
      const parent = getParent(p.resort_id);
      return { ...p, _parentName: parent?.name || parent?.code || '', _parentType: parent?.type || null };
    }),
  ].sort((a, b) => {
    const codeA = (a._parentName ? a._parentName + ' ' : '') + (a.code || '') + (a.code_suffix ? ` ${a.code_suffix}` : '');
    const codeB = (b._parentName ? b._parentName + ' ' : '') + (b.code || '') + (b.code_suffix ? ` ${b.code_suffix}` : '');
    return compareByCodeOrName({ code: codeA, name: a.name }, { code: codeB, name: b.name });
  });

  const togglePropertyExpand = (id) => {
    LayoutAnimation.configureNext({
      duration: 200,
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });
    setExpandedPropertyIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (selectedProperty) {
    return (
      <PropertyDetailScreen
        property={selectedProperty}
        onBack={() => setSelectedProperty(null)}
        onDelete={() => {
          Alert.alert(t('pdDeleteTitle'), t('pdDeleteConfirm'), [
            { text: t('no'), style: 'cancel' },
            {
              text: t('yes'),
              style: 'destructive',
              onPress: async () => {
                try {
                  await deleteProperty(selectedProperty.id);
                  setSelectedProperty(null);
                  setRefreshPropertiesTrigger(prev => prev + 1);
                } catch (e) {
                  Alert.alert(t('error'), e.message);
                }
              },
            },
          ]);
        }}
        onPropertyUpdated={() => setRefreshPropertiesTrigger(prev => prev + 1)}
        onSelectProperty={(prop) => setSelectedProperty(prop)}
      />
    );
  }

  if (selectedBooking) {
    return (
      <View style={{ flex: 1 }}>
        <BookingDetailScreen
          booking={selectedBooking}
          propertyCode={selectedBookingTitle || t('pdBookingList')}
          onBack={() => {
            setSelectedBooking(null);
            setSelectedBookingTitle('');
            setSelectedBookingProperty(null);
          }}
          onContactPress={undefined}
          onDelete={async (id) => {
            try {
              await cancelBookingReminders(id);
              await deleteBooking(id);
              setSelectedBooking(null);
              setSelectedBookingTitle('');
              setSelectedBookingProperty(null);
              setRefreshBookingsTrigger(prev => prev + 1);
            } catch (e) {
              Alert.alert(t('error'), e.message);
            }
          }}
          onEdit={(b) => {
            setEditBookingToEdit(b);
            setEditBookingModalVisible(true);
          }}
        />
        <AddBookingModal
          visible={editBookingModalVisible}
          property={selectedBookingProperty}
          editBooking={editBookingToEdit}
          onClose={() => { setEditBookingModalVisible(false); setEditBookingToEdit(null); }}
          onSaved={(updated) => {
            setEditBookingModalVisible(false);
            setEditBookingToEdit(null);
            if (updated) setSelectedBooking(updated);
            setRefreshBookingsTrigger(prev => prev + 1);
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.fixedTop}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.8}>
            <Text style={styles.backArrowText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{badgeLabel}</Text>
          <View style={styles.headerRight} />
        </View>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileSection}>
          {c.photoUri ? (
            <Image source={{ uri: c.photoUri }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarInitials}>
                {(c.name?.[0] || '').toUpperCase()}{(c.lastName?.[0] || '').toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.contactName}>{displayName}</Text>
          <View style={[styles.typeBadge, { backgroundColor: badgeColor }]}>
            <Text style={styles.typeBadgeText}>{badgeLabel}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>{t('contacts')}</Text>
            <TouchableOpacity onPress={() => setEditModalVisible(true)} style={styles.editBtn} activeOpacity={0.8}>
              <Image source={require('../../assets/pencil-icon.png')} style={styles.editIcon} resizeMode="contain" />
            </TouchableOpacity>
          </View>

          <InfoRow
            icon={require('../../assets/icon-contact-phone.png')}
            value={c.phone}
            onPress={() => openPhone(c.phone)}
          />
          {(c.extraPhones || []).map((p, i) =>
            p ? (
              <InfoRow
                key={`p-${i}`}
                icon={require('../../assets/icon-contact-phone.png')}
                value={p}
                onPress={() => openPhone(p)}
              />
            ) : null
          )}
          <InfoRow
            icon={require('../../assets/icon-contact-email.png')}
            value={c.email}
            onPress={() => openEmail(c.email)}
          />
          {(c.extraEmails || []).map((e, i) =>
            e ? (
              <InfoRow
                key={`e-${i}`}
                icon={require('../../assets/icon-contact-email.png')}
                value={e}
                onPress={() => openEmail(e)}
              />
            ) : null
          )}
          <InfoRow
            icon={require('../../assets/icon-contact-telegram.png')}
            value={c.telegram}
            onPress={() => openTelegram(c.telegram)}
          />
          <InfoRow
            icon={require('../../assets/icon-contact-whatsapp.png')}
            value={c.whatsapp}
            onPress={() => openWhatsApp(c.whatsapp)}
          />
        </View>

        {(c.documentNumber || c.nationality || c.birthday) ? (
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>{t(isOwner ? 'ownerDataDetails' : 'clientDataDetails')}</Text>
            </View>
            {c.documentNumber ? (
              <View style={styles.passportRow}>
                <Image source={require('../../assets/icon-passport-id.png')} style={styles.passportRowIcon} resizeMode="contain" />
                <Text style={styles.detailValue}>{c.documentNumber}</Text>
              </View>
            ) : null}
            {c.nationality ? (
              <View style={styles.passportRow}>
                <Image source={require('../../assets/icon-nationality.png')} style={styles.passportRowIcon} resizeMode="contain" />
                <Text style={styles.detailValue}>{c.nationality}</Text>
              </View>
            ) : null}
            {c.birthday ? (
              <View style={styles.passportRow}>
                <Image source={require('../../assets/icon-birthday.png')} style={styles.passportRowIcon} resizeMode="contain" />
                <Text style={styles.detailValue}>{c.birthday}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {isOwner ? (
          <View style={styles.ownerPropertiesSection}>
            <View style={styles.sectionTitleRow}>
              <Image source={require('../../assets/icon-property-house.png')} style={styles.sectionTitleIcon} resizeMode="contain" />
              <Text style={styles.cardTitle}>{t('ownerProperties')}</Text>
            </View>
            {ownerPropertiesList.length > 0 ? (
              ownerPropertiesList.map((item) => (
                <PropertyItem
                  key={item.id}
                  item={item}
                  expanded={expandedPropertyIds.has(item.id)}
                  onToggle={() => togglePropertyExpand(item.id)}
                  onPress={() => setSelectedProperty(item)}
                  t={t}
                />
              ))
            ) : (
              <Text style={styles.emptyBookings}>{t('ownerNoProperties')}</Text>
            )}
          </View>
        ) : null}

        {!isOwner ? (
          <View style={[styles.card, styles.bookingsBlock]}>
            <View style={styles.sectionTitleRow}>
              <Image source={require('../../assets/icon-booking.png')} style={styles.sectionTitleIcon} resizeMode="contain" />
              <Text style={styles.cardTitle}>{t('clientBookings')}</Text>
            </View>
            {bookings.length > 0 ? (
              bookings.map((b) => {
                const prop = properties.find(p => p.id === b.propertyId);
                const codeDisplay = buildPropertyCode(prop, properties);
                const samePropBookings = byProperty[b.propertyId] || [];
                const bookingNum = getBookingNumber(b, samePropBookings);
                const codePart = `${codeDisplay} ${bookingNum}`;
                const past = isPastBooking(b);
                return (
                  <TouchableOpacity
                    key={b.id}
                    style={[styles.bookingItem, past && styles.bookingItemPast]}
                    onPress={() => {
                      setSelectedBooking(b);
                      setSelectedBookingTitle(codePart);
                      setSelectedBookingProperty(prop || null);
                    }}
                    activeOpacity={0.7}
                  >
                    <Image source={require('../../assets/icon-booking-hashtag.png')} style={[styles.bookingItemIcon, past && styles.bookingItemPastIcon]} resizeMode="contain" />
                    <Text style={[styles.bookingItemCode, past && styles.bookingItemPastText]} numberOfLines={1}>{codePart}</Text>
                    <Text style={[styles.bookingItemDates, past && styles.bookingItemPastText]}>
                      {formatBookingDate(b.checkIn)} — {formatBookingDate(b.checkOut)}
                    </Text>
                  </TouchableOpacity>
                );
              })
            ) : (
              <Text style={styles.emptyBookings}>{t('clientNoBookings')}</Text>
            )}
          </View>
        ) : null}

        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.7}>
          <Text style={styles.deleteBtnText}>{t('deleteContactTitle')}</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <AddContactModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        contactType={c.type}
        editContact={c}
        onSave={handleEditSave}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  fixedTop: {
    paddingTop: TOP_INSET,
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backBtn: {
    width: 52,
    padding: 8,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  backArrowText: {
    fontSize: 24,
    color: COLORS.backArrow,
  },
  headerTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.title,
    textAlign: 'center',
  },
  headerRight: {
    width: 52,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 88,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E0D8CC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 12,
  },
  avatarInitials: {
    fontSize: 32,
    fontWeight: '700',
    color: '#8A8A8A',
  },
  contactName: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.title,
    marginBottom: 8,
  },
  typeBadge: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.title,
  },
  editBtn: {
    padding: 6,
  },
  editIcon: {
    width: 22,
    height: 22,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoIcon: {
    width: 22,
    height: 22,
    marginRight: 10,
  },
  infoText: {
    fontSize: 15,
    color: COLORS.title,
  },
  infoTextLink: {
    fontWeight: '700',
    color: COLORS.contactLink,
  },
  detailRow: {
    marginBottom: 12,
  },
  passportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  passportRowIcon: {
    width: 22,
    height: 22,
    marginRight: 10,
  },
  detailLabel: {
    fontSize: 13,
    color: COLORS.labelColor,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.title,
  },
  deleteBtn: {
    marginTop: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(232, 93, 76, 0.4)',
    backgroundColor: 'rgba(232, 93, 76, 0.06)',
  },
  deleteBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.deleteRed,
  },
  bottomSpacer: {
    height: 20,
  },
  ownerPropertiesSection: {
    marginBottom: 14,
  },
  bookingsBlock: {
    backgroundColor: 'rgba(187,222,251,0.5)',
    borderWidth: 1.5,
    borderColor: '#64B5F6',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitleIcon: {
    width: 22,
    height: 22,
  },
  bookingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  bookingItemPast: {
    opacity: 0.6,
  },
  bookingItemIcon: {
    width: 19,
    height: 19,
    marginRight: 10,
  },
  bookingItemPastIcon: {
    opacity: 0.7,
  },
  bookingItemCode: {
    flex: 1,
    fontSize: 15,
    color: '#C45C6E',
    fontWeight: '600',
  },
  bookingItemDates: {
    fontSize: 14,
    color: '#2C2C2C',
  },
  bookingItemPastText: {
    color: '#888',
  },
  emptyBookings: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
  },
});
