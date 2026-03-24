import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Image, Linking, Platform,
} from 'react-native';
import dayjs from 'dayjs';
import { useLanguage } from '../../context/LanguageContext';

import { getContacts, getContactsByIds, deleteContact } from '../../services/contactsService';
import { getBookings } from '../../services/bookingsService';
import { getProperties } from '../../services/propertiesService';
import WebContactEditPanel from '../components/WebContactEditPanel';
import { PropertyDetail } from './WebPropertiesScreen';
import WebPropertyEditPanel from '../components/WebPropertyEditPanel';

const ICON_PHONE    = require('../../../assets/icon-contact-phone.png');
const ICON_EMAIL    = require('../../../assets/icon-contact-email.png');
const ICON_WHATSAPP = require('../../../assets/icon-contact-whatsapp.png');
const ICON_TELEGRAM = require('../../../assets/icon-contact-telegram.png');
const ICON_BIRTHDAY     = require('../../../assets/icon-contact-birthday.png');
const ICON_DOCUMENT     = require('../../../assets/icon-contact-document.png');
const ICON_NATIONALITY  = require('../../../assets/icon-contact-nationality.png');
const ICON_TRASH        = require('../../../assets/trash-icon.png');

// ─── Constants ───────────────────────────────────────────────────────────────

const ACCENT = '#3D7D82';
const C = {
  bg: '#F4F6F9',
  surface: '#FFFFFF',
  border: '#E9ECEF',
  text: '#212529',
  muted: '#6C757D',
  light: '#ADB5BD',
  client: '#5B82D6',
  clientBg: '#F0F5FD',
  owner: '#C2920E',
  ownerBg: '#FFFDE7',
  accent: ACCENT,
  accentBg: '#EAF4F5',
};

const TYPE_META_COLORS = {
  clients: { color: C.client, bg: C.clientBg },
  owners:  { color: C.owner,  bg: C.ownerBg  },
};

const PROPERTY_TYPE = {
  house:  { color: '#C2920E', bg: '#FFFDE7' },
  resort: { color: '#2E7D32', bg: '#E8F5E9' },
  condo:  { color: '#1565C0', bg: '#E3F2FD' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name, lastName) {
  const f = (name || '').trim()[0] || '';
  const l = (lastName || '').trim()[0] || '';
  return (f + l).toUpperCase() || '?';
}

function getAvatarColor(name) {
  const colors = ['#3D7D82','#5B82D6','#4AA87D','#6A1B9A','#E65100','#00695C','#AD1457','#283593'];
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = (name.charCodeAt(i) + ((h << 5) - h));
  return colors[Math.abs(h) % colors.length];
}

function openWhatsApp(phone) {
  const clean = (phone || '').replace(/\D/g, '');
  if (clean) Linking.openURL(`https://wa.me/${clean}`);
}

function openTelegram(value) {
  const v = (value || '').trim();
  if (!v) return;
  const isPhone = /^\+?[\d\s-]+$/.test(v);
  const url = isPhone
    ? 'https://t.me/+' + v.replace(/\D/g, '')
    : 'https://t.me/' + (v.startsWith('@') ? v.slice(1) : v);
  Linking.openURL(url);
}

function openPhone(phone) {
  const clean = (phone || '').replace(/\s/g, '');
  if (clean) Linking.openURL('tel:' + clean);
}

function openEmail(email) {
  if (email?.trim()) Linking.openURL('mailto:' + encodeURIComponent(email.trim()));
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ contact, size = 44 }) {
  if (contact.photoUri) {
    return (
      <Image
        source={{ uri: contact.photoUri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        resizeMode="cover"
      />
    );
  }
  const color = getAvatarColor(contact.name + contact.lastName);
  const initials = getInitials(contact.name, contact.lastName);
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color, alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: '#FFF', fontWeight: '700', fontSize: size * 0.38 }}>
        {initials}
      </Text>
    </View>
  );
}

// ─── TypeBadge ───────────────────────────────────────────────────────────────

function TypeBadge({ type }) {
  const { t } = useLanguage();
  const colors = TYPE_META_COLORS[type];
  if (!colors) return null;
  const label = type === 'clients' ? t('client') : t('owner');
  return (
    <View style={[s.typeBadge, { backgroundColor: colors.bg }]}>
      <Text style={[s.typeBadgeText, { color: colors.color }]}>{label}</Text>
    </View>
  );
}

// ─── Contact Card (left list) ─────────────────────────────────────────────────

