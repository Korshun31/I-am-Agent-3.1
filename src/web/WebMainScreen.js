import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import WebLayout from './components/WebLayout';
import WebDashboardScreen from './screens/WebDashboardScreen';
import WebPropertiesScreen from './screens/WebPropertiesScreen';
import WebContactsScreen from './screens/WebContactsScreen';
import WebBookingsScreen from './screens/WebBookingsScreen';
import WebStatisticsScreen from './screens/WebStatisticsScreen';
import WebAccountScreen from './screens/WebAccountScreen';
import WebFlightTracker from './components/WebFlightTracker';
import { supabase } from '../services/supabase';
import { getUserProfile } from '../services/authService';
import { useLanguage } from '../context/LanguageContext';
import { useUser } from '../context/UserContext';
import { initCompanyChannel, destroyCompanyChannel, broadcastChange } from '../services/companyChannel';

const FULL_HEIGHT_TABS = new Set(['properties', 'contacts', 'bookings', 'profile']);

/**
 * Точка входа в веб-интерфейс.
 * TD-020: user теперь приходит только из UserContext (общий с App.js / mobile),
 * локальный useState убран. Обновления — через updateUser/handleUserUpdate.
 */
export default function WebMainScreen({ onLogout }) {
  const { t } = useLanguage();
  const { user, updateUser, handleUserUpdate } = useUser();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [propertiesInitialId, setPropertiesInitialId] = useState(null);
  const [visited, setVisited] = useState(() => new Set(['dashboard']));
  const [refreshKey, setRefreshKey] = useState({
    properties: 0, bookings: 0, contacts: 0, calendar_events: 0,
  });
  const [teamRefreshKey, setTeamRefreshKey] = useState(0);

  // Обновляем полный профиль пользователя при монтировании (с teamMembership, teamPermissions и т.д.)
  useEffect(() => {
    if (!user?.id) return;
    const fetchUser = async () => {
      const freshUser = await getUserProfile(user.id);
      if (freshUser) updateUser(freshUser);
    };
    fetchUser();
    // Грузим только при первом монтировании по id; updateUser стабилен (из контекста).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Broadcast: обновляем данные через лёгкий канал компании
  useEffect(() => {
    if (!user?.id) return;
    const companyId = user?.teamMembership?.companyId || user?.companyId;
    if (!companyId) return;
    initCompanyChannel(companyId, {
      properties: () => setRefreshKey(k => ({ ...k, properties: k.properties + 1 })),
      // A booking event also affects what contacts the current user can see
      // (TD-099: agent reads booking-clients via RLS) and the dashboard
      // counters (Мои брони / occupied / upcoming). Bump the related keys
      // so those screens refetch instead of showing stale data until reload.
      bookings: () => setRefreshKey(k => ({
        ...k,
        bookings: k.bookings + 1,
        contacts: k.contacts + 1,
      })),
      contacts: () => setRefreshKey(k => ({ ...k, contacts: k.contacts + 1 })),
      calendar_events: () => setRefreshKey(k => ({ ...k, calendar_events: k.calendar_events + 1 })),
      permissions: async () => {
        const freshUser = await getUserProfile(user.id);
        if (freshUser) updateUser(freshUser);
      },
      team: () => setTeamRefreshKey(prev => prev + 1),
    });
    if (user?.isAgentRole) {
      setTimeout(() => broadcastChange('team'), 1000);
    }
    return () => destroyCompanyChannel();
  }, [user?.id, user?.companyId, user?.teamMembership?.companyId]);

  // Realtime notifications logic
  useEffect(() => {
    if (!user || Platform.OS !== 'web') return;

    // Request browser notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const showToast = (title, body) => {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/favicon.ico' });
      }
    };

    const channel = supabase
      .channel('web-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bookings' }, payload => {
        if (user.web_notifications?.new_booking && payload.new.user_id !== user.id) {
          showToast(t('notifNewBooking'), t('bkNewTitle'));
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bookings' }, payload => {
        if (user.web_notifications?.booking_changed && payload.new.user_id !== user.id) {
          showToast(t('notifBookingChanged'), `${t('edit')}: ${payload.new.check_in} - ${payload.new.check_out}`);
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'calendar_events' }, payload => {
        if (user.web_notifications?.new_event && payload.new.user_id !== user.id) {
          showToast(t('notifNewEvent'), payload.new.title);
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'properties' }, payload => {
        if (user.web_notifications?.new_property && payload.new.user_id !== user.id) {
          showToast(t('notifNewProperty'), payload.new.name);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, t]);

  const navigateToProperty = (propertyId) => {
    setPropertiesInitialId(propertyId);
    setVisited(prev => new Set([...prev, 'properties']));
    setActiveTab('properties');
  };

  const handleTabChange = (tab) => {
    setVisited(prev => new Set([...prev, tab]));
    setActiveTab(tab);
    if (tab !== 'properties') setPropertiesInitialId(null);
  };

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes sb-fadein  { from { opacity: 0; } to { opacity: 1; } }
      @keyframes sb-fadeout { from { opacity: 1; } to { opacity: 0; } }

      * { scrollbar-width: thin; scrollbar-color: transparent transparent; }

      ::-webkit-scrollbar { width: 5px; height: 5px; }
      ::-webkit-scrollbar-track { background: transparent; }

      ::-webkit-scrollbar-thumb {
        background: rgba(0,0,0,0.22);
        border-radius: 4px;
        opacity: 0;
        animation: sb-fadeout 0.5s ease 0s 1 forwards;
      }
      *.scrolling { scrollbar-color: rgba(0,0,0,0.22) transparent; }
      *.scrolling::-webkit-scrollbar-thumb {
        animation: sb-fadein 0.25s ease 0s 1 forwards;
      }
    `;
    document.head.appendChild(style);

    const timers = new WeakMap();
    const onScroll = (e) => {
      const el = e.target;
      if (!el || !el.classList) return;
      el.classList.add('scrolling');
      if (timers.has(el)) clearTimeout(timers.get(el));
      timers.set(el, setTimeout(() => el.classList.remove('scrolling'), 800));
    };
    document.addEventListener('scroll', onScroll, true);

    return () => {
      document.head.removeChild(style);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, []);

  const isActive = (tab) => tab === activeTab;
  const tabStyle = (tab) => isActive(tab) ? styles.tabVisible : styles.tabHidden;

  return (
    <WebLayout
      activeTab={activeTab}
      onTabChange={handleTabChange}
      fullHeight={FULL_HEIGHT_TABS.has(activeTab)}
      user={user}
      onPropertiesChanged={() => setRefreshKey(k => ({
        ...k,
        properties: k.properties + 1,
        // Bookings tab caches the property list (with responsible_agent_id)
        // and uses it to show/hide the "Responsible agent" picker in the
        // booking form. Bump bookings key too so the picker stays in sync
        // when admin changes a property's responsible agent.
        bookings: k.bookings + 1,
      }))}
      onNavigateToProperty={navigateToProperty}
    >
      {/* Dashboard — монтируется сразу */}
      <View style={[styles.tabWrap, tabStyle('dashboard')]}>
        <WebDashboardScreen
          user={user}
          // Dashboard reads bookings, properties and calendar events to build
          // its counters and check-in/out lists. A composite key forces
          // refetch when any of those change in the company.
          refreshKey={refreshKey.calendar_events + refreshKey.bookings + refreshKey.properties}
        />
      </View>

      {/* Properties — монтируется при первом посещении */}
      {visited.has('properties') && (
        <View style={[styles.tabWrap, tabStyle('properties')]}>
          <WebPropertiesScreen initialPropertyId={propertiesInitialId} user={user} refreshKey={refreshKey.properties} />
        </View>
      )}

      {/* Contacts — монтируется при первом посещении */}
      {visited.has('contacts') && (
        <View style={[styles.tabWrap, tabStyle('contacts')]}>
          <WebContactsScreen onNavigateToProperty={navigateToProperty} user={user} refreshKey={refreshKey.contacts} />
        </View>
      )}

      {/* Bookings — монтируется при первом посещении */}
      {visited.has('bookings') && (
        <View style={[styles.tabWrap, tabStyle('bookings')]}>
          <WebBookingsScreen user={user} refreshKey={refreshKey.bookings} />
        </View>
      )}

      {/* Statistics — монтируется при первом посещении */}
      {visited.has('statistics') && (
        <View style={[styles.tabWrap, tabStyle('statistics')]}>
          <WebStatisticsScreen user={user} refreshKey={refreshKey.bookings + refreshKey.properties} />
        </View>
      )}

      {/* Account — монтируется при первом посещении */}
      {visited.has('profile') && (
        <View style={[styles.tabWrap, tabStyle('profile')]}>
          <WebAccountScreen user={user} onLogout={onLogout} onUserUpdate={handleUserUpdate} teamRefreshKey={teamRefreshKey} />
        </View>
      )}

      <WebFlightTracker />
    </WebLayout>
  );
}

const styles = StyleSheet.create({
  tabWrap: {
    flex: 1,
    minHeight: 0,
  },
  tabVisible: {
    display: 'flex',
  },
  tabHidden: {
    display: 'none',
  },
});
