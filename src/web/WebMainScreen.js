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
import { useAppData } from '../context/AppDataContext';

const FULL_HEIGHT_TABS = new Set(['properties', 'contacts', 'bookings', 'profile']);

/**
 * Точка входа в веб-интерфейс.
 * TD-020: user теперь приходит только из UserContext (общий с App.js / mobile),
 * локальный useState убран. Обновления — через updateUser/handleUserUpdate.
 */
export default function WebMainScreen({ onLogout }) {
  const { t } = useLanguage();
  const { user, updateUser, handleUserUpdate } = useUser();
  const { refreshProperties, refreshBookings } = useAppData();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [propertiesInitialId, setPropertiesInitialId] = useState(null);
  const [visited, setVisited] = useState(() => new Set(['dashboard']));

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
      onPropertiesChanged={() => { refreshProperties(); refreshBookings(); }}
      onNavigateToProperty={navigateToProperty}
    >
      {/* Dashboard — монтируется сразу */}
      <View style={[styles.tabWrap, tabStyle('dashboard')]}>
        <WebDashboardScreen user={user} />
      </View>

      {/* Properties — монтируется при первом посещении */}
      {visited.has('properties') && (
        <View style={[styles.tabWrap, tabStyle('properties')]}>
          <WebPropertiesScreen initialPropertyId={propertiesInitialId} user={user} />
        </View>
      )}

      {/* Contacts — монтируется при первом посещении */}
      {visited.has('contacts') && (
        <View style={[styles.tabWrap, tabStyle('contacts')]}>
          <WebContactsScreen onNavigateToProperty={navigateToProperty} user={user} />
        </View>
      )}

      {/* Bookings — монтируется при первом посещении */}
      {visited.has('bookings') && (
        <View style={[styles.tabWrap, tabStyle('bookings')]}>
          <WebBookingsScreen user={user} />
        </View>
      )}

      {/* Statistics — монтируется при первом посещении */}
      {visited.has('statistics') && (
        <View style={[styles.tabWrap, tabStyle('statistics')]}>
          <WebStatisticsScreen user={user} />
        </View>
      )}

      {/* Account — монтируется при первом посещении */}
      {visited.has('profile') && (
        <View style={[styles.tabWrap, tabStyle('profile')]}>
          <WebAccountScreen user={user} onLogout={onLogout} onUserUpdate={handleUserUpdate} />
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
