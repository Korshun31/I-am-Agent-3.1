import React, { useState, useCallback, memo, useRef, startTransition } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import BottomNav from '../components/BottomNav';
import TabLoadingOverlay from '../components/TabLoadingOverlay';
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

  // Lazy rendering — монтируем экран только при первом визите
  const visitedRef = useRef(new Set([3]));
  const [visited, setVisited] = useState(new Set([3]));
  const activeTabRef = useRef(3);

  // ─── Animated.Value для opacity вкладок ─────────────────────────────────────
  // В отличие от setNativeProps, React НЕ перезаписывает animated opacity
  // при ре-рендерах. setValue() мгновенно меняет нативный слой.
  const tabOpacities = useRef([
    new Animated.Value(0), // База      — скрыта
    new Animated.Value(0), // Бронирования — скрыта
    new Animated.Value(0), // Календарь  — скрыт
    new Animated.Value(1), // Аккаунт   — виден по умолчанию
  ]).current;

  // Opacity прелоадеров
  const overlayOpacities = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  // pointerEvents — какая вкладка принимает касания.
  // Обновляется срочно (не через startTransition), чтобы не блокировать ввод.
  const [interactiveTab, setInteractiveTab] = useState(3);

  // ─── Прелоадеры ────────────────────────────────────────────────────────────
  const showOverlay = useCallback((i) => {
    if (i < 3) overlayOpacities[i].setValue(1);
  }, []);

  const hideOverlay = useCallback((i) => {
    if (i < 3) overlayOpacities[i].setValue(0);
  }, []);

  const handleTab0Ready = useCallback(() => hideOverlay(0), [hideOverlay]);
  const handleTab1Ready = useCallback(() => hideOverlay(1), [hideOverlay]);
  const handleTab2Ready = useCallback(() => hideOverlay(2), [hideOverlay]);

  // ─── Навигация к объекту ───────────────────────────────────────────────────
  const handleOpenProperty = useCallback((property) => {
    if (!property) return;
    const prevTab = activeTabRef.current;
    if (prevTab !== 0) {
      tabOpacities[prevTab].setValue(0);
      tabOpacities[0].setValue(1);
    }
    activeTabRef.current = 0;

    if (!visitedRef.current.has(0)) showOverlay(0);

    setPropertyToOpen(property);
    setInteractiveTab(0); // срочно — чтобы вкладка сразу принимала касания

    startTransition(() => {
      setActiveTab(0);
      if (!visitedRef.current.has(0)) {
        visitedRef.current = new Set([...visitedRef.current, 0]);
        setVisited(new Set(visitedRef.current));
      }
    });
  }, [showOverlay]);

  const handlePropertyOpened = useCallback(() => setPropertyToOpen(null), []);

  // ─── Переключение вкладок ──────────────────────────────────────────────────
  const handleTabSelect = useCallback((newIndex) => {
    const prevTab = activeTabRef.current;
    if (prevTab === newIndex) return;

    // 1. Мгновенное переключение opacity через Animated.Value
    //    (React не перезапишет это при ре-рендере — в отличие от setNativeProps)
    tabOpacities[prevTab].setValue(0);
    tabOpacities[newIndex].setValue(1);
    activeTabRef.current = newIndex;

    // 2. Показываем прелоадер при первом визите
    if (!visitedRef.current.has(newIndex)) {
      showOverlay(newIndex);
    }

    // 3. Срочно обновляем pointerEvents, чтобы вкладка сразу принимала касания
    setInteractiveTab(newIndex);

    // 4. Несрочные обновления React-состояния — в фоне
    startTransition(() => {
      if (prevTab === 3) setScreenWithinAccount('account');
      setActiveTab(newIndex);
      if (!visitedRef.current.has(newIndex)) {
        visitedRef.current = new Set([...visitedRef.current, newIndex]);
        setVisited(new Set(visitedRef.current));
      }
    });
  }, [showOverlay]);

  return (
    <View style={styles.container}>

      {/* ── База ─────────────────────────────────────────────────────── */}
      <Animated.View
        style={[styles.tabPanel, { opacity: tabOpacities[0] }]}
        pointerEvents={interactiveTab === 0 ? 'auto' : 'none'}
      >
        {visited.has(0) && (
          <MemoRealEstate
            propertyToOpen={propertyToOpen}
            onPropertyOpened={handlePropertyOpened}
            isVisible={activeTab === 0}
            onReady={handleTab0Ready}
            user={user}
          />
        )}
        <TabLoadingOverlay opacity={overlayOpacities[0]} />
      </Animated.View>

      {/* ── Бронирования ─────────────────────────────────────────────── */}
      <Animated.View
        style={[styles.tabPanel, { opacity: tabOpacities[1] }]}
        pointerEvents={interactiveTab === 1 ? 'auto' : 'none'}
      >
        {visited.has(1) && (
          <MemoBookingCalendar isVisible={activeTab === 1} onReady={handleTab1Ready} user={user} />
        )}
        <TabLoadingOverlay opacity={overlayOpacities[1]} />
      </Animated.View>

      {/* ── Календарь ────────────────────────────────────────────────── */}
      <Animated.View
        style={[styles.tabPanel, { opacity: tabOpacities[2] }]}
        pointerEvents={interactiveTab === 2 ? 'auto' : 'none'}
      >
        {visited.has(2) && (
          <MemoAgentCalendar
            isVisible={activeTab === 2}
            onOpenProperty={handleOpenProperty}
            onReady={handleTab2Ready}
            user={user}
          />
        )}
        <TabLoadingOverlay opacity={overlayOpacities[2]} />
      </Animated.View>

      {/* ── Аккаунт ──────────────────────────────────────────────────── */}
      <Animated.View
        style={[styles.tabPanel, { opacity: tabOpacities[3] }]}
        pointerEvents={interactiveTab === 3 ? 'auto' : 'none'}
      >
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
      </Animated.View>

      {/* ── Нижняя навигация (всегда поверх) ─────────────────────────── */}
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
  navOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
