import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import WebLayout from './components/WebLayout';
import WebDashboardScreen from './screens/WebDashboardScreen';
import WebPropertiesScreen from './screens/WebPropertiesScreen';
import WebContactsScreen from './screens/WebContactsScreen';
import WebBookingsScreen from './screens/WebBookingsScreen';
import WebFlightTracker from './components/WebFlightTracker';

const FULL_HEIGHT_TABS = new Set(['properties', 'contacts', 'bookings']);

/**
 * Точка входа в веб-интерфейс.
 * Управляет переключением вкладок.
 * Вкладки сохраняются в памяти после первого открытия (display:none вместо unmount)
 * — переключение становится мгновенным со второго посещения.
 */
export default function WebMainScreen({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [propertiesInitialId, setPropertiesInitialId] = useState(null);
  // Набор вкладок, которые уже были открыты (смонтированы)
  const [visited, setVisited] = useState(() => new Set(['dashboard']));

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
    >
      {/* Dashboard — монтируется сразу */}
      <View style={[styles.tabWrap, tabStyle('dashboard')]}>
        <WebDashboardScreen user={user} />
      </View>

      {/* Properties — монтируется при первом посещении */}
      {visited.has('properties') && (
        <View style={[styles.tabWrap, tabStyle('properties')]}>
          <WebPropertiesScreen initialPropertyId={propertiesInitialId} />
        </View>
      )}

      {/* Contacts — монтируется при первом посещении */}
      {visited.has('contacts') && (
        <View style={[styles.tabWrap, tabStyle('contacts')]}>
          <WebContactsScreen onNavigateToProperty={navigateToProperty} />
        </View>
      )}

      {/* Bookings — монтируется при первом посещении */}
      {visited.has('bookings') && (
        <View style={[styles.tabWrap, tabStyle('bookings')]}>
          <WebBookingsScreen />
        </View>
      )}

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
