import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BottomNav from '../components/BottomNav';
import AccountScreen from './AccountScreen';
import ContactsScreen from './ContactsScreen';
import RealEstateScreen from './RealEstateScreen';
import BookingCalendarScreen from './BookingCalendarScreen';
import AgentCalendarScreen from './AgentCalendarScreen';

export default function MainScreen({ onLogout, user, onUserUpdate }) {
  const [activeTab, setActiveTab] = useState(3);
  const [screenWithinAccount, setScreenWithinAccount] = useState('account');
  const [propertyToOpen, setPropertyToOpen] = useState(null);

  const handleOpenProperty = (property) => {
    if (property) {
      setPropertyToOpen(property);
      setActiveTab(0);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.tabPanel, activeTab !== 0 && styles.tabPanelHidden]}>
        <RealEstateScreen propertyToOpen={propertyToOpen} onPropertyOpened={() => setPropertyToOpen(null)} />
      </View>
      <View style={[styles.tabPanel, activeTab !== 1 && styles.tabPanelHidden]}>
        <BookingCalendarScreen isVisible={activeTab === 1} />
      </View>
      <View style={[styles.tabPanel, activeTab !== 2 && styles.tabPanelHidden]}>
        <AgentCalendarScreen isVisible={activeTab === 2} onOpenProperty={handleOpenProperty} />
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
