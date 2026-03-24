import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabase';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, FlatList, Image, Linking, Modal,
} from 'react-native';
import dayjs from 'dayjs';
import { useLanguage } from '../../context/LanguageContext';
import { getCurrencySymbol } from '../../utils/currency';

const ICON_BEDROOM  = require('../../../assets/icon-stat-bedroom.png');
const ICON_BATHROOM = require('../../../assets/icon-stat-bathroom.png');
const ICON_AREA     = require('../../../assets/icon-stat-area.png');
const ICON_TYPE_HOUSE  = require('../../../assets/icon-type-house.png');
const ICON_TYPE_RESORT = require('../../../assets/icon-type-resort.png');
const ICON_TYPE_CONDO  = require('../../../assets/icon-type-condo.png');
const ICON_PENCIL      = require('../../../assets/icon-type-pencil.png');
const ICON_LOCATION      = require('../../../assets/icon-property-location.png');
const ICON_CODE          = require('../../../assets/icon-property-code.png');
const ICON_SEC_LOCATION  = require('../../../assets/icon-section-location.png');

const AMENITY_ICONS = {
  swimming_pool:   require('../../../assets/icon-amenity-swimming_pool.png'),
  gym:             require('../../../assets/icon-amenity-gym.png'),
  parking:         require('../../../assets/icon-amenity-parking.png'),
  internet:        require('../../../assets/icon-amenity-internet.png'),
  tv:              require('../../../assets/icon-amenity-tv.png'),
  washing_machine: require('../../../assets/icon-amenity-washing_machine.png'),
  dishwasher:      require('../../../assets/icon-amenity-dishwasher.png'),
  fridge:          require('../../../assets/icon-amenity-fridge.png'),
  stove:           require('../../../assets/icon-amenity-stove.png'),
  oven:            require('../../../assets/icon-amenity-oven.png'),
  hood:            require('../../../assets/icon-amenity-hood.png'),
  microwave:       require('../../../assets/icon-amenity-microwave.png'),
  kettle:          require('../../../assets/icon-amenity-kettle.png'),
  toaster:         require('../../../assets/icon-amenity-toaster.png'),
  coffee_machine:  require('../../../assets/icon-amenity-coffee_machine.png'),
  multi_cooker:    require('../../../assets/icon-amenity-multi_cooker.png'),
  blender:         require('../../../assets/icon-amenity-blender.png'),
};

import { getProperties, createProperty, deleteProperty, approveProperty, rejectProperty, updatePropertyResponsible, getPropertyDraft } from '../../services/propertiesService';
import { getActiveTeamMembers } from '../../services/companyService';
import WebPropertyEditPanel from '../components/WebPropertyEditPanel';
import { getContacts } from '../../services/contactsService';
import { getBookings } from '../../services/bookingsService';
import { sendNotification } from '../../services/notificationsService';

// ─── Constants ──────────────────────────────────────────────────────────────

const ACCENT  = '#3D7D82';
const TEAL_BG   = '#EAF4F5';
const TEAL_LIGHT = '#B2D8DB';
const C = {
  bg: '#F4F6F9',
  surface: '#FFFFFF',
  border: '#E9ECEF',
  text: '#212529',
  muted: '#6C757D',
  light: '#ADB5BD',
  // Нижний ряд (Блоки)
  in:       '#A8D5BA', // Мятный
  inText:   '#4A7D62', // Темно-мятный
  out:      '#F3B0A1', // Коралловый
  outText:  '#A65E4E', // Темно-коралловый
  ev:       '#A9C7EB', // Небесный
  evText:   '#4E75A6', // Темно-небесный
  
  // Верхний ряд (Статистика)
  stat1:    '#F9E2AF', // Песочный
  stat1Text:'#8D7A4E', // Темно-песочный
  stat2:    '#E2C2D6', // Пыльная сирень
  stat2Text:'#8D5E7A', // Темно-сиреневый
  stat3:    '#B2E2E2', // Аквамарин
  stat3Text:'#4E8D8D', // Темно-аквамариновый

  house:      '#C2920E',
  houseBg:    '#FFFDE7',
  houseStripe:'#F5D06A',
  resort:     '#4AA87D',
  resortBg:   '#F0FAF5',
  resortStripe:'#82C9A5',
  condo:      '#5B82D6',
  condoBg:    '#F0F5FD',
  condoStripe:'#93B4F0',
  accent: ACCENT,
  accentBg: TEAL_BG,
};

// TYPE_META and AMENITY_LABELS are built via getTypeMeta(t) / getAmenityLabels(t) functions
// to support i18n. Static fallback kept for non-translated contexts.
function getTypeMeta(t) {
  return {
    house:  { label: t('house'),  color: C.house,  bg: C.houseBg,  stripe: C.houseStripe,  icon: '🏠', img: ICON_TYPE_HOUSE  },
    resort: { label: t('resort'), color: C.resort, bg: C.resortBg, stripe: C.resortStripe, icon: '🏨', img: ICON_TYPE_RESORT },
    condo:  { label: t('condo'),  color: C.condo,  bg: C.condoBg,  stripe: C.condoStripe,  icon: '🏢', img: ICON_TYPE_CONDO  },
  };
}

