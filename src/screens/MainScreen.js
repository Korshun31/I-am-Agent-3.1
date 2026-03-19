import React, { useState, useCallback, memo, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BottomNav from '../components/BottomNav';
import AccountScreen from './AccountScreen';
import ContactsScreen from './ContactsScreen';
import StatisticsScreen from './StatisticsScreen';
import RealEstateScreen from './RealEstateScreen';
import BookingCalendarScreen from './BookingCalendarScreen';
import AgentCalendarScreen from './AgentCalendarScreen';

const MemoRealEstate      = memo(RealEstateScreen);
const MemoBookingCalendar = memo(BookingCalendarScreen);
const MemoAgentCalendar   = memo(AgentCalendarScreen);

export default function MainScreen({ onLogout, user, onUserUpdate }) {
  const [activeTab, setActiveTab] = useState(3);
  const [screenWithinAccount, setScreenWithinAccount] = useState('account');
  const [propertyToOpen, setPropertyToOpen] = useState(null);

  const visitedRef = useRef(new Set([3]));
  const [visited, setVisited] = useState(new Set([3]));
  const activeTabRef = useRef(3);

  // Refs на нативные View — для мгновенного обновления opacity без React
  const tab0Ref = useRef(null);
  const tab1Ref = useRef(null);
  const tab2Ref = useRef(null);
  const tab3Ref = useRef(null);

  const handleOpenProperty = useCallback((property) => {
    if (property) {
      setPropertyToOpen(property);
      // Мгновенно показываем вкладку База через нативный слой
      const refs = [tab0Ref, tab1Ref, tab2Ref, tab3Ref];
      refs.forEach((ref, i) => {
        ref.current?.setNativeProps({
          style: { opacity: i === 0 ? 1 : 0 },
          pointerEvents: i === 0 ? 'auto' : 'none',
        });
      });
      activeTabRef.current = 0;
      setActiveTab(0);
      if (!visitedRef.current.has(0)) {
        visitedRef.current = new Set([...visitedRef.current, 0]);
        setVisited(new Set(visitedRef.current));
      }
    }
  }, []);

  const handlePropertyOpened = useCallback(() => setPropertyToOpen(null), []);

  const handleTabSelect = useCallback((newIndex) => {
    const prevTab = activeTabRef.current;
    if (prevTab === newIndex) return;

    // ─── Мгновенное визуальное обновление через нативный слой ──────────────
    // Это идёт напрямую в UI без ожидания React — пользователь видит
    // смену вкладки в следующем нативном кадре (~16ms), а не через ~1 сек
    const refs = [tab0Ref, tab1Ref, tab2Ref, tab3Ref];
    refs.forEach((ref, i) => {
      ref.current?.setNativeProps({
        style: { opacity: i === newIndex ? 1 : 0 },
        pointerEvents: i === newIndex ? 'auto' : 'none',
      });
    });
    activeTabRef.current = newIndex;

    // ─── Асинхронное обновление React-состояния ─────────────────────────────
    // Происходит в фоне — UI уже показал нужную вкладку
    if (prevTab === 3) setScreenWithinAccount('account');
    setActiveTab(newIndex);
    if (!visitedRef.current.has(newIndex)) {
      visitedRef.current = new Set([...visitedRef.current, newIndex]);
      setVisited(new Set(visitedRef.current));
    }
  }, []);

  return (
    <View style={styles.container}>
      <View ref={tab0Ref} style={[styles.tabPanel, styles.tabPanelHidden]}>
        {visited.has(0) && (
          <MemoRealEstate
            propertyToOpen={propertyToOpen}
            onPropertyOpened={handlePropertyOpened}
            isVisible={activeTab === 0}
          />
        )}
      </View>
      <View ref={tab1Ref} style={[styles.tabPanel, styles.tabPanelHidden]}>
        {visited.has(1) && (
          <MemoBookingCalendar isVisible={activeTab === 1} />
        )}
      </View>
      <View ref={tab2Ref} style={[styles.tabPanel, styles.tabPanelHidden]}>
        {visited.has(2) && (
          <MemoAgentCalendar isVisible={activeTab === 2} onOpenProperty={handleOpenProperty} />
        )}
      </View>
      <View ref={tab3Ref} style={styles.tabPanel}>
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
