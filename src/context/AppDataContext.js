import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { initCompanyChannel, destroyCompanyChannel } from '../services/companyChannel';
import { signOut, getCurrentUser } from '../services/authService';
import { setKickedFlag } from '../utils/kickedFlag';
import { getProperties } from '../services/propertiesService';
import { getBookings } from '../services/bookingsService';
import { getContacts } from '../services/contactsService';
import { getCalendarEvents } from '../services/calendarEventsService';
import { getActiveTeamMembers } from '../services/companyService';

const AppDataContext = createContext(null);

export function AppDataProvider({ children, user }) {
  const [properties, setProperties] = useState([]);
  const [bookings, setBookings]     = useState([]);
  const [propertiesLoading, setPropertiesLoading] = useState(true);
  const [bookingsLoading, setBookingsLoading]     = useState(true);
  const [contacts, setContacts]               = useState([]);
  const [calendarEvents, setCalendarEvents]   = useState([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [eventsLoading, setEventsLoading]     = useState(true);
  const [teamMembers, setTeamMembers]         = useState([]);
  const [teamMembersLoading, setTeamMembersLoading] = useState(true);
  // Счётчик «снимка команды» — экраны CompanyScreen / WebTeamSection держат
  // свой локальный список members + invitations через getTeamData. AppDataContext
  // не управляет этими данными напрямую (приглашения здесь не лежат), но при
  // realtime-событии в company_members / company_invitations инкрементирует
  // счётчик — экраны слушают его в deps useEffect и перезагружают свой снимок.
  const [teamSnapshotVersion, setTeamSnapshotVersion] = useState(0);

  // For team members (agents) filter data to their own properties/bookings only
  const agentId = user?.teamMembership ? user.id : null;
  const isAdminUser = !user?.teamMembership;
  const companyId = user?.teamMembership?.companyId || user?.companyId || null;

  const refreshProperties = useCallback(async () => {
    try {
      const data = await getProperties(agentId);
      setProperties(data);
    } catch (e) {
      console.error('AppDataContext: refreshProperties', e);
    } finally {
      setPropertiesLoading(false);
    }
  }, [agentId]);

  const refreshBookings = useCallback(async () => {
    try {
      const data = await getBookings(null, null, agentId);
      setBookings(data);
    } catch (e) {
      console.error('AppDataContext: refreshBookings', e);
    } finally {
      setBookingsLoading(false);
    }
  }, [agentId]);

  const refreshContacts = useCallback(async () => {
    try {
      const data = await getContacts();
      setContacts(data);
    } catch (e) {
      console.error('AppDataContext: refreshContacts', e);
    } finally {
      setContactsLoading(false);
    }
  }, []);

  const refreshCalendarEvents = useCallback(async () => {
    try {
      const data = await getCalendarEvents();
      setCalendarEvents(data);
    } catch (e) {
      console.error('AppDataContext: refreshCalendarEvents', e);
    } finally {
      setEventsLoading(false);
    }
  }, []);

  const refreshTeamMembers = useCallback(async () => {
    if (!isAdminUser || !companyId) {
      setTeamMembers([]);
      setTeamMembersLoading(false);
      return;
    }
    try {
      const data = await getActiveTeamMembers(companyId);
      setTeamMembers(data || []);
    } catch (e) {
      console.error('AppDataContext: refreshTeamMembers', e);
    } finally {
      setTeamMembersLoading(false);
    }
  }, [isAdminUser, companyId]);

  const refreshAll = useCallback(() => {
    return Promise.all([
      refreshProperties(),
      refreshBookings(),
      refreshContacts(),
      refreshCalendarEvents(),
      refreshTeamMembers(),
    ]);
  }, [refreshProperties, refreshBookings, refreshContacts, refreshCalendarEvents, refreshTeamMembers]);

  // Все объекты после упрощения модели прав сразу одобрены — фильтр снят.
  const filteredBookings = bookings;

  const isLoaded = !propertiesLoading && !bookingsLoading && !contactsLoading && !eventsLoading && !teamMembersLoading;

  const loadingProgress = (
    (!propertiesLoading   ? 20 : 0) +
    (!bookingsLoading     ? 20 : 0) +
    (!contactsLoading     ? 20 : 0) +
    (!eventsLoading       ? 20 : 0) +
    (!teamMembersLoading  ? 20 : 0)
  );

  // Reload when user/agentId changes (login, profile update)
  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Realtime: подписка на изменения таблиц компании через postgres_changes.
  // События приходят от любых мутаций (клиент, RPC, edge function) — БД сама пишет WAL.
  useEffect(() => {
    if (!user?.id) return;
    const companyId = user?.teamMembership?.companyId || user?.companyId;
    if (!companyId) return;
    initCompanyChannel(companyId, {
      properties: () => refreshProperties(),
      bookings: () => refreshBookings(),
      contacts: () => refreshContacts(),
      calendar_events: () => refreshCalendarEvents(),
      company_members: async (payload) => {
        // TD-128: деактивация себя — ставим флаг с именем компании и выкидываем.
        // Модалка покажется на login через AppContent useEffect (SIGNED_OUT listener).
        if (
          payload?.eventType === 'UPDATE' &&
          payload?.new?.user_id === user.id &&
          payload?.new?.status === 'inactive' &&
          payload?.old?.status !== 'inactive'
        ) {
          const companyName = user?.teamMembership?.companyName || user?.companyInfo?.name || '';
          await setKickedFlag({ companyName });
          try { await signOut(); } catch {}
          return;
        }
        refreshTeamMembers();
        setTeamSnapshotVersion((v) => v + 1);
      },
      // Новый/изменённый/отозванный инвайт — пересобираем снимок команды на экранах.
      // refreshTeamMembers() здесь не нужен — getActiveTeamMembers фильтрует по active,
      // приглашений там нет.
      company_invitations: () => setTeamSnapshotVersion((v) => v + 1),
      agent_location_access: () => refreshAll(),
      // Перечитываем профиль текущего юзера — у компании могли поменяться поля,
      // на которые завязаны UserContext-производные (план, имя компании и т.п.).
      companies: async () => {
        const freshUser = await getCurrentUser();
        if (freshUser) refreshAll();
      },
    });
    return () => destroyCompanyChannel();
  }, [user?.id, user?.companyId, user?.teamMembership?.companyId, refreshProperties, refreshBookings, refreshContacts, refreshCalendarEvents, refreshTeamMembers, refreshAll]);

  const value = useMemo(() => ({
    properties,
    bookings: filteredBookings,
    propertiesLoading,
    bookingsLoading,
    refreshProperties,
    refreshBookings,
    contacts,
    calendarEvents,
    contactsLoading,
    eventsLoading,
    refreshContacts,
    refreshCalendarEvents,
    teamMembers,
    teamMembersLoading,
    refreshTeamMembers,
    teamSnapshotVersion,
    refreshAll,
    isLoaded,
    loadingProgress,
  }), [
    properties, filteredBookings, propertiesLoading, bookingsLoading,
    contacts, calendarEvents, contactsLoading, eventsLoading,
    teamMembers, teamMembersLoading, teamSnapshotVersion,
    refreshProperties, refreshBookings, refreshContacts, refreshCalendarEvents, refreshTeamMembers, refreshAll,
    isLoaded, loadingProgress,
  ]);

  return (
    <AppDataContext.Provider value={value}>
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used inside AppDataProvider');
  return ctx;
}
