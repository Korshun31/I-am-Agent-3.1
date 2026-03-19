import React, { useState, useCallback, memo, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BottomNav from '../components/BottomNav';
import AccountScreen from './AccountScreen';
import ContactsScreen from './ContactsScreen';
import StatisticsScreen from './StatisticsScreen';
import RealEstateScreen from './RealEstateScreen';
import BookingCalendarScreen from './BookingCalendarScreen';
import AgentCalendarScreen from './AgentCalendarScreen';

// Мемоизируем тяжёлые экраны — перерисовываются только если изменились их пропсы
const MemoRealEstate      = memo(RealEstateScreen);
const MemoBookingCalendar = memo(BookingCalendarScreen);
const MemoAgentCalendar   = memo(AgentCalendarScreen);

export default function MainScreen({ onLogout, user, onUserUpdate }) {
  const [activeTab, setActiveTab] = useState(3);
  const [screenWithinAccount, setScreenWithinAccount] = useState('account');
  const [propertyToOpen, setPropertyToOpen] = useState(null);

  // Отслеживаем какие вкладки уже посещались — монтируем только при первом визите
  const visitedRef = useRef(new Set([3])); // Аккаунт открыт по умолчанию
  const [visited, setVisited] = useState(new Set([3]));

  const handleOpenProperty = useCallback((property) => {
    if (property) {
      setPropertyToOpen(property);
      setActiveTab(0);
      if (!visitedRef.current.has(0)) {
        visitedRef.current = new Set([...visitedRef.current, 0]);
        setVisited(new Set(visitedRef.current));
      }
    }
  }, []);

  const handlePropertyOpened = useCallback(() => setPropertyToOpen(null), []);

  const handleTabSelect = useCallback((newIndex) => {
    setActiveTab(prev => {
      if (newIndex === prev) return prev;
      if (prev === 3) setScreenWithinAccount('account');
      return newIndex;
    });
    // Помечаем вкладку как посещённую — контент монтируется
    if (!visitedRef.current.has(newIndex)) {
      visitedRef.current = new Set([...visitedRef.current, newIndex]);
      setVisited(new Set(visitedRef.current));
    }
  }, []);

  return (
    <View style={styles.container}>
      <View style={[styles.tabPanel, activeTab !== 0 && styles.tabPanelHidden]}>
        {visited.has(0) && (
          <MemoRealEstate
            propertyToOpen={propertyToOpen}
            onPropertyOpened={handlePropertyOpened}
            isVisible={activeTab === 0}
          />
        )}
      </View>
      <View style={[styles.tabPanel, activeTab !== 1 && styles.tabPanelHidden]}>
        {visited.has(1) && (
          <MemoBookingCalendar isVisible={activeTab === 1} />
        )}
      </View>
      <View style={[styles.tabPanel, activeTab !== 2 && styles.tabPanelHidden]}>
        {visited.has(2) && (
          <MemoAgentCalendar isVisible={activeTab === 2} onOpenProperty={handleOpenProperty} />
        )}
      </View>
      <View style={[styles.tabPanel, activeTab !== 3 && styles.tabPanelHidden]}>
        {screenWithinAccount === 'contacts' ? (
          <ContactsScreen onBack={() => setScreenWithinAccount('account')} />
        ) : screenWithinAccount === 'statistics' ? (
          <StatisticsScreen onBack={() => setScreenWithinAccount('account')} />
        ) : (
          <AccountScreen
            onLogout={onLogout}
            user={user || {}}
            onUserUpdate={onUserUpdate}
            onOpenContacts={() => setScreenWithinAccount('contacts')}
            onOpenStatistics={() => setScreenWithinAccount('statistics')}
            isVisible={activeTab === 3}
          />
        )}
      </View>
      <View style={styles.navOverlay} pointerEvents="box-none">
        <BottomNav activeTab={activeTab} onSelect={handleTabSelect} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F2EB',
  },
  tabPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  tabPanelHidden: {
    opacity: 0,
    pointerEvents: 'none',
  },
  navOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  placeholder: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C2C2C',
    marginBottom: 8,
    textAlign: 'center',
  },
  hint: {
    fontSize: 14,
    color: '#6B6B6B',
  },
});
