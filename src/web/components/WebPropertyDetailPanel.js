import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, Image, Platform, Linking,
} from 'react-native';
import dayjs from 'dayjs';
import { getContactById } from '../../services/contactsService';
import { useLanguage } from '../../context/LanguageContext';

const ICON_PHONE    = require('../../../assets/icon-contact-phone.png');
const ICON_WHATSAPP = require('../../../assets/icon-contact-whatsapp.png');
const ICON_TELEGRAM = require('../../../assets/icon-contact-telegram.png');
const ICON_EMAIL    = require('../../../assets/icon-contact-email.png');
const ICON_LOCATION = require('../../../assets/icon-property-location.png');

const ACCENT = '#D81B60';
const C = {
  bg:      '#F8F9FA',
  surface: '#FFFFFF',
  border:  '#E9ECEF',
  text:    '#1A1D23',
  muted:   '#6B7280',
  light:   '#B0B7C3',
};

const TYPE_COLOR = {
  house:           { border: '#C2920E', bg: '#FFFBEB', text: '#92680A', pill: '#FEF3C7' },
  resort:          { border: '#16A34A', bg: '#F0FDF4', text: '#15803D', pill: '#DCFCE7' },
  condo:           { border: '#2563EB', bg: '#EFF6FF', text: '#1D4ED8', pill: '#DBEAFE' },
  resort_house:    { border: '#16A34A', bg: '#F0FDF4', text: '#15803D', pill: '#DCFCE7' },
  condo_apartment: { border: '#2563EB', bg: '#EFF6FF', text: '#1D4ED8', pill: '#DBEAFE' },
};

const HOUSE_LIKE_TYPES = new Set(['house', 'resort_house', 'condo_apartment']);

function getEffectiveType(prop) {
  if (!prop) return 'house';
  // Respect explicit unit types first; fallback to parent type only for legacy records.
  if (prop.type === 'resort_house' || prop.type === 'condo_apartment') return prop.type;
  if (prop.type === 'house' && prop.parentType === 'resort') return 'resort_house';
  if (prop.type === 'house' && prop.parentType === 'condo') return 'condo_apartment';
  return prop.type || 'house';
}