function ContactCard({ item, isSelected, onPress, bookingCount, propertyCount }) {
  const { t } = useLanguage();
  const displayName = [item.name, item.lastName].filter(Boolean).join(' ') || '—';
  const isOwner = item.type === 'owners';
  return (
    <TouchableOpacity
      style={[s.card, isSelected && s.cardSelected]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Avatar contact={item} size={44} />
      <View style={s.cardBody}>
        <View style={s.cardTopRow}>
          <Text style={[s.cardName, isSelected && s.cardNameSelected]} numberOfLines={1}>
            {displayName}
          </Text>
          <TypeBadge type={item.type} />
        </View>
        {item.phone ? (
          <Text style={s.cardSub} numberOfLines={1}>{item.phone}</Text>
        ) : item.telegram ? (
          <Text style={s.cardSub} numberOfLines={1}>{item.telegram}</Text>
        ) : null}
        <Text style={s.cardCount}>
          {isOwner
            ? `${propertyCount || 0} ${t('contactsProperties').toLowerCase()}`
            : `${bookingCount || 0} ${t('contactsBookings').toLowerCase()}`}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Action Button ────────────────────────────────────────────────────────────

function ActionBtn({ icon, label, color, onPress }) {
  return (
    <TouchableOpacity style={[s.actionBtn, { backgroundColor: color + '15' }]} onPress={onPress} activeOpacity={0.7}>
      <Image source={icon} style={s.actionBtnIcon} resizeMode="contain" />
      <Text style={[s.actionBtnText, { color }]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Booking Row ──────────────────────────────────────────────────────────────

function getBookingStatus(booking) {
  const today = dayjs().format('YYYY-MM-DD');
  if (!booking.checkIn) return 'past';
  if (booking.checkIn > today) return 'future';
  if (booking.checkOut && booking.checkOut <= today) return 'past';
  return 'active';
}

function getBookingStatusMeta(t) {
  return {
    future: {
      label: `● ${t('bkStatusFuture')}`,
      labelColor: '#1565C0',
      bg: '#EFF6FF',
      border: '#1565C0',
      propColor: '#1A237E',
      dateColor: '#1565C0',
      amountColor: '#1565C0',
    },
    active: {
      label: `● ${t('bkStatusActive')}`,
      labelColor: '#2E7D32',
      bg: '#F0FFF4',
      border: '#2E7D32',
      propColor: '#1B5E20',
      dateColor: '#2E7D32',
      amountColor: '#2E7D32',
    },
    past: {
      label: null,
      labelColor: C.light,
      bg: C.surface,
      border: 'transparent',
      propColor: C.muted,
      dateColor: C.light,
      amountColor: C.light,
    },
  };
}

function BookingRow({ booking, properties }) {
  const { t } = useLanguage();
  const prop = properties.find(p => p.id === booking.propertyId);
  const propName = prop ? (prop.name || prop.code) : '—';
  const checkIn  = booking.checkIn  ? dayjs(booking.checkIn).format('DD.MM.YYYY')  : '—';
  const checkOut = booking.checkOut ? dayjs(booking.checkOut).format('DD.MM.YYYY') : '—';
  const nights = (booking.checkIn && booking.checkOut)
    ? dayjs(booking.checkOut).diff(dayjs(booking.checkIn), 'day')
    : null;
  const status = getBookingStatus(booking);
  const st = getBookingStatusMeta(t)[status];

  return (
    <View style={[s.bookingRow, { backgroundColor: st.bg, borderLeftColor: st.border }]}>
      <View style={s.bookingLeft}>
        <View style={s.bookingTopLine}>
          <Text style={[s.bookingProp, { color: st.propColor }]} numberOfLines={1}>{propName}</Text>
          {st.label && (
            <Text style={[s.bookingBadge, { color: st.labelColor }]}>{st.label}</Text>
          )}
        </View>
        <Text style={[s.bookingDates, { color: st.dateColor }]}>
          {checkIn} → {checkOut}{nights ? `  (${nights} ${t('nightsShort')})` : ''}
        </Text>
      </View>
      {booking.totalAmount ? (
        <Text style={[s.bookingAmount, { color: st.amountColor }]}>
          {Number(booking.totalAmount).toLocaleString('ru-RU')} ฿
        </Text>
      ) : null}
    </View>
  );
}

// ─── Property Row (for owners) ────────────────────────────────────────────────

function PropertyRow({ property, onPress }) {
  const code = property.code + (property.code_suffix ? `-${property.code_suffix}` : '');
  const pt = PROPERTY_TYPE[property.type] || PROPERTY_TYPE.house;
  return (
    <TouchableOpacity
      style={[s.propertyRow, { backgroundColor: pt.bg, borderLeftColor: pt.color }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={{ flex: 1 }}>
        <Text style={[s.propertyName, { color: pt.color }]} numberOfLines={1}>{property.name}</Text>
        {property.city ? <Text style={s.propertySub}>{property.city}</Text> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={[s.propertyCodeChip, { backgroundColor: pt.color + '20' }]}>
          <Text style={[s.propertyCodeText, { color: pt.color }]}>{code}</Text>
        </View>
        <Text style={[s.propertyArrow, { color: pt.color }]}>→</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Contact Detail ───────────────────────────────────────────────────────────

function ContactDetail({ contact, allProperties, onEdit, onDelete, onOpenInline, user }) {
  const { t } = useLanguage();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Разрешения агента
  const isAgent = !!user?.teamMembership;
  const canManage = !isAgent || !!user?.teamPermissions?.can_book;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteContact(contact.id);
      onDelete && onDelete();
    } catch (e) {
      console.error('Delete contact error:', e);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const isOwner = contact.type === 'owners';
  const displayName = [contact.name, contact.lastName].filter(Boolean).join(' ') || '—';

  const allOwned = allProperties.filter(p =>
    p.owner_id === contact.id || p.owner_id_2 === contact.id
  );
  const ownedIds = new Set(allOwned.map(p => p.id));
  // Hide child units whose parent resort/condo also belongs to this contact
  const ownedProperties = allOwned.filter(p =>
    !p.resort_id || !ownedIds.has(p.resort_id)
  );

  useEffect(() => {
    if (isOwner) return;
    setLoading(true);
    getBookings(null, contact.id)
      .then(data => setBookings(data || []))
      .finally(() => setLoading(false));
  }, [contact.id, isOwner]);

  const allPhones    = [contact.phone, ...(contact.extraPhones || [])].filter(Boolean);
  const allEmails    = [contact.email, ...(contact.extraEmails || [])].filter(Boolean);
  const allTelegrams = contact.extraTelegrams?.length ? contact.extraTelegrams : (contact.telegram ? [contact.telegram] : []);
  const allWhatsapps = contact.extraWhatsapps?.length ? contact.extraWhatsapps : (contact.whatsapp ? [contact.whatsapp] : []);

  return (
    <ScrollView style={s.detail} showsVerticalScrollIndicator={true} contentContainerStyle={s.detailContent}>

      {/* ── Header ── */}
      <View style={s.detailHeader}>
        <Avatar contact={contact} size={72} />
        <View style={s.detailHeaderInfo}>
          <Text style={s.detailName}>{displayName}</Text>
          <View style={s.detailHeaderRow}>
            <TypeBadge type={contact.type} />
            {contact.nationality ? (
              <View style={s.detailNationalityRow}>
                <Image source={ICON_NATIONALITY} style={s.detailNationalityIcon} resizeMode="contain" />
                <Text style={s.detailNationality}>{contact.nationality}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <View style={s.detailHeaderActions}>
          {canManage && (
            <TouchableOpacity style={s.editBtn} onPress={onEdit} activeOpacity={0.7}>
              <Image source={require('../../../assets/icon-type-pencil.png')} style={s.editBtnIcon} resizeMode="contain" />
              <Text style={s.editBtnText}>{t('edit')}</Text>
            </TouchableOpacity>
          )}
          {!isAgent && (
            <TouchableOpacity style={s.deleteBtn} onPress={() => setConfirmDelete(true)} activeOpacity={0.7}>
              <Image source={ICON_TRASH} style={s.deleteBtnIcon} resizeMode="contain" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Delete confirmation ── */}
      {confirmDelete && (
        <View style={s.confirmDeleteBar}>
          <Text style={s.confirmDeleteText}>{t('pdDeleteConfirm')}</Text>
          <TouchableOpacity
            style={s.confirmDeleteYes}
            onPress={handleDelete}
            disabled={deleting}
            activeOpacity={0.8}
          >
            <Text style={s.confirmDeleteYesText}>{deleting ? '...' : t('delete')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.confirmDeleteNo} onPress={() => setConfirmDelete(false)} activeOpacity={0.8}>
            <Text style={s.confirmDeleteNoText}>{t('cancel')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Quick Actions ── */}
      {(allPhones.length > 0 || allWhatsapps.length > 0 || allTelegrams.length > 0 || allEmails.length > 0) && (
        <View style={s.actions}>
          {allPhones.map((p, i) => (
            <ActionBtn key={`ph${i}`} icon={ICON_PHONE} label={p} color="#2E7D32" onPress={() => openPhone(p)} />
          ))}
          {allWhatsapps.map((w, i) => (
            <ActionBtn key={`wa${i}`} icon={ICON_WHATSAPP} label={i === 0 ? 'WhatsApp' : `WhatsApp ${i+1}`} color="#25D366" onPress={() => openWhatsApp(w)} />
          ))}
          {allTelegrams.map((tg, i) => (
            <ActionBtn key={`tg${i}`} icon={ICON_TELEGRAM} label={i === 0 ? 'Telegram' : `Telegram ${i+1}`} color="#229ED9" onPress={() => openTelegram(tg)} />
          ))}
          {allEmails.map((e, i) => (
            <ActionBtn key={`em${i}`} icon={ICON_EMAIL} label={e} color="#6A1B9A" onPress={() => openEmail(e)} />
          ))}
        </View>
      )}

      {/* ── Info ── */}
      <View style={s.infoCard}>
        <Text style={s.sectionTitle}>{t('myDetails').toUpperCase()}</Text>
        {contact.birthday ? (
          <View style={s.infoRow}>
            <View style={s.infoLabelRow}>
              <Image source={ICON_BIRTHDAY} style={s.infoLabelIcon} resizeMode="contain" />
              <Text style={s.infoLabel}>{t('birthdayDate')}</Text>
            </View>
            <Text style={s.infoValue}>{dayjs(contact.birthday).format('DD.MM.YYYY')}</Text>
          </View>
        ) : null}
        {contact.documentNumber ? (
          <View style={s.infoRow}>
            <View style={s.infoLabelRow}>
              <Image source={ICON_DOCUMENT} style={s.infoLabelIcon} resizeMode="contain" />
              <Text style={s.infoLabel}>{t('documentNumber')}</Text>
            </View>
            <Text style={s.infoValue}>{contact.documentNumber}</Text>
          </View>
        ) : null}
        {allPhones.length > 0 && allPhones.map((p, i) => (
          <View key={i} style={s.infoRow}>
            <View style={s.infoLabelRow}>
              <Image source={ICON_PHONE} style={s.infoLabelIcon} resizeMode="contain" />
              <Text style={s.infoLabel}>{i === 0 ? t('contactPhoneLabel') : t('contactExtraPhone')}</Text>
            </View>
            <Text style={[s.infoValue, s.infoLink]} onPress={() => openPhone(p)}>{p}</Text>
          </View>
        ))}
        {allEmails.length > 0 && allEmails.map((e, i) => (
          <View key={i} style={s.infoRow}>
            <View style={s.infoLabelRow}>
              <Image source={ICON_EMAIL} style={s.infoLabelIcon} resizeMode="contain" />
              <Text style={s.infoLabel}>{i === 0 ? t('contactEmailLabel') : t('contactExtraEmail')}</Text>
            </View>
            <Text style={[s.infoValue, s.infoLink]} onPress={() => openEmail(e)}>{e}</Text>
          </View>
        ))}
          {allTelegrams.length > 0 && allTelegrams.map((tg, i) => (
          <View key={i} style={s.infoRow}>
            <View style={s.infoLabelRow}>
              <Image source={ICON_TELEGRAM} style={s.infoLabelIcon} resizeMode="contain" />
              <Text style={s.infoLabel}>{i === 0 ? t('contactTelegramLabel') : t('contactExtraTelegram')}</Text>
            </View>
            <Text style={[s.infoValue, s.infoLink]} onPress={() => openTelegram(tg)}>{tg}</Text>
          </View>
        ))}
        {allWhatsapps.length > 0 && allWhatsapps.map((w, i) => (
          <View key={i} style={s.infoRow}>
            <View style={s.infoLabelRow}>
              <Image source={ICON_WHATSAPP} style={s.infoLabelIcon} resizeMode="contain" />
              <Text style={s.infoLabel}>{i === 0 ? t('contactWhatsappLabel') : t('contactExtraWhatsapp')}</Text>
            </View>
            <Text style={[s.infoValue, s.infoLink]} onPress={() => openWhatsApp(w)}>{w}</Text>
          </View>
        ))}
      </View>

      {/* ── Bookings (clients) ── */}
      {!isOwner && (
        <View style={s.infoCard}>
          <Text style={s.sectionTitle}>{t('bookings').toUpperCase()} ({bookings.length})</Text>
          {loading ? (
            <ActivityIndicator color={ACCENT} style={{ padding: 20 }} />
          ) : bookings.length === 0 ? (
            <Text style={s.emptyText}>{t('bookingsNoData')}</Text>
          ) : (
            [...bookings]
              .sort((a, b) => {
                const order = { future: 0, active: 1, past: 2 };
                const sa = order[getBookingStatus(a)];
                const sb = order[getBookingStatus(b)];
                if (sa !== sb) return sa - sb;
                // внутри группы — по дате заезда
                return (a.checkIn || '').localeCompare(b.checkIn || '');
              })
              .map(b => (
                <BookingRow key={b.id} booking={b} properties={allProperties} />
              ))
          )}
        </View>
      )}

      {/* ── Properties (owners) ── */}
      {isOwner && (
        <View style={s.infoCard}>
          <Text style={s.sectionTitle}>{t('ctOwnedProperties').toUpperCase()} ({ownedProperties.length})</Text>
          {ownedProperties.length === 0 ? (
            <Text style={s.emptyText}>{t('ctNoProperties')}</Text>
          ) : (
            ownedProperties.map(p => (
              <PropertyRow
                key={p.id}
                property={p}
                onPress={() => onOpenInline && onOpenInline(p)}
              />
            ))
          )}
        </View>
      )}

    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function WebContactsScreen({ onNavigateToProperty, user }) {
  const { t } = useLanguage();
  const [allContacts, setAllContacts] = useState([]);
  const [allProperties, setAllProperties] = useState([]);
  const [bookingCounts, setBookingCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [editPanelVisible, setEditPanelVisible] = useState(false);
  const [editContact, setEditContact] = useState(null);
  const [editMode, setEditMode] = useState('create');

  // ── Inline property view state ──
  const [inlineProperty, setInlineProperty] = useState(null);
  const [inlineNavStack, setInlineNavStack] = useState([]);
  const [inlineBookings, setInlineBookings] = useState([]);
  const [inlineEditPanel, setInlineEditPanel] = useState({ visible: false, mode: 'edit', property: null, parentProperty: null });

  const isTeamMember = user?.teamMembership != null && !user?.teamMembership?.is_admin;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let allOwners = [];
      let allClients = [];
      let props = [];

      if (isTeamMember) {
        // Агент: получаем его объекты, затем собственников по owner_id
        props = await getProperties();
        const ownerIds = [...new Set([
          ...props.map(p => p.owner_id).filter(Boolean),
          ...props.map(p => p.owner_id_2).filter(Boolean),
        ])];
        allOwners = ownerIds.length > 0 ? await getContactsByIds(ownerIds) : [];
        // Клиенты — из бронирований его объектов
        const propIds = new Set(props.map(p => p.id));
        try {
          const allBookings = await getBookings();
          const clientIds = [...new Set(
            allBookings.filter(bk => propIds.has(bk.propertyId) && bk.contactId).map(bk => bk.contactId)
          )];
          allClients = clientIds.length > 0 ? await getContactsByIds(clientIds) : [];
        } catch {}
      } else {
        // Админ: загружаем всё
        [allClients, allOwners, props] = await Promise.all([
          getContacts('clients'),
          getContacts('owners'),
          getProperties(),
        ]);
        // Count bookings per client
        const counts = {};
        try {
          const allBookings = await getBookings();
          allBookings.forEach(bk => {
            if (bk.contactId) counts[bk.contactId] = (counts[bk.contactId] || 0) + 1;
          });
        } catch {}
        setBookingCounts(counts);
      }

      // Убираем дубликаты (если один контакт — и собственник и клиент)
      const seen = new Set();
      const all = [...allOwners, ...allClients].filter(c => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      }).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ru'));

      setAllContacts(all);
      setAllProperties(props);
    } finally {
      setLoading(false);
    }
  }, [isTeamMember]);

  useEffect(() => { load(); }, [load]);

  // Load bookings for inline property view
  useEffect(() => {
    if (!inlineProperty) { setInlineBookings([]); return; }
    getBookings(inlineProperty.id).then(data => setInlineBookings(data || [])).catch(() => {});
  }, [inlineProperty?.id]);

  // ── Inline property handlers ──
  const openInlineProperty = useCallback((property) => {
    setInlineProperty(property);
    setInlineNavStack([]);
  }, []);

  const closeInlineProperty = useCallback(() => {
    setInlineProperty(null);
    setInlineNavStack([]);
    setInlineBookings([]);
  }, []);

  const handleInlineChildPress = useCallback((child) => {
    setInlineNavStack(prev => [...prev, inlineProperty]);
    setInlineProperty(child);
  }, [inlineProperty]);

  const handleInlineBack = useCallback(() => {
    setInlineNavStack(prev => {
      if (prev.length === 0) return prev;
      setInlineProperty(prev[prev.length - 1]);
      return prev.slice(0, -1);
    });
  }, []);

  const handleSelectContact = useCallback((contact) => {
    setSelected(contact);
    closeInlineProperty();
  }, [closeInlineProperty]);

  const openCreate = () => {
    setEditContact(null);
    setEditMode('create');
    setEditPanelVisible(true);
  };

  const openEdit = (contact) => {
    setEditContact(contact);
    setEditMode('edit');
    setEditPanelVisible(true);
  };

  const handleContactDeleted = useCallback(() => {
    setSelected(null);
    closeInlineProperty();
    load();
  }, [closeInlineProperty, load]);

  const handleSaved = (saved) => {
    setEditPanelVisible(false);
    load().then(() => {
      if (saved?.id) {
        setAllContacts(prev => {
          const updated = prev.some(c => c.id === saved.id)
            ? prev.map(c => c.id === saved.id ? saved : c)
            : [...prev, saved];
          return updated.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ru'));
        });
        setSelected(saved);
      }
    });
  };

  // ── Filtered list ──
  const isAgent = !!user?.teamMembership;
  const canManage = !isAgent || !!user?.teamPermissions?.can_book;

  const q = search.trim().toLowerCase();
  const filtered = allContacts.filter(c => {
    if (typeFilter !== 'all' && c.type !== typeFilter) return false;
    if (!q) return true;
    const full = [c.name, c.lastName, c.phone, c.email, c.telegram].join(' ').toLowerCase();
    return full.includes(q);
  });

  const counts = {
    all: allContacts.length,
    clients: allContacts.filter(c => c.type === 'clients').length,
    owners:  allContacts.filter(c => c.type === 'owners').length,
  };

  const propertyCount = (contactId) =>
    allProperties.filter(p => p.owner_id === contactId || p.owner_id_2 === contactId).length;

  return (
    <View style={s.root}>

      {/* ══════════════ LEFT PANEL ══════════════ */}
      <View style={s.leftPanel}>

        {/* Header */}
        <View style={s.leftHeader}>
          <View>
            <Text style={s.leftTitle}>{t('contactsTitle')}</Text>
            <Text style={s.leftSubtitle}>{counts.all} {t('contactsTitle').toLowerCase()}</Text>
          </View>
          {canManage && (
            <TouchableOpacity style={s.addBtn} onPress={openCreate} activeOpacity={0.8}>
              <Text style={s.addBtnText}>+ {t('contactsAddBtn')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Search */}
        <View style={s.searchBox}>
          <Text style={s.searchIcon}>🔍</Text>
          <TextInput
            style={s.searchInput}
            placeholder={t('search') + '…'}
            placeholderTextColor={C.light}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={s.searchClear}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Filter tabs */}
        <View style={s.filterTabs}>
          {[
            { key: 'all',     label: `${t('all')} (${counts.all})` },
            { key: 'clients', label: `${t('clients')} (${counts.clients})` },
            { key: 'owners',  label: `${t('owners')} (${counts.owners})` },
          ].map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[s.filterTab, typeFilter === tab.key && s.filterTabActive]}
              onPress={() => setTypeFilter(tab.key)}
            >
              <Text style={[s.filterTabText, typeFilter === tab.key && s.filterTabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* List */}
        {loading ? (
          <ActivityIndicator color={ACCENT} style={{ flex: 1, justifyContent: 'center' }} />
        ) : filtered.length === 0 ? (
          <View style={s.listEmpty}>
            <Text style={s.listEmptyIcon}>👤</Text>
            <Text style={s.listEmptyText}>{search ? t('noData') : t('contactsNoClients')}</Text>
          </View>
        ) : (
          <ScrollView
            style={s.list}
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={true}
          >
            {filtered.map(item => (
              <ContactCard
                key={item.id}
                item={item}
                isSelected={selected?.id === item.id}
                onPress={() => handleSelectContact(item)}
                bookingCount={bookingCounts[item.id] || 0}
                propertyCount={propertyCount(item.id)}
              />
            ))}
          </ScrollView>
        )}
      </View>

      {/* ══════════════ RIGHT PANEL ══════════════ */}
      <View style={s.rightPanel}>
        {inlineProperty ? (
          <View style={{ flex: 1 }}>
            {/* ← Back to contact bar */}
            <TouchableOpacity style={s.backToContactBar} onPress={closeInlineProperty} activeOpacity={0.8}>
              <Text style={s.backToContactArrow}>←</Text>
              {selected && <Avatar contact={selected} size={22} />}
              <Text style={s.backToContactText} numberOfLines={1}>
                {[selected?.name, selected?.lastName].filter(Boolean).join(' ') || t('emptySelectContact')}
              </Text>
            </TouchableOpacity>
            <PropertyDetail
              property={inlineProperty}
              contacts={allContacts}
              allProperties={allProperties}
              bookings={inlineBookings}
              previousProperty={inlineNavStack.length > 0 ? inlineNavStack[inlineNavStack.length - 1] : null}
              onChildPress={handleInlineChildPress}
              onBack={handleInlineBack}
              onEdit={() => setInlineEditPanel({ visible: true, mode: 'edit', property: inlineProperty, parentProperty: null })}
              onAddUnit={() => setInlineEditPanel({ visible: true, mode: 'create-unit', property: null, parentProperty: inlineProperty })}
              user={user}
            />
            <WebPropertyEditPanel
              visible={inlineEditPanel.visible}
              mode={inlineEditPanel.mode}
              property={inlineEditPanel.property}
              parentProperty={inlineEditPanel.parentProperty}
              onClose={() => setInlineEditPanel(p => ({ ...p, visible: false }))}
              onSaved={(saved) => {
                setInlineEditPanel(p => ({ ...p, visible: false }));
                if (saved?.id === inlineProperty?.id) setInlineProperty(saved);
                load();
              }}
              user={user}
            />
          </View>
        ) : selected ? (
          <ContactDetail
            key={selected.id}
            contact={selected}
            allProperties={allProperties}
            onEdit={() => openEdit(selected)}
            onDelete={handleContactDeleted}
            onOpenInline={openInlineProperty}
            user={user}
          />
        ) : (
          <View style={s.rightEmpty}>
            <Text style={s.rightEmptyIcon}>👤</Text>
            <Text style={s.rightEmptyTitle}>{t('emptySelectContact')}</Text>
            <Text style={s.rightEmptySub}>{t('emptySelectContactHint')}</Text>
          </View>
        )}
      </View>

      {/* ══════════════ EDIT PANEL ══════════════ */}
      <WebContactEditPanel
        visible={editPanelVisible}
        mode={editMode}
        contact={editContact}
        onClose={() => setEditPanelVisible(false)}
        onSaved={handleSaved}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: C.bg },

  // ── Left panel ──
  leftPanel: {
    width: 380,
    backgroundColor: C.surface,
    borderRightWidth: 1,
    borderRightColor: C.border,
    flexDirection: 'column',
  },
  leftHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  leftTitle:    { fontSize: 20, fontWeight: '800', color: C.text },
  leftSubtitle: { fontSize: 12, color: C.muted, marginTop: 2 },
  addBtn: {
    backgroundColor: '#EAF4F5',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#B2D8DB',
  },
  addBtnText: { color: '#3D7D82', fontSize: 14, fontWeight: '700' },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: C.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  searchIcon:  { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 13, color: C.text, outlineStyle: 'none' },
  searchClear: { color: C.light, fontSize: 14, padding: 4 },

  filterTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 6,
  },
  filterTab: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, backgroundColor: C.bg,
    borderWidth: 1, borderColor: C.border,
  },
  filterTabActive:     { backgroundColor: ACCENT, borderColor: ACCENT },
  filterTabText:       { fontSize: 12, color: C.muted, fontWeight: '500' },
  filterTabTextActive: { color: '#FFF', fontWeight: '700' },

  list:        { flex: 1 },
  listContent: { paddingHorizontal: 10, paddingBottom: 20 },
  listEmpty:   { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  listEmptyIcon: { fontSize: 48, marginBottom: 12 },
  listEmptyText: { fontSize: 14, color: C.muted },

  // ── Card ──
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  cardSelected: { backgroundColor: C.accentBg },
  cardBody:     { flex: 1 },
  cardTopRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  cardName:     { flex: 1, fontSize: 14, fontWeight: '600', color: C.text },
  cardNameSelected: { color: ACCENT },
  cardSub:  { fontSize: 12, color: C.muted, marginBottom: 2 },
  cardCount: { fontSize: 11, color: C.light },

  typeBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  typeBadgeText: { fontSize: 11, fontWeight: '700' },

  // ── Right panel ──
  rightPanel: { flex: 1, backgroundColor: C.bg },
  rightEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  rightEmptyIcon:  { fontSize: 64, marginBottom: 16 },
  rightEmptyTitle: { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 8 },
  rightEmptySub:   { fontSize: 14, color: C.muted, textAlign: 'center', maxWidth: 300 },

  // ── Detail ──
  detail: { flex: 1 },
  detailContent: { padding: 32, paddingBottom: 60 },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  detailHeaderInfo: { flex: 1 },
  detailHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  detailName:       { fontSize: 22, fontWeight: '800', color: C.text },
  detailNationalityRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  detailNationalityIcon: { width: 16, height: 16 },
  detailNationality: { fontSize: 13, color: C.muted },

  detailHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#B2D8DB',
    backgroundColor: '#EAF4F5',
  },
  editBtnIcon: { width: 14, height: 14, tintColor: '#3D7D82' },
  editBtnText: { fontSize: 14, fontWeight: '700', color: '#3D7D82' },

  deleteBtn: {
    width: 34, height: 34, borderRadius: 8,
    borderWidth: 1, borderColor: '#FFCDD2',
    backgroundColor: '#FFF5F5',
    alignItems: 'center', justifyContent: 'center',
  },
  deleteBtnIcon: { width: 16, height: 16 },

  confirmDeleteBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFF5F5',
    borderWidth: 1, borderColor: '#FFCDD2',
    borderRadius: 10, padding: 12,
    marginBottom: 16,
  },
  confirmDeleteText: { flex: 1, fontSize: 13, color: '#C62828', fontWeight: '500' },
  confirmDeleteYes: {
    backgroundColor: '#E53935', paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 7,
  },
  confirmDeleteYesText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  confirmDeleteNo: {
    backgroundColor: C.bg, paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 7, borderWidth: 1, borderColor: C.border,
  },
  confirmDeleteNoText: { color: C.muted, fontSize: 13, fontWeight: '600' },

  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    maxWidth: 200,
  },
  actionBtnIcon: { width: 18, height: 18, flexShrink: 0 },
  actionBtnText: { fontSize: 13, fontWeight: '600', flexShrink: 1 },

  infoCard: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    ...Platform.select({ web: { boxShadow: '0 2px 8px rgba(0,0,0,0.05)' } }),
  },
  sectionTitle: {
    fontSize: 11, fontWeight: '800', color: C.light,
    letterSpacing: 0.8, marginBottom: 14,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  infoLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoLabelIcon: { width: 16, height: 16 },
  infoLabel: { fontSize: 13, color: C.muted },
  infoValue: { fontSize: 13, fontWeight: '600', color: C.text, maxWidth: '60%', textAlign: 'right' },
  infoLink:  { color: ACCENT },
  emptyText: { fontSize: 13, color: C.light, textAlign: 'center', paddingVertical: 20 },

  // ── Booking row ──
  bookingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    borderLeftWidth: 3,
    borderRadius: 6,
    marginBottom: 4,
    gap: 12,
  },
  bookingLeft:    { flex: 1 },
  bookingTopLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  bookingProp:    { flex: 1, fontSize: 13, fontWeight: '600' },
  bookingBadge:   { fontSize: 11, fontWeight: '700' },
  bookingDates:   { fontSize: 12 },
  bookingAmount:  { fontSize: 13, fontWeight: '700' },

  // ── Property row ──
  propertyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderLeftWidth: 3,
    borderRadius: 6,
    marginBottom: 6,
    gap: 12,
  },
  propertyName:  { fontSize: 13, fontWeight: '700' },
  propertySub:   { fontSize: 12, color: C.muted, marginTop: 2 },
  propertyCodeChip: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5,
  },
  propertyCodeText: { fontSize: 12, fontWeight: '700' },
  propertyArrow: { fontSize: 14, fontWeight: '600' },

  // ── Back to contact bar ──
  backToContactBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backToContactArrow: { fontSize: 20, color: ACCENT, fontWeight: '700' },
  backToContactText:  { flex: 1, fontSize: 14, fontWeight: '600', color: C.text },
});
