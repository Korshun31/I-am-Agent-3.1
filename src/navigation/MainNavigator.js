import React, { useCallback } from 'react';
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

const Tab = createBottomTabNavigator();
const AccountStack = createNativeStackNavigator();

// CustomTabBar — обёртка React Navigation tabBar prop.
// Рендерит BottomNav с реальными state/navigation из навигатора.
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
          />
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
      <CompanyScreen onBack={NOOP} onUserUpdate={NOOP} />
    </View>
  );
}

function MainNavigator({ onLogout, onUserUpdate }) {
  // Стабильная ссылка на render-функцию вкладки Account: без useCallback
  // на каждом ре-рендере MainNavigator React Navigation видела бы новую
  // функцию children и пересоздавала AccountNavigator (с потерей места
  // во внутреннем стеке — например, открытый CompanyScreen откатывался бы).
  const renderAccountTab = useCallback(
    () => <AccountNavigator onLogout={onLogout} onUserUpdate={onUserUpdate} />,
    [onLogout, onUserUpdate]
  );

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        lazy={false}
        detachInactiveScreens={false}
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#F5F2EB' },
          // freezeOnBlur: неактивные вкладки заморожены — смонтированы и готовы
          // показаться мгновенно, но React не обновляет их JSX пока они не в фокусе.
          // Это снимает каскад ре-рендеров от изменений в контекстах данных.
          freezeOnBlur: true,
        }}
      >
        <Tab.Screen name="RealEstate" component={RealEstateScreen} />
        <Tab.Screen name="Bookings" component={BookingCalendarScreen} />
        <Tab.Screen name="Calendar" component={AgentCalendarScreen} />
        <Tab.Screen name="Account" children={renderAccountTab} />
      </Tab.Navigator>

      <ScreenWarmers />
    </View>
  );
}

export default React.memo(MainNavigator);
