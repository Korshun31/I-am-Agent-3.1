import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform, Linking, Image } from 'react-native';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { useLanguage } from '../../context/LanguageContext';
import { useAppData } from '../../context/AppDataContext';
import {
  computeBaseStats,
  computeAgentStats,
  buildCommissionEvents,
  computeAgendaForDate,
} from '../../utils/dashboardStats';
import WebCalendarStrip from '../components/WebCalendarStrip';
import WebAddCalendarEventModal from '../components/WebAddCalendarEventModal';

const ICON_PHONE    = require('../../../assets/icon-contact-phone.png');
const ICON_TELEGRAM = require('../../../assets/icon-contact-telegram.png');
const ICON_WHATSAPP = require('../../../assets/icon-contact-whatsapp.png');

dayjs.extend(isBetween);

// ─── Новая палитра ──────────────────────────────────────
const CLR = {
  // Нижний ряд (Блоки)
  in:       '#A8D5BA', // Мятный
  inText:   '#4A7D62', // Темно-мятный (читаемый)
  inBg:     '#F0FAF5', // Светлый фон для бейджей
  out:      '#F3B0A1', // Коралловый
  outText:  '#A65E4E', // Темно-коралловый (читаемый)
  outBg:    '#FDF3F2', // Светлый фон для бейджей
  ev:       '#A9C7EB', // Небесный
  evText:   '#4E75A6', // Темно-небесный (читаемый)
  evBg:     '#F0F5FD', // Светлый фон для бейджей
  
  // Верхний ряд (Статистика)
  stat1:    '#F9E2AF', // Песочный
  stat1Text:'#8D7A4E', // Темно-песочный
  stat2:    '#E2C2D6', // Пыльная сирень
  stat2Text:'#8D5E7A', // Темно-сиреневый
  stat3:    '#B2E2E2', // Аквамарин
  stat3Text:'#4E8D8D', // Темно-аквамариновый
  
  comm:     '#F9E2AF', 
  commText: '#8D7A4E',
  commBg:   '#FDF4E7',
};

