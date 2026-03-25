import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { getProperties } from '../services/propertiesService';
import { getBookings } from '../services/bookingsService';
import { getContacts } from '../services/contactsService';
import { getCalendarEvents } from '../services/calendarEventsService';

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

  // For team members (agents) filter data to their own properties/bookings only
  const agentId = user?.teamMembership ? user.id : null;

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

  const refreshAll = useCallback(() => {
    return Promise.all([
      refreshProperties(),
      refreshBookings(),
      refreshContacts(),
      refreshCalendarEvents(),
    ]);
  }, [refreshProperties, refreshBookings, refreshContacts, refreshCalendarEvents]);

  // Бронирования только для утверждённых объектов (pending/rejected исключены)
  const filteredBookings = useMemo(() => {
    const approvedIds = new Set(
      properties
        .filter(p => !p.property_status || p.property_status === 'approved')
        .map(p => p.id)
    );
    return bookings.filter(b => approvedIds.has(b.propertyId));
  }, [properties, bookings]);

  const isLoaded = !propertiesLoading && !bookingsLoading && !contactsLoading && !eventsLoading;

  const loadingProgress = (
    (!propertiesLoading ? 25 : 0) +
    (!bookingsLoading   ? 25 : 0) +
    (!contactsLoading   ? 25 : 0) +
    (!eventsLoading     ? 25 : 0)
  );

  // Reload when user/agentId changes (login, profile update)
  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Realtime: обновляем объекты при изменениях на сервере (напр. утверждение черновика админом)
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`properties-sync-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'properties',
      }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          refreshProperties();
        }
        if (payload.eventType === 'DELETE') {
          const deletedId = payload.old?.id;
          if (deletedId) {
            setProperties(prev => prev.filter(p => p.id !== deletedId));
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, refreshProperties]);

  return (
    <AppDataContext.Provider value={{
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
      refreshAll,
      isLoaded,
      loadingProgress,
    }}>
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used inside AppDataProvider');
  return ctx;
}
