import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useLanguage } from '../context/LanguageContext';

const H_PADDING = Dimensions.get('window').width * 0.05;

const TAB_KEYS = [
  { key: 'base', labelKey: 'base', color: '#FFE066E6', icon: require('../../assets/icon_base.png') },
  { key: 'bookings', labelKey: 'bookings', color: '#6FCF97E6', icon: require('../../assets/icon_bookings.png') },
  { key: 'calendar', labelKey: 'calendar', color: '#56CCF2E6', icon: require('../../assets/icon_calendar.png') },
  { key: 'account', labelKey: 'myAccount', color: '#EB5757E6', icon: require('../../assets/icon_account.png') },
];

const OVERLAP = 22;

// Светлая версия цвета вкладки для естественного выпуклого блика (не белый)
function lightenForBevel(hex, amount = 0.55) {
  const c = hex.replace('#', '').slice(0, 6);
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const lr = Math.round(r + (255 - r) * amount);
  const lg = Math.round(g + (255 - g) * amount);
  const lb = Math.round(b + (255 - b) * amount);
  return `rgba(${lr},${lg},${lb},0.55)`;
}

export default function BottomNav({ activeTab, onSelect }) {
  const { t } = useLanguage();
  return (
    <View style={styles.container}>
      {TAB_KEYS.map((tab, index) => {
        const isActive = activeTab === index;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tabWrapper,
              index > 0 && { marginLeft: -OVERLAP },
              isActive ? styles.tabWrapperActive : { zIndex: index },
            ]}
            onPress={() => onSelect(index)}
            activeOpacity={0.85}
          >
            {isActive ? (
              <View
                style={[
                  styles.tabActive,
                  {
                    backgroundColor: tab.color,
                    borderTopColor: lightenForBevel(tab.color),
                    borderLeftColor: lightenForBevel(tab.color, 0.45),
                  },
                ]}
              >
                {typeof tab.icon === 'string' ? (
                  <Text style={styles.tabActiveIcon}>{tab.icon}</Text>
                ) : (
                  <Image source={tab.icon} style={styles.tabActiveIconImage} resizeMode="contain" />
                )}
                <Text style={styles.tabActiveLabel} numberOfLines={1}>
                  {t(tab.labelKey)}
                </Text>
              </View>
            ) : (
              <View
                style={[
                  styles.tabInactiveBlock,
                  {
                    backgroundColor: tab.color,
                    borderTopColor: lightenForBevel(tab.color),
                    borderLeftColor: lightenForBevel(tab.color, 0.45),
                  },
                  index === 0 && styles.tabInactiveFirst,
                  index > 0 && styles.tabInactiveOverlap,
                  index > 0 && styles.tabShadowOverlap,
                ]}
              >
                {typeof tab.icon === 'string' ? (
                  <Text style={styles.tabInactiveIcon}>{tab.icon}</Text>
                ) : (
                  <Image source={tab.icon} style={styles.tabInactiveIconImage} resizeMode="contain" />
                )}
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: H_PADDING,
    paddingTop: 0,
    paddingBottom: 0,
    alignItems: 'flex-end',
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
  tabWrapper: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'flex-end',
    minHeight: 52,
  },
  tabWrapperActive: {
    flex: 1.28,
    zIndex: 10,
  },
  tabInactiveBlock: {
    height: 50,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    borderRightColor: 'rgba(0,0,0,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  tabInactiveFirst: {
    borderTopLeftRadius: 20,
  },
  tabInactiveOverlap: {
    borderTopLeftRadius: 16,
  },
  tabShadowOverlap: {
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  tabInactiveIcon: {
    fontSize: 24,
  },
  tabInactiveIconImage: {
    width: 28,
    height: 28,
  },
  tabActive: {
    minHeight: 62,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -12,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.12)',
    borderRightColor: 'rgba(0,0,0,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 5,
    elevation: 5,
  },
  tabActiveIcon: {
    fontSize: 34,
    marginBottom: 4,
  },
  tabActiveIconImage: {
    width: 41,
    height: 41,
    marginBottom: 4,
  },
  tabActiveLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2C2C2C',
  },
});