function getAmenityLabels(t) {
  return {
    swimming_pool: t('amenity_swimming_pool'), gym: t('amenity_gym'), parking: t('amenity_parking'),
    internet: t('amenity_internet'), tv: t('amenity_tv'), washing_machine: t('amenity_washing_machine'),
    dishwasher: t('amenity_dishwasher'), fridge: t('amenity_fridge'), stove: t('amenity_stove'),
    oven: t('amenity_oven'), hood: t('amenity_hood'), microwave: t('amenity_microwave'),
    kettle: t('amenity_kettle'), toaster: t('amenity_toaster'), coffee_machine: t('amenity_coffee_machine'),
    multi_cooker: t('amenity_multi_cooker'), blender: t('amenity_blender'),
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(val, suffix = ' ฿') {
  if (val == null) return null;
  return `${Number(val).toLocaleString('ru-RU')}${suffix}`;
}

function isOccupiedNow(bookings, propertyId) {
  const today = dayjs().format('YYYY-MM-DD');
  return bookings.some(b =>
    b.propertyId === propertyId &&
    !b.notMyCustomer &&
    b.checkIn <= today && b.checkOut > today
  );
}

function getActiveBooking(bookings, propertyId) {
  const today = dayjs().format('YYYY-MM-DD');
  return bookings.find(b =>
    b.propertyId === propertyId &&
    !b.notMyCustomer &&
    b.checkIn <= today && b.checkOut > today
  ) || null;
}

// ─── Small shared components ─────────────────────────────────────────────────

function TypeBadge({ type, small }) {
  const { t } = useLanguage();
  const TYPE_META = getTypeMeta(t);
  const m = TYPE_META[type];
  if (!m) return null;
  return (
    <View style={[s.typeBadge, { backgroundColor: m.bg, borderColor: m.stripe }, small && s.typeBadgeSmall]}>
      {m.img && (
        <Image
          source={m.img}
          style={small ? s.typeBadgeImgSmall : s.typeBadgeImg}
          resizeMode="contain"
        />
      )}
      <Text style={[s.typeBadgeText, { color: m.color }, small && s.typeBadgeTextSmall]}>
        {m.label}
      </Text>
    </View>
  );
}

function SectionBlock({ title, icon, children, action }) {
  return (
    <View style={s.sectionBlock}>
      <View style={s.sectionTitleRow}>
        {icon
          ? <View style={s.sectionTitleInner}>
              <Image source={icon} style={s.sectionTitleIcon} resizeMode="contain" />
              <Text style={s.sectionTitle}>{title}</Text>
            </View>
          : <Text style={s.sectionTitle}>{title}</Text>
        }
        {action}
      </View>
      <View style={s.sectionContent}>{children}</View>
    </View>
  );
}

function InfoRow({ label, value, highlight }) {
  if (value == null || value === '') return null;
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={[s.infoValue, highlight && s.infoValueHighlight]}>{value}</Text>
    </View>
  );
}

// ─── Property List Card ───────────────────────────────────────────────────────

function PropertyCard({ item, isSelected, onPress, occupied, parentName }) {
  const { t } = useLanguage();
  const TYPE_META = getTypeMeta(t);
  const meta = TYPE_META[item.type] || TYPE_META.house;
  const hasPhoto = item.photos?.length > 0;
  const code = item.code + (item.code_suffix ? `-${item.code_suffix}` : '');

  return (
    <TouchableOpacity
      style={[s.card, isSelected && s.cardSelected]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Цветная полоска по типу */}
      <View style={[s.cardStripe, { backgroundColor: isSelected ? ACCENT : meta.stripe }]} />

      {/* Thumbnail */}
      <View style={s.cardThumbWrap}>
        {hasPhoto ? (
          <Image source={{ uri: item.photos[0] }} style={s.cardThumb} resizeMode="cover" />
        ) : (
          <View style={[s.cardThumbPlaceholder, { backgroundColor: meta.bg }]}>
            {meta.img
              ? <Image source={meta.img} style={s.cardThumbImg} resizeMode="contain" />
              : <Text style={s.cardThumbIcon}>{meta.icon}</Text>}
          </View>
        )}
        {occupied && <View style={s.occupiedDot} />}
      </View>

      {/* Body */}
      <View style={s.cardBody}>
        <View style={s.cardTopRow}>
          <Text style={[s.cardName, isSelected && s.cardNameSelected]} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={[s.codePill, isSelected && s.codePillSelected]}>
            <Text style={[s.codePillText, isSelected && s.codePillTextSelected]}>{code}</Text>
          </View>
        </View>

        <View style={s.cardMidRow}>
          <TypeBadge type={item.type} small />
          {item.city ? <Text style={s.cardMeta}>{item.city}</Text> : null}
          {item.bedrooms ? <Text style={s.cardMeta}>· {item.bedrooms} 🛏</Text> : null}
          {item.area ? <Text style={s.cardMeta}>· {item.area} м²</Text> : null}
        </View>

        {parentName ? (
          <Text style={s.cardParent} numberOfLines={1}>↳ {parentName}</Text>
        ) : null}

        {item.price_monthly ? (
          <Text style={[s.cardPrice, isSelected && s.cardPriceSelected]}>
            {item.price_monthly_is_from ? `${t('propFrom')} ` : ''}{fmt(item.price_monthly)} {getCurrencySymbol(item.currency || 'THB')}/{t('perMonth')}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// ─── Property Detail ──────────────────────────────────────────────────────────

export function PropertyDetail({ property, contacts, allProperties, bookings, previousProperty, onChildPress, onBack, onScrollY, initialScrollY, onEdit, onAddUnit, user, onApprove, onReject }) {
  const { t } = useLanguage();
  const TYPE_META = getTypeMeta(t);
  const AMENITY_LABELS = getAmenityLabels(t);
  const psym = getCurrencySymbol(property.currency || 'THB');
  // Участник команды: видит чужой объект и сам не является владельцем компании
  const isTeamMember = !!(user?.id && property.agent_id && user.id !== property.agent_id && user.workAs !== 'company');
  const isAdmin = !isTeamMember;
  const isCompanyAdmin = !!(user?.workAs === 'company' && user?.companyId);

  // Разрешения агента
  const isAgent = !!user?.teamMembership;
  const canEditInfo = !isAgent || user?.teamPermissions?.can_edit_info;
  const canEditPrices = !isAgent || user?.teamPermissions?.can_edit_prices;
  const canSeeFinancials = !isAgent || user?.teamPermissions?.can_see_financials;
  const canAddUnit = !isAgent || user?.teamPermissions?.can_add_property;

  const [teamMembers, setTeamMembers] = useState([]);
  const [currentResponsible, setCurrentResponsible] = useState(property.responsible_agent_id ?? null);
  const [responsiblePickerVisible, setResponsiblePickerVisible] = useState(false);
  const [pendingDraft, setPendingDraft] = useState(null);

  React.useEffect(() => {
    setCurrentResponsible(property.responsible_agent_id ?? null);
  }, [property.id, property.responsible_agent_id]);

  React.useEffect(() => {
    if (!isCompanyAdmin || !user?.companyId) return;
    getActiveTeamMembers(user.companyId).then(setTeamMembers).catch(() => {});
  }, [isCompanyAdmin, user?.companyId]);

  // Загружаем pending черновик агента для этого объекта
  React.useEffect(() => {
    if (!isAgent || !property?.id) { setPendingDraft(null); return; }
    getPropertyDraft(property.id).then(setPendingDraft).catch(() => {});
  }, [property?.id, isAgent]);

  const isSubmitted = property.property_status === 'pending';
  const isRejected = property.property_status === 'rejected';

  const owner1 = contacts.find(c => c.id === property.owner_id);
  const owner2 = contacts.find(c => c.id === property.owner_id_2);
  const parent = allProperties.find(p => p.id === property.resort_id);
  const children = allProperties.filter(p => p.resort_id === property.id);
  const occupied = isOccupiedNow(bookings, property.id);
  const code = property.code + (property.code_suffix ? `-${property.code_suffix}` : '');
  const effectiveType = property.resort_id && parent ? parent.type : property.type;
  const meta = TYPE_META[effectiveType] || TYPE_META.house;
  const hasAmenities = property.amenities && Object.values(property.amenities).some(Boolean);
  const scrollRef = React.useRef(null);

  // Сброс/восстановление позиции скролла при смене объекта
  React.useEffect(() => {
    const y = initialScrollY || 0;
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y, animated: false });
    }, 0);
    return () => clearTimeout(timer);
  }, [property.id]);

  return (
    <View style={s.detail}>
      {/* ── Back navigation bar ── */}
      {previousProperty && (
        <TouchableOpacity style={s.backBar} onPress={onBack} activeOpacity={0.75}>
          <Text style={s.backArrow}>←</Text>
          <View style={[s.backParentIcon, { backgroundColor: (TYPE_META[previousProperty.type]?.bg || C.bg) }]}>
            {TYPE_META[previousProperty.type]?.img
              ? <Image source={TYPE_META[previousProperty.type].img} style={s.backParentImg} resizeMode="contain" />
              : <Text style={{ fontSize: 14 }}>{TYPE_META[previousProperty.type]?.icon}</Text>}
          </View>
          <Text style={s.backText}>
            <Text style={s.backLabel}>{t('back')}: </Text>
            {previousProperty.name}
          </Text>
        </TouchableOpacity>
      )}

    <ScrollView
      ref={scrollRef}
      style={{ flex: 1 }}
      showsVerticalScrollIndicator={false}
      onScroll={e => onScrollY && onScrollY(e.nativeEvent.contentOffset.y)}
      scrollEventThrottle={16}
    >

      {/* ── Hero / Photos ── */}
      <View style={s.galleryWrap}>
        {property.photos?.length > 0 ? (
          property.photos.length === 1 ? (
            <View style={s.gallerySingle}>
              <Image source={{ uri: property.photos[0] }} style={s.gallerySinglePhoto} resizeMode="cover" />
            </View>
          ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.gallery} contentContainerStyle={s.galleryContent}>
            {property.photos.map((uri, i) => (
              <Image key={i} source={{ uri }} style={s.galleryPhoto} resizeMode="cover" />
            ))}
          </ScrollView>
          )
        ) : (
          <View style={[s.galleryPlaceholder, { backgroundColor: meta.bg }]}>
            {meta.img
              ? <Image source={meta.img} style={s.galleryPlaceholderImg} resizeMode="contain" />
              : <Text style={s.galleryPlaceholderIcon}>{meta.icon}</Text>}
            <Text style={[s.galleryPlaceholderText, { color: meta.color }]}>Фото не добавлены</Text>
          </View>
        )}
      </View>

      {/* Ответственный — только для Admin компании */}
      {isCompanyAdmin && (
        <>
          <TouchableOpacity
            style={s.responsibleRow}
            onPress={() => setResponsiblePickerVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={s.responsibleLabel}>Ответственный:</Text>
            <Text style={s.responsibleValue}>
              {!currentResponsible
                ? 'Компания'
                : currentResponsible === user?.id
                  ? ([user?.name, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Я')
                  : (() => {
                      const m = teamMembers.find(tm => tm.agent_id === currentResponsible);
                      return m ? ([m.name, m.last_name].filter(Boolean).join(' ') || m.email) : 'Компания';
                    })()}
            </Text>
            <Text style={s.responsibleChevron}>✎</Text>
          </TouchableOpacity>

          <Modal
            visible={responsiblePickerVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setResponsiblePickerVisible(false)}
          >
            <TouchableOpacity style={s.pickerOverlay} activeOpacity={1} onPress={() => setResponsiblePickerVisible(false)}>
              <View style={s.pickerSheet}>
                <Text style={s.pickerTitle}>Ответственный</Text>
                <TouchableOpacity
                  style={[s.pickerItem, !currentResponsible && s.pickerItemActive]}
                  onPress={async () => {
                    await updatePropertyResponsible(property.id, null, (property.type === 'resort' || property.type === 'condo'));
                    setCurrentResponsible(null);
                    setResponsiblePickerVisible(false);
                  }}
                >
                  <Text style={[s.pickerItemText, !currentResponsible && s.pickerItemTextActive]}>Компания</Text>
                </TouchableOpacity>
                {teamMembers.filter(m => m.role !== 'owner').map(m => {
                  const name = [m.name, m.last_name].filter(Boolean).join(' ') || m.email;
                  const isSelected = currentResponsible === m.agent_id;
                  return (
                    <TouchableOpacity
                      key={m.agent_id}
                      style={[s.pickerItem, isSelected && s.pickerItemActive]}
                      onPress={async () => {
                        await updatePropertyResponsible(property.id, m.agent_id, (property.type === 'resort' || property.type === 'condo'));
                        setCurrentResponsible(m.agent_id);
                        setResponsiblePickerVisible(false);
                      }}
                    >
                      <Text style={[s.pickerItemText, isSelected && s.pickerItemTextActive]}>{name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </TouchableOpacity>
          </Modal>
        </>
      )}

      <View style={s.detailPadding}>

        {/* ── Header ── */}
        <View style={s.detailHeader}>
          <View style={{ flex: 1 }}>
            <View style={s.detailTitleRow}>
              <Text style={s.detailTitle}>{property.name}</Text>
              {occupied && (
                <View style={s.occupiedBadge}>
                  <Text style={s.occupiedBadgeText}>● {t('propOccupied')}</Text>
                </View>
              )}
            </View>
            <View style={s.detailSubRow}>
              <View style={s.detailCodeBadge}>
                <Image source={ICON_CODE} style={s.detailCodeIcon} resizeMode="contain" />
                <Text style={s.detailCodeText}>{code}</Text>
              </View>
              {property.city ? (
                <View style={s.detailCityRow}>
                  <Image source={ICON_LOCATION} style={s.detailCityIcon} resizeMode="contain" />
                  <Text style={s.detailCity}>{property.city}{property.district ? `, ${property.district}` : ''}</Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={s.detailActions}>
            {isSubmitted && isTeamMember && (
              <View style={s.statusBadgePending}>
                <Text style={s.statusBadgePendingText}>⏳ {t('propSubmitted') || 'На проверке'}</Text>
              </View>
            )}
            {isRejected && (
              <View style={s.statusBadgeRejected}>
                <Text style={s.statusBadgeRejectedText}>❌ {t('propRejected') || 'Отклонено'}</Text>
              </View>
            )}
            {!isSubmitted && (
              <TouchableOpacity style={s.detailEditBtn} onPress={onEdit}>
                <Image source={ICON_PENCIL} style={s.detailEditBtnIcon} resizeMode="contain" />
                <Text style={s.detailEditBtnText}>{t('edit')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Key Stats ── */}
        {(property.bedrooms != null || property.bathrooms != null || property.area != null || property.price_monthly != null || property.air_conditioners != null) && (
          <View style={s.statsRow}>
            {property.bedrooms != null && (
              <View style={[s.statCard, { borderLeftColor: C.in }]}>
                <Text style={s.statValue}>{property.bedrooms}</Text>
                <Text style={s.statLabel}>{t('propBedrooms2')}</Text>
              </View>
            )}
            {property.bathrooms != null && (
              <View style={[s.statCard, { borderLeftColor: C.ev }]}>
                <Text style={s.statValue}>{property.bathrooms}</Text>
                <Text style={s.statLabel}>{t('propBathrooms')}</Text>
              </View>
            )}
            {property.air_conditioners != null && (
              <View style={[s.statCard, { borderLeftColor: C.stat1 }]}>
                <Text style={s.statValue}>{property.air_conditioners}</Text>
                <Text style={s.statLabel}>{t('propAirCon')}</Text>
              </View>
            )}
            {property.area != null && (
              <View style={[s.statCard, { borderLeftColor: C.muted }]}>
                <Text style={s.statValue}>{property.area}</Text>
                <Text style={s.statLabel}>{t('propSqm')}</Text>
              </View>
            )}
            {property.price_monthly != null && (
              <View style={[s.statCard, s.statCardAccent]}>
                <Text style={[s.statValue, { color: ACCENT }]}>
                  {property.price_monthly_is_from ? `${t('propFrom')} ` : ''}{Number(property.price_monthly).toLocaleString()} {getCurrencySymbol(property.currency || 'THB')}
                </Text>
                <Text style={[s.statLabel, { color: ACCENT }]}>{t('perMonth')}</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Admin: Approve / Reject submitted property ── */}
        {isAdmin && isSubmitted && (
          <View style={s.approvalBlock}>
            <Text style={s.approvalTitle}>⏳ {t('propAwaitingApproval') || 'Объект ожидает проверки'}</Text>
            <Text style={s.approvalSubtitle}>{t('propApprovalHint') || 'Проверьте данные и примите решение'}</Text>
            <View style={s.approvalActions}>
              <TouchableOpacity style={s.approveBtn} onPress={onApprove}>
                <Text style={s.approveBtnText}>✓ {t('propApprove') || 'Принять'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.rejectBtn} onPress={onReject}>
                <Text style={s.rejectBtnText}>✗ {t('propReject') || 'Отклонить'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {isRejected && property.rejection_reason ? (
          <View style={s.rejectedBlock}>
            <Text style={s.rejectedLabel}>{t('propRejectionReason') || 'Причина отклонения:'}</Text>
            <Text style={s.rejectedReason}>{property.rejection_reason}</Text>
          </View>
        ) : null}

        {/* Баннер для агента: изменения отправлены на проверку */}
        {pendingDraft && (
          <View style={s.draftBanner}>
            <Text style={s.draftBannerIcon}>⏳</Text>
            <Text style={s.draftBannerText}>
              Изменения отправлены на проверку администратору
            </Text>
          </View>
        )}

        {/* ── Location ── */}
        {(property.city || property.beach_distance || property.market_distance || property.google_maps_link || property.website_url) && (
          <SectionBlock title={t('pdLocation').toUpperCase()} icon={ICON_SEC_LOCATION}>
            <InfoRow label={t('pdCity')} value={property.city} />
            <InfoRow label={t('propDistrict')} value={property.district} />
            <InfoRow label={t('propBeach')} value={property.beach_distance ? `${property.beach_distance} м` : null} />
            <InfoRow label={t('propMarket')} value={property.market_distance ? `${property.market_distance} м` : null} />
            {property.google_maps_link ? (
              <TouchableOpacity onPress={() => Linking.openURL(property.google_maps_link)} style={s.linkBtn}>
                <Text style={s.linkBtnText}>🗺️ {t('openGoogleMaps')}</Text>
              </TouchableOpacity>
            ) : null}
            {property.website_url ? (
              <TouchableOpacity onPress={() => Linking.openURL(property.website_url)} style={s.linkBtn}>
                <Text style={s.linkBtnText}>🌐 {t('openWebsite')}</Text>
              </TouchableOpacity>
            ) : null}
          </SectionBlock>
        )}

        {/* ── Pricing ── */}
        {(property.price_monthly != null || property.booking_deposit != null || property.save_deposit != null) && (
          <SectionBlock title={t('propRentalDeposits')}>
            <InfoRow
              label={t('pdPriceMonthly')}
              value={property.price_monthly != null ? `${property.price_monthly_is_from ? `${t('propFrom')} ` : ''}${Number(property.price_monthly).toLocaleString()} ${psym}` : null}
              highlight
            />
            <InfoRow
              label={t('pdBookingDeposit')}
              value={property.booking_deposit != null ? `${property.booking_deposit_is_from ? `${t('propFrom')} ` : ''}${Number(property.booking_deposit).toLocaleString()} ${psym}` : null}
            />
            <InfoRow
              label={t('pdSaveDeposit')}
              value={property.save_deposit != null ? `${property.save_deposit_is_from ? `${t('propFrom')} ` : ''}${Number(property.save_deposit).toLocaleString()} ${psym}` : null}
            />
          </SectionBlock>
        )}

        {/* ── Commissions ── */}
        {canSeeFinancials && (property.commission != null || property.owner_commission_one_time != null || property.owner_commission_monthly != null) && (
          <SectionBlock title={t('propCommissionSection')}>
            {property.commission != null && (
              <InfoRow
                label={t('pdCommission')}
                value={`${property.commission_is_from ? `${t('propFrom')} ` : ''}${Number(property.commission).toLocaleString()} ${psym}`}
              />
            )}
            {property.owner_commission_one_time != null && (
              <InfoRow
                label={t('pdOwnerCommOnce')}
                value={
                  property.owner_commission_one_time_is_percent
                    ? `${Number(property.owner_commission_one_time).toLocaleString()}%`
                    : `${Number(property.owner_commission_one_time).toLocaleString()} ${psym}`
                }
              />
            )}
            {property.owner_commission_monthly != null && (
              <InfoRow
                label={t('pdOwnerCommMonthly')}
                value={
                  property.owner_commission_monthly_is_percent
                    ? `${Number(property.owner_commission_monthly).toLocaleString()}%`
                    : `${Number(property.owner_commission_monthly).toLocaleString()} ${psym}`
                }
              />
            )}
          </SectionBlock>
        )}

        {/* ── Utilities ── */}
        {canSeeFinancials && (property.electricity_price != null || property.water_price != null || property.gas_price != null || property.internet_price != null || property.cleaning_price != null || property.exit_cleaning_price != null) && (
          <SectionBlock title={t('propUtilities')}>
            <InfoRow label={t('pdElectricity')} value={property.electricity_price != null ? `${property.electricity_price} ${psym}/${t('propWaterCubic')}` : null} />
            <InfoRow
              label={t('pdWater')}
              value={property.water_price != null
                ? `${property.water_price} ${psym} / ${property.water_price_type === 'cubic' ? t('pdPerCubic') : property.water_price_type === 'person' ? t('pdPerPerson') : t('pdFixed')}`
                : null}
            />
            <InfoRow label={t('pdGas')} value={property.gas_price != null ? `${property.gas_price} ${psym}` : null} />
            <InfoRow label={t('pdInternetMonth')} value={fmt(property.internet_price)} />
            <InfoRow label={t('pdCleaning')} value={fmt(property.cleaning_price)} />
            <InfoRow label={t('pdExitCleaning')} value={fmt(property.exit_cleaning_price)} />
          </SectionBlock>
        )}

        {/* ── Features ── */}
        {(property.internet_speed != null || property.pets_allowed != null || property.long_term_booking != null) && (
          <SectionBlock title={t('propFeatures')}>
            <InfoRow label={t('pdInternetSpeed')} value={property.internet_speed ? `${property.internet_speed} ${t('pdInternetSpeedUnit')}` : null} />
            <InfoRow label={t('pdPets')} value={property.pets_allowed != null ? (property.pets_allowed ? `✅ ${t('yes')}` : `❌ ${t('no')}`) : null} />
            <InfoRow label={t('pdLongTerm')} value={property.long_term_booking != null ? (property.long_term_booking ? `✅ ${t('yes')}` : `❌ ${t('no')}`) : null} />
          </SectionBlock>
        )}

        {/* ── Amenities ── */}
        {hasAmenities && (
          <SectionBlock title={t('propAmenities')}>
            <View style={s.amenitiesGrid}>
              {Object.entries(property.amenities)
                .filter(([, v]) => v)
                .map(([k]) => (
                  <View key={k} style={s.amenityChip}>
                    {AMENITY_ICONS[k] && (
                      <Image source={AMENITY_ICONS[k]} style={s.amenityChipIcon} resizeMode="contain" />
                    )}
                    <Text style={s.amenityChipText}>{AMENITY_LABELS[k] || k}</Text>
                  </View>
                ))}
            </View>
          </SectionBlock>
        )}

        {/* ── Description ── */}
        {(property.description || property.comments) && (
          <SectionBlock title={`📝 ${t('pdDescription')}`}>
            {property.description ? <Text style={s.descText}>{property.description}</Text> : null}
            {property.comments ? (
              <View style={s.commentsBox}>
                <Text style={s.commentsLabel}>{t('pdComments')}:</Text>
                <Text style={s.commentsText}>{property.comments}</Text>
              </View>
            ) : null}
          </SectionBlock>
        )}

        {/* ── Owners ── */}
        {(owner1 || owner2) && (
          <SectionBlock title={`👤 ${t('propOwners')}`}>
            {[owner1, owner2].filter(Boolean).map((owner, i) => (
              <View key={i} style={s.ownerRow}>
                <View style={s.ownerAvatar}>
                  <Text style={s.ownerAvatarText}>{(owner.name || '?')[0].toUpperCase()}</Text>
                </View>
                <View>
                  <Text style={s.ownerName}>{owner.name} {owner.lastName || ''}</Text>
                  {owner.phone ? <Text style={s.ownerPhone}>{owner.phone}</Text> : null}
                </View>
              </View>
            ))}
          </SectionBlock>
        )}

        {/* ── Parent Resort ── */}
        {parent && (
          <SectionBlock title={`🏨 ${t('pdLocation')}`}>
            <View style={s.ownerRow}>
              {TYPE_META[parent.type]?.img
                ? <Image source={TYPE_META[parent.type].img} style={s.parentImg} resizeMode="contain" />
                : <Text style={s.parentIcon}>{TYPE_META[parent.type]?.icon}</Text>}
              <View>
                <Text style={s.ownerName}>{parent.name}</Text>
                <Text style={s.ownerPhone}>{parent.code}{parent.code_suffix ? `-${parent.code_suffix}` : ''}</Text>
              </View>
            </View>
          </SectionBlock>
        )}

        {/* ── Children (for resorts/condos) ── */}
        {(children.length > 0 || ['resort', 'condo'].includes(property.type)) && (
          <SectionBlock
            title={`🏠 ${t('propUnitsSection')} (${children.length})`}
            action={onAddUnit && canAddUnit ? (
              <TouchableOpacity style={s.addUnitBtn} onPress={onAddUnit}>
                <Text style={s.addUnitBtnText}>{t('addUnit')}</Text>
              </TouchableOpacity>
            ) : null}
          >
            <View style={s.childGrid}>
              {children.map(child => {
                const childMeta = TYPE_META[child.type] || TYPE_META.house;
                const childCode = child.code + (child.code_suffix ? `-${child.code_suffix}` : '');
                const activeBooking = getActiveBooking(bookings, child.id);
                const childOccupied = !!activeBooking;
                const checkOutLabel = activeBooking
                  ? `до ${dayjs(activeBooking.checkOut).format('D MMM')}`
                  : null;
                const hasPhoto = child.photos?.length > 0;
                return (
                  <TouchableOpacity
                    key={child.id}
                    style={s.childCard}
                    onPress={() => onChildPress && onChildPress(child)}
                    activeOpacity={0.8}
                  >
                    {/* Полоска по типу */}
                    <View style={[s.childCardStripe, { backgroundColor: childMeta.stripe }]} />

                    {/* Photo */}
                    <View style={s.childCardPhoto}>
                      {hasPhoto ? (
                        <Image source={{ uri: child.photos[0] }} style={s.childCardImg} resizeMode="cover" />
                      ) : (
                        <View style={[s.childCardImgPlaceholder, { backgroundColor: childMeta.bg }]}>
                          {childMeta.img
                            ? <Image source={childMeta.img} style={s.childCardImgIcon2} resizeMode="contain" />
                            : <Text style={s.childCardImgIcon}>{childMeta.icon}</Text>}
                        </View>
                      )}
                    </View>

                    {/* Info */}
                    <View style={s.childCardInfo}>
                      {/* Top row: name + code + status */}
                      <View style={s.childCardTopRow}>
                        <Text style={s.childCardTitle} numberOfLines={1}>{child.name}</Text>
                        <View style={s.childCodeChip}>
                          <Text style={s.childCodeChipText}>{childCode}</Text>
                        </View>
                        <View style={[s.childStatusPill, { backgroundColor: childOccupied ? C.accentBg : C.houseBg }]}>
                          <View style={[s.childStatusDot, { backgroundColor: childOccupied ? ACCENT : C.house }]} />
                          <Text style={[s.childStatusLabel, { color: childOccupied ? ACCENT : C.house }]}>
                            {childOccupied ? `${t('propOccupied')} ${checkOutLabel}` : t('propFree')}
                          </Text>
                        </View>
                      </View>

                      {/* Stats row */}
                      <View style={s.childStatsRow}>
                        {child.bedrooms != null && (
                          <View style={s.childStat}>
                            <Image source={ICON_BEDROOM} style={s.childStatImg} />
                            <Text style={s.childStatNum}>{child.bedrooms}</Text>
                            <Text style={s.childStatLabel}>{t('propBedrooms2')}</Text>
                          </View>
                        )}
                        {child.bathrooms != null && (
                          <View style={s.childStat}>
                            <Image source={ICON_BATHROOM} style={s.childStatImg} />
                            <Text style={s.childStatNum}>{child.bathrooms}</Text>
                            <Text style={s.childStatLabel}>{t('propBathrooms')}</Text>
                          </View>
                        )}
                        {child.area != null && (
                          <View style={s.childStat}>
                            <Image source={ICON_AREA} style={s.childStatImg} />
                            <Text style={s.childStatNum}>{child.area}</Text>
                            <Text style={s.childStatLabel}>{t('propSqm')}</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Price + arrow */}
                    <View style={s.childCardRight}>
                      {child.price_monthly != null ? (
                        <>
                          <Text style={s.childPriceValue}>{child.price_monthly_is_from ? `${t('propFrom')} ` : ''}{fmt(child.price_monthly)} {getCurrencySymbol(child.currency || 'THB')}</Text>
                          <Text style={s.childPricePer}>{t('perMonth')}</Text>
                        </>
                      ) : (
                        <Text style={s.childNoPrice}>—</Text>
                      )}
                      <Text style={s.childCardArrow}>›</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </SectionBlock>
        )}

        <View style={{ height: 40 }} />
      </View>
    </ScrollView>
    </View>
  );
}

// ─── Add Property Modal ───────────────────────────────────────────────────────

function AddPropertyModal({ visible, onClose, onSaved, user }) {
  const { t } = useLanguage();
  const TYPE_META = getTypeMeta(t);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [type, setType] = useState('house');
  const [city, setCity] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const reset = () => { setName(''); setCode(''); setType('house'); setCity(''); setError(''); };

  const handleSave = async () => {
    if (!name.trim()) { setError('Введите название объекта'); return; }
    if (!code.trim()) { setError('Введите код объекта'); return; }
    setSaving(true);
    setError('');
    try {
      const created = await createProperty({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        type,
        property_status: user?.teamMembership ? 'pending' : 'approved',
      });
      // Уведомляем Админа если создаёт агент
      const adminId = user?.teamMembership?.adminId;
      if (adminId && created?.id) {
        const agentName = [user.name, user.lastName].filter(Boolean).join(' ') || user.email;
        await sendNotification({
          recipientId: adminId,
          senderId: user.id,
          type: 'property_submitted',
          title: `🏠 ${agentName} добавил объект «${name.trim()}»`,
          body: `Код: ${code.trim().toUpperCase()} · Тип: ${type}`,
          propertyId: created.id,
        });
      }
      reset();
      onSaved();
    } catch (e) {
      setError(e.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={s.modalBox}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{t('propertiesAddBtn')}</Text>
            <TouchableOpacity onPress={() => { reset(); onClose(); }} style={s.modalClose}>
              <Text style={s.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Type selector */}
          <Text style={s.fieldLabel}>{t('propertyType')}</Text>
          <View style={s.typeRow}>
            {Object.entries(TYPE_META).map(([key, m]) => (
              <TouchableOpacity
                key={key}
                style={[s.typeOption, type === key && s.typeOptionSelected]}
                onPress={() => setType(key)}
              >
                <Text style={[s.typeOptionText, type === key && s.typeOptionTextSelected]}>
                  {m.icon} {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.fieldLabel}>{t('name')} *</Text>
          <TextInput
            style={s.fieldInput}
            value={name}
            onChangeText={setName}
            placeholder="Например: Вилла Sunset"
            placeholderTextColor={C.light}
          />

          <Text style={s.fieldLabel}>{t('bookingHouseCode')} *</Text>
          <TextInput
            style={s.fieldInput}
            value={code}
            onChangeText={setCode}
            placeholder="Например: CW01"
            placeholderTextColor={C.light}
            autoCapitalize="characters"
          />

          <Text style={s.fieldLabel}>{t('pdCity')}</Text>
          <TextInput
            style={s.fieldInput}
            value={city}
            onChangeText={setCity}
            placeholder="Например: Samui"
            placeholderTextColor={C.light}
          />

          {error ? <Text style={s.fieldError}>{error}</Text> : null}

          <View style={s.modalActions}>
            <TouchableOpacity style={s.cancelBtn} onPress={() => { reset(); onClose(); }}>
              <Text style={s.cancelBtnText}>{t('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={s.saveBtnText}>{t('propertiesAddBtn')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  const { t } = useLanguage();
  return (
    <View style={s.emptyState}>
      <Text style={s.emptyIcon}>🏠</Text>
      <Text style={s.emptyTitle}>{t('emptySelectProperty')}</Text>
      <Text style={s.emptyText}>{t('emptySelectPropertyHint')}</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function WebPropertiesScreen({ initialPropertyId, user }) {
  const { t, currency: userCurrency } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [previousSelected, setPreviousSelected] = useState(null);
  const [currentScrollY, setCurrentScrollY] = useState(0);
  const [savedScrollY, setSavedScrollY] = useState(0);
  const [restoreScrollY, setRestoreScrollY] = useState(0);
  const [addVisible, setAddVisible] = useState(false);
  const [editPanel, setEditPanel] = useState({ visible: false, mode: 'create', property: null, parentProperty: null });

  const handleSelectProperty = (prop) => {
    setSelected(prop);
    setPreviousSelected(null);
    setSavedScrollY(0);
    setRestoreScrollY(0);
  };

  const handleSelectChild = (child, parent) => {
    setSavedScrollY(currentScrollY); // сохраняем позицию резорта
    setPreviousSelected(parent);
    setSelected(child);
    setRestoreScrollY(0); // юнит открывается сверху
  };

  const handleBack = () => {
    setRestoreScrollY(savedScrollY); // восстанавливаем позицию резорта
    setSelected(previousSelected);
    setPreviousSelected(null);
    setSavedScrollY(0);
  };

  const load = useCallback(async () => {
    try {
      const agentId = user?.teamMembership ? user.id : null;
      const [props, conts, bkgs] = await Promise.all([
        getProperties(agentId),
        getContacts('owners'),
        getBookings(null, null, agentId),
      ]);
      setProperties(props);
      setContacts(conts);
      setBookings(bkgs);
    } catch (e) {
      console.error('WebPropertiesScreen load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  // Realtime: обновляем данные объекта при изменениях — только для агента
  useEffect(() => {
    if (!user?.teamMembership || !user?.id) return;
    const agentId = user.id;

    const channel = supabase
      .channel('properties-realtime')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'properties',
        filter: `responsible_agent_id=eq.${agentId}`,
      }, (payload) => {
        const updated = payload.new;
        // Обновляем список объектов
        setProperties(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p));
        // Обновляем selected если это тот же объект и панель редактирования закрыта
        setSelected(prev => {
          if (!prev || prev.id !== updated.id) return prev;
          return { ...prev, ...updated };
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.teamMembership, user?.id]);

  // Auto-select property when navigating from Contacts
  useEffect(() => {
    if (!initialPropertyId || loading || properties.length === 0) return;
    const target = properties.find(p => p.id === initialPropertyId);
    if (!target) return;
    // If it's a unit (has resort_id), open its parent first then navigate into the unit
    if (target.resort_id) {
      const parent = properties.find(p => p.id === target.resort_id);
      if (parent) {
        setPreviousSelected(parent);
        setSelected(target);
        setRestoreScrollY(0);
        return;
      }
    }
    setSelected(target);
    setPreviousSelected(null);
  }, [initialPropertyId, loading, properties]);

  // ── Filter & sort list ──
  const filtered = properties.filter(p => {
    if (typeFilter !== 'all' && p.type !== typeFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const code = (p.code + (p.code_suffix ? `-${p.code_suffix}` : '')).toLowerCase();
      if (!p.name?.toLowerCase().includes(q) && !code.includes(q) && !p.city?.toLowerCase().includes(q))
        return false;
    }
    return true;
  });

  // В поиске показываем все (включая юниты), без поиска — только верхний уровень
  const sorted = search.trim()
    ? [...filtered.filter(p => !p.resort_id), ...filtered.filter(p => !!p.resort_id)]
    : filtered.filter(p => !p.resort_id);

  const counts = { all: properties.length };
  ['house', 'resort', 'condo'].forEach(typ => {
    counts[typ] = properties.filter(p => p.type === typ).length;
  });

  const handleSaved = () => {
    setAddVisible(false);
    setLoading(true);
    load();
  };

  const openCreate = () => setEditPanel({ visible: true, mode: 'create', property: null, parentProperty: null });
  const openEdit = (prop) => setEditPanel({ visible: true, mode: 'edit', property: prop, parentProperty: null });
  const openCreateUnit = (parent) => setEditPanel({ visible: true, mode: 'create-unit', property: null, parentProperty: parent });
  const closePanel = () => setEditPanel(p => ({ ...p, visible: false }));

  const handlePanelSaved = (saved) => {
    closePanel();
    setLoading(true);
    load().then(() => {
      if (saved?.id) {
        // Обновляем выбранный объект если редактировали его
        setSelected(prev => prev?.id === saved.id ? saved : prev);
      }
    });
  };

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={s.loadingText}>{t('loading')}</Text>
      </View>
    );
  }

  const isAgent = !!user?.teamMembership;
  const canAdd = !isAgent || user?.teamPermissions?.can_add_property;

  return (
    <View style={s.root}>

      {/* ── Left Panel ── */}
      <View style={s.leftPanel}>

        {/* Header */}
        <View style={s.panelHeader}>
          <View>
            <Text style={s.panelTitle}>{t('propertiesTitle')}</Text>
            <Text style={s.panelSubtitle}>{properties.length} {t('propertiesTitle').toLowerCase()}</Text>
          </View>
          {canAdd && (
            <TouchableOpacity style={s.addBtn} onPress={openCreate}>
              <Text style={s.addBtnText}>＋ {t('propertiesAddBtn')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Search */}
        <View style={s.searchWrap}>
          <Text style={s.searchIcon}>🔍</Text>
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder={t('search') + '…'}
            placeholderTextColor={C.light}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} style={s.searchClear} activeOpacity={0.7}>
              <Text style={s.searchClearText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Type filter tabs */}
        <View style={s.filterTabs}>
          {[
            { key: 'all',    label: `${t('all')} (${counts.all})`,                img: null },
            { key: 'house',  label: `${t('house')} (${counts.house || 0})`,       img: ICON_TYPE_HOUSE  },
            { key: 'resort', label: `${t('resort')} (${counts.resort || 0})`,     img: ICON_TYPE_RESORT },
            { key: 'condo',  label: `${t('condo')} (${counts.condo || 0})`,       img: ICON_TYPE_CONDO  },
          ].map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[s.filterTab, typeFilter === tab.key && s.filterTabActive]}
              onPress={() => setTypeFilter(tab.key)}
            >
              <View style={s.filterTabInner}>
                {tab.img && (
                  <Image source={tab.img} style={s.filterTabIcon} resizeMode="contain" />
                )}
                <Text style={[s.filterTabText, typeFilter === tab.key && s.filterTabTextActive]}>
                  {tab.label}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* List */}
        {sorted.length === 0 ? (
          <View style={s.listEmpty}>
            <Text style={s.listEmptyText}>
              {search ? t('noData') : t('propertiesNoData')}
            </Text>
          </View>
        ) : (
          <FlatList
            data={sorted}
            keyExtractor={item => item.id}
            renderItem={({ item }) => {
              const parent = properties.find(p => p.id === item.resort_id);
              return (
                <PropertyCard
                  item={item}
                  isSelected={selected?.id === item.id}
                  onPress={() => {
                    if (item.resort_id) {
                      const par = properties.find(p => p.id === item.resort_id);
                      handleSelectChild(item, par);
                    } else {
                      handleSelectProperty(item);
                    }
                  }}
                  occupied={isOccupiedNow(bookings, item.id)}
                  parentName={parent?.name}
                />
              );
            }}
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={s.listSep} />}
          />
        )}
      </View>

      {/* ── Right Panel ── */}
      <View style={s.rightPanel}>
        {selected ? (
          <PropertyDetail
            property={selected}
            contacts={contacts}
            allProperties={properties}
            bookings={bookings}
            previousProperty={previousSelected}
            onChildPress={(child) => handleSelectChild(child, selected)}
            onBack={handleBack}
            onScrollY={setCurrentScrollY}
            initialScrollY={restoreScrollY}
            onEdit={() => openEdit(selected)}
            onAddUnit={() => openCreateUnit(selected)}
            user={user}
            onApprove={async () => {
              await approveProperty(selected.id);
              await load();
              setSelected(prev => ({ ...prev, property_status: 'approved' }));
            }}
            onReject={async () => {
              const reason = window.prompt('Причина отклонения (необязательно):') ?? '';
              await rejectProperty(selected.id, reason);
              await load();
              setSelected(prev => ({ ...prev, property_status: 'rejected', rejection_reason: reason }));
            }}
          />
        ) : (
          <EmptyState />
        )}
      </View>

      {/* ── Add Modal (legacy, kept for fallback) ── */}
      <AddPropertyModal
        visible={addVisible}
        onClose={() => setAddVisible(false)}
        onSaved={handleSaved}
        user={user}
      />

      {/* ── Edit / Create Panel ── */}
      <WebPropertyEditPanel
        visible={editPanel.visible}
        mode={editPanel.mode}
        property={editPanel.property}
        parentProperty={editPanel.parentProperty}
        onClose={closePanel}
        onSaved={handlePanelSaved}
        userCurrency={userCurrency}
        user={user}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: C.bg,
    overflow: 'hidden',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: { fontSize: 14, color: C.muted },

  // ── Left panel ──
  leftPanel: {
    width: 380,
    backgroundColor: C.surface,
    borderRightWidth: 1,
    borderRightColor: C.border,
    flexDirection: 'column',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  panelTitle: { fontSize: 20, fontWeight: '700', color: C.text },
  panelSubtitle: { fontSize: 12, color: C.muted, marginTop: 2 },
  addBtn: {
    backgroundColor: '#EAF4F5',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#B2D8DB',
  },
  addBtnText: { color: '#3D7D82', fontWeight: '700', fontSize: 14 },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: { fontSize: 15, opacity: 0.5 },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: C.text,
    outlineStyle: 'none',
    padding: 0,
  },
  searchClear: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchClearText: { color: '#FFF', fontSize: 11, fontWeight: '700', lineHeight: 13 },

  filterTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 6,
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
  },
  filterTabActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  filterTabText: { fontSize: 12, color: C.muted, fontWeight: '500' },
  filterTabTextActive: { color: '#FFF', fontWeight: '600' },
  filterTabInner: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  filterTabIcon: { width: 16, height: 16 },

  listContent: { paddingHorizontal: 12, paddingBottom: 20 },
  listSep: { height: 6 },
  listEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  listEmptyText: { fontSize: 14, color: C.light },

  // ── Property card ──
  card: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    gap: 0,
    cursor: 'pointer',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  cardSelected: {
    backgroundColor: TEAL_BG,
    borderColor: ACCENT,
    borderWidth: 1.5,
  },
  cardStripe: {
    width: 4,
    alignSelf: 'stretch',
  },
  cardThumbWrap: { position: 'relative', margin: 10, marginLeft: 10 },
  cardThumb: { width: 64, height: 64, borderRadius: 10 },
  cardThumbPlaceholder: {
    width: 64, height: 64, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  cardThumbIcon: { fontSize: 28 },
  cardThumbImg: { width: 40, height: 40 },
  occupiedDot: {
    position: 'absolute', top: -3, right: -3,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: ACCENT,
    borderWidth: 2, borderColor: C.surface,
  },
  cardBody: { flex: 1, justifyContent: 'center', paddingVertical: 10, paddingRight: 12 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardName: { flex: 1, fontSize: 14, fontWeight: '700', color: C.text },
  cardNameSelected: { color: ACCENT },
  codePill: {
    backgroundColor: C.bg, borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: C.border,
  },
  codePillSelected: { backgroundColor: TEAL_BG, borderColor: TEAL_LIGHT },
  codePillText: { fontSize: 11, fontWeight: '600', color: C.muted },
  codePillTextSelected: { color: ACCENT },
  cardMidRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  cardMeta: { fontSize: 12, color: C.muted },
  cardParent: { fontSize: 11, color: C.light, marginTop: 2 },
  cardPrice: { fontSize: 13, fontWeight: '700', color: C.house, marginTop: 4 },
  cardPriceSelected: { color: ACCENT },

  // ── Type badge ──
  typeBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1,
  },
  typeBadgeSmall: { paddingHorizontal: 6, paddingVertical: 2 },
  typeBadgeImg: { width: 14, height: 14 },
  typeBadgeImgSmall: { width: 12, height: 12 },
  typeBadgeText: { fontSize: 12, fontWeight: '600' },
  typeBadgeTextSmall: { fontSize: 11 },

  // ── Right panel ──
  rightPanel: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // ── Detail view ──
  detail: { flex: 1 },
  galleryWrap: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  gallery: { height: 240, backgroundColor: '#E9ECEF' },
  galleryContent: { gap: 2, alignItems: 'center' },
  galleryPhoto: { width: 360, height: 240 },
  gallerySingle: {
    height: 240,
    backgroundColor: '#E9ECEF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gallerySinglePhoto: {
    width: '100%',
    height: 240,
  },
  galleryPlaceholder: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  galleryPlaceholderIcon: { fontSize: 56 },
  galleryPlaceholderImg: { width: 80, height: 80, marginBottom: 8 },
  galleryPlaceholderText: { fontSize: 14, fontWeight: '500' },

  detailPadding: { padding: 24 },
  detailHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
  detailTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 },
  detailTitle: { fontSize: 24, fontWeight: '800', color: C.text },
  detailSubRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  detailCodeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.bg, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: C.border,
  },
  detailCodeIcon: { width: 14, height: 14 },
  detailCodeText: { fontSize: 13, fontWeight: '700', color: C.muted },
  detailCityRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  detailCityIcon: { width: 16, height: 16 },
  detailCity: { fontSize: 13, color: C.muted },
  occupiedBadge: {
    backgroundColor: TEAL_BG, borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: TEAL_LIGHT,
  },
  occupiedBadgeText: { fontSize: 12, fontWeight: '700', color: ACCENT },

  // ── Stats row ──
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  statCard: {
    backgroundColor: C.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    minWidth: 72,
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 4,
  },
  statCardAccent: { backgroundColor: C.accentBg, borderColor: ACCENT, borderLeftColor: ACCENT },
  statValue: { fontSize: 22, fontWeight: '800', color: C.text },
  statLabel: { fontSize: 11, color: C.muted, marginTop: 2 },

  // ── Section block ──
  sectionBlock: {
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 14,
    overflow: 'hidden',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.bg,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sectionTitleInner: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1 },
  sectionTitleIcon: { width: 14, height: 14 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  detailActions: { paddingTop: 4 },
  responsibleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 1,
    borderColor: '#E9ECEF',
    gap: 8,
    cursor: 'pointer',
  },
  responsibleLabel: { fontSize: 13, color: '#868E96', fontWeight: '500' },
  responsibleValue: { flex: 1, fontSize: 13, color: '#212529', fontWeight: '600' },
  responsibleChevron: { fontSize: 14, color: '#ADB5BD' },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerSheet: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    minWidth: 300,
    maxWidth: 400,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  pickerTitle: { fontSize: 16, fontWeight: '700', color: '#212529', marginBottom: 16, textAlign: 'center' },
  pickerItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: '#F8F9FA',
  },
  pickerItemActive: { backgroundColor: '#E8F5E9' },
  pickerItemText: { fontSize: 15, color: '#495057' },
  pickerItemTextActive: { color: '#2E7D32', fontWeight: '700' },
  detailEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#B2D8DB',
    backgroundColor: '#EAF4F5',
  },
  detailEditBtnIcon: { width: 18, height: 18, tintColor: '#3D7D82' },
  detailEditBtnText: { fontSize: 15, fontWeight: '700', color: '#3D7D82' },
  addUnitBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#EAF4F5',
    borderWidth: 1.5,
    borderColor: '#B2D8DB',
  },
  addUnitBtnText: { fontSize: 13, fontWeight: '700', color: '#3D7D82' },
  sectionContent: { padding: 16 },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F9FA',
  },
  infoLabel: { fontSize: 13, color: C.muted },
  infoValue: { fontSize: 13, fontWeight: '600', color: C.text },
  infoValueHighlight: { color: ACCENT, fontSize: 15, fontWeight: '800' },
  fromNote: { fontSize: 11, color: C.light, textAlign: 'right', marginTop: -4, marginBottom: 4 },

  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: TEAL_BG,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: TEAL_LIGHT,
    alignSelf: 'flex-start',
  },
  linkBtnText: { fontSize: 13, color: ACCENT, fontWeight: '600' },

  amenitiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amenityChip: {
    backgroundColor: C.bg,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: C.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  amenityChipIcon: { width: 18, height: 18 },
  amenityChipText: { fontSize: 13, color: C.text },

  descText: { fontSize: 14, color: C.text, lineHeight: 22 },
  commentsBox: {
    backgroundColor: C.bg, borderRadius: 8,
    padding: 12, marginTop: 10,
    borderLeftWidth: 3, borderLeftColor: ACCENT,
  },
  commentsLabel: { fontSize: 11, fontWeight: '700', color: C.muted, marginBottom: 4 },
  commentsText: { fontSize: 13, color: C.text, lineHeight: 20 },

  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  ownerAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: TEAL_BG,
    borderWidth: 1.5, borderColor: TEAL_LIGHT,
    alignItems: 'center', justifyContent: 'center',
  },
  ownerAvatarText: { fontSize: 16, fontWeight: '700', color: ACCENT },
  ownerName: { fontSize: 14, fontWeight: '600', color: C.text },
  ownerPhone: { fontSize: 12, color: C.muted },
  parentIcon: { fontSize: 24 },
  parentImg: { width: 32, height: 32 },

  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.bg,
  },
  childDot: { width: 8, height: 8, borderRadius: 4 },
  childName: { flex: 1, fontSize: 13, color: C.text, fontWeight: '500' },
  childCodePill: {
    backgroundColor: C.bg, borderRadius: 5,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  childCodeText: { fontSize: 11, color: C.muted, fontWeight: '600' },
  childMeta: { fontSize: 12, color: C.muted },
  childPrice: { fontSize: 12, color: C.house, fontWeight: '600' },
  childRowClickable: { cursor: 'pointer' },
  childArrow: { fontSize: 18, color: C.light, marginLeft: 'auto' },

  // ── Child list cards ──
  childGrid: { gap: 8 },
  childCardStripe: { width: 4, alignSelf: 'stretch' },

  childCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    cursor: 'pointer',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },

  // Photo block — left
  childCardPhoto: {
    width: 100,
    height: 80,
    flexShrink: 0,
  },
  childCardImg: { width: '100%', height: '100%' },
  childCardImgPlaceholder: {
    width: '100%', height: '100%',
    alignItems: 'center', justifyContent: 'center',
  },
  childCardImgIcon: { fontSize: 32 },
  childCardImgIcon2: { width: 44, height: 44 },

  // Info block — center
  childCardInfo: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  childCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  childCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
    flexShrink: 1,
  },
  childCodeChip: {
    backgroundColor: C.bg,
    borderRadius: 6, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  childCodeChipText: { fontSize: 11, fontWeight: '700', color: C.muted },
  childStatusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 20,
  },
  childStatusDot: { width: 6, height: 6, borderRadius: 3 },
  childStatusLabel: { fontSize: 11, fontWeight: '600' },

  childStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  childStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  childStatIcon: { fontSize: 14 },
  childStatImg: { width: 20, height: 20, resizeMode: 'contain' },
  childStatNum: { fontSize: 14, fontWeight: '700', color: C.text },
  childStatLabel: { fontSize: 12, color: C.muted },

  // Price block — right
  childCardRight: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 2,
    borderLeftWidth: 1,
    borderLeftColor: C.border,
    minWidth: 120,
  },
  childPriceValue: {
    fontSize: 15,
    fontWeight: '800',
    color: ACCENT,
  },
  childPricePer: {
    fontSize: 11,
    color: C.muted,
  },
  childNoPrice: {
    fontSize: 14,
    color: C.light,
  },
  childCardArrow: {
    fontSize: 18,
    color: C.light,
    marginTop: 4,
  },

  // ── Back navigation bar ──
  backBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    cursor: 'pointer',
  },
  backArrow: { fontSize: 20, color: ACCENT, fontWeight: '700' },
  backParentIcon: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  backParentImg: { width: 20, height: 20 },
  backText: { fontSize: 14, color: C.text },
  backLabel: { color: C.muted, fontWeight: '400' },

  // ── Approval block ──
  approvalBlock: { backgroundColor: '#FFF8E1', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#FFE082', gap: 10 },
  approvalTitle: { fontSize: 14, fontWeight: '700', color: '#795548' },
  approvalSubtitle: { fontSize: 13, color: '#8D6E63' },
  approvalActions: { flexDirection: 'row', gap: 10 },
  approveBtn: { flex: 1, height: 42, backgroundColor: '#16A34A', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  approveBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  rejectBtn: { flex: 1, height: 42, backgroundColor: '#FFF', borderRadius: 10, borderWidth: 1.5, borderColor: '#E53935', alignItems: 'center', justifyContent: 'center' },
  rejectBtnText: { fontSize: 14, fontWeight: '700', color: '#E53935' },
  rejectedBlock: { backgroundColor: '#FFF5F5', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#FFCDD2', gap: 4 },
  rejectedLabel: { fontSize: 12, fontWeight: '700', color: '#E53935' },
  rejectedReason: { fontSize: 13, color: '#C62828' },
  statusBadgePending: { backgroundColor: '#FFF8E1', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#FFE082' },
  statusBadgePendingText: { fontSize: 12, fontWeight: '700', color: '#795548' },
  statusBadgeRejected: { backgroundColor: '#FFF5F5', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#FFCDD2' },
  statusBadgeRejectedText: { fontSize: 12, fontWeight: '700', color: '#E53935' },

  // Баннер «Изменения на проверке» для агента — янтарный акцент с иконкой
  draftBanner: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#FCD34D',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  draftBannerIcon: {
    fontSize: 18,
    flexShrink: 0,
  },
  draftBannerText: {
    fontSize: 13,
    color: '#92400E',
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
  },

  // ── Empty state ──
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: C.text, marginBottom: 8 },
  emptyText: { fontSize: 14, color: C.muted, textAlign: 'center', maxWidth: 320, lineHeight: 22 },

  // ── Add modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBox: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 28,
    width: 480,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: C.text },
  modalClose: { padding: 4 },
  modalCloseText: { fontSize: 18, color: C.light },

  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  typeOption: {
    flex: 1, paddingVertical: 10, alignItems: 'center',
    borderRadius: 10, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.bg,
  },
  typeOptionSelected: { borderColor: ACCENT, backgroundColor: C.accentBg },
  typeOptionText: { fontSize: 13, fontWeight: '600', color: C.muted },
  typeOptionTextSelected: { color: ACCENT },

  fieldLabel: { fontSize: 12, fontWeight: '600', color: C.muted, marginBottom: 6 },
  fieldInput: {
    height: 44,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 14,
    color: C.text,
    backgroundColor: C.bg,
    marginBottom: 16,
    outlineWidth: 0,
  },
  fieldError: { fontSize: 13, color: ACCENT, marginBottom: 12 },

  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1, paddingVertical: 12,
    borderRadius: 10, borderWidth: 1, borderColor: C.border,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: C.muted },
  // Primary-кнопка: тёмный тил, белый текст
  saveBtn: {
    flex: 2, paddingVertical: 12,
    borderRadius: 10, backgroundColor: ACCENT,
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