export default function WebDashboardScreen({ user }) {
  const { t } = useLanguage();
  const {
    bookings,
    properties,
    contacts,
    calendarEvents,
    propertiesLoading, bookingsLoading, contactsLoading, eventsLoading,
    refreshCalendarEvents,
  } = useAppData();

  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [eventModalVisible, setEventModalVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  const loading = propertiesLoading || bookingsLoading || contactsLoading || eventsLoading;

  const stats = useMemo(
    () => computeBaseStats({ properties, bookings, user }),
    [properties, bookings, user]
  );

  const agentStats = useMemo(
    () => computeAgentStats({ properties, bookings, user }),
    [properties, bookings, user]
  );

  const allCommissionEvents = useMemo(
    () => buildCommissionEvents({ bookings, properties }),
    [bookings, properties]
  );

  const filteredEvents = useMemo(
    () => computeAgendaForDate({
      date: selectedDate,
      user,
      properties,
      bookings,
      contacts,
      calendarEvents,
      commissionEvents: allCommissionEvents,
      noNameFallback: t('noName'),
    }),
    [selectedDate, user, properties, bookings, contacts, calendarEvents, allCommissionEvents, t]
  );

  const handleDateSelect = (date) => setSelectedDate(date);

  const openWhatsApp = (phone) => {
    if (!phone) return;
    const cleanPhone = phone.replace(/\D/g, '');
    Linking.openURL(`https://wa.me/${cleanPhone}`);
  };

  const openTelegram = (username) => {
    if (!username) return;
    const cleanUser = username.replace('@', '');
    Linking.openURL(`https://t.me/${cleanUser}`);
  };

  const handleAddEvent = () => {
    setEditingEvent(null);
    setEventModalVisible(true);
  };

  const handleEventSaved = async () => {
    await refreshCalendarEvents();
    if (editingEvent) {
      const updated = calendarEvents.find(e => e.id === editingEvent.id);
      if (updated) setEditingEvent(updated);
    }
  };

  const handleEditEvent = (event) => {
    if (event.type === 'COMMISSION') return; // Комиссии нельзя редактировать как события
    setEditingEvent(event);
    setEventModalVisible(true);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3D7D82" />
      </View>
    );
  }

  const renderAgendaItem = (item, type) => (
    <TouchableOpacity 
      key={item.id} 
      style={[styles.agendaItem, item.isCompleted && styles.agendaItemCompleted]}
      onPress={() => type === 'EVENT' ? handleEditEvent(item) : null}
      activeOpacity={type === 'EVENT' ? 0.7 : 1}
    >
      <View style={[
        styles.statusBadge, 
        type === 'IN' ? styles.badgeIn : 
        type === 'OUT' ? styles.badgeOut : 
        item.type === 'COMMISSION' ? styles.badgeComm : styles.badgePersonal
      ]}>
        <Text style={[
          styles.badgeText, 
          { color: type === 'IN' ? CLR.inText : type === 'OUT' ? CLR.outText : item.type === 'COMMISSION' ? CLR.commText : CLR.evText }
        ]}>
          {item.type === 'COMMISSION' ? '$$' : type === 'EVENT' ? 'EV' : type}
        </Text>
      </View>
      <View style={styles.agendaInfo}>
        {item.type === 'COMMISSION' ? (
          <>
            <Text style={styles.agendaCode}>{t('commissionLabel')}: {item.amount} {item.currency}</Text>
            <Text style={styles.agendaPropName}>{item.propertyCode} — {item.propertyName}</Text>
          </>
        ) : type === 'EVENT' ? (
          <>
            <Text style={[styles.agendaCode, item.isCompleted && styles.textDimmed]}>{item.title}</Text>
            <Text style={[styles.agendaPropName, item.isCompleted && styles.textDimmed]}>{item.time || ''}</Text>
          </>
        ) : (
          <>
            <Text style={styles.agendaCode}>{item.propertyCode}</Text>
            <Text style={styles.agendaPropName} numberOfLines={1}>{item.propertyName}</Text>
            <Text style={styles.agendaClient}>{item.clientName}</Text>
          </>
        )}
      </View>
      {type === 'EVENT' && item.isCompleted && (
        <View style={styles.checkIconBadge}>
          <Text style={styles.checkIconText}>✓</Text>
        </View>
      )}
      <View style={styles.agendaActions}>
        {item.clientPhone ? (
          <TouchableOpacity style={[styles.msgBtn, styles.phoneBtn]} onPress={() => openWhatsApp(item.clientPhone)}>
            <Image source={ICON_WHATSAPP} style={styles.btnIcon} resizeMode="contain" />
          </TouchableOpacity>
        ) : null}
        {item.clientTelegram ? (
          <TouchableOpacity style={[styles.msgBtn, styles.tgBtn]} onPress={() => openTelegram(item.clientTelegram)}>
            <Image source={ICON_TELEGRAM} style={styles.btnIcon} resizeMode="contain" />
          </TouchableOpacity>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  const isToday = selectedDate.isSame(dayjs(), 'day');
  const dateTitle = isToday ? t('today') : selectedDate.format('DD MMMM');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.containerContent}
      showsVerticalScrollIndicator={true}
    >
      <Text style={styles.welcome}>{t('dashboardTitle')}</Text>
      
      <View style={styles.columnsGrid}>
      <View style={styles.statsRow}>
        {/* ОБЪЕКТОВ — одобренные сдаваемые единицы; на утверждении отдельно; donut только по одобренным */}
        <View style={[styles.statCard, { borderLeftColor: CLR.stat1 }]}>
          <View>
            <Text style={styles.statLabel}>{t('dashboardMyObjects').toUpperCase()}</Text>
            {agentStats ? (
              <>
                <View style={styles.agentStatRow}>
                  <Text style={[styles.statValue, { color: '#ADB5BD' }]}>{agentStats.companyTotal}</Text>
                  <Text style={styles.agentStatSep}> / </Text>
                  <Text style={[styles.statValue, { color: CLR.stat1Text }]}>{agentStats.myTotal}</Text>
                </View>
                <View style={styles.agentStatLabels}>
                  <Text style={styles.agentStatLabelGray}>{t('dashboardStatCompany')}</Text>
                  <Text style={styles.agentStatLabelGray}> / </Text>
                  <Text style={[styles.agentStatLabelColored, { color: CLR.stat1Text }]}>{t('dashboardStatMine')}</Text>
                </View>
              </>
            ) : (
              <Text style={[styles.statValue, { color: CLR.stat1Text }]}>{stats.total}</Text>
            )}
          </View>

          {agentStats ? (
            <View style={[styles.subStats, { flexWrap: 'wrap', marginTop: 10 }]}>
              {[
                { label: t('dashboardBreakdownHouses'), co: agentStats.companyHouses, my: agentStats.myHouses },
                { label: t('dashboardBreakdownResortHouses'), co: agentStats.companyResorts, my: agentStats.myResorts },
                { label: t('dashboardBreakdownApartments'), co: agentStats.companyCondos, my: agentStats.myCondos },
              ].map(({ label, co, my }) => (
                <Text key={label} style={styles.subStatText}>
                  {label}
                  {': '}
                  <Text style={{ color: '#ADB5BD', fontWeight: '700' }}>{co}</Text>
                  <Text style={{ color: '#CED4DA' }}>{' / '}</Text>
                  <Text style={[styles.subStatValue, { color: CLR.stat1Text }]}>{my}</Text>
                </Text>
              ))}
            </View>
          ) : (
            <View style={styles.subStats}>
              <Text style={styles.subStatText}>
                {t('dashboardBreakdownHouses')}: <Text style={styles.subStatValue}>{stats.houses}</Text>
              </Text>
              <Text style={styles.subStatText}>
                {t('dashboardBreakdownResortHouses')}: <Text style={styles.subStatValue}>{stats.resortHouses}</Text>
              </Text>
              <Text style={styles.subStatText}>
                {t('dashboardBreakdownApartments')}: <Text style={styles.subStatValue}>{stats.apartments}</Text>
              </Text>
            </View>
          )}
        </View>

        {/* БРОНИРОВАНИЙ */}
        <View style={[styles.statCard, { borderLeftColor: CLR.stat2 }]}>
          <View>
            <Text style={styles.statLabel}>{t('dashboardBookings').toUpperCase()}</Text>
            <Text style={[styles.statValue, { color: CLR.stat2Text }]}>
              {stats.occupied + stats.upcoming}
            </Text>
          </View>

          <View style={styles.subStats}>
            <Text style={styles.subStatText}>{t('dashboardActiveBookings')}: <Text style={styles.subStatValue}>{stats.occupied}</Text></Text>
            <Text style={styles.subStatText}>{t('dashboardFutureBookings')}: <Text style={styles.subStatValue}>{stats.upcoming}</Text></Text>
          </View>
        </View>

        {/* ЗАЕЗДЫ */}
        <View style={[styles.statCard, { borderLeftColor: CLR.stat3 }]}>
          <View>
            <Text style={styles.statLabel}>
              {agentStats ? t('dashboardCheckInsAgent').toUpperCase() : t('dashboardCheckIns').toUpperCase()}
            </Text>
            <Text style={[styles.statValue, { color: CLR.stat3Text }]}>
              {agentStats ? agentStats.myUpcoming : stats.upcoming}
            </Text>
          </View>

          <View style={styles.subStats}>
            <Text style={styles.subStatText}>{t('thisMonth')}: <Text style={styles.subStatValue}>{agentStats ? agentStats.myThisMonth : stats.thisMonth}</Text></Text>
            <Text style={styles.subStatText}>{t('later')}: <Text style={styles.subStatValue}>{agentStats ? agentStats.myLater : stats.later}</Text></Text>
          </View>
        </View>
      </View>

      <View style={styles.calendarGridSpan}>
        <WebCalendarStrip
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
          user={user}
        />
      </View>

      <View style={styles.mainContentRow}>
        <View style={styles.agendaContainer}>
          <View style={styles.agendaRow}>
            <View style={styles.agendaColumn}>
              <View style={[styles.sectionCard, { borderLeftWidth: 4, borderLeftColor: CLR.in }]}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: CLR.inText }]}>{t('checkIn')} {dateTitle} ({filteredEvents.checkIns.length})</Text>
                </View>
                <ScrollView style={styles.agendaScroll} showsVerticalScrollIndicator={true}>
                  {filteredEvents.checkIns.length > 0 ? (
                    filteredEvents.checkIns.map(b => renderAgendaItem(b, 'IN'))
                  ) : (
                    <Text style={styles.emptyText}>{t('dashboardNoEvents')}</Text>
                  )}
                </ScrollView>
              </View>
            </View>
            <View style={styles.agendaColumn}>
              <View style={[styles.sectionCard, { borderLeftWidth: 4, borderLeftColor: CLR.out }]}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: CLR.outText }]}>{t('checkOut')} {dateTitle} ({filteredEvents.checkOuts.length})</Text>
                </View>
                <ScrollView style={styles.agendaScroll} showsVerticalScrollIndicator={true}>
                  {filteredEvents.checkOuts.length > 0 ? (
                    filteredEvents.checkOuts.map(b => renderAgendaItem(b, 'OUT'))
                  ) : (
                    <Text style={styles.emptyText}>{t('dashboardNoEvents')}</Text>
                  )}
                </ScrollView>
              </View>
            </View>
            <View style={styles.agendaColumn}>
              <View style={[styles.sectionCard, { borderLeftWidth: 4, borderLeftColor: CLR.ev }]}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: CLR.evText }]}>{t('dashboardEvents')} {dateTitle} ({filteredEvents.personal.length})</Text>
                  <TouchableOpacity style={styles.addEventBtn} onPress={handleAddEvent}>
                    <View style={[styles.plusH, { backgroundColor: CLR.evText }]} />
                    <View style={[styles.plusV, { backgroundColor: CLR.evText }]} />
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.agendaScroll} showsVerticalScrollIndicator={true}>
                  {filteredEvents.personal.length > 0 ? (
                    filteredEvents.personal.map(e => renderAgendaItem(e, 'EVENT'))
                  ) : (
                    <Text style={styles.emptyText}>{t('dashboardNoEvents')}</Text>
                  )}
                </ScrollView>
              </View>
            </View>
          </View>

          {/* Следующие заселения — под первой колонкой */}
          {(() => {
            const today = dayjs().format('YYYY-MM-DD');
            const isTeamMemberUpcoming = !!(user?.teamMembership);
            const propsMapUpcoming = {};
            properties.forEach(p => { propsMapUpcoming[p.id] = p; });
            const next5 = bookings
              .filter(b => {
                if (b.checkIn <= today || b.notMyCustomer) return false;
                if (isTeamMemberUpcoming) return propsMapUpcoming[b.propertyId]?.responsible_agent_id === user.id;
                return true;
              })
              .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
              .slice(0, 20);
            return (
              <View style={styles.upcomingRow}>
                <View style={styles.agendaColumn}>
                  <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionTitle}>{t('upcoming')}</Text>
                    </View>
                    <ScrollView style={styles.agendaScroll} showsVerticalScrollIndicator={true}>
                      {next5.length === 0 ? (
                        <Text style={[styles.emptyText, { marginVertical: 16 }]}>{t('bookingsNoData')}</Text>
                      ) : next5.map((b, i) => {
                        const prop = properties.find(p => p.id === b.propertyId);
                        const contact = contacts.find(c => c.id === b.contactId);
                        const propColor = prop?.parent_id ? '#2563EB' : '#C2920E';
                        const code = prop ? (prop.code + (prop.code_suffix ? ` (${prop.code_suffix})` : '')) : '—';
                        const daysUntil = dayjs(b.checkIn).diff(dayjs(), 'day');
                        return (
                          <View key={b.id} style={[styles.agendaItem, i < next5.length - 1 && { borderBottomWidth: 1, borderBottomColor: '#F8F9FA' }]}>
                            <View style={styles.upcomingDateBadge}>
                              <Text style={styles.upcomingDateDay}>{dayjs(b.checkIn).format('DD')}</Text>
                              <Text style={styles.upcomingDateMon}>{dayjs(b.checkIn).format('MMM')}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <View style={[styles.upcomingCodePill, { backgroundColor: propColor + '22', borderColor: propColor + '66', alignSelf: 'flex-start', marginBottom: 2 }]}>
                                <Text style={[styles.upcomingCodeText, { color: propColor }]}>{code}</Text>
                              </View>
                              <Text style={styles.upcomingGuest} numberOfLines={1}>
                                {contact ? [contact.name, contact.lastName].filter(Boolean).join(' ') : '—'}
                              </Text>
                            </View>
                            <Text style={[styles.upcomingDays, daysUntil <= 3 && { color: '#C97570' }]}>
                              {daysUntil === 1 ? t('tomorrow') : `${t('daysUntilPrefix')} ${daysUntil} ${t('daysUntilSuffix')}`}
                            </Text>
                          </View>
                        );
                      })}
                    </ScrollView>
                  </View>
                </View>
                {/* Пустое место справа (FlightTracker теперь плавающий) */}
                <View style={{ flex: 2 }} />
              </View>
            );
          })()}
        </View>

      </View>
      </View>{/* columnsGrid */}

      <WebAddCalendarEventModal
        visible={eventModalVisible}
        onClose={() => setEventModalVisible(false)}
        onSaved={handleEventSaved}
        editEvent={editingEvent}
        initialDate={selectedDate.toDate()}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, ...Platform.select({ web: { marginRight: -40, overflowY: 'scroll' } }) },
  containerContent: { ...Platform.select({ web: { paddingRight: 40 } }) },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 100 },
  welcome: { fontSize: 24, fontWeight: '700', color: '#212529', marginBottom: 30 },
  columnsGrid: {
    ...Platform.select({ web: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', columnGap: '20px', rowGap: '20px', overflowX: 'auto' } }),
  },
  calendarGridSpan: {
    ...Platform.select({ web: { gridColumn: '1 / -1' } }),
  },
  statsRow: { flexDirection: 'row', gap: 20, marginBottom: 30, ...Platform.select({ web: { display: 'contents' } }) },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 5,
    borderLeftColor: '#E8C977',
    justifyContent: 'space-between',
    minHeight: 140,
    ...Platform.select({ web: { boxShadow: '0 2px 8px rgba(0,0,0,0.04)' } }),
  },
  statCardObjects: {
    minHeight: 168,
    justifyContent: 'flex-start',
  },
  objectsWidgetRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    width: '100%',
  },
  objectsWidgetLeft: {
    flex: 1,
    minWidth: 0,
  },
  statLabel: { fontSize: 11, fontWeight: '800', color: '#ADB5BD', marginBottom: 6, letterSpacing: 0.5 },
  statValue: { fontSize: 28, fontWeight: '800', color: '#212529' },
  subStats: { flexDirection: 'row', flexWrap: 'nowrap', marginTop: 12, gap: 12, borderTopWidth: 1, borderTopColor: '#F8F9FA', paddingTop: 8 },
  subStatText: { fontSize: 11, color: '#868E96', fontWeight: '500', flexShrink: 0, ...Platform.select({ web: { whiteSpace: 'nowrap' } }) },
  subStatValue: { color: '#212529', fontWeight: '700' },
  // Agent stat card styles
  agentStatRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 2 },
  agentStatSep: { fontSize: 22, fontWeight: '400', color: '#CED4DA', marginHorizontal: 4 },
  agentStatLabels: { flexDirection: 'row', marginBottom: 4 },
  agentStatLabelGray: { fontSize: 11, color: '#ADB5BD', fontWeight: '500' },
  agentStatLabelColored: { fontSize: 11, fontWeight: '700' },
  mainContentRow: { flexDirection: 'column', gap: 20, ...Platform.select({ web: { display: 'contents' } }) },
  agendaContainer: { width: '100%', ...Platform.select({ web: { display: 'contents' } }) },

  agendaRow: { flexDirection: 'row', gap: 20, alignItems: 'stretch', ...Platform.select({ web: { display: 'contents' } }) },
  upcomingRow: { flexDirection: 'row', gap: 20, marginTop: 16, ...Platform.select({ web: { gridColumn: '1 / -1' } }) },
  agendaColumn: { flex: 1, flexDirection: 'column' },
  sectionCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingTop: 24,
    paddingBottom: 24,
    paddingLeft: 24,
    paddingRight: 24,
    maxHeight: 320,
    minHeight: 120,
    ...Platform.select({ web: { boxShadow: '0 4px 12px rgba(0,0,0,0.05)' } }),
  },
  sectionHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 12,
    paddingRight: 18,
    height: 28, 
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#212529' },
  addEventBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: CLR.evText,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusH: {
    position: 'absolute',
    width: 11,
    height: 2,
    borderRadius: 1,
    backgroundColor: CLR.evText,
  },
  plusV: {
    position: 'absolute',
    width: 2,
    height: 11,
    borderRadius: 1,
    backgroundColor: CLR.evText,
  },
  agendaScroll: { flex: 1 },
  agendaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F9FA',
  },
  statusBadge: {
    width: 36,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  agendaItemCompleted: {
    opacity: 0.6,
  },
  eventTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkIconBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: CLR.inText,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    flexShrink: 0,
  },
  checkIconText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  textDimmed: {
    color: '#ADB5BD',
  },
  badgeIn: { backgroundColor: CLR.inBg },
  badgeOut: { backgroundColor: CLR.outBg },
  badgePersonal: { backgroundColor: CLR.evBg },
  badgeComm: { backgroundColor: CLR.commBg },
  badgeText: { fontSize: 10, fontWeight: '900' },
  agendaInfo: { flex: 1 },
  agendaCode: { fontSize: 13, fontWeight: '700', color: '#212529', marginBottom: 2 },
  agendaPropName: { fontSize: 12, color: '#868E96', marginBottom: 2 },
  agendaClient: { fontSize: 13, color: '#3D7D82', fontWeight: '600' },
  agendaActions: { flexDirection: 'row', gap: 6 },
  msgBtn: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  phoneBtn: { backgroundColor: '#E8F5E9' },
  tgBtn: { backgroundColor: '#E3F2FD' },
  btnIcon: { width: 22, height: 22 },
  emptyText: { color: '#ADB5BD', fontSize: 14, fontStyle: 'italic', textAlign: 'center', marginTop: 40 },

  upcomingDateBadge: { width: 40, alignItems: 'center', marginRight: 12, flexShrink: 0 },
  upcomingDateDay:   { fontSize: 18, fontWeight: '800', color: '#212529', lineHeight: 20 },
  upcomingDateMon:   { fontSize: 11, fontWeight: '600', color: '#6C757D', textTransform: 'uppercase' },
  upcomingCodePill:  { borderRadius: 6, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  upcomingCodeText:  { fontSize: 11, fontWeight: '700' },
  upcomingGuest:     { fontSize: 13, color: '#212529', fontWeight: '500' },
  upcomingDays:      { fontSize: 12, fontWeight: '600', color: '#6C757D', flexShrink: 0 },
});
