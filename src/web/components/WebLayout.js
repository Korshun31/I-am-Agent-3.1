import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Image } from 'react-native';
import { useLanguage } from '../../context/LanguageContext';

const LOGO_SVG = require('../../../assets/logo.svg');

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
        <TouchableOpacity 
          style={styles.logoContainer} 
          onPress={() => onTabChange('dashboard')}
          activeOpacity={0.7}
        >
          <Image 
            source={LOGO_SVG} 
            style={styles.logoImage} 
            resizeMode="contain"
          />
          <Text style={styles.logoText}>I am Agent</Text>
        </TouchableOpacity>
        
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
    paddingTop: 20,
  },
  logoContainer: {
    marginBottom: 20,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  logoImage: {
    width: 60,
    height: 40,
    marginBottom: 4,
  },
  logoText: {
    fontSize: 14,
    fontWeight: '800',
    color: ACCENT,
    letterSpacing: 1.2,
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