function fmt(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString('ru-RU');
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export default function WebPropertyDetailPanel({ visible, property, bookings = [], onClose, user, teamMembers = [] }) {
  const { t } = useLanguage();
  const slideAnim    = useRef(new Animated.Value(500)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const mountedRef   = useRef(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [owner, setOwner] = useState(null);

  // Reset photo index and load owner when property changes
  useEffect(() => {
    setPhotoIndex(0);
    setOwner(null);
    if (property?.owner_id) {
      getContactById(property.owner_id).then(c => setOwner(c)).catch(() => {});
    }
  }, [property?.id]);

  useEffect(() => {
    if (visible) {
      mountedRef.current = true;
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 500, duration: 260, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible && !mountedRef.current) return null;

  const tc   = property ? (TYPE_COLOR[getEffectiveType(property)] || TYPE_COLOR.house) : TYPE_COLOR.house;
  const TYPE_KEY_MAP = { resort_house: 'resortHouse', condo_apartment: 'condoApartment' };
  const typeKey = TYPE_KEY_MAP[getEffectiveType(property)] ?? getEffectiveType(property);
  const code = property ? (property.code + (property.code_suffix ? ` (${property.code_suffix})` : '')) : '—';

  // Upcoming & current bookings for this property
  const today = dayjs().format('YYYY-MM-DD');
  const propBookings = (bookings || [])
    .filter(b => b.propertyId === property?.id && b.checkOut >= today)
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
    .slice(0, 5);

  return (
    <>
      {/* Backdrop — decorative dimming, not interactive */}
      <Animated.View style={[st.backdrop, { opacity: backdropAnim }]} pointerEvents="none" />

      {/* Panel — slides from RIGHT */}
      <Animated.View style={[st.panel, { transform: [{ translateX: slideAnim }] }]}>

        {/* Header */}
        <View style={[st.header, { borderBottomColor: tc.border }]}>
          <View style={[st.headerAccent, { backgroundColor: tc.border }]} />
          <View style={st.headerContent}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <View style={[st.typePill, { backgroundColor: tc.pill }]}>
                <Text style={[st.typePillText, { color: tc.text }]}>{t(typeKey)}</Text>
              </View>
              <Text style={[st.codeText, { color: tc.text }]}>{code}</Text>
            </View>
            <Text style={st.nameText} numberOfLines={2}>{property?.name || '—'}</Text>
            {property?.city ? (
              <Text style={st.cityText}>
                📍 {property.city}{property.district ? `, ${property.district}` : ''}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity style={st.closeBtn} onPress={onClose}>
            <Text style={st.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={st.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={st.scrollContent}>

          {/* Photo */}
          {property?.photos?.length > 0 ? (() => {
            const photos = property.photos;
            const total  = photos.length;
            const idx    = Math.min(photoIndex, total - 1);
            return (
              <View style={st.photoWrap}>
                <Image source={{ uri: photos[idx] }} style={st.photo} resizeMode="cover" />

                {/* Arrows — only if more than 1 photo */}
                {total > 1 && (
                  <>
                    <TouchableOpacity
                      style={[st.photoArrow, st.photoArrowLeft]}
                      onPress={() => setPhotoIndex(i => (i - 1 + total) % total)}
                      activeOpacity={0.8}
                    >
                      <Text style={st.photoArrowText}>‹</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[st.photoArrow, st.photoArrowRight]}
                      onPress={() => setPhotoIndex(i => (i + 1) % total)}
                      activeOpacity={0.8}
                    >
                      <Text style={st.photoArrowText}>›</Text>
                    </TouchableOpacity>

                    {/* Dots */}
                    <View style={st.photoDots}>
                      {photos.map((_, i) => (
                        <TouchableOpacity key={i} onPress={() => setPhotoIndex(i)}>
                          <View style={[st.photoDot, i === idx && st.photoDotActive]} />
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Counter */}
                    <View style={st.photoCount}>
                      <Text style={st.photoCountText}>{idx + 1} / {total}</Text>
                    </View>
                  </>
                )}
              </View>
            );
          })() : (
            <View style={[st.photoPlaceholder, { backgroundColor: tc.bg }]}>
              <Text style={{ fontSize: 36 }}>🏠</Text>
              <Text style={[st.photoPlaceholderText, { color: tc.text }]}>Фото не добавлены</Text>
            </View>
          )}

          {/* Stats */}
          {(property?.bedrooms != null || property?.bathrooms != null || property?.area != null || property?.price_monthly != null) && (
            <View style={st.statsRow}>
              {property.bedrooms != null && (
                <View style={st.statCard}>
                  <Text style={st.statValue}>{property.bedrooms}</Text>
                  <Text style={st.statLabel}>Спален</Text>
                </View>
              )}
              {property.bathrooms != null && (
                <View style={st.statCard}>
                  <Text style={st.statValue}>{property.bathrooms}</Text>
                  <Text style={st.statLabel}>Санузлов</Text>
                </View>
              )}
              {property.area != null && (
                <View style={st.statCard}>
                  <Text style={st.statValue}>{property.area}</Text>
                  <Text style={st.statLabel}>м²</Text>
                </View>
              )}
              {property.price_monthly != null && (
                <View style={[st.statCard, st.statCardAccent]}>
                  <Text style={[st.statValue, { color: ACCENT }]}>
                    {property.price_monthly_is_from ? 'от ' : ''}{fmt(property.price_monthly)}
                  </Text>
                  <Text style={[st.statLabel, { color: ACCENT }]}>฿/мес</Text>
                </View>
              )}
            </View>
          )}

          {/* Ответственный за объект — только админ компании с командой.
              У одиночки без приглашённых агентов карточка не имеет смысла. */}
          {!user?.teamMembership && property && (teamMembers || []).length > 0 ? (() => {
            const ra = property.responsible_agent_id ?? null;
            let name;
            if (!ra) {
              name = user?.companyInfo?.name || 'Company';
            } else {
              const m = teamMembers.find(x => (x.user_id ?? x.id) === ra);
              name = m ? ([m.name, m.last_name].filter(Boolean).join(' ') || m.email) : '—';
            }
            return (
              <View style={st.card}>
                <Text style={st.cardTitle}>ОТВЕТСТВЕННЫЙ ЗА ОБЪЕКТ</Text>
                <View style={st.cardBody}>
                  <Text style={st.ownerName}>{name}</Text>
                </View>
              </View>
            );
          })() : null}

          {/* Owner */}
          {owner && (
            <View style={st.card}>
              <Text style={st.cardTitle}>СОБСТВЕННИК</Text>
              <View style={st.cardBody}>
                <View style={st.ownerRow}>
                  <View style={st.ownerAvatar}>
                    <Text style={st.ownerAvatarText}>
                      {(owner.name || owner.lastName || '?')[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.ownerName}>
                      {[owner.name, owner.lastName].filter(Boolean).join(' ') || '—'}
                    </Text>
                    {owner.phone ? (
                      <Text style={st.ownerContact}>{owner.phone}</Text>
                    ) : null}
                  </View>
                  {/* Contact icons on the right */}
                  <View style={st.ownerIcons}>
                    {owner.phone ? (
                      <TouchableOpacity onPress={() => Linking.openURL(`https://wa.me/${owner.phone.replace(/\D/g, '')}`)} activeOpacity={0.7}>
                        <Image source={ICON_WHATSAPP} style={st.ownerIcon} resizeMode="contain" />
                      </TouchableOpacity>
                    ) : null}
                    {owner.telegram ? (
                      <TouchableOpacity onPress={() => Linking.openURL(`https://t.me/${owner.telegram.replace('@', '')}`)} activeOpacity={0.7}>
                        <Image source={ICON_TELEGRAM} style={st.ownerIcon} resizeMode="contain" />
                      </TouchableOpacity>
                    ) : null}
                    {owner.phone ? (
                      <TouchableOpacity onPress={() => Linking.openURL(`tel:${owner.phone}`)} activeOpacity={0.7}>
                        <Image source={ICON_PHONE} style={st.ownerIcon} resizeMode="contain" />
                      </TouchableOpacity>
                    ) : null}
                    {owner.email ? (
                      <TouchableOpacity onPress={() => Linking.openURL(`mailto:${owner.email}`)} activeOpacity={0.7}>
                        <Image source={ICON_EMAIL} style={st.ownerIcon} resizeMode="contain" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Location link — hidden for team members */}
          {property?.google_maps_link && !(user?.id && property?.user_id && user.id !== property.user_id && user.workAs !== 'company') ? (
            <TouchableOpacity
              style={st.locationBtn}
              onPress={() => Linking.openURL(property.google_maps_link)}
              activeOpacity={0.8}
            >
              <Image source={ICON_LOCATION} style={st.locationIcon} resizeMode="contain" />
              <Text style={st.locationBtnText}>Открыть на карте</Text>
              <Text style={st.locationBtnArrow}>→</Text>
            </TouchableOpacity>
          ) : null}

          {/* Deposits & commission */}
          {(property?.booking_deposit != null || property?.save_deposit != null || property?.commission != null) && (
            <View style={st.card}>
              <Text style={st.cardTitle}>Финансы</Text>
              <View style={st.cardBody}>
                {property.booking_deposit != null && (
                  <View style={st.infoRow}>
                    <Text style={st.infoLabel}>Депозит брони</Text>
                    <Text style={st.infoValue}>฿ {fmt(property.booking_deposit)}</Text>
                  </View>
                )}
                {property.save_deposit != null && (
                  <View style={st.infoRow}>
                    <Text style={st.infoLabel}>Сохранный депозит</Text>
                    <Text style={st.infoValue}>฿ {fmt(property.save_deposit)}</Text>
                  </View>
                )}
                {property.commission != null && (
                  <View style={st.infoRow}>
                    <Text style={st.infoLabel}>Комиссия агента</Text>
                    <Text style={st.infoValue}>฿ {fmt(property.commission)}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Upcoming bookings */}
          <View style={st.card}>
            <Text style={st.cardTitle}>Бронирования</Text>
            {propBookings.length === 0 ? (
              <View style={st.cardBody}>
                <Text style={st.emptyText}>Нет активных и предстоящих бронирований</Text>
              </View>
            ) : (
              <View style={st.cardBody}>
                {propBookings.map((b, i) => {
                  const isActive = b.checkIn <= today && b.checkOut >= today;
                  const nights   = dayjs(b.checkOut).diff(dayjs(b.checkIn), 'day');
                  return (
                    <View key={b.id} style={[st.bookingRow, i < propBookings.length - 1 && st.bookingRowBorder]}>
                      <View style={[st.bookingDot, { backgroundColor: isActive ? '#16A34A' : ACCENT }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={st.bookingDates}>
                          {dayjs(b.checkIn).format('DD MMM')} — {dayjs(b.checkOut).format('DD MMM YYYY')}
                        </Text>
                        <Text style={st.bookingMeta}>
                          {nights} {nights === 1 ? 'ночь' : nights < 5 ? 'ночи' : 'ночей'}
                          {b.totalPrice ? `  ·  ฿ ${fmt(b.totalPrice)}` : ''}
                        </Text>
                      </View>
                      {isActive && (
                        <View style={st.activeBadge}>
                          <Text style={st.activeBadgeText}>Сейчас</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Description */}
          {property?.description ? (
            <View style={st.card}>
              <Text style={st.cardTitle}>Описание</Text>
              <View style={st.cardBody}>
                <Text style={st.descText}>{property.description}</Text>
              </View>
            </View>
          ) : null}

          <View style={{ height: 16 }} />
        </ScrollView>
      </Animated.View>
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 300,
  },
  panel: {
    position: 'absolute', top: 0, right: 0, bottom: 0,
    width: 420, zIndex: 301,
    backgroundColor: C.bg, flexDirection: 'column',
    ...Platform.select({ web: { boxShadow: '-6px 0 32px rgba(0,0,0,0.14)' } }),
  },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: C.surface,
    borderBottomWidth: 1, paddingRight: 12,
  },
  headerAccent:  { width: 4, alignSelf: 'stretch' },
  headerContent: { flex: 1, padding: 14 },
  nameText:      { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 4 },
  codeText:      { fontSize: 13, fontWeight: '700' },
  cityText:      { fontSize: 12, color: C.muted, marginTop: 2 },
  typePill:      { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  typePillText:  { fontSize: 11, fontWeight: '700' },
  closeBtn:      { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginTop: 10, borderRadius: 8, backgroundColor: C.bg },
  closeBtnText:  { fontSize: 14, color: C.muted },

  // Scroll
  scroll:        { flex: 1 },
  scrollContent: { padding: 14, gap: 12 },

  // Photo
  photoWrap:        { borderRadius: 12, overflow: 'hidden', height: 200, position: 'relative' },
  photo:            { width: '100%', height: '100%' },

  photoArrow: {
    position: 'absolute', top: '50%', marginTop: -20,
    width: 36, height: 40,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 8,
  },
  photoArrowLeft:  { left: 8 },
  photoArrowRight: { right: 8 },
  photoArrowText:  { color: '#FFF', fontSize: 28, lineHeight: 34, fontWeight: '300' },

  photoDots: {
    position: 'absolute', bottom: 10, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 5,
  },
  photoDot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  photoDotActive: { backgroundColor: '#FFF', width: 18, borderRadius: 3 },

  photoCount:       { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  photoCountText:   { color: '#FFF', fontSize: 12, fontWeight: '600' },

  photoPlaceholder:    { height: 120, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 6 },
  photoPlaceholderText:{ fontSize: 12, fontWeight: '600' },

  // Stats
  statsRow:      { flexDirection: 'row', gap: 8 },
  statCard:      { flex: 1, backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 10, alignItems: 'center' },
  statCardAccent:{ borderColor: '#FECDD3', backgroundColor: '#FFF1F2' },
  statValue:     { fontSize: 18, fontWeight: '700', color: C.text },
  statLabel:     { fontSize: 11, color: C.muted, marginTop: 2 },

  // Card
  card:      { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  cardTitle: { fontSize: 12, fontWeight: '700', color: C.muted, letterSpacing: 0.4, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.bg },
  cardBody:  { padding: 14, gap: 8 },

  // Info rows
  infoRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { fontSize: 13, color: C.muted },
  infoValue: { fontSize: 13, fontWeight: '600', color: C.text },

  // Bookings
  bookingRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  bookingRowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  bookingDot:       { width: 8, height: 8, borderRadius: 4 },
  bookingDates:     { fontSize: 13, fontWeight: '600', color: C.text },
  bookingMeta:      { fontSize: 12, color: C.muted, marginTop: 1 },
  activeBadge:      { backgroundColor: '#DCFCE7', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  activeBadgeText:  { fontSize: 11, fontWeight: '700', color: '#16A34A' },
  emptyText:        { fontSize: 13, color: C.light, textAlign: 'center', paddingVertical: 8 },

  // Description
  descText: { fontSize: 13, color: C.text, lineHeight: 20 },

  // Owner
  ownerRow:        { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ownerAvatar:     { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FCE4EC', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  ownerAvatarText: { fontSize: 18, fontWeight: '700', color: ACCENT },
  ownerName:       { fontSize: 14, fontWeight: '700', color: C.text },
  ownerContact:    { fontSize: 12, color: C.muted, marginTop: 2 },
  ownerIcons:      { flexDirection: 'row', alignItems: 'center', gap: 16 },
  ownerIcon:       { width: 21, height: 21 },

  // Location
  locationBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.surface, borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  locationIcon:     { width: 18, height: 18, opacity: 0.7 },
  locationBtnText:  { flex: 1, fontSize: 13, fontWeight: '600', color: '#1D4ED8' },
  locationBtnArrow: { fontSize: 14, color: C.muted },
});
