import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getProperties } from '../services/propertiesService';
import { getBookings } from '../services/bookingsService';

const AppDataContext = createContext(null);

export function AppDataProvider({ children }) {
  const [properties, setProperties] = useState([]);
  const [bookings, setBookings]     = useState([]);
  const [propertiesLoading, setPropertiesLoading] = useState(true);
  const [bookingsLoading, setBookingsLoading]     = useState(true);

  const refreshProperties = useCallback(async () => {
    try {
      const data = await getProperties();
      setProperties(data);
    } catch (e) {
      console.error('AppDataContext: refreshProperties', e);
    } finally {
      setPropertiesLoading(false);
    }
  }, []);

  const refreshBookings = useCallback(async () => {
    try {
      const data = await getBookings();
      setBookings(data);
    } catch (e) {
      console.error('AppDataContext: refreshBookings', e);
    } finally {
      setBookingsLoading(false);
    }
  }, []);

  const refreshAll = useCallback(() => {
    return Promise.all([refreshProperties(), refreshBookings()]);
  }, [refreshProperties, refreshBookings]);

  // Load once on app start
  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  return (
    <AppDataContext.Provider value={{
      properties,
      bookings,
      propertiesLoading,
      bookingsLoading,
      refreshProperties,
      refreshBookings,
      refreshAll,
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
