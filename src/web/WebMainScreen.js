import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import WebLayout from './components/WebLayout';
import WebDashboardScreen from './screens/WebDashboardScreen';

/**
 * Точка входа в веб-интерфейс.
 * Управляет переключением вкладок.
 */
export default function WebMainScreen({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <WebDashboardScreen user={user} />;
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
    <WebLayout activeTab={activeTab} onTabChange={setActiveTab}>
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
