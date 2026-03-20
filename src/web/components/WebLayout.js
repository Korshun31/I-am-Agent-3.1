import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useLanguage } from '../../context/LanguageContext';

const ACCENT  = '#3D7D82';
const ACCENT_BG = '#EAF4F5';
const ACCENT_LIGHT = '#B2D8DB';

/**
 * Базовый каркас веб-версии.
 * Только структура: Сайдбар слева, контент справа.
 */
export default function WebLayout({ children, activeTab, onTabChange, fullHeight }) {
  const { t } = useLanguage();
  const menuItems = [
    { id: 'dashboard',  label: t('dashboard') },
    { id: 'properties', label: t('base') },
    { id: 'bookings',   label: t('bookings') },
    { id: 'contacts',   label: t('contacts') },
    { id: 'profile',    label: t('myAccount') },
  ];

  return (
    <View style={styles.container}>
      {/* Sidebar */}
      <View style={styles.sidebar}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>I AM AGENT</Text>
        </View>
        
        <View style={styles.menu}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.menuItem, activeTab === item.id && styles.menuItemActive]}
              onPress={() => onTabChange(item.id)}
            >
              <Text style={[styles.menuItemText, activeTab === item.id && styles.menuItemTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Main Content Area */}
      <View style={[styles.content, fullHeight && styles.contentFull]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#F4F6F9',
  },
  sidebar: {
    width: 260,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#E9ECEF',
    padding: 20,
  },
  logoContainer: {
    marginBottom: 40,
    paddingHorizontal: 10,
  },
  logoText: {
    fontSize: 20,
    fontWeight: '800',
    color: ACCENT,
    letterSpacing: 1,
  },
  menu: {
    flex: 1,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginBottom: 5,
  },
  menuItemActive: {
    backgroundColor: ACCENT_BG,
    borderWidth: 1,
    borderColor: ACCENT_LIGHT,
  },
  menuItemText: {
    fontSize: 15,
    color: '#495057',
    fontWeight: '500',
  },
  menuItemTextActive: {
    color: ACCENT,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    padding: 40,
  },
  contentFull: {
    padding: 0,
    overflow: 'hidden',
  },
});
