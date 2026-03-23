import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Image } from 'react-native';
import { useLanguage } from '../../context/LanguageContext';
import WebNotificationBell from './WebNotificationBell';

const LOGO_SVG = require('../../../assets/logo.svg');

const ACCENT  = '#3D7D82';
const ACCENT_BG = '#EAF4F5';
const ACCENT_LIGHT = '#B2D8DB';

/**
 * Базовый каркас веб-версии.
 * Только структура: Сайдбар слева, контент справа.
 */
export default function WebLayout({ children, activeTab, onTabChange, fullHeight, user }) {
  const { t } = useLanguage();
  const menuItems = [
    { id: 'dashboard',  label: t('dashboard'), emoji: '🏠' },
    { id: 'properties', label: t('base'),       emoji: '🏢' },
    { id: 'bookings',   label: t('bookings'),   emoji: '📅' },
    { id: 'contacts',   label: t('contacts'),   emoji: '👥' },
    { id: 'profile',    label: t('myAccount'),  emoji: '👤' },
  ];

  // Имя пользователя для отображения в нижней части сайдбара
  const displayName = user
    ? ([user.name, user.lastName].filter(Boolean).join(' ') || user.email || '')
    : '';
  const avatarLetter = displayName ? displayName[0].toUpperCase() : '?';
  const roleLabel = user?.workAs === 'company' ? 'Администратор' : 'Агент';

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
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.menuItem, isActive && styles.menuItemActive]}
                onPress={() => onTabChange(item.id)}
                activeOpacity={0.7}
              >
                {/* Левая цветная полоска активного пункта */}
                {isActive && <View style={styles.menuActiveStripe} />}
                <Text style={styles.menuItemEmoji}>{item.emoji}</Text>
                <Text style={[styles.menuItemText, isActive && styles.menuItemTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Колокольчик — внизу сайдбара */}
        <View style={styles.bellWrap}>
          <WebNotificationBell userId={user?.id} />
        </View>

        {/* Аватар и имя пользователя */}
        {user && (
          <View style={styles.userBlock}>
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>{avatarLetter}</Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName} numberOfLines={1}>{displayName}</Text>
              <Text style={styles.userRole}>{roleLabel}</Text>
            </View>
          </View>
        )}
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
  bellWrap: {
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
    paddingTop: 8,
    marginTop: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  menuItemActive: {
    backgroundColor: ACCENT_BG,
  },
  // Цветная полоска слева для активного пункта
  menuActiveStripe: {
    position: 'absolute',
    left: 0,
    top: 6,
    bottom: 6,
    width: 3,
    backgroundColor: ACCENT,
    borderRadius: 2,
  },
  menuItemEmoji: {
    fontSize: 16,
    width: 22,
    textAlign: 'center',
  },
  menuItemText: {
    fontSize: 14,
    color: '#495057',
    fontWeight: '500',
    flex: 1,
  },
  menuItemTextActive: {
    color: ACCENT,
    fontWeight: '700',
  },
  // Блок пользователя внизу сайдбара
  userBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 12,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
    marginTop: 4,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ACCENT_BG,
    borderWidth: 1.5,
    borderColor: ACCENT_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  userAvatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: ACCENT,
  },
  userInfo: { flex: 1, overflow: 'hidden' },
  userName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#212529',
  },
  userRole: {
    fontSize: 11,
    color: '#6C757D',
    marginTop: 1,
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
