import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform, Linking, Image } from 'react-native';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { useLanguage } from '../../context/LanguageContext';
import { getBookings } from '../../services/bookingsService';
import { getProperties } from '../../services/propertiesService';
import { getContacts } from '../../services/contactsService';
import { getCalendarEvents, eventOccursOnDate } from '../../services/calendarEventsService';
import { getCommissionDateAmounts } from '../../services/commissionRemindersService';
import { supabase } from '../../services/supabase';
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
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0, houses: 0, resortHouses: 0, apartments: 0,
    occupied: 0, myClients: 0, otherClients: 0,
    upcoming: 0, thisMonth: 0, later: 0
  });
  const [allBookings, setAllBookings] = useState([]);
  const [allProperties, setAllProperties] = useState([]);
  const [allContacts, setAllContacts] = useState([]);
  const [allCalendarEvents, setAllCalendarEvents] = useState([]);
  const [allCommissionEvents, setAllCommissionEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [filteredEvents, setFilteredEvents] = useState({ checkIns: [], checkOuts: [], personal: [] });
  const [agentStats, setAgentStats] = useState(null); // только для team members
  
  // Состояние для модального окна событий
  const [eventModalVisible, setEventModalVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  const loadDashboardData = async () => {
    try {
      const [bookings, properties, contacts, calendarEvents] = await Promise.all([
        getBookings(),
        getProperties(),
        getContacts('clients'),
        getCalendarEvents()
      ]);

      setAllBookings(bookings);
      setAllProperties(properties);
      setAllContacts(contacts);
      setAllCalendarEvents(calendarEvents);

      // Расчет всех комиссионных событий
      const allComms = [];
      bookings.forEach(b => {
        if (b.ownerCommissionOneTime || b.ownerCommissionMonthly) {
          const dates = getCommissionDateAmounts(b.checkIn, b.checkOut, b.ownerCommissionOneTime, b.ownerCommissionMonthly);
          const prop = properties.find(p => p.id === b.propertyId);
          dates.forEach(d => {
            allComms.push({
              ...d,
              id: `comm-${b.id}-${d.date}`,
              bookingId: b.id,
              propertyId: b.propertyId,
              propertyCode: prop?.code || '—',
              propertyName: prop?.name || '—',
              type: 'COMMISSION'
            });
          });
        }
      });
      setAllCommissionEvents(allComms);

      const now = dayjs();
      const endOfMonth = now.endOf('month');
      const isTeamMemberStats = !!(user?.teamMembership);
      const propsMapStats = {};
      properties.forEach(p => { propsMapStats[p.id] = p; });

      // Для агента: только свои объекты (по responsible_agent_id)
      const countableProperties = isTeamMemberStats
        ? properties.filter(p => p.responsible_agent_id === user.id)
        : properties;

      // 1. Статистика по типам (только своих объектов для агента)
      let standaloneHouses = 0;
      let resortHousesCount = 0;
      let apartmentsCount = 0;
      countableProperties.forEach(p => {
        if (p.type === 'house') {
          if (!p.resort_id) standaloneHouses++;
          else {
            const parent = properties.find(parentProp => parentProp.id === p.resort_id);
            if (parent?.type === 'condo') apartmentsCount++;
            else resortHousesCount++;
          }
        }
      });

      // 2. Статистика занятости (для агента: только свои бронирования)
      let myClientsCount = 0;
      let otherClientsCount = 0;
      const bookingsForStats = isTeamMemberStats
        ? bookings.filter(b => b.agentId === user.id)
        : bookings;

      const occupiedCount = bookingsForStats.filter(b => {
        const start = dayjs(b.checkIn);
        const end = dayjs(b.checkOut);
        const isOccupied = now.isAfter(start) && now.isBefore(end);
        if (isOccupied) {
          if (b.notMyCustomer) otherClientsCount++;
          else myClientsCount++;
        }
        return isOccupied;
      }).length;

      const upcomingBookings = bookingsForStats.filter(b => dayjs(b.checkIn).isAfter(now));
      const thisMonthCount = upcomingBookings.filter(b => dayjs(b.checkIn).isBefore(endOfMonth)).length;

      setStats({
        total: standaloneHouses + resortHousesCount + apartmentsCount,
        houses: standaloneHouses,
        resortHouses: resortHousesCount,
        apartments: apartmentsCount,
        occupied: occupiedCount,
        myClients: myClientsCount,
        otherClients: otherClientsCount,
        upcoming: upcomingBookings.length,
        thisMonth: thisMonthCount,
        later: upcomingBookings.length - thisMonthCount
      });

      // Доп. статистика для участников команды (агентов)
      if (isTeamMemberStats) {
        // Объекты — подсчёт по категориям и ответственному
        let companyHouses = 0, companyResorts = 0, companyCondos = 0;
        let myHouses = 0, myResorts = 0, myCondos = 0;
        properties.forEach(p => {
          const isMine = p.responsible_agent_id === user?.id;
          if (p.type === 'resort' || p.type === 'condo') {
            // Верхнеуровневые контейнеры (резорт/кондо)
            if (p.type === 'resort') { companyResorts++; if (isMine) myResorts++; }
            else { companyCondos++; if (isMine) myCondos++; }
          } else if (p.type === 'house') {
            if (!p.resort_id) {
              companyHouses++; if (isMine) myHouses++;
            } else {
              const parent = propsMapStats[p.resort_id];
              if (parent?.type === 'condo') { companyCondos++; if (isMine) myCondos++; }
              else { companyResorts++; if (isMine) myResorts++; }
            }
          }
        });

        // Бронирования (активные сейчас)
        let companyAgencyActive = 0, companyOwnerActive = 0, myAgencyActive = 0;
        bookings.forEach(b => {
          const start = dayjs(b.checkIn);
          const end = dayjs(b.checkOut);
          if (!now.isAfter(start) || !now.isBefore(end)) return;
          if (b.notMyCustomer) { companyOwnerActive++; }
          else {
            companyAgencyActive++;
            if (b.agentId === user.id) myAgencyActive++;
          }
        });

        // Предстоящие заселения
        const allFutureAgency = bookings.filter(b => !b.notMyCustomer && dayjs(b.checkIn).isAfter(now));
        const myFutureAgency = allFutureAgency.filter(b => b.agentId === user.id);
        const companyUpcomingCount = allFutureAgency.length;
        const myUpcomingCount = myFutureAgency.length;
        const myThisMonth = myFutureAgency.filter(b => dayjs(b.checkIn).isBefore(endOfMonth)).length;
        const myLater = myUpcomingCount - myThisMonth;

        // Заселения агента: сегодня / эта неделя / этот месяц
        const todayStr = now.format('YYYY-MM-DD');
        const endOfWeek = now.endOf('week');
        const myBookings = bookings.filter(b => b.agentId === user.id && !b.notMyCustomer);
        const myCheckInToday = myBookings.filter(b => b.checkIn === todayStr).length;
        const myCheckInWeek = myBookings.filter(b => {
          const d = dayjs(b.checkIn);
          return d.isAfter(now.startOf('day').subtract(1, 'ms')) && d.isBefore(endOfWeek.add(1, 'ms'));
        }).length;
        const myCheckInMonth = myBookings.filter(b => {
          const d = dayjs(b.checkIn);
          return d.isAfter(now.startOf('month').subtract(1, 'ms')) && d.isBefore(endOfMonth.add(1, 'ms'));
        }).length;

        setAgentStats({
          companyTotal: companyHouses + companyResorts + companyCondos,
          companyHouses, companyResorts, companyCondos,
          myTotal: myHouses + myResorts + myCondos,
          myHouses, myResorts, myCondos,
          companyAgencyActive, companyOwnerActive, myAgencyActive,
          companyTotalActive: companyAgencyActive + companyOwnerActive,
          companyUpcoming: companyUpcomingCount,
          myUpcoming: myUpcomingCount,
          myThisMonth, myLater,
          myCheckInToday, myCheckInWeek, myCheckInMonth,
        });
      } else {
        setAgentStats(null);
      }

      updateEventsForDate(selectedDate, bookings, properties, contacts, calendarEvents, allComms);
    } catch (e) {
      console.error('Dashboard load error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Ref всегда указывает на актуальную версию loadDashboardData (с текущим selectedDate в замыкании)
  const loadDashboardDataRef = useRef(loadDashboardData);
  useEffect(() => {
    loadDashboardDataRef.current = loadDashboardData;
  });

  useEffect(() => {
    const channel = supabase
      .channel('dashboard-calendar-events-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, (payload) => {
        console.log('[Realtime] dashboard calendar_events change:', payload);
        loadDashboardDataRef.current();
      })
      .subscribe((status, err) => {
        console.log('[Realtime] Dashboard subscription status:', status, err || '');
      });
    return () => { supabase.removeChannel(channel); };
  }, []);

  const updateEventsForDate = (date, bookings, properties, contacts, calendarEvents, allComms) => {
    const dateStr = date.format('YYYY-MM-DD');
    const isTeamMember = !!(user?.teamMembership);
    const propsMap = {};
    properties.forEach(p => { propsMap[p.id] = p; });

    const enrich = (b) => {
      const prop = propsMap[b.propertyId];
      const client = contacts.find(c => c.id === b.contactId);
      return {
        ...b,
        propertyName: prop?.name || 'Без названия',
        propertyCode: prop?.code || '—',
        clientName: client ? `${client.name} ${client.lastName}` : '—',
        clientPhone: client?.phone || '',
        clientTelegram: client?.telegram || '',
      };
    };

    // Заселения: свои клиенты (не клиенты собственника) из своих объектов
    const ins = bookings.filter(b => {
      if (b.checkIn !== dateStr || b.notMyCustomer) return false;
      if (isTeamMember) return propsMap[b.propertyId]?.responsible_agent_id === user.id;
      return true;
    }).map(enrich);

    // Выселения: все бронирования из своих объектов (включая клиентов собственника)
    const outs = bookings.filter(b => {
      if (b.checkOut !== dateStr) return false;
      if (isTeamMember) return propsMap[b.propertyId]?.responsible_agent_id === user.id;
      return true;
    }).map(enrich);

    // Комиссии: только из своих объектов
    const commissions = allComms.filter(c => {
      if (c.date !== dateStr) return false;
      if (isTeamMember) return propsMap[c.propertyId]?.responsible_agent_id === user.id;
      return true;
    });

    // Личные события всегда видны (они созданы самим пользователем)
    const personal = calendarEvents
      .filter(e => eventOccursOnDate(e, dateStr))
      .map(e => ({ 
        ...e, 
        type: 'PERSONAL',
        time: e.eventTime
      }));

    setFilteredEvents({ 
      checkIns: ins, 
      checkOuts: outs, 
      personal: [...personal, ...commissions] 
    });
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    updateEventsForDate(date, allBookings, allProperties, allContacts, allCalendarEvents, allCommissionEvents);
  };

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
    await loadDashboardData();
    // loadDashboardData уже обновляет allCalendarEvents — берём обновлённое событие из стейта
    if (editingEvent) {
      setAllCalendarEvents(prev => {
        const updated = prev.find(e => e.id === editingEvent.id);
        if (updated) setEditingEvent(updated);
        return prev;
      });
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
            <Text style={styles.agendaCode}>Комиссия: {item.amount} THB</Text>
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
      
      <View style={styles.statsRow}>
        {/* ОБЪЕКТОВ */}
        <View style={[styles.statCard, { borderLeftColor: CLR.stat1 }]}>
          <View>
            <Text style={styles.statLabel}>{t('dashboardObjects').toUpperCase()}</Text>
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
            <View style={[styles.subStats, { flexWrap: 'wrap' }]}>
              {[
                { label: t('house'),  co: agentStats.companyHouses,  my: agentStats.myHouses  },
                { label: t('resort'), co: agentStats.companyResorts, my: agentStats.myResorts },
                { label: t('condo'),  co: agentStats.companyCondos,  my: agentStats.myCondos  },
              ].map(({ label, co, my }) => (
                <Text key={label} style={styles.subStatText}>
                  {label}{': '}
                  <Text style={{ color: '#ADB5BD', fontWeight: '700' }}>{co}</Text>
                  <Text style={{ color: '#CED4DA' }}>{' / '}</Text>
                  <Text style={[styles.subStatValue, { color: CLR.stat1Text }]}>{my}</Text>
                </Text>
              ))}
            </View>
          ) : (
            <View style={styles.subStats}>
              <Text style={styles.subStatText}>{t('house')}: <Text style={styles.subStatValue}>{stats.houses}</Text></Text>
              <Text style={styles.subStatText}>{t('resort')}: <Text style={styles.subStatValue}>{stats.resortHouses}</Text></Text>
              <Text style={styles.subStatText}>{t('condo')}: <Text style={styles.subStatValue}>{stats.apartments}</Text></Text>
            </View>
          )}
        </View>

        {/* БРОНИРОВАНИЙ */}
        <View style={[styles.statCard, { borderLeftColor: CLR.stat2 }]}>
          <View>
            <Text style={styles.statLabel}>{t('dashboardBookings').toUpperCase()}</Text>
            {agentStats ? (
              <>
                <Text style={[styles.statValue, { color: CLR.stat2Text }]}>{agentStats.myAgencyActive}</Text>
                <View style={styles.agentStatLabels}>
                  <Text style={[styles.agentStatLabelColored, { color: CLR.stat2Text }]}>{t('dashboardStatMine')}</Text>
                </View>
              </>
            ) : (
              <Text style={[styles.statValue, { color: CLR.stat2Text }]}>{stats.occupied}</Text>
            )}
          </View>

          {agentStats ? (
            <View style={styles.subStats}>
              <Text style={styles.subStatText}>{t('all')}{': '}
                <Text style={{ color: '#ADB5BD', fontWeight: '700' }}>{agentStats.companyTotalActive}</Text>
              </Text>
              <Text style={styles.subStatText}>{t('dashboardStatOwners')}{': '}
                <Text style={{ color: '#ADB5BD', fontWeight: '700' }}>{agentStats.companyOwnerActive}</Text>
              </Text>
              <Text style={styles.subStatText}>{t('dashboardStatCompany')}{': '}
                <Text style={{ color: '#ADB5BD', fontWeight: '700' }}>{agentStats.companyAgencyActive}</Text>
              </Text>
            </View>
          ) : (
            <View style={styles.subStats}>
              <Text style={styles.subStatText}>{t('dashboardMyClients')}: <Text style={styles.subStatValue}>{stats.myClients}</Text></Text>
              <Text style={styles.subStatText}>{t('dashboardOtherClients')}: <Text style={styles.subStatValue}>{stats.otherClients}</Text></Text>
            </View>
          )}
        </View>

        {/* ЗАЕЗДЫ */}
        <View style={[styles.statCard, { borderLeftColor: CLR.stat3 }]}>
          <View>
            <Text style={styles.statLabel}>
              {agentStats ? t('dashboardCheckInsAgent').toUpperCase() : t('dashboardCheckIns').toUpperCase()}
            </Text>
            {agentStats ? (
              <View style={[styles.agentStatRow, { gap: 20, marginTop: 8 }]}>
                <View style={styles.agentSubItem}>
                  <Text style={[styles.statValue, { color: CLR.stat3Text }]}>{agentStats.myCheckInToday}</Text>
                  <Text style={[styles.agentSubLabel, { color: CLR.stat3Text }]}>{t('dashboardStatToday')}</Text>
                </View>
                <View style={styles.agentSubItem}>
                  <Text style={[styles.statValue, { color: '#ADB5BD' }]}>{agentStats.myCheckInWeek}</Text>
                  <Text style={styles.agentSubLabelGray}>{t('dashboardStatWeek')}</Text>
                </View>
                <View style={styles.agentSubItem}>
                  <Text style={[styles.statValue, { color: '#ADB5BD' }]}>{agentStats.myCheckInMonth}</Text>
                  <Text style={styles.agentSubLabelGray}>{t('thisMonth')}</Text>
                </View>
              </View>
            ) : (
              <Text style={[styles.statValue, { color: CLR.stat3Text }]}>{stats.upcoming}</Text>
            )}
          </View>

          {agentStats ? null : (
            <View style={styles.subStats}>
              <Text style={styles.subStatText}>{t('thisMonth')}: <Text style={styles.subStatValue}>{stats.thisMonth}</Text></Text>
              <Text style={styles.subStatText}>{t('later')}: <Text style={styles.subStatValue}>{stats.later}</Text></Text>
            </View>
          )}
        </View>
      </View>

      <WebCalendarStrip 
        selectedDate={selectedDate} 
        onDateSelect={handleDateSelect}
        user={user}
      />

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
            allProperties.forEach(p => { propsMapUpcoming[p.id] = p; });
            const next5 = allBookings
              .filter(b => {
                if (b.checkIn <= today || b.notMyCustomer) return false;
                if (isTeamMemberUpcoming) return propsMapUpcoming[b.propertyId]?.responsible_agent_id === user.id;
                return true;
              })
              .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
              .slice(0, 5);
            return (
              <View style={styles.upcomingRow}>
                <View style={styles.agendaColumn}>
                  <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionTitle}>{t('upcoming')}</Text>
                    </View>
                    {next5.length === 0 ? (
                      <Text style={[styles.emptyText, { marginVertical: 16 }]}>{t('bookingsNoData')}</Text>
                    ) : next5.map((b, i) => {
                      const prop = allProperties.find(p => p.id === b.propertyId);
                      const contact = allContacts.find(c => c.id === b.contactId);
                      const propColor = prop?.resort_id ? '#2563EB' : '#C2920E';
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
                            {daysUntil === 1 ? 'завтра' : `через ${daysUntil} д.`}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
                {/* Пустое место справа (FlightTracker теперь плавающий) */}
                <View style={{ flex: 2 }} />
              </View>
            );
          })()}
        </View>

      </View>

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
  statsRow: { flexDirection: 'row', gap: 20, marginBottom: 30 },
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
  statLabel: { fontSize: 11, fontWeight: '800', color: '#ADB5BD', marginBottom: 6, letterSpacing: 0.5 },
  statValue: { fontSize: 28, fontWeight: '800', color: '#212529' },
  subStats: { flexDirection: 'row', marginTop: 12, gap: 12, borderTopWidth: 1, borderTopColor: '#F8F9FA', paddingTop: 8 },
  subStatText: { fontSize: 11, color: '#868E96', fontWeight: '500' },
  subStatValue: { color: '#212529', fontWeight: '700' },
  // Agent stat card styles
  agentStatRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 2 },
  agentStatSep: { fontSize: 22, fontWeight: '400', color: '#CED4DA', marginHorizontal: 4 },
  agentStatLabels: { flexDirection: 'row', marginBottom: 4 },
  agentStatLabelGray: { fontSize: 11, color: '#ADB5BD', fontWeight: '500' },
  agentStatLabelColored: { fontSize: 11, fontWeight: '700' },
  agentSubItem: { alignItems: 'center', flex: 1 },
  agentSubValue: { fontSize: 20, fontWeight: '800', marginBottom: 2 },
  agentSubValueGray: { fontSize: 20, fontWeight: '800', color: '#ADB5BD', marginBottom: 2 },
  agentSubLabel: { fontSize: 10, fontWeight: '600' },
  agentSubLabelGray: { fontSize: 10, fontWeight: '500', color: '#ADB5BD' },
  
  mainContentRow: { flexDirection: 'column', gap: 20 },
  agendaContainer: { width: '100%' },

  agendaRow: { flexDirection: 'row', gap: 20, alignItems: 'stretch' },
  upcomingRow: { flexDirection: 'row', gap: 20, marginTop: 16 },
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
