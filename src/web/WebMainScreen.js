import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import WebLayout from './components/WebLayout';
import WebDashboardScreen from './screens/WebDashboardScreen';
import WebPropertiesScreen from './screens/WebPropertiesScreen';
import WebContactsScreen from './screens/WebContactsScreen';
import WebBookingsScreen from './screens/WebBookingsScreen';

/**
 * Точка входа в веб-интерфейс.
 * Управляет переключением вкладок.
 */
export default function WebMainScreen({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [propertiesInitialId, setPropertiesInitialId] = useState(null);

  const navigateToProperty = (propertyId) => {
    setPropertiesInitialId(propertyId);
    setActiveTab('properties');
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

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <WebDashboardScreen user={user} />;
      case 'properties':
        return <WebPropertiesScreen initialPropertyId={propertiesInitialId} />;
      case 'contacts':
        return <WebContactsScreen onNavigateToProperty={navigateToProperty} />;
      case 'bookings':
        return <WebBookingsScreen />;
      default:
        return (
          <View style={styles.card}>
            <Text style={styles.title}>Раздел: {activeTab}</Text>
            <Text style={styles.text}>Этот раздел находится в разработке.</Text>
          </View>
        );
    }
  };

  return (
    <WebLayout
      activeTab={activeTab}
      onTabChange={(tab) => { setActiveTab(tab); if (tab !== 'properties') setPropertiesInitialId(null); }}
      fullHeight={activeTab === 'properties' || activeTab === 'contacts' || activeTab === 'bookings'}
    >
      {renderContent()}
    </WebLayout>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    padding: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 15,
    color: '#212529',
  },
  text: {
    fontSize: 16,
    color: '#6C757D',
  },
});
