import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import BottomNav from '../components/BottomNav';
import RealEstateScreen from '../screens/RealEstateScreen';
import BookingCalendarScreen from '../screens/BookingCalendarScreen';
import AgentCalendarScreen from '../screens/AgentCalendarScreen';
import AccountScreen from '../screens/AccountScreen';
import ContactsScreen from '../screens/ContactsScreen';
import StatisticsScreen from '../screens/StatisticsScreen';
import CompanyScreen from '../screens/CompanyScreen';
import TeamScreen from '../screens/TeamScreen';

const Tab = createBottomTabNavigator();
const AccountStack = createNativeStackNavigator();

function CustomTabBar({ state, navigation }) {
  return (
    <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
      <BottomNav
        activeTab={state.index}
        onSelect={(index) => {
          const route = state.routes[index];
          navigation.jumpTo(route.name);
        }}
      />
    </View>
  );
}

function AccountNavigator({ onLogout, onUserUpdate }) {
  return (
    <AccountStack.Navigator screenOptions={{ headerShown: false }}>
      <AccountStack.Screen
        name="Account"
        children={(props) => (
          <AccountScreen
            {...props}
            onLogout={onLogout}
            onUserUpdate={onUserUpdate}
            onOpenCompany={() => props.navigation.navigate('Company')}
            onOpenContacts={() => props.navigation.navigate('Contacts')}
            onOpenStatistics={() => props.navigation.navigate('Statistics')}
          />
        )}
      />
      <AccountStack.Screen
        name="Contacts"
        children={(props) => (
          <ContactsScreen onBack={() => props.navigation.goBack()} />
        )}
      />
      <AccountStack.Screen
        name="Statistics"
        children={(props) => (
          <StatisticsScreen onBack={() => props.navigation.goBack()} />
        )}
      />
      <AccountStack.Screen
        name="Company"
        children={(props) => (
          <CompanyScreen
            onBack={() => props.navigation.goBack()}
            onUserUpdate={onUserUpdate}
            onOpenTeam={() => props.navigation.navigate('Team')}
          />
        )}
      />
      <AccountStack.Screen
        name="Team"
        children={(props) => (
          <TeamScreen onBack={() => props.navigation.goBack()} />
        )}
      />
    </AccountStack.Navigator>
  );
}

// Прогрев экранов в фоне сразу после логина: PNG-иконки декодятся, модалки
// парсятся, нативные модули инициализируются, Animated.Values создаются.
// Когда юзер первый раз открывает вкладку или внутренний экран — настоящий
// инстанс монтируется мгновенно, потому что ресурсы уже в кэше React Native.
const NOOP = () => {};
function ScreenWarmers() {
  return (
    <View
      style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <AccountScreen
        onLogout={NOOP}
        onUserUpdate={NOOP}
        onOpenCompany={NOOP}
        onOpenContacts={NOOP}
        onOpenStatistics={NOOP}
        isVisible={false}
      />
      <ContactsScreen onBack={NOOP} />
      <StatisticsScreen onBack={NOOP} />
      <CompanyScreen onBack={NOOP} onUserUpdate={NOOP} onOpenTeam={NOOP} />
      <TeamScreen onBack={NOOP} />
    </View>
  );
}

export default function MainNavigator({ onLogout, onUserUpdate }) {
  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        lazy={false}
        detachInactiveScreens={false}
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#F5F2EB' },
        }}
      >
        <Tab.Screen name="RealEstate" component={RealEstateScreen} />
        <Tab.Screen name="Bookings" component={BookingCalendarScreen} />
        <Tab.Screen name="Calendar" component={AgentCalendarScreen} />
        <Tab.Screen
          name="Account"
          children={() => (
            <AccountNavigator onLogout={onLogout} onUserUpdate={onUserUpdate} />
          )}
        />
      </Tab.Navigator>
      <ScreenWarmers />
    </View>
  );
}
