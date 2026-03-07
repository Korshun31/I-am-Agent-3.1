import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BottomNav from '../components/BottomNav';
import AccountScreen from './AccountScreen';
import ContactsScreen from './ContactsScreen';
import RealEstateScreen from './RealEstateScreen';

const TAB_NAMES = [
  'База недвижимости',
  'Календарь бронирования',
  'Календарь агента',
  'Личный кабинет',
];

export default function MainScreen({ onLogout, user, onUserUpdate }) {
  // После входа/регистрации открывается профиль агента (красная вкладка)
  const [activeTab, setActiveTab] = useState(3);
  const [screenWithinAccount, setScreenWithinAccount] = useState('account'); // 'account' | 'contacts'

  return (
    <View style={styles.container}>
      <View style={[styles.tabPanel, activeTab !== 0 && styles.tabPanelHidden]}>
        <RealEstateScreen />
      </View>
      <View style={[styles.tabPanel, activeTab !== 3 && styles.tabPanelHidden]}>
        {screenWithinAccount === 'contacts' ? (
          <ContactsScreen onBack={() => setScreenWithinAccount('account')} />
        ) : (
          <AccountScreen
            onLogout={onLogout}
            user={user || {}}
            onUserUpdate={onUserUpdate}
            onOpenContacts={() => setScreenWithinAccount('contacts')}
          />
        )}
      </View>
      <View style={[styles.tabPanel, (activeTab !== 1 && activeTab !== 2) && styles.tabPanelHidden]}>
        <View style={styles.content}>
          <Text style={styles.placeholder}>{TAB_NAMES[activeTab]}</Text>
          <Text style={styles.hint}>Дизайн экрана будет добавлен позже</Text>
        </View>
      </View>
      <View style={styles.navOverlay} pointerEvents="box-none">
        <BottomNav activeTab={activeTab} onSelect={setActiveTab} />
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
